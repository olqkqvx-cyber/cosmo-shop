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
  StringSelectMenuOptionBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} = require("discord.js");

const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");

/* =========================================================
   COSMO SHOP
   ========================================================= */

const DATA_FILE = path.join(__dirname, "data.json");

/* =========================================================
   KONFIGURACJA
   ========================================================= */

const CHANNELS = {
  welcome: "powitalnia",
  clientPanel: "panel-klienta",
  search: "wyszukaj-produkt",
  prices: "cennik",
  legit: "czy-jestesmy-legit",
  legitChecks: "legitki",
  dailyLegit: "dzienne-legit-checki",
  opinions: "opinie"
};

const ROLES = {
  user: "Użytkownik",
  staff: "Obsługa"
};

const COLORS = {
  primary: 0x7c3aed,
  success: 0x22c55e,
  danger: 0xef4444,
  gold: 0xf59e0b,
  blue: 0x3b82f6,
  pink: 0xec4899,
  dark: 0x17121f
};

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

/* =========================================================
   BAZA DANYCH
   ========================================================= */

function defaultData() {
  return {
    products: [],
    orders: [],
    settings: {},
    daily: {},
    opinionSessions: {},
    legitSessions: {}
  };
}

function loadData() {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      const data = defaultData();
      saveData(data);
      return data;
    }

    const data = JSON.parse(
      fs.readFileSync(DATA_FILE, "utf8")
    );

    const defaults = defaultData();

    for (const key of Object.keys(defaults)) {
      if (data[key] === undefined) {
        data[key] = defaults[key];
      }
    }

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
  } catch (error) {
    console.error(
      "Nie udało się wczytać data.json:",
      error
    );

    return defaultData();
  }
}

function saveData(data) {

    try {
    
    fs.writeFileSync(
      DATA_FILE,
      JSON.stringify(data, null, 2),
      "utf8"
    );
  } catch (error) {
    console.error(
      "Nie udało się zapisać data.json:",
      error
    );
  }
}

/* =========================================================
   POMOCNICZE
   ========================================================= */

function cleanName(name) {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9-_]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 35) || "klient";
}

function money(value) {
  return `${Number(value || 0).toFixed(2)} zł`;
}

function getChannel(guild, name) {
  return guild.channels.cache.find(
    channel =>
      channel.name.toLowerCase() ===
      name.toLowerCase()
  );
}

function getRole(guild, name) {
  return guild.roles.cache.find(
    role =>
      role.name.toLowerCase() ===
      name.toLowerCase()
  );
}

function isStaff(interaction) {
  return Boolean(
    interaction.memberPermissions?.has(
      PermissionFlagsBits.ManageGuild
    )
  );
}

function starString(value) {
  const amount = Math.max(
    1,
    Math.min(5, Number(value) || 1)
  );

  return "⭐".repeat(amount);
}

function todayKey() {
  const now = new Date();

  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0")
  ].join("-");
}

function getDaily(guildId, data) {
  const key = `${guildId}_${todayKey()}`;

  if (!data.daily[key]) {
    data.daily[key] = {
      guildId,
      date: todayKey(),
      count: 0,
      money: 0
    };
  }

  return data.daily[key];
}

function getGuildOrders(data, guildId) {
  return data.orders.filter(
    order => order.guildId === guildId
  );
}

function getUserOrders(data, guildId, userId) {
  return getGuildOrders(data, guildId).filter(
    order => order.userId === userId
  );
}

function getTotalSpent(data, guildId, userId) {
  return getUserOrders(
    data,
    guildId,
    userId
  ).reduce(
    (sum, order) =>
      sum + Number(order.price || 0),
    0
  );
}

function productById(data, guildId, id) {
  return data.products.find(
    product =>
      product.guildId === guildId &&
      product.id === Number(id)
  );
}

/* =========================================================
   EMBEDY
   ========================================================= */

function shopEmbed() {
  return new EmbedBuilder()
    .setColor(COLORS.primary)
    .setTitle("🌌 COSMO SHOP")
    .setDescription(
      [
        "Witaj w **Cosmo Shop**!",
        "",
        "✨ Najlepsze produkty",
        "🛒 Bezpieczne zakupy",
        "⚡ Szybka realizacja",
        "💎 Profesjonalna obsługa",
        "",
        "Wybierz opcję poniżej, aby rozpocząć."
      ].join("\n")
    )
    .setFooter({
      text: "Cosmo Shop • System zakupowy"
    })
    .setTimestamp();
}

function welcomeEmbed(member) {
  return new EmbedBuilder()
    .setColor(COLORS.primary)
    .setTitle("🌌 WITAJ W COSMO SHOP!")
    .setDescription(
      [
        `👋 Witaj ${member}!`,
        "",
        "Cieszymy się, że do nas dołączyłeś/aś!",
        "",
        "🛒 **Sklep** — znajdziesz tutaj nasze produkty.",
        "🎫 **Tickety** — jeżeli potrzebujesz pomocy.",
        "⭐ **Opinie** — możesz zostawić swoją opinię.",
        "🟩 **Legitki** — zobacz opinie naszych klientów.",
        "",
        "Życzymy udanych zakupów! 💜"
      ].join("\n")
    )
    .setThumbnail(
      member.user.displayAvatarURL({
        extension: "png",
        size: 256
      })
    )
    .setFooter({
      text: "Cosmo Shop • Witamy na pokładzie!"
    })
    .setTimestamp();
}

function clientPanelEmbed() {
  return new EmbedBuilder()
    .setColor(COLORS.primary)
    .setTitle("🌌 PANEL KLIENTA")
    .setDescription(
      [
        "Witaj w **Panelu Klienta Cosmo Shop**.",
        "",
        "📜 **Historia zakupów**",
        "Sprawdź swoje poprzednie zakupy oraz wydane pieniądze.",
        "",
        "🏆 **Topka wydanych pieniędzy**",
        "Zobacz klientów, którzy wydali u nas najwięcej.",
        "",
        "🎖️ **Przenieś rangę**",
        "Potrzebujesz przenieść rangę na inne konto?",
        "Utwórz ticket, a obsługa zajmie się sprawą.",
        "",
        "👇 Wybierz opcję poniżej."
      ].join("\n")
    )
    .setFooter({
      text: "Cosmo Shop • Panel Klienta"
    })
    .setTimestamp();
}

/* =========================================================
   SELECTY
   ========================================================= */

function categoryMenu(customId) {
  const menu = new StringSelectMenuBuilder()
    .setCustomId(customId)
    .setPlaceholder("📁 Wybierz kategorię...");

  for (const [id, category] of Object.entries(
    CATEGORIES
  )) {
    menu.addOptions(
      new StringSelectMenuOptionBuilder()
        .setLabel(category.name)
        .setEmoji(category.emoji)
        .setValue(id)
    );
  }

  return new ActionRowBuilder().addComponents(menu);
}

