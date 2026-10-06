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

function loadData() {
  try {
    const data = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));

    if (!data.products) data.products = [];
    if (!data.orders) data.orders = [];

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

function getCategoryName(categoryId) {
  return CATEGORIES[categoryId]?.name || "Inne";
}

function getCategoryEmoji(categoryId) {
  return CATEGORIES[categoryId]?.emoji || "📦";
}

const commands = [

  // /sklep
  new SlashCommandBuilder()
    .setName("sklep")
    .setDescription("Pokazuje produkty dostępne w sklepie."),

  // /produkt-dodaj
  new SlashCommandBuilder()
    .setName("produkt-dodaj")
    .setDescription("Dodaje produkt do sklepu.")
    .addStringOption(o =>
      o.setName("nazwa")
        .setDescription("Nazwa produktu")
        .setRequired(true)
    )
    .addNumberOption(o =>
      o.setName("cena")
        .setDescription("Cena produktu")
        .setRequired(true)
        .setMinValue(0)
    )
    .addStringOption(o =>
      o.setName("kategoria")
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
      o.setName("opis")
        .setDescription("Opis produktu")
        .setRequired(false)
    )
    .setDefaultMemberPermissions(
      PermissionFlagsBits.ManageGuild
    ),

  // /produkt-usun
  new SlashCommandBuilder()
    .setName("produkt-usun")
    .setDescription("Usuwa produkt ze sklepu.")
    .addIntegerOption(o =>
      o.setName("id")
        .setDescription("ID produktu")
        .setRequired(true)
        .setMinValue(1)
    )
    .setDefaultMemberPermissions(
      PermissionFlagsBits.ManageGuild
    ),

  // /produkty
  new SlashCommandBuilder()
    .setName("produkty")
    .setDescription("Pokazuje produkty wraz z ich ID."),

  // /zamow
  new SlashCommandBuilder()
    .setName("zamow")
    .setDescription("Tworzy zamówienie na produkt.")
    .addIntegerOption(o =>
      o.setName("id")
        .setDescription("ID produktu")
        .setRequired(true)
        .setMinValue(1)
    ),

  // /zamowienia
  new SlashCommandBuilder()
    .setName("zamowienia")
    .setDescription("Pokazuje ostatnie zamówienia.")
    .setDefaultMemberPermissions(
      PermissionFlagsBits.ManageGuild
    ),

  // /panel-zakup
  new SlashCommandBuilder()
    .setName("panel-zakup")
    .setDescription("Wysyła panel zakupowy.")
    .setDefaultMemberPermissions(
      PermissionFlagsBits.ManageGuild
    )

].map(command => command.toJSON());

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
  console.log(
    `Zalogowano jako ${client.user.tag}`
  );

  console.log(
    "Cosmo Shøp - Bot jest online."
  );
});

