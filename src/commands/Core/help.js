import {
    SlashCommandBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
} from "discord.js";
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { createEmbed } from "../../utils/embeds.js";
import {
    createSelectMenu,
} from "../../utils/components.js";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CATEGORY_SELECT_ID = "help-category-select";
const ALL_COMMANDS_ID = "help-all-commands";
const HELP_MENU_TIMEOUT_MS = 5 * 60 * 1000;

const CATEGORY_ICONS = {
    Core: "ℹ️",
    Moderation: "🛡️",
    Economy: "💰",
    Music: "🎵",
    Fun: "🎮",
    Utility: "🔧",
    Ticket: "🎫",
    Welcome: "👋",
    Giveaway: "🎉",
    Counter: "🔢",
    Tools: "🛠️",
    Search: "🔍",
    "Reaction Roles": "🎭",
    Community: "👥",
    Birthday: "🎂",
    "Join To Create": "🔌",
    Verification: "✅",
};

function formatCategoryName(rawCategory) {
    return rawCategory
        .replace(/_/g, '')
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .replace(/\b\w/g, (char) => char.toUpperCase());
}

export async function createInitialHelpMenu(client) {
    const commandsPath = path.join(__dirname, "../../commands");

    const categoryDirs = (
        await fs.readdir(commandsPath, { withFileTypes: true })
    )
        .filter((dirent) => dirent.isDirectory())
        .map((dirent) => dirent.name)
        .sort();

    const options = [
        {
            label: "📋 Tutti i comandi",
            description: "Visualizza tutti i comandi disponibili in un unico elenco",
            value: ALL_COMMANDS_ID,
        },
        ...categoryDirs.map((category) => {
            const categoryName = formatCategoryName(category);
            const icon = CATEGORY_ICONS[categoryName] || "🔍";

            return {
                label: `${icon} ${categoryName}`,
                description: `Visualizza i comandi della categoria ${categoryName}`,
                value: category,
            };
        }),
    ];

    const embed = createEmbed({
        title: "🇮🇹 Comeback Towny • Centro Comandi",
        description: "Usa il menu qui sotto per trovare tutti i comandi disponibili.",
        color: "primary",
        thumbnail: client.user?.displayAvatarURL?.({ size: 1024 }),
    });

    embed.setFooter({
        text: "Comeback Towny • Centro Comandi",
    });

    embed.setTimestamp();

    const bugReportButton = new ButtonBuilder()
        .setLabel("Segnala un Bug")
        .setURL("https://discord.com/channels/@me/1540589439099740220")
        .setStyle(ButtonStyle.Link);

    const supportButton = new ButtonBuilder()
        .setLabel("Server Comeback Towny")
        .setURL("https://discord.gg/AWfp6vztAj")
        .setStyle(ButtonStyle.Link);

    const selectRow = createSelectMenu(
        CATEGORY_SELECT_ID,
        "Seleziona una categoria per vedere i comandi",
        options,
    );

    const buttonRow = new ActionRowBuilder().addComponents([
        bugReportButton,
        supportButton,
    ]);

    return {
        embeds: [embed],
        components: [buttonRow, selectRow],
    };
}

export default {
    slashOnly: true,

    data: new SlashCommandBuilder()
        .setName("help")
        .setDescription("Mostra il menu di aiuto con tutti i comandi disponibili"),

    async execute(interaction, guildConfig, client) {
        await InteractionHelper.safeDefer(interaction);

        const { embeds, components } = await createInitialHelpMenu(client);

        await InteractionHelper.safeEditReply(interaction, {
            embeds,
            components,
        });

        setTimeout(async () => {
            try {
                if (!InteractionHelper.isInteractionValid(interaction)) {
                    return;
                }

                const closedEmbed = createEmbed({
                    title: "Comeback Towny",
                    description: "Comeback Towny",
                    color: "secondary",
                });

                await InteractionHelper.safeEditReply(interaction, {
                    embeds: [closedEmbed],
                    components: [],
                });
            } catch (error) {
                logger.debug(
                    "Help menu close edit failed (interaction may have expired):",
                    error?.message
                );
            }
        }, HELP_MENU_TIMEOUT_MS);
    },
};