/* =========================================================
   KOMENDY
   ========================================================= */

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
    .addStringOption(option =>
      option
        .setName("opis")
        .setDescription("Opis produktu")
        .setRequired(false)
    )
    .setDefaultMemberPermissions(
      PermissionFlagsBits.ManageGuild
    ),

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
    .setDefaultMemberPermissions(
      PermissionFlagsBits.ManageGuild
    ),

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

  new SlashCommandBuilder()
    .setName("zamowienia")
    .setDescription("Pokazuje zamówienia.")
    .setDefaultMemberPermissions(
      PermissionFlagsBits.ManageGuild
    ),

  new SlashCommandBuilder()
    .setName("panel-zakup")
    .setDescription("Tworzy panel zakupowy.")
    .setDefaultMemberPermissions(
      PermissionFlagsBits.ManageGuild
    ),

  new SlashCommandBuilder()
    .setName("panel-klienta")
    .setDescription("Tworzy panel klienta.")
    .setDefaultMemberPermissions(
      PermissionFlagsBits.ManageGuild
    ),

  new SlashCommandBuilder()
    .setName("panel-cennik")
    .setDescription("Tworzy panel cennika.")
    .setDefaultMemberPermissions(
      PermissionFlagsBits.ManageGuild
    ),

  new SlashCommandBuilder()
    .setName("panel-wyszukaj")
    .setDescription("Tworzy panel wyszukiwania.")
    .setDefaultMemberPermissions(
      PermissionFlagsBits.ManageGuild
    ),

  new SlashCommandBuilder()
    .setName("panel-legit")
    .setDescription("Tworzy panel legit.")
    .setDefaultMemberPermissions(
      PermissionFlagsBits.ManageGuild
    ),

  new SlashCommandBuilder()
    .setName("panel-opinie")
    .setDescription("Tworzy panel opinii.")
    .setDefaultMemberPermissions(
      PermissionFlagsBits.ManageGuild
    ),

  new SlashCommandBuilder()
    .setName("panel-dzienne")
    .setDescription("Tworzy panel dziennych legit-checków.")
    .setDefaultMemberPermissions(
      PermissionFlagsBits.ManageGuild
    )
].map(command => command.toJSON());

/* =========================================================
   REJESTRACJA KOMEND
   ========================================================= */

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

  console.log(
    "✅ Komendy slash zostały zarejestrowane."
  );
}

/* =========================================================
   CLIENT
   ========================================================= */

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.MessageContent
  ]
});

/* =========================================================
   READY
   ========================================================= */

client.once("ready", async () => {
  console.log(
    `✅ Zalogowano jako ${client.user.tag}`
  );

  console.log(
    "🌌 Cosmo Shop • Bot jest online."
  );

  await updateAllLegitChannelNames();
});

/* =========================================================
   NOWY UŻYTKOWNIK
   ========================================================= */

client.on(
  "guildMemberAdd",
  async member => {
    try {
      const role = getRole(
        member.guild,
        ROLES.user
      );

      if (role) {
        await member.roles.add(
          role,
          "Automatyczna ranga po dołączeniu"
        ).catch(error => {
          console.error(
            "Nie udało się nadać rangi Użytkownik:",
            error
          );
        });
      }

      const welcomeChannel = getChannel(
        member.guild,
        CHANNELS.welcome
      );

      if (welcomeChannel) {
        await welcomeChannel.send({
          embeds: [
            welcomeEmbed(member)
          ]
        });
      }
    } catch (error) {
      console.error(
        "Błąd guildMemberAdd:",
        error
      );
    }
  }
);

/* =========================================================
   INTERACTIONS
   ========================================================= */