client.on("interactionCreate", async interaction => {

  // ==================================================
  // PRZYCISKI
  // ==================================================

  if (interaction.isButton()) {

    // ----------------------------------------------
    // 🛒 ZAKUP
    // ----------------------------------------------

    if (interaction.customId === "otworz_zakup") {

      const menu = new StringSelectMenuBuilder()
        .setCustomId("wybierz_kategorie")
        .setPlaceholder("🛍️ Wybierz kategorię produktu")
        .addOptions(
          Object.entries(CATEGORIES).map(
            ([id, category]) =>
              new StringSelectMenuOptionBuilder()
                .setLabel(category.name)
                .setValue(id)
                .setEmoji(category.emoji)
                .setDescription(
                  `Produkty: ${category.name}`
                )
          )
        );

      const row = new ActionRowBuilder()
        .addComponents(menu);

      const embed = new EmbedBuilder()
        .setTitle("🛍️ Cosmo Shøp — Zakup")
        .setDescription(
          "Wybierz kategorię produktu poniżej.\n\n" +
          "Po wybraniu kategorii zobaczysz dostępne produkty."
        );

      return interaction.reply({
        embeds: [embed],
        components: [row],
        ephemeral: true
      });
    }

    // ----------------------------------------------
    // 💳 PŁATNOŚĆ
    // ----------------------------------------------

    if (interaction.customId === "platnosc") {

      if (
        !interaction.member.permissions.has(
          PermissionFlagsBits.ManageGuild
        )
      ) {
        return interaction.reply({
          content:
            "💳 Poczekaj na obsługę sklepu. Metodę płatności ustalicie tutaj w tickecie.",
          ephemeral: true
        });
      }

      return interaction.reply({
        content:
          "💳 **Płatność**\n\n" +
          "Ustal z klientem metodę płatności oraz kwotę zamówienia.",
        ephemeral: true
      });
    }

    // ----------------------------------------------
    // 📦 ZAMÓWIENIE GOTOWE
    // ----------------------------------------------

    if (interaction.customId === "zamowienie_gotowe") {

      if (
        !interaction.member.permissions.has(
          PermissionFlagsBits.ManageGuild
        )
      ) {
        return interaction.reply({
          content:
            "❌ Tylko obsługa może oznaczyć zamówienie jako gotowe.",
          ephemeral: true
        });
      }

      await interaction.reply({
        content:
          "📦 Zamówienie zostało oznaczone jako gotowe.",
        ephemeral: true
      });

      return interaction.channel.send(
        "📦 **Zamówienie gotowe!**\nProdukt może zostać przekazany klientowi."
      );
    }

    // ----------------------------------------------
    // 🔒 ZAMKNIJ
    // ----------------------------------------------

    if (interaction.customId === "zamknij_ticket") {

      if (
        !interaction.member.permissions.has(
          PermissionFlagsBits.ManageGuild
        )
      ) {
        return interaction.reply({
          content:
            "❌ Tylko obsługa może zamknąć ticket.",
          ephemeral: true
        });
      }

      await interaction.reply(
        "🔒 Ticket zostanie zamknięty za 3 sekundy."
      );

      setTimeout(async () => {
        try {
          await interaction.channel.delete();
        } catch (error) {
          console.error(
            "Nie udało się usunąć ticketu:",
            error
          );
        }
      }, 3000);

      return;
    }

    return;
  }

  // ==================================================
  // MENU KATEGORII
  // ==================================================

  if (
    interaction.isStringSelectMenu() &&
    interaction.customId === "wybierz_kategorie"
  ) {

    const categoryId = interaction.values[0];

    const data = loadData();

    const products = data.products.filter(
      product =>
        product.category === categoryId
    );

    if (!products.length) {
      return interaction.update({
        content:
          `❌ W kategorii **${getCategoryName(categoryId)}** nie ma obecnie produktów.`,
        embeds: [],
        components: []
      });
    }

    const options = products
      .slice(0, 25)
      .map(product =>
        new StringSelectMenuOptionBuilder()
          .setLabel(
            `${product.name} — ${product.price.toFixed(2)} zł`
          )
          .setValue(
            String(product.id)
          )
          .setEmoji(
            getCategoryEmoji(categoryId)
          )
          .setDescription(
            (product.description || "Brak opisu").slice(0, 100)
          )
      );

    const menu = new StringSelectMenuBuilder()
      .setCustomId(
        `wybierz_produkt_${categoryId}`
      )
      .setPlaceholder(
        "📦 Wybierz produkt"
      )
      .addOptions(options);

    const row = new ActionRowBuilder()
      .addComponents(menu);

    const embed = new EmbedBuilder()
      .setTitle(
        `${getCategoryEmoji(categoryId)} ${getCategoryName(categoryId)}`
      )
      .setDescription(
        "Wybierz produkt, który chcesz kupić."
      );

    return interaction.update({
      content: "",
      embeds: [embed],
      components: [row]
    });
  }

  // ==================================================
  // MENU PRODUKTU
  // ==================================================

  if (
    interaction.isStringSelectMenu() &&
    interaction.customId.startsWith("wybierz_produkt_")
  ) {

    const productId = Number(
      interaction.values[0]
    );

    const data = loadData();

    const product = data.products.find(
      p =>
        p.guildId === interaction.guildId &&
        p.id === productId
    );

    if (!product) {
      return interaction.update({
        content:
          "❌ Nie znaleziono tego produktu.",
        embeds: [],
        components: []
      });
    }

    const guild = interaction.guild;

    // Sprawdzamy, czy użytkownik ma już ticket
    const existingTicket =
      guild.channels.cache.find(
        channel =>
          channel.type === ChannelType.GuildText &&
          channel.name ===
            `🛒・zakup-${interaction.user.username.toLowerCase()}`
      );

    if (existingTicket) {
      return interaction.update({
        content:
          `❌ Masz już otwarty ticket: ${existingTicket}`,
        embeds: [],
        components: []
      });
    }

    // Szukamy kategorii Discord "zakup"
    let category =
      guild.channels.cache.find(
        channel =>
          channel.type === ChannelType.GuildCategory &&
          channel.name.toLowerCase() === "zakup"
      );

    if (!category) {
      category =
        await guild.channels.create({
          name: "zakup",
          type: ChannelType.GuildCategory
        });
    }

    // Szukamy roli Obsługa
    const staffRole =
      guild.roles.cache.find(
        role =>
          role.name.toLowerCase() ===
          "obsługa"
      );

    const permissionOverwrites = [
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
          PermissionFlagsBits.ReadMessageHistory
        ]
      }
    ];

    if (staffRole) {
      permissionOverwrites.push({
        id: staffRole.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory
        ]
      });
    }

    const ticket =
      await guild.channels.create({
        name:
          `🛒・zakup-${interaction.user.username}`,
        type: ChannelType.GuildText,
        parent: category.id,
        permissionOverwrites
      });

    // Dostęp dla bota
    if (guild.members.me) {
      await ticket.permissionOverwrites.edit(
        guild.members.me.id,
        {
          ViewChannel: true,
          SendMessages: true,
          ReadMessageHistory: true,
          ManageChannels: true
        }
      );
    }

    const embed =
      new EmbedBuilder()
        .setTitle(
          "🛍️ Cosmo Shøp — Nowe zamówienie"
        )
        .setDescription(
          `👤 **Klient:** <@${interaction.user.id}>\n\n` +
          `📦 **Produkt:** ${product.name}\n` +
          `💰 **Cena:** ${product.price.toFixed(2)} zł\n` +
          `📁 **Kategoria:** ${getCategoryName(product.category)}\n\n` +
          `💳 Ustal z obsługą metodę płatności.\n` +
          `📦 Po otrzymaniu płatności produkt zostanie przekazany.`
        )
        .setFooter({
          text:
            "Cosmo Shøp • Obsługa zamówień"
        });

    const buttons =
      new ActionRowBuilder()
        .addComponents(

          new ButtonBuilder()
            .setCustomId("platnosc")
            .setLabel("Płatność")
            .setEmoji("💳")
            .setStyle(
              ButtonStyle.Primary
            ),

          new ButtonBuilder()
            .setCustomId(
              "zamowienie_gotowe"
            )
            .setLabel(
              "Zamówienie gotowe"
            )
            .setEmoji("📦")
            .setStyle(
              ButtonStyle.Success
            ),

          new ButtonBuilder()
            .setCustomId(
              "zamknij_ticket"
            )
            .setLabel(
              "Zamknij ticket"
            )
            .setEmoji("🔒")
            .setStyle(
              ButtonStyle.Danger
            )
        );

    const staffPing = staffRole
      ? `<@&${staffRole.id}>`
      : "🔔 **Obsługa sklepu**";

    await ticket.send({
      content:
        `${staffPing} <@${interaction.user.id}>`,
      embeds: [embed],
      components: [buttons]
    });

    return interaction.update({
      content:
        `✅ Utworzono ticket: ${ticket}`,
      embeds: [],
      components: []
    });
  }

  // ==================================================
  // KOMENDY SLASH
  // ==================================================

  if (!interaction.isChatInputCommand()) {
    return;
  }

  const data = loadData();

  const guildId =
    interaction.guildId;

  const userId =
    interaction.user.id;

  // ==================================================
  // PANEL
  // ==================================================

  if (
    interaction.commandName ===
    "panel-zakup"
  ) {

    const embed =
      new EmbedBuilder()
        .setTitle(
          "🛍️ COSMO SHØP × STWÓRZ TICKET"
        )
        .setDescription(
          "Chcesz coś kupić?\n\n" +
          "Kliknij **🛒 Zakup**, a następnie wybierz kategorię oraz produkt.\n\n" +
          "💰 Ustalimy cenę\n" +
          "💳 Ustalimy metodę płatności\n" +
          "📦 Przekażemy zakupiony produkt"
        )
        .setFooter({
          text:
            "Cosmo Shøp • Zakupy"
        });

    const row =
      new ActionRowBuilder()
        .addComponents(

          new ButtonBuilder()
            .setCustomId(
              "otworz_zakup"
            )
            .setLabel("Zakup")
            .setEmoji("🛒")
            .setStyle(
              ButtonStyle.Success
            )
        );

    return interaction.reply({
      embeds: [embed],
      components: [row]
    });
  }

  // ==================================================
  // SKLEP
  // ==================================================

  if (
    interaction.commandName === "sklep" ||
    interaction.commandName === "produkty"
  ) {

    const products =
      data.products.filter(
        p => p.guildId === guildId
      );

    if (!products.length) {
      return interaction.reply(
        "🛒 Sklep jest obecnie pusty."
      );
    }

    const description =
      products.map(product =>
        `**#${product.id} — ${product.name}**\n` +
        `${getCategoryEmoji(product.category)} ${getCategoryName(product.category)}\n` +
        `${product.description || "Brak opisu"}\n` +
        `💰 **${product.price.toFixed(2)} zł**`
      ).join("\n\n");

    const embed =
      new EmbedBuilder()
        .setTitle("🛍️ Cosmo Shøp")
        .setDescription(
          description.slice(0, 4096)
        )
        .setFooter({
          text:
            "Użyj panelu zakupowego, aby kupić produkt."
        });

    return interaction.reply({
      embeds: [embed]
    });
  }

  // ==================================================
  // DODAJ PRODUKT
  // ==================================================

  if (
    interaction.commandName ===
    "produkt-dodaj"
  ) {

    const name =
      interaction.options.getString(
        "nazwa"
      );

    const price =
      interaction.options.getNumber(
        "cena"
      );

    const category =
      interaction.options.getString(
        "kategoria"
      );

    const description =
      interaction.options.getString(
        "opis"
      ) || "";

    const guildProducts =
      data.products.filter(
        p => p.guildId === guildId
      );

    const nextId =
      guildProducts.length
        ? Math.max(
            ...guildProducts.map(
              p => p.id
            )
          ) + 1
        : 1;

    data.products.push({
      id: nextId,
      guildId,
      name,
      price,
      category,
      description,
      createdAt:
        new Date().toISOString()
    });

    saveData(data);

    return interaction.reply(
      `✅ Dodano produkt **#${nextId} — ${name}**\n` +
      `${getCategoryEmoji(category)} Kategoria: **${getCategoryName(category)}**\n` +
      `💰 Cena: **${price.toFixed(2)} zł**`
    );
  }

  // ==================================================
  // USUŃ PRODUKT
  // ==================================================

  if (
    interaction.commandName ===
    "produkt-usun"
  ) {

    const id =
      interaction.options.getInteger(
        "id"
      );

    const index =
      data.products.findIndex(
        p =>
          p.guildId === guildId &&
          p.id === id
      );

    if (index === -1) {
      return interaction.reply({
        content:
          "❌ Nie znaleziono takiego produktu.",
        ephemeral: true
      });
    }

    const removed =
      data.products.splice(
        index,
        1
      )[0];

    saveData(data);

    return interaction.reply(
      `🗑️ Usunięto produkt **#${removed.id} — ${removed.name}**.`
    );
  }

  // ==================================================
  // ZAMÓW
  // ==================================================

  if (
    interaction.commandName ===
    "zamow"
  ) {

    const id =
      interaction.options.getInteger(
        "id"
      );

    const product =
      data.products.find(
        p =>
          p.guildId === guildId &&
          p.id === id
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
              o => o.id
            )
          ) + 1
        : 1;

    data.orders.push({
      id: orderId,
      guildId,
      userId,
      productId: product.id,
      productName: product.name,
      price: product.price,
      status: "nowe",
      createdAt:
        new Date().toISOString()
    });

    saveData(data);

    return interaction.reply(
      `✅ Utworzono zamówienie **#${orderId}** na **${product.name}** za **${product.price.toFixed(2)} zł**.\n` +
      `📌 Status: **nowe**`
    );
  }

  // ==================================================
  // ZAMÓWIENIA
  // ==================================================

  if (
    interaction.commandName ===
    "zamowienia"
  ) {

    const orders =
      data.orders
        .filter(
          o => o.guildId === guildId
        )
        .slice(-15)
        .reverse();

    if (!orders.length) {
      return interaction.reply(
        "📦 Brak zamówień."
      );
    }

    const text =
      orders.map(order =>
        `**#${order.id}** — <@${order.userId}> — ` +
        `${order.productName} — **${order.price.toFixed(2)} zł** — ` +
        `\`${order.status}\``
      ).join("\n");

    return interaction.reply({
      content:
        `📦 **Ostatnie zamówienia**\n${text}`
    });
  }
});

// ==================================================
// START
// ==================================================

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

// ==================================================
// RENDER HTTP SERVER
// ==================================================

const PORT =
  process.env.PORT || 3000;

http.createServer(
  (req, res) => {

    res.writeHead(
      200,
      {
        "Content-Type":
          "text/plain"
      }
    );

    res.end(
      "Cosmo Shop Bot is online!"
    );
  }
).listen(
  PORT,
  () => {
    console.log(
      `Serwer HTTP działa na porcie ${PORT}`
    );
  }
);
