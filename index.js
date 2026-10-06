require("dotenv").config();

const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder
} = require("discord.js");
const fs = require("node:fs");
const path = require("node:path");

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
      o.setName("nazwa").setDescription("Nazwa produktu").setRequired(true))
    .addNumberOption(o =>
      o.setName("cena").setDescription("Cena produktu").setRequired(true).setMinValue(0))
    .addStringOption(o =>
      o.setName("opis").setDescription("Opis produktu").setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  new SlashCommandBuilder()
    .setName("produkt-usun")
    .setDescription("Usuwa produkt ze sklepu.")
    .addIntegerOption(o =>
      o.setName("id").setDescription("ID produktu").setRequired(true).setMinValue(1))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  new SlashCommandBuilder()
    .setName("produkty")
    .setDescription("Pokazuje produkty wraz z ich ID."),

  new SlashCommandBuilder()
    .setName("zamow")
    .setDescription("Tworzy zamówienie na produkt.")
    .addIntegerOption(o =>
      o.setName("id").setDescription("ID produktu").setRequired(true).setMinValue(1)),

  new SlashCommandBuilder()
    .setName("zamowienia")
    .setDescription("Pokazuje ostatnie zamówienia.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
].map(c => c.toJSON());

async function registerCommands() {
  const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);
  const route = process.env.GUILD_ID
    ? Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID)
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
  if (!interaction.isChatInputCommand()) return;

  const data = loadData();
  const guildId = interaction.guildId;
  const userId = interaction.user.id;

  if (interaction.commandName === "sklep" || interaction.commandName === "produkty") {
    const products = data.products.filter(p => p.guildId === guildId);

    if (!products.length) {
      return interaction.reply("🛒 Sklep jest obecnie pusty.");
    }

    const description = products.map(p =>
      `**#${p.id} — ${p.name}**\n${p.description || "Brak opisu"}\n💰 **${p.price.toFixed(2)} zł**`
    ).join("\n\n");

    const embed = new EmbedBuilder()
      .setTitle("🛍️ Cosmo Shøp")
      .setDescription(description.slice(0, 4096))
      .setFooter({ text: "Użyj /zamow id:<ID>, aby utworzyć zamówienie." });

    return interaction.reply({ embeds: [embed] });
  }

  if (interaction.commandName === "produkt-dodaj") {
    const name = interaction.options.getString("nazwa");
    const price = interaction.options.getNumber("cena");
    const description = interaction.options.getString("opis") || "";

    const guildProducts = data.products.filter(p => p.guildId === guildId);
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
    return interaction.reply(`✅ Dodano produkt **#${nextId} — ${name}** za **${price.toFixed(2)} zł**.`);
  }

  if (interaction.commandName === "produkt-usun") {
    const id = interaction.options.getInteger("id");
    const index = data.products.findIndex(p => p.guildId === guildId && p.id === id);

    if (index === -1) {
      return interaction.reply({ content: "❌ Nie znaleziono takiego produktu.", ephemeral: true });
    }

    const removed = data.products.splice(index, 1)[0];
    saveData(data);
    return interaction.reply(`🗑️ Usunięto produkt **#${removed.id} — ${removed.name}**.`);
  }

  if (interaction.commandName === "zamow") {
    const id = interaction.options.getInteger("id");
    const product = data.products.find(p => p.guildId === guildId && p.id === id);

    if (!product) {
      return interaction.reply({ content: "❌ Nie znaleziono takiego produktu.", ephemeral: true });
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
      `ℹ️ Płatności nie są jeszcze podłączone.`
    );
  }

  if (interaction.commandName === "zamowienia") {
    const orders = data.orders.filter(o => o.guildId === guildId).slice(-15).reverse();

    if (!orders.length) {
      return interaction.reply("📦 Brak zamówień.");
    }

    const text = orders.map(o =>
      `**#${o.id}** — <@${o.userId}> — ${o.productName} — **${o.price.toFixed(2)} zł** — \`${o.status}\``
    ).join("\n");

    return interaction.reply({ content: `📦 **Ostatnie zamówienia**\n${text}` });
  }
});

(async () => {
  if (!process.env.DISCORD_TOKEN || !process.env.CLIENT_ID) {
    console.error("Brakuje DISCORD_TOKEN lub CLIENT_ID w pliku .env");
    process.exit(1);
  }

  try {
    await registerCommands();
    await client.login(process.env.DISCORD_TOKEN);
  } catch (error) {
    console.error("Nie udało się uruchomić bota:", error);
    process.exit(1);
  }
})();
const http = require("http");

const PORT = process.env.PORT || 3000;

http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("Cosmo Shop Bot is online!");
}).listen(PORT, () => {
  console.log(`Serwer HTTP działa na porcie ${PORT}`);
});