client.on(
  "interactionCreate",
  async interaction => {
    try {
      const data = loadData();
      const guildId = interaction.guildId;

      if (!guildId) {
        return;
      }

      /* =====================================================
         SLASH COMMANDS
         ===================================================== */

      if (interaction.isChatInputCommand()) {

        /* ===============================
           SKLEP
        =============================== */

        if (
          interaction.commandName === "sklep" ||
          interaction.commandName === "produkty"
        ) {
          const products =
            data.products.filter(
              product =>
                product.guildId === guildId
            );

          if (!products.length) {
            return interaction.reply({
              content:
                "🛒 Sklep jest obecnie pusty."
            });
          }

          const embed = shopEmbed();

          const grouped = {};

          for (const product of products) {
            const category =
              product.category || "inne";

            if (!grouped[category]) {
              grouped[category] = [];
            }

            grouped[category].push(product);
          }

          let description = "";

          for (const [categoryId, items] of Object.entries(
            grouped
          )) {
            const category =
              CATEGORIES[categoryId] ||
              CATEGORIES.inne;

            description +=
              `\n${category.emoji} **${category.name}**\n`;

            for (const product of items) {
              description +=
                `> **#${product.id} — ${product.name}** • **${money(product.price)}**\n`;
            }
          }

          embed.setDescription(
            description.slice(0, 4096)
          );

          return interaction.reply({
            embeds: [embed]
          });
        }

        /* ===============================
           PRODUKT DODAJ
        =============================== */

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
              product =>
                product.guildId === guildId
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
            category,
            description,
            createdAt:
              new Date().toISOString()
          });

          saveData(data);

          return interaction.reply({
            content:
              `✅ Dodano **#${nextId} — ${name}** za **${money(price)}**.`
          });
        }

        /* ===============================
           PRODUKT USUŃ
        =============================== */

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
            data.products.splice(
              index,
              1
            )[0];

          saveData(data);

          return interaction.reply({
            content:
              `🗑️ Usunięto **#${removed.id} — ${removed.name}**.`
          });
        }

        /* ===============================
           ZAMÓW
        =============================== */

        if (
          interaction.commandName === "zamow"
        ) {
          const id =
            interaction.options.getInteger(
              "id"
            );

          const product =
            productById(
              data,
              guildId,
              id
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
            userId:
              interaction.user.id,
            productId:
              product.id,
            productName:
              product.name,
            price:
              product.price,
            paymentMethod:
              "Nie podano",
            sellerId: null,
            status: "nowe",
            createdAt:
              new Date().toISOString()
          });

          saveData(data);

          return interaction.reply({
            content:
              `✅ Zamówienie **#${orderId}** zostało utworzone.\n📦 ${product.name}\n💰 ${money(product.price)}`
          });
        }

        /* ===============================
           ZAMÓWIENIA
        =============================== */

        if (
          interaction.commandName ===
          "zamowienia"
        ) {
          const orders =
            getGuildOrders(
              data,
              guildId
            )
              .slice(-20)
              .reverse();

          if (!orders.length) {
            return interaction.reply({
              content:
                "📦 Nie ma jeszcze żadnych zamówień."
            });
          }

          const text = orders
            .map(order =>
              `**#${order.id}** • <@${order.userId}> • ${order.productName} • **${money(order.price)}** • \`${order.status}\``
            )
            .join("\n");

          return interaction.reply({
            embeds: [
              new EmbedBuilder()
                .setColor(COLORS.primary)
                .setTitle(
                  "📦 OSTATNIE ZAMÓWIENIA"
                )
                .setDescription(
                  text.slice(0, 4096)
                )
            ]
          });
        }

        /* ===============================
           PANEL ZAKUPU
        =============================== */

        if (
          interaction.commandName ===
          "panel-zakup"
        ) {
          const row =
            new ActionRowBuilder()
              .addComponents(
                new ButtonBuilder()
                  .setCustomId(
                    "otworz_sklep"
                  )
                  .setLabel(
                    "Kup produkt"
                  )
                  .setEmoji("🛒")
                  .setStyle(
                    ButtonStyle.Primary
                  )
              );

          return interaction.reply({
            embeds: [
              shopEmbed()
            ],
            components: [row]
          });
        }

        /* ===============================
           PANEL KLIENTA
        =============================== */

        if (
          interaction.commandName ===
          "panel-klienta"
        ) {
          const row =
            new ActionRowBuilder()
              .addComponents(
                new ButtonBuilder()
                  .setCustomId(
                    "historia_zakupow"
                  )
                  .setLabel(
                    "Historia zakupów"
                  )
                  .setEmoji("📜")
                  .setStyle(
                    ButtonStyle.Primary
                  ),

                new ButtonBuilder()
                  .setCustomId(
                    "topka_wydanych"
                  )
                  .setLabel(
                    "Topka wydanych"
                  )
                  .setEmoji("🏆")
                  .setStyle(
                    ButtonStyle.Success
                  ),

                new ButtonBuilder()
                  .setCustomId(
                    "przenies_role"
                  )
                  .setLabel(
                    "Przenieś rangę"
                  )
                  .setEmoji("🎖️")
                  .setStyle(
                    ButtonStyle.Secondary
                  )
              );

          return interaction.reply({
            embeds: [
              clientPanelEmbed()
            ],
            components: [row]
          });
        }

        /* ===============================
           PANEL CENNIKA
        =============================== */

        if (
          interaction.commandName ===
          "panel-cennik"
        ) {
          return interaction.reply({
            embeds: [
              new EmbedBuilder()
                .setColor(COLORS.gold)
                .setTitle(
                  "💰 CENNIK COSMO SHOP"
                )
                .setDescription(
                  "Wybierz kategorię, aby zobaczyć wszystkie dostępne produkty oraz ich ceny."
                )
            ],
            components: [
              categoryMenu(
                "cennik_kategoria"
              )
            ]
          });
        }

        /* ===============================
           PANEL WYSZUKIWANIA
        =============================== */

        if (
          interaction.commandName ===
          "panel-wyszukaj"
        ) {
          const row =
            new ActionRowBuilder()
              .addComponents(
                new ButtonBuilder()
                  .setCustomId(
                    "wyszukaj_produkt"
                  )
                  .setLabel(
                    "Wyszukaj produkt"
                  )
                  .setEmoji("🔎")
                  .setStyle(
                    ButtonStyle.Primary
                  )
              );

          return interaction.reply({
            embeds: [
              new EmbedBuilder()
                .setColor(COLORS.blue)
                .setTitle(
                  "🔎 WYSZUKAJ PRODUKT"
                )
                .setDescription(
                  [
                    "Szukasz konkretnego produktu?",
                    "",
                    "Kliknij przycisk poniżej i wpisz nazwę produktu.",
                    "",
                    "⚡ Wyszukiwanie działa po nazwie produktu."
                  ].join("\n")
                )
            ],
            components: [row]
          });
        }

        /* ===============================
           PANEL LEGIT
        =============================== */

        if (
          interaction.commandName ===
          "panel-legit"
        ) {
          const row =
            new ActionRowBuilder()
              .addComponents(
                new ButtonBuilder()
                  .setCustomId(
                    "legit_yes"
                  )
                  .setLabel(
                    "Jesteśmy legit"
                  )
                  .setEmoji("🟩")
                  .setStyle(
                    ButtonStyle.Success
                  ),

                new ButtonBuilder()
                  .setCustomId(
                    "legit_no"
                  )
                  .setLabel(
                    "Nie jesteśmy legit"
                  )
                  .setEmoji("🟥")
                  .setStyle(
                    ButtonStyle.Danger
                  )
              );

          return interaction.reply({
            embeds: [
              new EmbedBuilder()
                .setColor(COLORS.success)
                .setTitle(
                  "🟩 CZY NASZ SERWER JEST LEGIT?"
                )
                .setDescription(
                  [
                    "Czy uważasz, że **Cosmo Shop** jest legit?",
                    "",
                    "🟩 — Tak, jesteśmy legit.",
                    "🟥 — Nie, nie jesteśmy legit.",
                    "",
                    "⚠️ **Bezpodstawne zgłoszenia są traktowane jako próba celowego szkodzenia serwerowi i mogą skutkować konsekwencjami moderacyjnymi.**"
                  ].join("\n")
                )
            ],
            components: [row]
          });
        }

        /* ===============================
           PANEL OPINII
        =============================== */

        if (
          interaction.commandName ===
          "panel-opinie"
        ) {
          return interaction.reply({
            embeds: [
              new EmbedBuilder()
                .setColor(COLORS.pink)
                .setTitle(
                  "🪐 OPINIE KLIENTÓW"
                )
                .setDescription(
                  [
                    "Chcesz zostawić opinię po zakupie?",
                    "",
                    "Kliknij **🪐** poniżej, aby rozpocząć.",
                    "",
                    "Twoja opinia pomoże innym klientom wybrać Cosmo Shop."
                  ].join("\n")
                )
            ],
            components: [
              new ActionRowBuilder()
                .addComponents(
                  new ButtonBuilder()
                    .setCustomId(
                      "otworz_opinie"
                    )
                    .setLabel(
                      "🪐 Zostaw opinię"
                    )
                    .setStyle(
                      ButtonStyle.Primary
                    )
                )
            ]
          });
        }

        /* ===============================
           PANEL DZIENNY
        =============================== */

        if (
          interaction.commandName ===
          "panel-dzienne"
        ) {
          const daily =
            getDaily(
              guildId,
              data
            );

          saveData(data);

          return interaction.reply({
            embeds: [
              new EmbedBuilder()
                .setColor(COLORS.gold)
                .setTitle(
                  "📊 DZISIEJSZE LEGIT-CHECKI"
                )
                .setDescription(
                  [
                    `🟢 Liczba legit-checków: **${daily.count}**`,
                    `💰 Wydane dzisiaj: **${money(daily.money)}**`,
                    "",
                    "Statystyki są resetowane codziennie o **00:00**."
                  ].join("\n")
                )
            ]
          });
        }
      }

      /* =====================================================
         BUTTONY
         ===================================================== */

      if (interaction.isButton()) {

        /* ===============================
           OTWÓRZ SKLEP
        =============================== */

        if (
          interaction.customId ===
          "otworz_sklep"
        ) {
          const products =
            data.products.filter(
              product =>
                product.guildId === guildId
            );

          if (!products.length) {
            return interaction.reply({
              content:
                "🛒 Sklep jest obecnie pusty.",
              ephemeral: true
            });
          }

          return interaction.reply({
            content:
              "🛒 **Wybierz kategorię produktu:**",
            components: [
              categoryMenu(
                "wybierz_kategorie"
              )
            ],
            ephemeral: true
          });
        }

        /* ===============================
           HISTORIA ZAKUPÓW
        =============================== */

        if (
          interaction.customId ===
          "historia_zakupow"
        ) {
          await interaction.deferReply({
            ephemeral: true
          });

          const orders =
            getUserOrders(
              data,
              guildId,
              interaction.user.id
            );

          if (!orders.length) {
            return interaction.editReply({
              content:
                "📜 Nie masz jeszcze żadnych zakupów."
            });
          }

          const lines =
            orders
              .slice(-20)
              .reverse()
              .map(order =>
                `🛒 **${order.productName}** — **${money(order.price)}**\n└ 📅 <t:${Math.floor(new Date(order.createdAt).getTime() / 1000)}:f>`
              );

          return interaction.editReply({
            embeds: [
              new EmbedBuilder()
                .setColor(COLORS.primary)
                .setTitle(
                  "📜 TWOJA HISTORIA ZAKUPÓW"
                )
                .setDescription(
                  lines.join("\n\n").slice(0, 4096)
                )
                .addFields({
                  name: "💰 Łącznie wydano",
                  value: money(
                    getTotalSpent(
                      data,
                      guildId,
                      interaction.user.id
                    )
                  ),
                  inline: true
                })
            ]
          });
        }

        /* ===============================
           TOPKA
        =============================== */

        if (
          interaction.customId ===
          "topka_wydanych"
        ) {
          await interaction.deferReply({
            ephemeral: true
          });

          const orders =
            getGuildOrders(
              data,
              guildId
            );

          const totals = {};

          for (const order of orders) {
            if (!totals[order.userId]) {
              totals[order.userId] = 0;
            }

            totals[order.userId] +=
              Number(order.price || 0);
          }

          const ranking =
            Object.entries(totals)
              .sort(
                (a, b) =>
                  b[1] - a[1]
              )
              .slice(0, 10);

          if (!ranking.length) {
            return interaction.editReply({
              content:
                "🏆 Nie ma jeszcze danych do stworzenia topki."
            });
          }

          const text =
            ranking
              .map(
                ([userId, total], index) =>
                  `**${index + 1}.** <@${userId}> — **${money(total)}**`
              )
              .join("\n");

          return interaction.editReply({
            embeds: [
              new EmbedBuilder()
                .setColor(COLORS.gold)
                .setTitle(
                  "🏆 TOPKA WYDANYCH PIENIĘDZY"
                )
                .setDescription(text)
                .setFooter({
                  text: "Cosmo Shop • Ranking klientów"
                })
            ]
          });
        }

        /* ===============================
           PRZENOSZENIE RANGI
        =============================== */

        if (
          interaction.customId ===
          "przenies_role"
        ) {
          const modal =
            new ModalBuilder()
              .setCustomId(
                "modal_przenies_role"
              )
              .setTitle(
                "🎖️ Przeniesienie rangi"
              );

          const roleInput =
            new TextInputBuilder()
              .setCustomId(
                "nazwa_rangi"
              )
              .setLabel(
                "Jaką rangę chcesz przenieść?"
              )
              .setPlaceholder(
                "np. VIP, Premium, Booster..."
              )
              .setStyle(
                TextInputStyle.Short
              )
              .setRequired(true)
              .setMaxLength(100);

          const accountInput =
            new TextInputBuilder()
              .setCustomId(
                "nowe_konto"
              )
              .setLabel(
                "ID nowego konta"
              )
              .setPlaceholder(
                "Wpisz Discord ID nowego konta"
              )
              .setStyle(
                TextInputStyle.Short
              )
              .setRequired(true)
              .setMaxLength(30);

          modal.addComponents(
            new ActionRowBuilder()
              .addComponents(
                roleInput
              ),
            new ActionRowBuilder()
              .addComponents(
                accountInput
              )
          );

          return interaction.showModal(
            modal
          );
        }

        /* ===============================
           WYSZUKIWANIE
        =============================== */

        if (
          interaction.customId ===
          "wyszukaj_produkt"
        ) {
          const modal =
            new ModalBuilder()
              .setCustomId(
                "modal_wyszukaj_produkt"
              )
              .setTitle(
                "🔎 Wyszukaj produkt"
              );

          const input =
            new TextInputBuilder()
              .setCustomId(
                "szukana_nazwa"
              )
              .setLabel(
                "Nazwa produktu"
              )
              .setPlaceholder(
                "np. Minecraft, Nitro, konto..."
              )
              .setStyle(
                TextInputStyle.Short
              )
              .setRequired(true)
              .setMaxLength(100);

          modal.addComponents(
            new ActionRowBuilder()
              .addComponents(input)
          );

          return interaction.showModal(
            modal
          );
        }

        /* ===============================
           LEGIT TAK
        =============================== */

        if (
          interaction.customId ===
          "legit_yes"
        ) {
          return interaction.reply({
            content:
              "🟩 Dziękujemy za pozytywną opinię o Cosmo Shop! 💜",
            ephemeral: true
          });
        }

        /* ===============================
           LEGIT NIE
        =============================== */

        if (
          interaction.customId ===
          "legit_no"
        ) {
          return interaction.reply({
            content:
              "🟥 Twoje zgłoszenie zostało odnotowane. Jeżeli masz problem z zakupem lub serwerem, skontaktuj się z obsługą.",
            ephemeral: true
          });
        }

        /* ===============================
           OPINIA
        =============================== */

        if (
          interaction.customId ===
          "otworz_opinie"
        ) {
          const modal =
            new ModalBuilder()
              .setCustomId(
                "modal_opinia"
              )
              .setTitle(
                "🪐 Twoja opinia"
              );

          const content =
            new TextInputBuilder()
              .setCustomId(
                "tresc_opinii"
              )
              .setLabel(
                "Napisz swoją opinię"
              )
              .setPlaceholder(
                "Napisz tutaj swoją opinię o zakupie..."
              )
              .setStyle(
                TextInputStyle.Paragraph
              )
              .setRequired(true)
              .setMaxLength(1000);

          modal.addComponents(
            new ActionRowBuilder()
              .addComponents(content)
          );

          return interaction.showModal(
            modal
          );
        }

        /* ===============================
           OCENA 1-5
        =============================== */

        if (
          interaction.customId.startsWith(
            "opinia_dostawa_"
          )
        ) {
          const value = Number(
            interaction.customId.split(
              "_"
            )[2]
          );

          const session =
            data.opinionSessions[
              interaction.user.id
            ];

          if (!session) {
            return interaction.reply({
              content:
                "❌ Sesja opinii wygasła. Rozpocznij opinię ponownie.",
              ephemeral: true
            });
          }

          session.delivery = value;

          saveData(data);

          return askOpinionTransaction(
            interaction,
            data
          );
        }

        if (
          interaction.customId.startsWith(
            "opinia_transakcja_"
          )
        ) {
          const value = Number(
            interaction.customId.split(
              "_"
            )[2]
          );

          const session =
            data.opinionSessions[
              interaction.user.id
            ];

          if (!session) {
            return interaction.reply({
              content:
                "❌ Sesja opinii wygasła.",
              ephemeral: true
            });
          }

          session.transaction =
            value;

          saveData(data);

          return askOpinionQuality(
            interaction,
            data
          );
        }

        if (
          interaction.customId.startsWith(
            "opinia_jakosc_"
          )
        ) {
          const value = Number(
            interaction.customId.split(
              "_"
            )[2]
          );

          const session =
            data.opinionSessions[
              interaction.user.id
            ];

          if (!session) {
            return interaction.reply({
              content:
                "❌ Sesja opinii wygasła.",
              ephemeral: true
            });
          }

          session.quality = value;

          saveData(data);

          const channel =
            getChannel(
              interaction.guild,
              CHANNELS.opinions
            );

          if (channel) {
            await channel.send({
              embeds: [
                new EmbedBuilder()
                  .setColor(COLORS.pink)
                  .setTitle(
                    "🪐 NOWA OPINIA KLIENTA"
                  )
                  .setDescription(
                    session.content
                  )
                  .addFields(
                    {
                      name: "👤 Twórca opinii",
                      value:
                        `<@${interaction.user.id}>`
                    },
                    {
                      name:
                        "🚚 Czas dostawy",
                      value:
                        starString(
                          session.delivery
                        ),
                      inline: true
                    },
                    {
                      name:
                        "💳 Przebieg transakcji",
                      value:
                        starString(
                          session.transaction
                        ),
                      inline: true
                    },
                    {
                      name:
                        "📦 Jakość produktu",
                      value:
                        starString(
                          session.quality
                        ),
                      inline: true
                    }
                  )
                  .setFooter({
                    text:
                      "Cosmo Shop • Opinie klientów"
                  })
                  .setTimestamp()
              ]
            });
          }

          delete data.opinionSessions[
            interaction.user.id
          ];

          saveData(data);

          return interaction.update({
            content:
              "🪐 **Dziękujemy za opinię!** Została opublikowana.",
            embeds: [],
            components: []
          });
        }

        /* ===============================
           PŁATNOŚĆ
        =============================== */

        if (
          interaction.customId ===
          "platnosc"
        ) {
          const modal =
            new ModalBuilder()
              .setCustomId(
                "modal_platnosc"
              )
              .setTitle(
                "💳 Metoda płatności"
              );

          const input =
            new TextInputBuilder()
              .setCustomId(
                "metoda_platnosci"
              )
              .setLabel(
                "Czym klient zapłacił?"
              )
              .setPlaceholder(
                "np. PayPal, BLIK, przelew..."
              )
              .setStyle(
                TextInputStyle.Short
              )
              .setRequired(true)
              .setMaxLength(100);

          modal.addComponents(
            new ActionRowBuilder()
              .addComponents(input)
          );

          return interaction.showModal(
            modal
          );
        }

        /* ===============================
           ZAMÓWIENIE GOTOWE
        =============================== */

        if (
          interaction.customId ===
          "zamowienie_gotowe"
        ) {
          if (!isStaff(interaction)) {
            return interaction.reply({
              content:
                "❌ Tylko obsługa może oznaczyć zamówienie jako gotowe.",
              ephemeral: true
            });
          }

          await interaction.deferReply();

          const channelName =
            interaction.channel.name;

          const dataMatch =
            data.orders.find(
              order =>
                order.ticketChannelId ===
                interaction.channel.id
            );

          if (dataMatch) {
            dataMatch.status =
              "gotowe";

            dataMatch.sellerId =
              interaction.user.id;

            saveData(data);
          }

          const row =
            new ActionRowBuilder()
              .addComponents(
                new ButtonBuilder()
                  .setCustomId(
                    "legit_payment_yes"
                  )
                  .setLabel(
                    "Płatność przebiegła pomyślnie"
                  )
                  .setEmoji("🟩")
                  .setStyle(
                    ButtonStyle.Success
                  ),

                new ButtonBuilder()
                  .setCustomId(
                    "legit_payment_no"
                  )
                  .setLabel(
                    "Płatność NIE przebiegła"
                  )
                  .setEmoji("🟥")
                  .setStyle(
                    ButtonStyle.Danger
                  )
              );

          if (dataMatch) {
            data.legitSessions[
              interaction.channel.id
            ] = {
              orderId:
                dataMatch.id,
              sellerId:
                interaction.user.id
            };

            saveData(data);
          }

          return interaction.editReply({
            embeds: [
              new EmbedBuilder()
                .setColor(COLORS.gold)
                .setTitle(
                  "📦 ZAMÓWIENIE GOTOWE"
                )
                .setDescription(
                  [
                    "Czy płatność przebiegła pomyślnie?",
                    "",
                    "🟩 **Tak** — wszystko przebiegło pomyślnie.",
                    "🟥 **Nie** — zgłoś problem obsłudze.",
                    "",
                    "⚠️ Bezpodstawne zgłoszenia mogą skutkować konsekwencjami moderacyjnymi."
                  ].join("\n")
                )
            ],
            components: [row]
          });
        }

        /* ===============================
           LEGIT PO ZAMÓWIENIU - TAK
        =============================== */

        if (
          interaction.customId ===
          "legit_payment_yes"
        ) {
          await interaction.deferReply({
            ephemeral: true
          });

          const session =
            data.legitSessions[
              interaction.channel.id
            ];

          if (!session) {
            return interaction.editReply({
              content:
                "❌ Nie znaleziono danych zamówienia."
            });
          }

          const order =
            data.orders.find(
              item =>
                item.id ===
                session.orderId
            );

          if (!order) {
            return interaction.editReply({
              content:
                "❌ Nie znaleziono zamówienia."
            });
          }

          order.status =
            "zrealizowane";

          order.buyerId =
            interaction.user.id;

          if (!order.sellerId) {
            order.sellerId =
              session.sellerId;
          }

          order.completedAt =
            new Date().toISOString();

          saveData(data);

          const legitChannel =
            getChannel(
              interaction.guild,
              CHANNELS.legitChecks
            );

          const daily =
            getDaily(
              guildId,
              data
            );

          daily.count += 1;
          daily.money +=
            Number(order.price || 0);

          saveData(data);

          if (legitChannel) {
            await legitChannel.send({
              embeds: [
                new EmbedBuilder()
                  .setColor(COLORS.success)
                  .setTitle(
                    "🟩 NOWY LEGIT CHECK"
                  )
                  .setDescription(
                    `Klient potwierdził pomyślną realizację zamówienia **${order.productName}**.`
                  )
                  .addFields(
                    {
                      name: "📦 Produkt",
                      value:
                        order.productName,
                      inline: true
                    },
                    {
                      name: "💰 Cena",
                      value:
                        money(order.price),
                      inline: true
                    },
                    {
                      name: "💳 Płatność",
                      value:
                        order.paymentMethod ||
                        "Nie podano",
                      inline: true
                    },
                    {
                      name: "🧑‍💼 Sprzedawca",
                      value:
                        order.sellerId
                          ? `<@${order.sellerId}>`
                          : "Nie podano",
                      inline: true
                    },
                    {
                      name: "👤 Kupujący",
                      value:
                        `<@${order.buyerId}>`,
                      inline: true
                    }
                  )
                  .setFooter({
                    text:
                      "Cosmo Shop • Zweryfikowana transakcja"
                  })
                  .setTimestamp()
              ]
            });
          }

          delete data.legitSessions[
            interaction.channel.id
          ];

          saveData(data);

          await updateLegitChannelName(
            interaction.guild
          );

          return interaction.editReply({
            content:
              "🟩 Dziękujemy! Legit-check został zapisany."
          });
        }

        /* ===============================
           LEGIT PO ZAMÓWIENIU - NIE
        =============================== */

        if (
          interaction.customId ===
          "legit_payment_no"
        ) {
          return interaction.reply({
            content:
              "🟥 Zgłoszenie zostało zapisane. Skontaktuj się z obsługą, aby wyjaśnić problem z płatnością.",
            ephemeral: true
          });
        }

        /* ===============================
           ZAMKNIJ TICKET
        =============================== */

        if (
          interaction.customId ===
          "zamknij_ticket"
        ) {
          if (!isStaff(interaction)) {
            return interaction.reply({
              content:
                "❌ Tylko obsługa może zamknąć ticket.",
              ephemeral: true
            });
          }

          await interaction.reply({
            content:
              "🔒 Ticket zostanie zamknięty za **3 sekundy**."
          });

          const channel =
            interaction.channel;

          const parent =
            channel.parent;

          setTimeout(
            async () => {
              try {
                await channel.delete();

                if (
                  parent &&
                  parent.type ===
                    ChannelType.GuildCategory
                ) {
                  const freshParent =
                    await interaction.guild.channels
                      .fetch(parent.id)
                      .catch(
                        () => null
                      );

                  if (
                    freshParent &&
                    freshParent.children
                      .cache.size === 0
                  ) {
                    await freshParent
                      .delete()
                      .catch(
                        () => {}
                      );
                  }
                }
              } catch (error) {
                console.error(
                  "Błąd zamykania ticketu:",
                  error
                );
              }
            },
            3000
          );

          return;
        }
      }

      /* =====================================================
         SELECT MENU
         ===================================================== */

      if (
        interaction.isStringSelectMenu()
      ) {

        /* ===============================
           KATEGORIA ZAKUPU
        =============================== */

        if (
          interaction.customId ===
          "wybierz_kategorie"
        ) {
          const categoryId =
            interaction.values[0];

          const products =
            data.products.filter(
              product =>
                product.guildId === guildId &&
                (product.category ||
                  "inne") ===
                  categoryId
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
                `${category.emoji} Wybierz produkt...`
              );

          for (const product of products.slice(
            0,
            25
          )) {
            menu.addOptions(
              new StringSelectMenuOptionBuilder()
                .setLabel(
                  `${product.name} — ${money(product.price)}`
                    .slice(0, 100)
                )
                .setDescription(
                  (
                    product.description ||
                    "Brak opisu"
                  ).slice(0, 100)
                )
                .setValue(
                  String(product.id)
                )
            );
          }

          return interaction.update({
            content:
              `${category.emoji} **${category.name}**\n\nWybierz produkt:`,
            components: [
              new ActionRowBuilder()
                .addComponents(menu)
            ]
          });
        }

        /* ===============================
           WYBÓR PRODUKTU
           WAŻNA POPRAWKA TIMEOUTU
        =============================== */

        if (
          interaction.customId.startsWith(
            "wybierz_produkt_"
          )
        ) {
          const productId =
            Number(
              interaction.values[0]
            );

          const product =
            productById(
              data,
              guildId,
              productId
            );

          if (!product) {
            return interaction.update({
              content:
                "❌ Nie znaleziono produktu.",
              components: []
            });
          }

          const staffRole =
            getRole(
              interaction.guild,
              ROLES.staff
            );

          if (!staffRole) {
            return interaction.update({
              content:
                "❌ Nie znaleziono roli `Obsługa`.",
              components: []
            });
          }

          /*
            ===================================================
            NAJWAŻNIEJSZA POPRAWKA

            Najpierw potwierdzamy interakcję.
            Dopiero później tworzymy kategorię i kanał.

            Dzięki temu Discord nie zwróci:
            "This interaction failed"
            / "Bot nie odpowiedział na czas".
            ===================================================
          */

          await interaction.deferUpdate();

          try {
            const username =
              cleanName(
                interaction.user.username
              );

            const ticketCategory =
              await interaction.guild.channels.create(
                {
                  name:
                    `🛒 ZAKUP - ${username}`
                      .slice(0, 100),

                  type:
                    ChannelType.GuildCategory,

                  permissionOverwrites: [
                    {
                      id:
                        interaction.guild
                          .roles.everyone.id,

                      deny: [
                        "ViewChannel"
                      ]
                    },

                    {
                      id:
                        interaction.user.id,

                      allow: [
                        "ViewChannel",
                        "SendMessages",
                        "ReadMessageHistory",
                        "AttachFiles"
                      ]
                    },

                    {
                      id:
                        staffRole.id,

                      allow: [
                        "ViewChannel",
                        "SendMessages",
                        "ReadMessageHistory",
                        "ManageChannels",
                        "AttachFiles"
                      ]
                    }
                  ]
                }
              );

            const ticketChannel =
              await interaction.guild.channels.create(
                {
                  name:
                    `🛒・zakup-${username}`
                      .slice(0, 100),

                  type:
                    ChannelType.GuildText,

                  parent:
                    ticketCategory.id,

                  permissionOverwrites: [
                    {
                      id:
                        interaction.guild
                          .roles.everyone.id,

                      deny: [
                        "ViewChannel"
                      ]
                    },

                    {
                      id:
                        interaction.user.id,

                      allow: [
                        "ViewChannel",
                        "SendMessages",
                        "ReadMessageHistory",
                        "AttachFiles"
                      ]
                    },

                    {
                      id:
                        staffRole.id,

                      allow: [
                        "ViewChannel",
                        "SendMessages",
                        "ReadMessageHistory",
                        "ManageChannels",
                        "AttachFiles"
                      ]
                    }
                  ]
                }
              );

            const orderId =
              data.orders.length
                ? Math.max(
                    ...data.orders.map(
                      order => order.id
                    )
                  ) + 1
                : 1;

            const order = {
              id: orderId,
              guildId,
              userId:
                interaction.user.id,
              productId:
                product.id,
              productName:
                product.name,
              price:
                product.price,
              paymentMethod:
                "Nie podano",
              sellerId: null,
              ticketChannelId:
                ticketChannel.id,
              status:
                "ticket",
              createdAt:
                new Date().toISOString()
            };

            data.orders.push(order);

            saveData(data);

            const embed =
              new EmbedBuilder()
                .setColor(
                  COLORS.primary
                )
                .setTitle(
                  "🛒 NOWE ZAMÓWIENIE"
                )
                .setDescription(
                  [
                    "Witaj w swoim tickecie zakupowym! 🌌",
                    "",
                    "Obsługa Cosmo Shop zajmie się Twoim zamówieniem.",
                    "",
                    "📌 **Nie opuszczaj ticketa podczas realizacji zamówienia.**"
                  ].join("\n")
                )
                .addFields(
                  {
                    name: "👤 Klient",
                    value:
                      `<@${interaction.user.id}>`,
                    inline: true
                  },
                  {
                    name: "📦 Produkt",
                    value:
                      product.name,
                    inline: true
                  },
                  {
                    name: "💰 Cena",
                    value:
                      money(product.price),
                    inline: true
                  },
                  {
                    name: "📁 Kategoria",
                    value:
                      (
                        CATEGORIES[
                          product.category
                        ] ||
                        CATEGORIES.inne
                      ).name,
                    inline: true
                  },
                  {
                    name: "🆔 Zamówienie",
                    value:
                      `#${orderId}`,
                    inline: true
                  },
                  {
                    name: "💳 Płatność",
                    value:
                      "Nie podano",
                    inline: true
                  }
                )
                .setFooter({
                  text:
                    "Cosmo Shop • Ticket zakupowy"
                })
                .setTimestamp();

            const row =
              new ActionRowBuilder()
                .addComponents(
                  new ButtonBuilder()
                    .setCustomId(
                      "platnosc"
                    )
                    .setLabel(
                      "Ustaw płatność"
                    )
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
                      "Zamknij"
                    )
                    .setEmoji("🔒")
                    .setStyle(
                      ButtonStyle.Danger
                    )
                );

            await ticketChannel.send({
              content:
                `<@${interaction.user.id}> <@&${staffRole.id}>`,
              embeds: [embed],
              components: [row]
            });

            return interaction.editReply({
              content:
                `✅ **Ticket utworzony!** ${ticketChannel}`,
              components: []
            });
          } catch (error) {
            console.error(
              "❌ Nie udało się utworzyć ticketu:",
              error
            );

            return interaction.editReply({
              content:
                "❌ Nie udało się utworzyć ticketu. Sprawdź uprawnienia bota.",
              components: []
            }).catch(
              () => {}
            );
          }
        }

        /* ===============================
           CENNIK
        =============================== */

        if (
          interaction.customId ===
          "cennik_kategoria"
        ) {
          const categoryId =
            interaction.values[0];

          const category =
            CATEGORIES[categoryId] ||
            CATEGORIES.inne;

          const products =
            data.products.filter(
              product =>
                product.guildId === guildId &&
                (product.category ||
                  "inne") ===
                  categoryId
            );

          if (!products.length) {
            return interaction.update({
              content:
                "❌ Brak produktów w tej kategorii.",
              components: []
            });
          }

          const text =
            products
              .map(
                product =>
                  `${category.emoji} **${product.name}** — **${money(product.price)}**\n> ${product.description || "Brak opisu"}`
              )
              .join("\n\n");

          return interaction.update({
            embeds: [
              new EmbedBuilder()
                .setColor(COLORS.gold)
                .setTitle(
                  `💰 CENNIK • ${category.name}`
                )
                .setDescription(
                  text.slice(0, 4096)
                )
                .setFooter({
                  text:
                    "Cosmo Shop • Cennik"
                })
            ],
            content: "",
            components: []
          });
        }
      }

      /* =====================================================
         MODALE
         ===================================================== */

      if (interaction.isModalSubmit()) {

        /* ===============================
           WYSZUKAJ PRODUKT
        =============================== */

        if (
          interaction.customId ===
          "modal_wyszukaj_produkt"
        ) {
          await interaction.deferReply({
            ephemeral: true
          });

          const query =
            interaction.fields
              .getTextInputValue(
                "szukana_nazwa"
              )
              .toLowerCase()
              .trim();

          const products =
            data.products.filter(
              product =>
                product.guildId === guildId &&
                (
                  product.name
                    .toLowerCase()
                    .includes(query) ||
                  (
                    product.description ||
                    ""
                  )
                    .toLowerCase()
                    .includes(query)
                )
            );

          if (!products.length) {
            return interaction.editReply({
              content:
                `🔎 Nie znaleziono produktu pasującego do **${query}**.`
            });
          }

          const text =
            products
              .slice(0, 15)
              .map(
                product =>
                  `🛒 **#${product.id} — ${product.name}**\n💰 ${money(product.price)}\n📁 ${(CATEGORIES[product.category] || CATEGORIES.inne).name}`
              )
              .join("\n\n");

          return interaction.editReply({
            embeds: [
              new EmbedBuilder()
                .setColor(COLORS.blue)
                .setTitle(
                  "🔎 WYNIKI WYSZUKIWANIA"
                )
                .setDescription(
                  text.slice(0, 4096)
                )
            ]
          });
        }

        /* ===============================
           PRZENIEŚ RANGĘ
        =============================== */

        if (
          interaction.customId ===
          "modal_przenies_role"
        ) {
          await interaction.deferReply({
            ephemeral: true
          });

          const roleName =
            interaction.fields
              .getTextInputValue(
                "nazwa_rangi"
              );

          const newAccount =
            interaction.fields
              .getTextInputValue(
                "nowe_konto"
              )
              .trim();

          const staffRole =
            getRole(
              interaction.guild,
              ROLES.staff
            );

          if (!staffRole) {
            return interaction.editReply({
              content:
                "❌ Nie znaleziono roli `Obsługa`."
            });
          }

          /*
            ===================================================
            WAŻNE:
            Bot NIE nadaje automatycznie dowolnej wysokiej
            rangi na podstawie samego tekstu.

            Tworzymy ticket dla obsługi, która zweryfikuje
            posiadanie rangi i wykona transfer.
            ===================================================
          */

          const username =
            cleanName(
              interaction.user.username
            );

          const category =
            await interaction.guild.channels.create(
              {
                name:
                  `🎖️ CosmoShop x ${roleName} 🎖️`
                    .slice(0, 100),

                type:
                  ChannelType.GuildCategory,

                permissionOverwrites: [
                  {
                    id:
                      interaction.guild
                        .roles.everyone.id,

                    deny: [
                      "ViewChannel"
                    ]
                  },
                  {
                    id:
                      interaction.user.id,

                    allow: [
                      "ViewChannel",
                      "SendMessages",
                      "ReadMessageHistory",
                      "AttachFiles"
                    ]
                  },
                  {
                    id:
                      staffRole.id,

                    allow: [
                      "ViewChannel",
                      "SendMessages",
                      "ReadMessageHistory",
                      "ManageChannels",
                      "AttachFiles"
                    ]
                  }
                ]
              }
            );

          const channel =
            await interaction.guild.channels.create(
              {
                name:
                  `${username}_rola`
                    .slice(0, 100),

                type:
                  ChannelType.GuildText,

                parent:
                  category.id,

                permissionOverwrites: [
                  {
                    id:
                      interaction.guild
                        .roles.everyone.id,

                    deny: [
                      "ViewChannel"
                    ]
                  },
                  {
                    id:
                      interaction.user.id,

                    allow: [
                      "ViewChannel",
                      "SendMessages",
                      "ReadMessageHistory",
                      "AttachFiles"
                    ]
                  },
                  {
                    id:
                      staffRole.id,

                    allow: [
                      "ViewChannel",
                      "SendMessages",
                      "ReadMessageHistory",
                      "AttachFiles"
                    ]
                  }
                ]
              }
            );

          await channel.send({
            content:
              `<@${interaction.user.id}> <@&${staffRole.id}>`,
            embeds: [
              new EmbedBuilder()
                .setColor(COLORS.gold)
                .setTitle(
                  "🎖️ PRZENIESIENIE RANGI"
                )
                .setDescription(
                  [
                    "Nowe zgłoszenie dotyczące przeniesienia rangi.",
                    "",
                    `👤 **Użytkownik:** <@${interaction.user.id}>`,
                    `🎖️ **Ranga:** ${roleName}`,
                    `👤 **Nowe konto:** \`${newAccount}\``,
                    "",
                    "⚠️ Obsługa powinna zweryfikować, czy użytkownik rzeczywiście posiada daną rangę oraz czy nowe konto jest prawidłowe.",
                    "",
                    "Po pomyślnej weryfikacji obsługa może wykonać transfer."
                  ].join("\n")
                )
                .setFooter({
                  text:
                    "Cosmo Shop • Transfer rangi"
                })
                .setTimestamp()
            ]
          });

          return interaction.editReply({
            content:
              `🎖️ Utworzono zgłoszenie: ${channel}`
          });
        }

        /* ===============================
           OPINIA
        =============================== */

        if (
          interaction.customId ===
          "modal_opinia"
        ) {
          const content =
            interaction.fields
              .getTextInputValue(
                "tresc_opinii"
              );

          data.opinionSessions[
            interaction.user.id
          ] = {
            content,
            delivery: null,
            transaction: null,
            quality: null
          };

          saveData(data);

          return interaction.reply({
            embeds: [
              new EmbedBuilder()
                .setColor(COLORS.pink)
                .setTitle(
                  "🚚 CZAS DOSTAWY"
                )
                .setDescription(
                  "Jak oceniasz czas dostawy produktu?\n\nWybierz liczbę gwiazdek:"
                )
            ],
            components: [
              starButtons(
                "opinia_dostawa"
              )
            ],
            ephemeral: true
          });
        }

        /* ===============================
           PŁATNOŚĆ
        =============================== */

        if (
          interaction.customId ===
          "modal_platnosc"
        ) {
          const payment =
            interaction.fields
              .getTextInputValue(
                "metoda_platnosci"
              );

          const order =
            data.orders
              .filter(
                item =>
                  item.guildId ===
                    guildId &&
                  item.ticketChannelId ===
                    interaction.channel.id
              )
              .sort(
                (a, b) =>
                  b.id - a.id
              )[0];

          if (!order) {
            return interaction.reply({
              content:
                "❌ Nie znaleziono zamówienia w tym tickecie.",
              ephemeral: true
            });
          }

          order.paymentMethod =
            payment;

          saveData(data);

          return interaction.reply({
            content:
              `💳 Ustawiono metodę płatności: **${payment}**.`,
            ephemeral: true
          });
        }
      }
    }


  } catch (error) {
    console.error(
      "❌ Błąd interactionCreate:",
      error
    );

    try {
      if (
        !interaction.replied &&
        !interaction.deferred
      ) {
        await interaction.reply({
          content:
            "❌ Wystąpił błąd podczas wykonywania operacji.",
          ephemeral: true
        });
      } else if (
        interaction.deferred &&
        !interaction.replied
      ) {
        await interaction.editReply({
          content:
            "❌ Wystąpił błąd podczas wykonywania operacji.",
          components: []
        });
      }
    } catch {}
  }
});

