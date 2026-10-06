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

// =====================================================
// KATEGORIE PRODUKTÓW
// =====================================================

const CATEGORIES = {
  gry: {
    name: "Gry",
    emoji: "🎮"
  },
  konta: {
    name: "Konta",
    emoji: "👤"
  },
  premium: {
    name: "Premium",
    emoji: "💎"
  },
  inne: {
    name: "Inne",
    emoji: "📦"
  }
};

// =====================================================
// DATA
// =====================================================

function loadData() {
  try {
    const data = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));

    if (!data.products) {
      data.products = [];
    }

    if (!data.orders) {
      data.orders = [];
    }

    // Stare produkty bez kategorii trafiają do "Inne"
    data.products = data.products.map(product => ({
      ...product,
      category: product.category || "inne"
    }));

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

// =====================================================
// KOMENDY SLASH
// =====================================================

const commands = [
  // /sklep
  new SlashCommandBuilder()
    .setName("sklep")
    .setDescription("Pokazuje wszystkie produkty."),

  // /produkty
  new SlashCommandBuilder()
    .setName("produkty")
    .setDescription("Pokazuje produkty wraz z ID."),

  // /produkt-dodaj
  new SlashCommandBuilder()
    .setName("produkt-dodaj")
    .setDescription("Dodaje produkt do sklepu.")
    .addStringOption(option =>
      option
        .setName("nazwa")
        .setDescription("Nazwa produktu")
        .setRequired(true)
    )
    .addNumberOption(option =>
      option
        .setName("cena")
        .setDescription("Cena produktu")
        .setRequired(true)
        .setMinValue(0)
    )
    .addStringOption(option =>
      option
        .setName("opis")
        .setDescription("Opis produktu")
        .setRequired(false)
    )
    .addStringOption(option =>
      option
        .setName("kategoria")
        .setDescription("Kategoria produktu")
        .setRequired(true)
        .addChoices(
          {
            name: "🎮 Gry",
            value: "gry"
          },
          {
            name: "👤 Konta",
            value: "konta"
          },
          {
            name: "💎 Premium",
            value: "premium"
          },
          {
            name: "📦 Inne",
            value: "inne"
          }
        )
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  // /produkt-usun
  new SlashCommandBuilder()
    .setName("produkt-usun")
    .setDescription("Usuwa produkt.")
    .addIntegerOption(option =>
      option
        .setName("id")
        .setDescription("ID produktu")
        .setRequired(true)
        .setMinValue(1)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  // /zamow
  new SlashCommandBuilder()
    .setName("zamow")
    .setDescription("Tworzy zamówienie.")
    .addIntegerOption(option =>
      option
        .setName("id")
        .setDescription("ID produktu")
        .setRequired(true)
        .setMinValue(1)
    ),

  // /zamowienia
  new SlashCommandBuilder()
    .setName("zamowienia")
    .setDescription("Pokazuje ostatnie zamówienia.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  // /panel-zakup
  new SlashCommandBuilder()
    .setName("panel-zakup")
    .setDescription("Tworzy panel zakupowy.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
].map(command => command.toJSON());

// =====================================================
// REJESTRACJA KOMEND
// =====================================================

async function registerCommands() {
  const rest = new REST({
    version: "10"
  }).setToken(process.env.DISCORD_TOKEN);

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

// =====================================================
// BOT
// =====================================================

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds
  ]
});

// =====================================================
// READY
// =====================================================

client.once("ready", () => {
  console.log(`Zalogowano jako ${client.user.tag}`);
  console.log("Cosmo Shøp - Bot jest online.");
});

// =====================================================
// INTERAKCJE
// =====================================================

client.on("interactionCreate", async interaction => {

  try {

    // =================================================
    // KOMENDY SLASH
    // =================================================

    if (interaction.isChatInputCommand()) {

      const data = loadData();
      const guildId = interaction.guildId;

      // -----------------------------------------------
      // /sklep
      // -----------------------------------------------

      if (interaction.commandName === "sklep") {

        const products = data.products.filter(
          product => product.guildId === guildId
        );

        if (!products.length) {
          return interaction.reply(
            "🛒 Sklep jest obecnie pusty."
          );
        }

        const description = products
          .map(product => {

            const category =
              CATEGORIES[product.category] ||
              CATEGORIES.inne;

            return (
              `**#${product.id} — ${product.name}**\n` +
              `${category.emoji} ${category.name}\n` +
              `${product.description || "Brak opisu"}\n` +
              `💰 **${product.price.toFixed(2)} zł**`
            );

          })
          .join("\n\n");

        const embed = new EmbedBuilder()
          .setTitle("🛍️ Cosmo Shøp")
          .setDescription(
            description.slice(0, 4096)
          );

        return interaction.reply({
          embeds: [embed]
        });
      }

      // -----------------------------------------------
      // /produkty
      // -----------------------------------------------

      if (interaction.commandName === "produkty") {

        const products = data.products.filter(
          product => product.guildId === guildId
        );

        if (!products.length) {
          return interaction.reply(
            "🛒 Brak produktów."
          );
        }

        const text = products
          .map(product => {

            const category =
              CATEGORIES[product.category] ||
              CATEGORIES.inne;

            return (
              `**#${product.id} — ${product.name}**\n` +
              `${category.emoji} ${category.name} • ` +
              `💰 ${product.price.toFixed(2)} zł`
            );

          })
          .join("\n\n");

        return interaction.reply({
          content: `🛍️ **Produkty w sklepie**\n\n${text}`
        });
      }

      // -----------------------------------------------
      // /produkt-dodaj
      // -----------------------------------------------

      if (interaction.commandName === "produkt-dodaj") {

        const name =
          interaction.options.getString("nazwa");

        const price =
          interaction.options.getNumber("cena");

        const description =
          interaction.options.getString("opis") || "";

        const category =
          interaction.options.getString("kategoria");

        const guildProducts =
          data.products.filter(
            product => product.guildId === guildId
          );

        const nextId =
          guildProducts.length
            ? Math.max(
                ...guildProducts.map(
                  product => product.id
                )
              ) + 1
            : 1;

        data.products.push({
          id: nextId,
          guildId,
          name,
          price,
          description,
          category,
          createdAt: new Date().toISOString()
        });

        saveData(data);

        const categoryInfo =
          CATEGORIES[category] ||
          CATEGORIES.inne;

        return interaction.reply(
          `✅ Dodano produkt **#${nextId} — ${name}**\n` +
          `${categoryInfo.emoji} Kategoria: **${categoryInfo.name}**\n` +
          `💰 Cena: **${price.toFixed(2)} zł**`
        );
      }

      // -----------------------------------------------
      // /produkt-usun
      // -----------------------------------------------

      if (interaction.commandName === "produkt-usun") {

        const id =
          interaction.options.getInteger("id");

        const index =
          data.products.findIndex(
            product =>
              product.guildId === guildId &&
              product.id === id
          );

        if (index === -1) {
          return interaction.reply({
            content:
              "❌ Nie znaleziono takiego produktu.",
            ephemeral: true
          });
        }

        const removed =
          data.products.splice(index, 1)[0];

        saveData(data);

        return interaction.reply(
          `🗑️ Usunięto produkt **#${removed.id} — ${removed.name}**.`
        );
      }

      // -----------------------------------------------
      // /zamow
      // -----------------------------------------------

      if (interaction.commandName === "zamow") {

        const id =
          interaction.options.getInteger("id");

        const product =
          data.products.find(
            item =>
              item.guildId === guildId &&
              item.id === id
          );

        if (!product) {
          return interaction.reply({
            content:
              "❌ Nie znaleziono takiego produktu.",
            ephemeral: true
          });
        }

        const orderId =
          data.orders.length
            ? Math.max(
                ...data.orders.map(
                  order => order.id
                )
              ) + 1
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
          `✅ Utworzono zamówienie **#${orderId}**\n` +
          `📦 Produkt: **${product.name}**\n` +
          `💰 Cena: **${product.price.toFixed(2)} zł**\n` +
          `📌 Status: **nowe**`
        );
      }

      // -----------------------------------------------
      // /zamowienia
      // -----------------------------------------------

      if (interaction.commandName === "zamowienia") {

        const orders =
          data.orders
            .filter(order =>
              order.guildId === guildId
            )
            .slice(-15)
            .reverse();

        if (!orders.length) {
          return interaction.reply(
            "📦 Brak zamówień."
          );
        }

        const text =
          orders
            .map(order =>
              `**#${order.id}** — ` +
              `<@${order.userId}> — ` +
              `${order.productName} — ` +
              `**${order.price.toFixed(2)} zł** — ` +
              `\`${order.status}\``
            )
            .join("\n");

        return interaction.reply({
          content:
            `📦 **Ostatnie zamówienia**\n\n${text}`
        });
      }

      // -----------------------------------------------
      // /panel-zakup
      // -----------------------------------------------

      if (interaction.commandName === "panel-zakup") {

        const embed = new EmbedBuilder()
          .setTitle("🛒 Cosmo Shøp")
          .setDescription(
            "Chcesz coś kupić?\n\n" +
            "Kliknij przycisk **🛒 Zakup**, " +
            "a następnie wybierz kategorię i produkt.\n\n" +
            "Po wybraniu produktu zostanie " +
            "automatycznie utworzony prywatny ticket."
          );

        const button =
          new ButtonBuilder()
            .setCustomId("otworz_zakup")
            .setLabel("Zakup")
            .setEmoji("🛒")
            .setStyle(ButtonStyle.Primary);

        const row =
          new ActionRowBuilder()
            .addComponents(button);

        return interaction.reply({
          embeds: [embed],
          components: [row]
        });
      }
    }

    // =================================================
    // PRZYCISK "ZAKUP"
    // =================================================

    if (
      interaction.isButton() &&
      interaction.customId === "otworz_zakup"
    ) {

      const data = loadData();

      const products =
        data.products.filter(
          product =>
            product.guildId === interaction.guildId
        );

      if (!products.length) {
        return interaction.reply({
          content:
            "❌ Sklep nie ma jeszcze żadnych produktów.",
          ephemeral: true
        });
      }

      const menu =
        new StringSelectMenuBuilder()
          .setCustomId("wybierz_kategorie")
          .setPlaceholder("Wybierz kategorię produktu");

      for (const [id, category] of Object.entries(CATEGORIES)) {

        const hasProducts =
          products.some(
            product => product.category === id
          );

        if (!hasProducts) {
          continue;
        }

        menu.addOptions(
          new StringSelectMenuOptionBuilder()
            .setLabel(category.name)
            .setValue(id)
            .setEmoji(category.emoji)
        );
      }

      const row =
        new ActionRowBuilder()
          .addComponents(menu);

      return interaction.reply({
        content: "🛒 **Wybierz kategorię:**",
        components: [row],
        ephemeral: true
      });
    }

    // =================================================
    // WYBÓR KATEGORII
    // =================================================

    if (
      interaction.isStringSelectMenu() &&
      interaction.customId === "wybierz_kategorie"
    ) {

      const categoryId =
        interaction.values[0];

      const data = loadData();

      const products =
        data.products.filter(
          product =>
            product.guildId === interaction.guildId &&
            product.category === categoryId
        );

      if (!products.length) {
        return interaction.update({
          content:
            "❌ W tej kategorii nie ma produktów.",
          components: []
        });
      }

      const category =
        CATEGORIES[categoryId] ||
        CATEGORIES.inne;

      const menu =
        new StringSelectMenuBuilder()
          .setCustomId(
            `wybierz_produkt_${categoryId}`
          )
          .setPlaceholder(
            `Wybierz produkt z kategorii ${category.name}`
          );

      // Discord pozwala maksymalnie na 25 opcji
      for (const product of products.slice(0, 25)) {

        menu.addOptions(
          new StringSelectMenuOptionBuilder()
            .setLabel(
              product.name.slice(0, 100)
            )
            .setDescription(
              `${product.price.toFixed(2)} zł`
            )
            .setValue(
              String(product.id)
            )
        );
      }

      const row =
        new ActionRowBuilder()
          .addComponents(menu);

      return interaction.update({
        content:
          `${category.emoji} **${category.name}**\n\n` +
          `Wybierz produkt:`,
        components: [row]
      });
    }

    // =================================================
    // WYBÓR PRODUKTU
    // =================================================

    if (
      interaction.isStringSelectMenu() &&
      interaction.customId.startsWith(
        "wybierz_produkt_"
      )
    ) {

      const productId =
        Number(interaction.values[0]);

      const data = loadData();

      const product =
        data.products.find(
          item =>
            item.guildId === interaction.guildId &&
            item.id === productId
        );

      if (!product) {
        return interaction.update({
          content:
            "❌ Produkt już nie istnieje.",
          components: []
        });
      }

      const guild = interaction.guild;

      // -----------------------------------------------
      // ROLA OBSŁUGA
      // -----------------------------------------------

      const staffRole =
        guild.roles.cache.find(
          role =>
            role.name.toLowerCase() ===
            "obsługa"
        );

      // -----------------------------------------------
      // BEZPIECZNA NAZWA UŻYTKOWNIKA
      // -----------------------------------------------

      const safeUsername =
        interaction.user.username
          .toLowerCase()
          .replace(/[^a-z0-9-_]/g, "-")
          .replace(/-+/g, "-")
          .replace(/^-|-$/g, "")
          .slice(0, 20) ||
        "klient";

      // -----------------------------------------------
      // NAZWA KATEGORII
      // -----------------------------------------------

      const categoryName =
        `🛒 ZAKUP - ${safeUsername}`;

      // -----------------------------------------------
      // UPRAWNIENIA KATEGORII
      // -----------------------------------------------

      const categoryPermissions = [
        {
          id: guild.roles.everyone.id,
          deny: [
            PermissionFlagsBits.ViewChannel
          ]
        },
        {
          id: interaction.user.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
            PermissionFlagsBits.AttachFiles,
            PermissionFlagsBits.EmbedLinks
          ]
        }
      ];

      if (staffRole) {
        categoryPermissions.push({
          id: staffRole.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
            PermissionFlagsBits.AttachFiles,
            PermissionFlagsBits.EmbedLinks
          ]
        });
      }

      // -----------------------------------------------
      // TWORZENIE NOWEJ KATEGORII
      // -----------------------------------------------

      const ticketCategory =
        await guild.channels.create({
          name: categoryName,
          type: ChannelType.GuildCategory,
          permissionOverwrites:
            categoryPermissions
        });

      // -----------------------------------------------
      // UPRAWNIENIA TICKETU
      // -----------------------------------------------

      const ticketPermissions = [
        {
          id: guild.roles.everyone.id,
          deny: [
            PermissionFlagsBits.ViewChannel
          ]
        },
        {
          id: interaction.user.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
            PermissionFlagsBits.AttachFiles,
            PermissionFlagsBits.EmbedLinks
          ]
        }
      ];

      if (staffRole) {
        ticketPermissions.push({
          id: staffRole.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
            PermissionFlagsBits.AttachFiles,
            PermissionFlagsBits.EmbedLinks
          ]
        });
      }

      // -----------------------------------------------
      // TWORZENIE TICKETU
      // -----------------------------------------------

      const ticketChannel =
        await guild.channels.create({
          name: `🛒・zakup-${safeUsername}`,
          type: ChannelType.GuildText,
          parent: ticketCategory.id,
          permissionOverwrites:
            ticketPermissions
        });

      // -----------------------------------------------
      // EMBED TICKETU
      // -----------------------------------------------

      const category =
        CATEGORIES[product.category] ||
        CATEGORIES.inne;

      const ticketEmbed =
        new EmbedBuilder()
          .setTitle("🛒 Nowe zamówienie")
          .setDescription(
            "Witaj w swoim tickecie zakupowym!\n\n" +
            "Obsługa ustali tutaj z Tobą metodę płatności. " +
            "Po otrzymaniu płatności produkt zostanie przekazany."
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
              value:
                `${product.price.toFixed(2)} zł`,
              inline: true
            },
            {
              name: "📂 Kategoria",
              value:
                `${category.emoji} ${category.name}`,
              inline: true
            }
          )
          .setFooter({
            text:
              "Cosmo Shøp • Obsługa zamówienia"
          });

      // -----------------------------------------------
      // PRZYCISKI
      // -----------------------------------------------

      const paymentButton =
        new ButtonBuilder()
          .setCustomId("platnosc")
          .setLabel("Płatność")
          .setEmoji("💳")
          .setStyle(ButtonStyle.Primary);

      const readyButton =
        new ButtonBuilder()
          .setCustomId("zamowienie_gotowe")
          .setLabel("Zamówienie gotowe")
          .setEmoji("📦")
          .setStyle(ButtonStyle.Success);

      const closeButton =
        new ButtonBuilder()
          .setCustomId("zamknij_ticket")
          .setLabel("Zamknij ticket")
          .setEmoji("🔒")
          .setStyle(ButtonStyle.Danger);

      const buttons =
        new ActionRowBuilder()
          .addComponents(
            paymentButton,
            readyButton,
            closeButton
          );

      // -----------------------------------------------
      // WIADOMOŚĆ W TICKIECIE
      // -----------------------------------------------

      const staffMention =
        staffRole
          ? `<@&${staffRole.id}>`
          : "🔔 **Obsługa sklepu**";

      await ticketChannel.send({
        content:
          `${staffMention}\n` +
          `<@${interaction.user.id}>`,
        embeds: [ticketEmbed],
        components: [buttons]
      });

      // -----------------------------------------------
      // ODPOWIEDŹ DLA KLIENTA
      // -----------------------------------------------

      return interaction.update({
        content:
          `✅ Utworzono ticket!\n\n` +
          `📦 Produkt: **${product.name}**\n` +
          `💰 Cena: **${product.price.toFixed(2)} zł**\n\n` +
          `🎫 ${ticketChannel}`,
        components: []
      });
    }

    // =================================================
    // PRZYCISK PŁATNOŚĆ
    // =================================================

    if (
      interaction.isButton() &&
      interaction.customId === "platnosc"
    ) {

      return interaction.reply({
        content:
          "💳 **Płatność**\n\n" +
          "Skontaktuj się z obsługą sklepu " +
          "w tym tickecie, aby ustalić metodę płatności.",
        ephemeral: true
      });
    }

    // =================================================
    // PRZYCISK ZAMÓWIENIE GOTOWE
    // =================================================

    if (
      interaction.isButton() &&
      interaction.customId === "zamowienie_gotowe"
    ) {

      return interaction.reply({
        content:
          "📦 **Zamówienie oznaczone jako gotowe!**\n\n" +
          "Możesz teraz przekazać produkt klientowi.",
        ephemeral: false
      });
    }

    // =================================================
    // ZAMKNIĘCIE TICKETU
    // =================================================

    if (
      interaction.isButton() &&
      interaction.customId === "zamknij_ticket"
    ) {

      // Tylko obsługa / administrator może zamknąć
      const member =
        interaction.member;

      const isStaff =
        member.permissions.has(
          PermissionFlagsBits.ManageChannels
        ) ||
        member.permissions.has(
          PermissionFlagsBits.ManageGuild
        ) ||
        member.roles.cache.some(
          role =>
            role.name.toLowerCase() ===
            "obsługa"
        );

      if (!isStaff) {
        return interaction.reply({
          content:
            "❌ Tylko obsługa może zamknąć ticket.",
          ephemeral: true
        });
      }

      await interaction.reply(
        "🔒 Ticket zostanie zamknięty za 3 sekundy..."
      );

      const ticketChannel =
        interaction.channel;

      const parentCategory =
        ticketChannel.parent;

      setTimeout(async () => {

        try {
          await ticketChannel.delete(
            "Ticket zamknięty"
          );
        } catch (error) {
          console.error(
            "Nie udało się usunąć ticketu:",
            error
          );
        }

        // Jeśli kategoria jest pusta,
        // również ją usuwamy.
        if (
          parentCategory &&
          parentCategory.type ===
            ChannelType.GuildCategory
        ) {

          try {

            const children =
              parentCategory.children.cache;

            if (children.size === 0) {
              await parentCategory.delete(
                "Pusta kategoria ticketu"
              );
            }

          } catch (error) {
            console.error(
              "Nie udało się usunąć kategorii:",
              error
            );
          }
        }

      }, 3000);

      return;
    }

  } catch (error) {

    console.error(
      "Błąd podczas obsługi interakcji:",
      error
    );

    try {

      if (interaction.replied) {

        await interaction.followUp({
          content:
            "❌ Wystąpił błąd. Sprawdź logi Render.",
          ephemeral: true
        });

      } else if (interaction.deferred) {

        await interaction.editReply({
          content:
            "❌ Wystąpił błąd. Sprawdź logi Render."
        });

      } else {

        await interaction.reply({
          content:
            "❌ Wystąpił błąd. Sprawdź logi Render.",
          ephemeral: true
        });

      }

    } catch {}
  }
});

// =====================================================
// START BOTA
// =====================================================

(async () => {

  if (
    !process.env.DISCORD_TOKEN ||
    !process.env.CLIENT_ID
  ) {

    console.error(
      "Brakuje DISCORD_TOKEN lub CLIENT_ID w zmiennych środowiskowych."
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

// =====================================================
// SERWER HTTP DLA RENDER
// =====================================================

const PORT =
  process.env.PORT || 3000;

http
  .createServer((req, res) => {

    res.writeHead(200, {
      "Content-Type":
        "text/plain; charset=utf-8"
    });

    res.end(
      "Cosmo Shop Bot is online!"
    );

  })
  .listen(PORT, () => {

    console.log(
      `Serwer HTTP działa na porcie ${PORT}`
    );

  });
