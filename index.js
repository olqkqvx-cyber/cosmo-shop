require("dotenv").config();

const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder
} = require("discord.js");

const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");

const DATA_FILE = path.join(__dirname, "data.json");

const CATEGORIES = {
  gry: { name: "Gry", emoji: "🎮" },
  konta: { name: "Konta", emoji: "👤" },
  premium: { name: "Premium", emoji: "💎" },
  inne: { name: "Inne", emoji: "📦" }
};

function loadData() {
  try {
    const data = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));

    if (!Array.isArray(data.products)) {
      data.products = [];
    }

    if (!Array.isArray(data.orders)) {
      data.orders = [];
    }

    for (const product of data.products) {
      if (!product.category) {
        product.category = "inne";
      }
    }

    return data;
  } catch {
    return {
      products: [],
      orders: []
    };
  }
}

function saveData(data) {
  fs.writeFileSync(
    DATA_FILE,
    JSON.stringify(data, null, 2),
    "utf8"
  );
}

function cleanName(name) {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9-_]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40) || "klient";
}

const commands = [
  new SlashCommandBuilder()
    .setName("sklep")
    .setDescription("Pokazuje produkty w sklepie."),

  new SlashCommandBuilder()
    .setName("produkty")
    .setDescription("Pokazuje produkty w sklepie."),

  new SlashCommandBuilder()
    .setName("produkt-dodaj")
    .setDescription("Dodaje produkt do sklepu.")
    .addStringOption(o =>
      o
        .setName("nazwa")
        .setDescription("Nazwa produktu")
        .setRequired(true)
    )
    .addNumberOption(o =>
      o
        .setName("cena")
        .setDescription("Cena produktu")
        .setRequired(true)
        .setMinValue(0)
    )
    .addStringOption(o =>
      o
        .setName("kategoria")
        .setDescription("Kategoria produktu")
        .setRequired(true)
        .addChoices(
          { name: "🎮 Gry", value: "gry" },
          { name: "👤 Konta", value: "konta" },
          { name: "💎 Premium", value: "premium" },
          { name: "📦 Inne", value: "inne" }
        )
    )
    .addStringOption(o =>
      o
        .setName("opis")
        .setDescription("Opis produktu")
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  new SlashCommandBuilder()
    .setName("produkt-usun")
    .setDescription("Usuwa produkt ze sklepu.")
    .addIntegerOption(o =>
      o
        .setName("id")
        .setDescription("ID produktu")
        .setRequired(true)
        .setMinValue(1)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  new SlashCommandBuilder()
    .setName("zamow")
    .setDescription("Tworzy zamówienie na produkt.")
    .addIntegerOption(o =>
      o
        .setName("id")
        .setDescription("ID produktu")
        .setRequired(true)
        .setMinValue(1)
    ),

  new SlashCommandBuilder()
    .setName("zamowienia")
    .setDescription("Pokazuje ostatnie zamówienia.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  new SlashCommandBuilder()
    .setName("panel-zakup")
    .setDescription("Tworzy panel zakupowy.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
].map(c => c.toJSON());

async function registerCommands() {
  const rest = new REST({ version: "10" })
    .setToken(process.env.DISCORD_TOKEN);

  const route = process.env.GUILD_ID
    ? Routes.applicationGuildCommands(
        process.env.CLIENT_ID,
        process.env.GUILD_ID
      )
    : Routes.applicationCommands(
        process.env.CLIENT_ID
      );

  await rest.put(route, {
    body: commands
  });

  console.log("Komendy slash zostały zarejestrowane.");
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds
  ]
});

client.once("ready", () => {
  console.log(`Zalogowano jako ${client.user.tag}`);
  console.log("Cosmo Shøp - Bot jest online.");
});

client.on("interactionCreate", async interaction => {
  try {
    const data = loadData();
    const guildId = interaction.guildId;

    // =========================
    // SLASH COMMANDS
    // =========================

    if (interaction.isChatInputCommand()) {

      // /sklep
      if (
        interaction.commandName === "sklep" ||
        interaction.commandName === "produkty"
      ) {
        const products = data.products.filter(
          p => p.guildId === guildId
        );

        if (!products.length) {
          return interaction.reply(
            "🛒 Sklep jest obecnie pusty."
          );
        }

        const description = products
          .map(p => {
            const category =
              CATEGORIES[p.category]?.name || "Inne";

            return (
              `**#${p.id} — ${p.name}**\n` +
              `${p.description || "Brak opisu"}\n` +
              `📁 ${category}\n` +
              `💰 **${p.price.toFixed(2)} zł**`
            );
          })
          .join("\n\n");

        const embed = new EmbedBuilder()
          .setTitle("🛍️ Cosmo Shøp")
          .setDescription(description.slice(0, 4096));

        return interaction.reply({
          embeds: [embed]
        });
      }

      // /produkt-dodaj
      if (interaction.commandName === "produkt-dodaj") {
        const name = interaction.options.getString("nazwa");
        const price = interaction.options.getNumber("cena");
        const category =
          interaction.options.getString("kategoria");
        const description =
          interaction.options.getString("opis") || "";

        const guildProducts = data.products.filter(
          p => p.guildId === guildId
        );

        const nextId = guildProducts.length
          ? Math.max(...guildProducts.map(p => p.id)) + 1
          : 1;

        data.products.push({
          id: nextId,
          guildId,
          name,
          price,
          category,
          description,
          createdAt: new Date().toISOString()
        });

        saveData(data);

        return interaction.reply(
          `✅ Dodano produkt **#${nextId} — ${name}** za **${price.toFixed(2)} zł**.`
        );
      }

      // /produkt-usun
      if (interaction.commandName === "produkt-usun") {
        const id = interaction.options.getInteger("id");

        const index = data.products.findIndex(
          p =>
            p.guildId === guildId &&
            p.id === id
        );

        if (index === -1) {
          return interaction.reply({
            content: "❌ Nie znaleziono takiego produktu.",
            ephemeral: true
          });
        }

        const removed = data.products.splice(index, 1)[0];

        saveData(data);

        return interaction.reply(
          `🗑️ Usunięto produkt **#${removed.id} — ${removed.name}**.`
        );
      }

      // /zamow
      if (interaction.commandName === "zamow") {
        const id = interaction.options.getInteger("id");

        const product = data.products.find(
          p =>
            p.guildId === guildId &&
            p.id === id
        );

        if (!product) {
          return interaction.reply({
            content: "❌ Nie znaleziono takiego produktu.",
            ephemeral: true
          });
        }

        const orderId = data.orders.length
          ? Math.max(...data.orders.map(o => o.id)) + 1
          : 1;

        data.orders.push({
          id: orderId,
          guildId,
          userId: interaction.user.id,
          productId: product.id,
          productName: product.name,
          price: product.price,
          status: "nowe",
          createdAt: new Date().toISOString()
        });

        saveData(data);

        return interaction.reply(
          `✅ Utworzono zamówienie **#${orderId}** na **${product.name}** za **${product.price.toFixed(2)} zł**.`
        );
      }

      // /zamowienia
      if (interaction.commandName === "zamowienia") {
        const orders = data.orders
          .filter(o => o.guildId === guildId)
          .slice(-15)
          .reverse();

        if (!orders.length) {
          return interaction.reply("📦 Brak zamówień.");
        }

        const text = orders
          .map(o =>
            `**#${o.id}** — <@${o.userId}> — ${o.productName} — **${o.price.toFixed(2)} zł** — \`${o.status}\``
          )
          .join("\n");

        return interaction.reply({
          content:
            `📦 **Ostatnie zamówienia**\n${text}`
        });
      }

     // panel-zakup
if (interaction.commandName === "panel-zakup") {
    const embed = new EmbedBuilder()
        .setTitle("🛍️ Cosmo Shøp × STWÓRZ TICKET")
        .setDescription(
            "Chcesz coś kupić lub potrzebujesz pomocy?\n\n" +
            "🎫 **Wybierz rodzaj ticketu poniżej.**"
        )
        .setFooter({
            text: "Cosmo Shøp • System ticketów"
        });

    const menu = new StringSelectMenuBuilder()
        .setCustomId("wybierz_ticket")
        .setPlaceholder("🎫 Wybierz rodzaj ticketu")
        .addOptions(
            new StringSelectMenuOptionBuilder()
                .setLabel("Chcę kupić produkt")
                .setDescription("Przejdź do sklepu i wybierz produkt")
                .setEmoji("🛒")
                .setValue("kupno"),

            new StringSelectMenuOptionBuilder()
                .setLabel("Potrzebuję pomocy")
                .setDescription("Utwórz ticket i skontaktuj się z obsługą")
                .setEmoji("🆘")
                .setValue("pomoc")
        );

    const row = new ActionRowBuilder()
        .addComponents(menu);

    return interaction.reply({
        embeds: [embed],
        components: [row]
    });
}

    // =========================
    // BUTTONY
    // =========================

    if (interaction.isButton()) {

      // Otwieranie sklepu
      if (interaction.customId === "potrzebuje_pomocy") {
    const staffRole = interaction.guild.roles.cache.find(
        role => role.name.toLowerCase() === "obsługa"
    );

    if (!staffRole) {
        return interaction.reply({
            content: "❌ Nie znaleziono roli `Obsługa`.",
            ephemeral: true
        });
    }

    const username = cleanName(interaction.user.username);

    await interaction.deferReply({ ephemeral: true });

    const ticketCategory = await interaction.guild.channels.create({
        name: `🆘 POMOC - ${username}`.slice(0, 100),
        type: ChannelType.GuildCategory,
        permissionOverwrites: [
            {
                id: interaction.guild.roles.everyone.id,
                deny: ["ViewChannel"]
            },
            {
                id: interaction.user.id,
                allow: [
                    "ViewChannel",
                    "SendMessages",
                    "ReadMessageHistory",
                    "AttachFiles"
                ]
            },
            {
                id: staffRole.id,
                allow: [
                    "ViewChannel",
                    "SendMessages",
                    "ReadMessageHistory",
                    "AttachFiles"
                ]
            }
        ]
    });

    const ticketChannel = await interaction.guild.channels.create({
        name: `🆘・pomoc-${username}`.slice(0, 100),
        type: ChannelType.GuildText,
        parent: ticketCategory.id,
        permissionOverwrites: [
            {
                id: interaction.guild.roles.everyone.id,
                deny: ["ViewChannel"]
            },
            {
                id: interaction.user.id,
                allow: [
                    "ViewChannel",
                    "SendMessages",
                    "ReadMessageHistory",
                    "AttachFiles"
                ]
            },
            {
                id: staffRole.id,
                allow: [
                    "ViewChannel",
                    "SendMessages",
                    "ReadMessageHistory",
                    "AttachFiles"
                ]
            }
        ]
    });

    const helpEmbed = new EmbedBuilder()
        .setTitle("🆘 Cosmo Shøp × Pomoc")
        .setDescription(
            `Witaj <@${interaction.user.id}>!\n\n` +
            `Napisz tutaj, w czym potrzebujesz pomocy.\n` +
            `Obsługa Cosmo Shøp odpowie tak szybko, jak to możliwe.`
        )
        .setFooter({
            text: "Cosmo Shøp • Centrum pomocy"
        });

    await ticketChannel.send({
        content: `<@${interaction.user.id}> <@&${staffRole.id}>`,
        embeds: [helpEmbed]
    });

    await interaction.editReply({
        content: `✅ Utworzono ticket pomocy: ${ticketChannel}`
    });

    return;
} if (interaction.customId === "otworz_sklep") {
        const products = data.products.filter(
          p => p.guildId === guildId
        );

        if (!products.length) {
          return interaction.reply({
            content: "🛒 Sklep jest obecnie pusty.",
            ephemeral: true
          });
        }

        const availableCategories =
          [...new Set(
            products.map(p => p.category || "inne")
          )];

        const menu = new StringSelectMenuBuilder()
          .setCustomId("wybierz_kategorie")
          .setPlaceholder("📁 Wybierz kategorię");

        for (const categoryId of availableCategories) {
          const category =
            CATEGORIES[categoryId] || CATEGORIES.inne;

          menu.addOptions(
            new StringSelectMenuOptionBuilder()
              .setLabel(category.name)
              .setValue(categoryId)
              .setEmoji(category.emoji)
          );
        }

        const row = new ActionRowBuilder()
          .addComponents(menu);

        return interaction.reply({
          content: "🛒 **Wybierz kategorię produktu:**",
          components: [row],
          ephemeral: true
        });
      }

      // Płatność
      if (interaction.customId === "platnosc") {
        return interaction.reply({
          content:
            "💳 **Płatność**\n\n" +
            "Skontaktuj się z obsługą w tym tickecie " +
            "i ustal metodę płatności.",
          ephemeral: true
        });
      }

      // Zamówienie gotowe
      if (interaction.customId === "zamowienie_gotowe") {
        if (
          !interaction.memberPermissions?.has(
            PermissionFlagsBits.ManageGuild
          )
        ) {
          return interaction.reply({
            content:
              "❌ Tylko obsługa sklepu może oznaczyć zamówienie jako gotowe.",
            ephemeral: true
          });
        }

        return interaction.reply(
          "📦 **Zamówienie gotowe!**\n\n" +
          "Produkt został przekazany klientowi.\n" +
          "♾️ Produkt nadal pozostaje dostępny w sklepie."
        );
      }

      // Zamknięcie ticketu
      if (interaction.customId === "zamknij_ticket") {
        if (
          !interaction.memberPermissions?.has(
            PermissionFlagsBits.ManageGuild
          )
        ) {
          return interaction.reply({
            content:
              "❌ Tylko obsługa sklepu może zamknąć ticket.",
            ephemeral: true
          });
        }

        await interaction.reply(
          "🔒 Ticket zostanie zamknięty za 3 sekundy..."
        );

        const channel = interaction.channel;
        const parent = channel.parent;

        setTimeout(async () => {
          try {
            await channel.delete();

            if (
              parent &&
              parent.type === ChannelType.GuildCategory
            ) {
              const freshParent =
                await interaction.guild.channels.fetch(parent.id)
                  .catch(() => null);

              if (
                freshParent &&
                freshParent.children.cache.size === 0
              ) {
                await freshParent.delete().catch(() => {});
              }
            }
          } catch (error) {
            console.error(
              "Nie udało się zamknąć ticketu:",
              error
            );
          }
        }, 3000);

        return;
      }
    }

    // =========================
    // SELECT MENU
    // =========================

    if (!products.length) {
// Wybór rodzaju ticketu
if (interaction.customId === "wybierz_ticket") {

    const wybor = interaction.values[0];

    // 🛒 KUP PRODUKT
    if (wybor === "kupno") {

        const products = data.products.filter(
            p => p.guildId === guildId
        );

        if (!products.length) {
            return interaction.update({
                content: "❌ Sklep jest obecnie pusty.",
                components: []
            });
        }

        const availableCategories = [
            ...new Set(
                products.map(p => p.category || "inne")
            )
        ];

        const menu = new StringSelectMenuBuilder()
            .setCustomId("wybierz_kategorie")
            .setPlaceholder("🛒 Wybierz kategorię");

        for (const categoryId of availableCategories) {

            const category =
                CATEGORIES[categoryId] || CATEGORIES.inne;

            menu.addOptions(
                new StringSelectMenuOptionBuilder()
                    .setLabel(category.name)
                    .setValue(categoryId)
                    .setEmoji(category.emoji)
            );
        }

        const row = new ActionRowBuilder()
            .addComponents(menu);

        return interaction.update({
            content: "🛒 **Wybierz kategorię produktu:**",
            components: [row]
        });
    }

    // 🆘 POTRZEBUJĘ POMOCY
    if (wybor === "pomoc") {

        const staffRole = interaction.guild.roles.cache.find(
            role => role.name.toLowerCase() === "obsługa"
        );

        if (!staffRole) {
            return interaction.update({
                content: "❌ Nie znaleziono roli `Obsługa`.",
                components: []
            });
        }

        const username = cleanName(interaction.user.username);

        await interaction.deferUpdate();

        const ticketCategory = await interaction.guild.channels.create({
            name: `🆘 POMOC - ${username}`.slice(0, 100),
            type: ChannelType.GuildCategory,
            permissionOverwrites: [
                {
                    id: interaction.guild.roles.everyone.id,
                    deny: ["ViewChannel"]
                },
                {
                    id: interaction.user.id,
                    allow: [
                        "ViewChannel",
                        "SendMessages",
                        "ReadMessageHistory",
                        "AttachFiles"
                    ]
                },
                {
                    id: staffRole.id,
                    allow: [
                        "ViewChannel",
                        "SendMessages",
                        "ReadMessageHistory",
                        "AttachFiles"
                    ]
                }
            ]
        });

        const ticketChannel = await interaction.guild.channels.create({
            name: `🆘・pomoc-${username}`.slice(0, 100),
            type: ChannelType.GuildText,
            parent: ticketCategory.id,
            permissionOverwrites: [
                {
                    id: interaction.guild.roles.everyone.id,
                    deny: ["ViewChannel"]
                },
                {
                    id: interaction.user.id,
                    allow: [
                        "ViewChannel",
                        "SendMessages",
                        "ReadMessageHistory",
                        "AttachFiles"
                    ]
                },
                {
                    id: staffRole.id,
                    allow: [
                        "ViewChannel",
                        "SendMessages",
                        "ReadMessageHistory",
                        "AttachFiles"
                    ]
                }
            ]
        });

        const embed = new EmbedBuilder()
            .setTitle("🆘 Potrzebujesz pomocy?")
            .setDescription(
                `Witaj ${interaction.user}!\n\n` +
                "Opisz tutaj dokładnie, w czym potrzebujesz pomocy. " +
                "Obsługa odpowie tak szybko, jak to możliwe."
            )
            .setFooter({
                text: "Cosmo Shøp • Pomoc"
            });

        const closeButton = new ButtonBuilder()
            .setCustomId("zamknij_ticket")
            .setLabel("Zamknij ticket")
            .setEmoji("🔒")
            .setStyle(ButtonStyle.Danger);

        const row = new ActionRowBuilder()
            .addComponents(closeButton);

        await ticketChannel.send({
            content: `${interaction.user} <@&${staffRole.id}>`,
            embeds: [embed],
            components: [row]
        });

        await interaction.editReply({
            content: `✅ Utworzono ticket pomocy: ${ticketChannel}`,
            components: []
        });
    }

    return;
}
      // Wybór kategorii
      if (
        interaction.customId === "wybierz_kategorie"
      ) {
        const categoryId =
          interaction.values[0];

        const products = data.products.filter(
          p =>
            p.guildId === guildId &&
            (p.category || "inne") === categoryId
        );

        if (!products.length) {
          return interaction.update({
            content:
              "❌ W tej kategorii nie ma produktów.",
            components: []
          });
        }

        const category =
          CATEGORIES[categoryId] || CATEGORIES.inne;

        const menu = new StringSelectMenuBuilder()
          .setCustomId(
            `wybierz_produkt_${categoryId}`
          )
          .setPlaceholder(
            `${category.emoji} Wybierz produkt`
          );

        for (const product of products.slice(0, 25)) {
          menu.addOptions(
            new StringSelectMenuOptionBuilder()
              .setLabel(
                `${product.name} — ${product.price.toFixed(2)} zł`
                  .slice(0, 100)
              )
              .setDescription(
                (product.description ||
                  "Brak opisu").slice(0, 100)
              )
              .setValue(String(product.id))
          );
        }

        const row = new ActionRowBuilder()
          .addComponents(menu);

        return interaction.update({
          content:
            `${category.emoji} **${category.name}**\n\nWybierz produkt:`,
          components: [row]
        });
      }

      // Wybór produktu
      if (
        interaction.customId.startsWith(
          "wybierz_produkt_"
        )
      ) {
        const productId = Number(
          interaction.values[0]
        );

        const product = data.products.find(
          p =>
            p.guildId === guildId &&
            p.id === productId
        );

        if (!product) {
          return interaction.update({
            content:
              "❌ Nie znaleziono tego produktu.",
            components: []
          });
        }

        const staffRole =
          interaction.guild.roles.cache.find(
            role =>
              role.name.toLowerCase() ===
              "obsługa"
          );

        if (!staffRole) {
          return interaction.update({
            content:
              "❌ Nie znaleziono roli **Obsługa**. Utwórz rolę o dokładnej nazwie `Obsługa`.",
            components: []
          });
        }

        const username = cleanName(
  interaction.user.username
);

await interaction.deferUpdate();

// Tworzymy osobną kategorię dla każdego ticketu
const ticketCategory =
  await interaction.guild.channels.create({
            name: `🛒 ZAKUP - ${username}`.slice(0, 100),
            type: ChannelType.GuildCategory,
            permissionOverwrites: [
              {
                id: interaction.guild.roles.everyone.id,
                deny: ["ViewChannel"]
              },
              {
                id: interaction.user.id,
                allow: [
                  "ViewChannel",
                  "SendMessages",
                  "ReadMessageHistory",
                  "AttachFiles"
                ]
              },
              {
                id: staffRole.id,
                allow: [
                  "ViewChannel",
                  "SendMessages",
                  "ReadMessageHistory",
                  "ManageChannels",
                  "AttachFiles"
                ]
              }
            ]
          });

        const ticketChannel =
          await interaction.guild.channels.create({
            name: `🛒・zakup-${username}`.slice(0, 100),
            type: ChannelType.GuildText,
            parent: ticketCategory.id,
            permissionOverwrites: [
              {
                id: interaction.guild.roles.everyone.id,
                deny: ["ViewChannel"]
              },
              {
                id: interaction.user.id,
                allow: [
                  "ViewChannel",
                  "SendMessages",
                  "ReadMessageHistory",
                  "AttachFiles"
                ]
              },
              {
                id: staffRole.id,
                allow: [
                  "ViewChannel",
                  "SendMessages",
                  "ReadMessageHistory",
                  "ManageChannels",
                  "AttachFiles"
                ]
              }
            ]
          });

        const embed = new EmbedBuilder()
          .setTitle("🛒 Nowe zamówienie")
          .setDescription(
            "Witaj w swoim tickecie zakupowym!\n\n" +
            "Obsługa sklepu zajmie się Twoim zamówieniem."
          )
          .addFields(
            {
              name: "👤 Klient",
              value: `<@${interaction.user.id}>`,
              inline: true
            },
            {
              name: "📦 Produkt",
              value: product.name,
              inline: true
            },
            {
              name: "💰 Cena",
              value: `${product.price.toFixed(2)} zł`,
              inline: true
            },
            {
              name: "📁 Kategoria",
              value:
                CATEGORIES[product.category]?.name ||
                "Inne",
              inline: true
            }
          )
          .setFooter({
            text: "Cosmo Shøp • Ticket zakupowy"
          });

        const paymentButton = new ButtonBuilder()
          .setCustomId("platnosc")
          .setLabel("Płatność")
          .setEmoji("💳")
          .setStyle(ButtonStyle.Primary);

        const readyButton = new ButtonBuilder()
          .setCustomId("zamowienie_gotowe")
          .setLabel("Zamówienie gotowe")
          .setEmoji("📦")
          .setStyle(ButtonStyle.Success);

        const closeButton = new ButtonBuilder()
          .setCustomId("zamknij_ticket")
          .setLabel("Zamknij ticket")
          .setEmoji("🔒")
          .setStyle(ButtonStyle.Danger);

        const row = new ActionRowBuilder()
          .addComponents(
            paymentButton,
            readyButton,
            closeButton
          );

        await ticketChannel.send({
          content:
            `<@${interaction.user.id}> <@&${staffRole.id}>`,
          embeds: [embed],
          components: [row]
        });

        return interaction.editReply({
          content:
            `✅ Utworzono ticket: ${ticketChannel}`,
          components: []
        });
      }
    }

  } catch (error) {
    console.error(
      "Błąd interactionCreate:",
      error
    );

    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content:
          "❌ Wystąpił błąd podczas wykonywania operacji.",
        ephemeral: true
      }).catch(() => {});
    }
  }
});

// =========================
// HTTP SERVER DLA RENDERA
// =========================

const PORT = process.env.PORT || 3000;

http.createServer((req, res) => {
  res.writeHead(200, {
    "Content-Type": "text/plain; charset=utf-8"
  });

  res.end(
    "Cosmo Shop Bot is online!"
  );
}).listen(PORT, () => {
  console.log(
    `Serwer HTTP działa na porcie ${PORT}`
  );
});

// =========================
// START
// =========================

(async () => {
  if (
    !process.env.DISCORD_TOKEN ||
    !process.env.CLIENT_ID
  ) {
    console.error(
      "Brakuje DISCORD_TOKEN lub CLIENT_ID."
    );

    process.exit(1);
  }

  try {
    await registerCommands();
    await client.login(
      process.env.DISCORD_TOKEN
    );
  } catch (error) {
    console.error(
      "Nie udało się uruchomić bota:",
      error
    );

    process.exit(1);
  }
})();