/* =========================================================
   POMOCNICZA OBSŁUGA BŁĘDÓW
   ========================================================= */

function catchInteraction(
  interaction,
  error
) {
  if (error) {
    console.error(
      "Interaction error:",
      error
    );
  }


/* =========================================================
   GWIAZDKI OPINII
   ========================================================= */

function starButtons(prefix) {
  return new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId(
          `${prefix}_1`
        )
        .setLabel("1")
        .setEmoji("⭐")
        .setStyle(
          ButtonStyle.Secondary
        ),

      new ButtonBuilder()
        .setCustomId(
          `${prefix}_2`
        )
        .setLabel("2")
        .setEmoji("⭐")
        .setStyle(
          ButtonStyle.Secondary
        ),

      new ButtonBuilder()
        .setCustomId(
          `${prefix}_3`
        )
        .setLabel("3")
        .setEmoji("⭐")
        .setStyle(
          ButtonStyle.Secondary
        ),

      new ButtonBuilder()
        .setCustomId(
          `${prefix}_4`
        )
        .setLabel("4")
        .setEmoji("⭐")
        .setStyle(
          ButtonStyle.Secondary
        ),

      new ButtonBuilder()
        .setCustomId(
          `${prefix}_5`
        )
        .setLabel("5")
        .setEmoji("⭐")
        .setStyle(
          ButtonStyle.Secondary
        )
    );
}

