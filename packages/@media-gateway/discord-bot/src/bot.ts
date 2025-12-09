import {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  Events,
  type Interaction,
  type ChatInputCommandInteraction,
} from "discord.js";
import { commands } from "./commands";

/**
 * Discord client instance
 */
let client: Client | null = null;

/**
 * Register slash commands with Discord
 */
async function registerCommands() {
  const token = process.env.DISCORD_TOKEN!;
  const clientId = process.env.DISCORD_CLIENT_ID!;

  const rest = new REST({ version: "10" }).setToken(token);

  try {
    console.log("Started refreshing application (/) commands.");

    const commandData = Array.from(commands.values()).map((cmd) =>
      cmd.data.toJSON(),
    );

    await rest.put(Routes.applicationCommands(clientId), { body: commandData });

    console.log(
      `Successfully registered ${commandData.length} application (/) commands.`,
    );
  } catch (error) {
    console.error("Error registering commands:", error);
    throw error;
  }
}

/**
 * Handle command interactions
 */
async function handleInteraction(interaction: Interaction) {
  if (!interaction.isChatInputCommand()) return;

  const command = commands.get(interaction.commandName);

  if (!command) {
    console.error(`No command matching ${interaction.commandName} was found.`);
    return;
  }

  try {
    await command.execute(interaction as ChatInputCommandInteraction);
  } catch (error) {
    console.error(`Error executing ${interaction.commandName}:`, error);

    const errorMessage = "There was an error while executing this command!";

    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ content: errorMessage, ephemeral: true });
    } else {
      await interaction.reply({ content: errorMessage, ephemeral: true });
    }
  }
}

/**
 * Initialize and start the Discord bot
 */
export async function startBot() {
  const token = process.env.DISCORD_TOKEN!;

  // Create Discord client with required intents
  client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
    ],
  });

  // Handle ready event
  client.once(Events.ClientReady, async (c) => {
    console.log(`Ready! Logged in as ${c.user.tag}`);

    // Register slash commands
    try {
      await registerCommands();
    } catch (error) {
      console.error("Failed to register commands:", error);
    }
  });

  // Handle interactions (slash commands)
  client.on(Events.InteractionCreate, handleInteraction);

  // Handle errors
  client.on("error", (error) => {
    console.error("Discord client error:", error);
  });

  // Login to Discord
  await client.login(token);

  return client;
}

/**
 * Stop the bot gracefully
 */
export async function stopBot() {
  if (client) {
    console.log("Destroying Discord client...");
    client.destroy();
    client = null;
  }
}

/**
 * Get the current client instance
 */
export function getClient(): Client | null {
  return client;
}
