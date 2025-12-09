import {
  Collection,
  type ChatInputCommandInteraction,
  type SlashCommandBuilder,
} from "discord.js";
import { recommendCommand } from "./recommend";
import { searchCommand } from "./search";
import { briefCommand } from "./brief";
import { mylistCommand } from "./mylist";
import link from "./link";
import profile from "./profile";
import unlink from "./unlink";

/**
 * Command interface
 */
export interface Command {
  data: SlashCommandBuilder;
  execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
}

/**
 * Command registry
 */
export const commands = new Collection<string, Command>();

// Register all commands
commands.set(recommendCommand.data.name, recommendCommand);
commands.set(searchCommand.data.name, searchCommand);
commands.set(briefCommand.data.name, briefCommand);
commands.set(mylistCommand.data.name, mylistCommand);
commands.set(link.data.name, link as Command);
commands.set(profile.data.name, profile as Command);
commands.set(unlink.data.name, unlink as Command);

export { recommendCommand } from "./recommend";
export { searchCommand } from "./search";
export { briefCommand } from "./brief";
export { mylistCommand } from "./mylist";
export { link, profile, unlink };