/* =========================================================
   OPINIA - KOLEJNE PYTANIE
   ========================================================= */

async function askOpinionTransaction(
  interaction,
  data
) {
  return interaction.update({
    embeds: [
      new EmbedBuilder()
        .setColor(COLORS.pink)
        .setTitle(
          "💳 PRZEBIEG TRANSAKCJI"
        )
        .setDescription(
          "Jak oceniasz przebieg transakcji?\n\nWybierz liczbę gwiazdek:"
        )
    ],
    components: [
      starButtons(
        "opinia_transakcja"
      )
    ]
  });
}

async function askOpinionQuality(
  interaction,
  data
) {
  return interaction.update({
    embeds: [
      new EmbedBuilder()
        .setColor(COLORS.pink)
        .setTitle(
          "📦 JAKOŚĆ PRODUKTU"
        )
        .setDescription(
          "Jak oceniasz jakość produktu?\n\nWybierz liczbę gwiazdek:"
        )
    ],
    components: [
      starButtons(
        "opinia_jakosc"
      )
    ]
  });
}

/* =========================================================
   LEGIT CHECK - LICZNIK
   ========================================================= */

async function updateLegitChannelName(
  guild
) {
  try {
    const data = loadData();

    const channel =
      getChannel(
        guild,
        CHANNELS.legitChecks
      );

    if (!channel) {
      return;
    }

    const total =
      getGuildOrders(
        data,
        guild.id
      ).filter(
        order =>
          order.status ===
          "zrealizowane"
      ).length;

    const newName =
      `legitki・${total}`;

    if (
      channel.name !== newName
    ) {
      await channel.setName(
        newName
      );
    }
  } catch (error) {
    console.error(
      "Nie udało się zaktualizować licznika legitów:",
      error
    );
  }
}

