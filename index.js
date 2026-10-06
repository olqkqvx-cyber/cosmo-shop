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
  ChannelType
} = require("discord.js");

const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");

const DATA_FILE = path.join(__dirname, "data.json");

function loadData() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  } catch {
    return { products: [], orders: [] };
  }
}

function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), "utf8");
}

const commands = [
  new SlashCommandBuilder()
    .setName("sklep")
    .setDescription("Pokazuje produkty dostępne w sklepie."),

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
      o.setName("opis")
        .setDescription("Opis produktu")
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  new SlashCommandBuilder()
    .setName("produkt-usun")
    .setDescription("Usuwa produkt ze sklepu.")
    .addIntegerOption(o =>
      o.setName("id")
        .setDescription("ID produktu")
        .setRequired(true)
        .setMinValue(1)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  new SlashCommandBuilder()
    .setName("produkty")
    .setDescription("Pokazuje produkty wraz z ich ID."),

  new SlashCommandBuilder()
    .setName("zamow")
    .setDescription("Tworzy zamówienie na produkt.")
    .addIntegerOption(o =>
      o.setName("id")
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
    .setDescription("Wysyła panel do tworzenia ticketów zakupowych.")
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
    : Routes.applicationCommands(process.env.CLIENT_ID);

  await rest.put(route, { body: commands });

  console.log("Komendy slash zostały zarejestrowane.");
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

client.once("ready", () => {
  console.log(`Zalogowano jako ${client.user.tag}`);
  console.log("Cosmo Shøp - Bot jest online.");
});

client.on("interactionCreate", async interaction => {

  // =========================
  // PRZYCISKI
  // =========================

  if (interaction.isButton()) {

    // 🛒 OTWÓRZ ZAKUP
    if (interaction.customId === "otworz_zakup") {

      const guild = interaction.guild;

      const existingTicket = guild.channels.cache.find(
        channel =>
          channel.type === ChannelType.GuildText &&
          channel.name === `zakup-${interaction.user.username.toLowerCase()}`
      );

      if (existingTicket) {
        return interaction.reply({
          content: `❌ Masz już otwarty ticket: ${existingTicket}`,
          ephemeral: true
        });
      }

      let category = guild.channels.cache.find(
        channel =>
          channel.type === ChannelType.GuildCategory &&
          channel.name.toLowerCase() === "zakup"
      );

      if (!category) {
        category = await guild.channels.create({
          name: "zakup",
          type: ChannelType.GuildCategory
        });
      }

      const ticket = await guild.channels.create({
        name: `zakup-${interaction.user.username}`,
        type: ChannelType.GuildText,
        parent: category.id,
        permissionOverwrites: [
          {
            id: guild.roles.everyone.id,
            deny: [PermissionFlagsBits.ViewChannel]
          },
          {
            id: interaction.user.id,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ReadMessageHistory
            ]
          }
        ]
      });

      await ticket.permissionOverwrites.edit(guild.members.me.id, {
        ViewChannel: true,
        SendMessages: true,
        ReadMessageHistory: true,
        ManageChannels: true
      });

      const embed = new EmbedBuilder()
        .setTitle("🛒 Cosmo Shøp — Zakup")
        .setDescription(
          `Witaj <@${interaction.user.id}>!\n\n` +
          `Napisz tutaj, **co chcesz kupić**.\n\n` +
          `💰 Ustalimy wspólnie cenę i metodę płatności.\n` +
          `📦 Po otrzymaniu płatności otrzymasz zakupiony produkt.\n\n` +
          `Wybierz odpowiednią opcję poniżej.`
        )
        .setFooter({
          text: "Cosmo Shøp • Obsługa zamówienia"
        });

      const buttons = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("platnosc")
          .setLabel("Płatność")
          .setEmoji("💳")
          .setStyle(ButtonStyle.Primary),

        new ButtonBuilder()
          .setCustomId("zamowienie_gotowe")
          .setLabel("Zamówienie gotowe")
          .setEmoji("📦")
          .setStyle(ButtonStyle.Success),

        new ButtonBuilder()
          .setCustomId("zamknij_ticket")
          .setLabel("Zamknij ticket")
          .setEmoji("🔒")
          .setStyle(ButtonStyle.Danger)
      );

      await ticket.send({
        content: `<@${interaction.user.id}>`,
        embeds: [embed],
        components: [buttons]
      });

      return interaction.reply({
        content: `✅ Utworzono Twój ticket: ${ticket}`,
        ephemeral: true
      });
    }

    // 💳 PŁATNOŚĆ
    if (interaction.customId === "platnosc") {

      if (
        !interaction.member.permissions.has(
          PermissionFlagsBits.ManageGuild
        )
      ) {
        return interaction.reply({
          content:
            "💳 Metodę płatności ustala z Tobą obsługa sklepu. Napisz, co chcesz kupić.",
          ephemeral: true
        });
      }

      return interaction.reply({
        content:
          "💳 **Płatność**\n\n" +
          "Ustal z klientem metodę płatności oraz kwotę zamówienia.\n" +
          "Po otrzymaniu płatności można oznaczyć zamówienie jako gotowe.",
        ephemeral: true
      });
    }

    // 📦 ZAMÓWIENIE GOTOWE
    if (interaction.customId === "zamowienie_gotowe") {

      if (
        !interaction.member.permissions.has(
          PermissionFlagsBits.ManageGuild
        )
      ) {
        return interaction.reply({
          content: "❌ Tylko obsługa sklepu może oznaczyć zamówienie jako gotowe.",
          ephemeral: true
        });
      }

      await interaction.reply({
        content:
          "📦 **Zamówienie gotowe!**\n\n" +
          "Możesz teraz wysłać klientowi zakupiony produkt.",
        ephemeral: true
      });

      return interaction.channel.send(
        "📦 **Zamówienie zostało oznaczone jako gotowe.**"
      );
    }

    // 🔒 ZAMKNIJ TICKET
    if (interaction.customId === "zamknij_ticket") {

      if (
        !interaction.member.permissions.has(
          PermissionFlagsBits.ManageGuild
        )
      ) {
        return interaction.reply({
          content: "❌ Tylko obsługa sklepu może zamknąć ticket.",
          ephemeral: true
        });
      }

      await interaction.reply("🔒 Ticket zostanie zamknięty za 3 sekundy.");

      setTimeout(async () => {
        try {
          await interaction.channel.delete();
        } catch (error) {
          console.error("Nie udało się usunąć ticketu:", error);
        }
      }, 3000);

      return;
    }

    return;
  }

  // =========================
  // KOMENDY SLASH
  // =========================

  if (!interaction.isChatInputCommand()) return;

  const data = loadData();
  const guildId = interaction.guildId;
  const userId = interaction.user.id;

  // =========================
  // PANEL ZAKUPU
  // =========================

  if (interaction.commandName === "panel-zakup") {

    const embed = new EmbedBuilder()
      .setTitle("🛍️ Cosmo Shøp")
      .setDescription(
        "Chcesz coś kupić?\n\n" +
        "Kliknij przycisk **🛒 Otwórz zakup**, aby utworzyć prywatny ticket.\n\n" +
        "W tickecie ustalimy:\n" +
        "• 📦 produkt\n" +
        "• 💰 cenę\n" +
        "• 💳 metodę płatności\n" +
        "• 📬 sposób przekazania produktu"
      )
      .setFooter({
        text: "Cosmo Shøp • Zakupy"
      });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("otworz_zakup")
        .setLabel("Otwórz zakup")
        .setEmoji("🛒")
        .setStyle(ButtonStyle.Success)
    );

    return interaction.reply({
      embeds: [embed],
      components: [row]
    });
  }

  // =========================
  // SKLEP / PRODUKTY
  // =========================

  if (
    interaction.commandName === "sklep" ||
    interaction.commandName === "produkty"
  ) {

    const products = data.products.filter(
      p => p.guildId === guildId
    );

    if (!products.length) {
      return interaction.reply("🛒 Sklep jest obecnie pusty.");
    }

    const description = products.map(p =>
      `**#${p.id} — ${p.name}**\n` +
      `${p.description || "Brak opisu"}\n` +
      `💰 **${p.price.toFixed(2)} zł**`
    ).join("\n\n");

    const embed = new EmbedBuilder()
      .setTitle("🛍️ Cosmo Shøp")
      .setDescription(description.slice(0, 4096))
      .setFooter({
        text: "Aby kupić, otwórz ticket zakupowy."
      });

    return interaction.reply({
      embeds: [embed]
    });
  }

  // =========================
  // DODAWANIE PRODUKTU
  // =========================

  if (interaction.commandName === "produkt-dodaj") {

    const name = interaction.options.getString("nazwa");
    const price = interaction.options.getNumber("cena");
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
      description,
      createdAt: new Date().toISOString()
    });

    saveData(data);

    return interaction.reply(
      `✅ Dodano produkt **#${nextId} — ${name}** za **${price.toFixed(2)} zł**.`
    );
  }

  // =========================
  // USUWANIE PRODUKTU
  // =========================

  if (interaction.commandName === "produkt-usun") {

    const id = interaction.options.getInteger("id");

    const index = data.products.findIndex(
      p => p.guildId === guildId && p.id === id
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

  // =========================
  // ZAMÓWIENIE
  // =========================

  if (interaction.commandName === "zamow") {

    const id = interaction.options.getInteger("id");

    const product = data.products.find(
      p => p.guildId === guildId && p.id === id
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
      userId,
      productId: product.id,
      productName: product.name,
      price: product.price,
      status: "nowe",
      createdAt: new Date().toISOString()
    });

    saveData(data);

    return interaction.reply(
      `✅ Utworzono zamówienie **#${orderId}** na **${product.name}** za **${product.price.toFixed(2)} zł**.\n` +
      `📌 Status: **nowe**\n` +
      `ℹ️ Dalsze ustalenia odbywają się w tickecie zakupowym.`
    );
  }

  // =========================
  // ZAMÓWIENIA
  // =========================

  if (interaction.commandName === "zamowienia") {

    const orders = data.orders
      .filter(o => o.guildId === guildId)
      .slice(-15)
      .reverse();

    if (!orders.length) {
      return interaction.reply("📦 Brak zamówień.");
    }

    const text = orders.map(o =>
      `**#${o.id}** — <@${o.userId}> — ${o.productName} — ` +
      `**${o.price.toFixed(2)} zł** — \`${o.status}\``
    ).join("\n");

    return interaction.reply({
      content: `📦 **Ostatnie zamówienia**\n${text}`
    });
  }
});

// =========================
// URUCHOMIENIE
// =========================

(async () => {

  if (!process.env.DISCORD_TOKEN || !process.env.CLIENT_ID) {
    console.error(
      "Brakuje DISCORD_TOKEN lub CLIENT_ID w pliku .env"
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

// =========================
// SERWER HTTP DLA RENDER
// =========================

const PORT = process.env.PORT || 3000;

http.createServer((req, res) => {

  res.writeHead(200, {
    "Content-Type": "text/plain"
  });

  res.end("Cosmo Shop Bot is online!");

}).listen(PORT, () => {

  console.log(
    `Serwer HTTP działa na porcie ${PORT}`
  );

});