async function updateAllLegitChannelNames() {
  for (const guild of client.guilds.cache.values()) {
    await updateLegitChannelName(
      guild
    );
  }
}

/* =========================================================
   RESET DZIENNY
   ========================================================= */

let lastDailyResetDate =
  todayKey();

async function dailyReset() {
  try {
    const current =
      todayKey();

    if (
      current ===
      lastDailyResetDate
    ) {
      return;
    }

    const data =
      loadData();

    const previous =
      lastDailyResetDate;

    for (const guild of client.guilds.cache.values()) {
      const oldKey =
        `${guild.id}_${previous}`;

      const old =
        data.daily[oldKey];

      if (!old) {
        continue;
      }

      const channel =
        getChannel(
          guild,
          CHANNELS.dailyLegit
        );

      if (channel) {
        await channel.send({
          embeds: [
            new EmbedBuilder()
              .setColor(
                COLORS.gold
              )
              .setTitle(
                "📊 PODSUMOWANIE DNIA"
              )
              .setDescription(
                [
                  `📅 Data: **${previous}**`,
                  "",
                  `🟢 Legit-checki: **${old.count}**`,
                  `💰 Wydano: **${money(old.money)}**`,
                  "",
                  "Statystyki zostały zamknięte. Zaczynamy nowy dzień! 🌌"
                ].join("\n")
              )
              .setFooter({
                text:
                  "Cosmo Shop • Dzienne statystyki"
              })
              .setTimestamp()
          ]
        });
      }
    }

    lastDailyResetDate =
      current;

    saveData(data);
  } catch (error) {
    console.error(
      "Błąd dziennego resetu:",
      error
    );
  }
}

/* =========================================================
   SPRAWDZANIE RESETU CO MINUTĘ
   ========================================================= */

setInterval(
  dailyReset,
  60 * 1000
);

/* =========================================================
   HTTP SERVER - RENDER
   ========================================================= */

const PORT =
  process.env.PORT || 3000;

http
  .createServer(
    (req, res) => {
      res.writeHead(
        200,
        {
          "Content-Type":
            "text/plain; charset=utf-8"
        }
      );

      res.end(
        "🌌 Cosmo Shop Bot is online!"
      );
    }
  )
  .listen(
    PORT,
    () => {
      console.log(
        `🌐 Serwer HTTP działa na porcie ${PORT}`
      );
    }
  );

/* =========================================================
   START
   ========================================================= */

(async () => {
  if (
    !process.env.DISCORD_TOKEN ||
    !process.env.CLIENT_ID
  ) {
    console.error(
      "❌ Brakuje DISCORD_TOKEN lub CLIENT_ID w .env"
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
      "❌ Nie udało się uruchomić bota:",
      error
    );

    process.exit(1);
  }
})();
