import { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { createEmbed } from '../../utils/embeds.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';

const STAFF_NAME = 'Comeback Towny Staff';
const SERVER_ICON = (interaction) => interaction.guild?.iconURL({ extension: 'png', size: 128 }) || undefined;

export default {
    slashOnly: true,
    category: 'Utility',
    data: new SlashCommandBuilder()
        .setName('ip')
        .setDescription('Mostra come entrare nel server Comeback Towny')
        .setDMPermission(false),

    async execute(interaction) {
        const embed = createEmbed({
            title: '🌐 Comeback Towny — IP Server',
            description: [
                '**Minecraft Java + Bedrock**',
                '',
                '🟢 Server disponibile per **Minecraft Premium e Cracked**.',
                '',
                'Clicca sul pulsante qui sotto per vedere tutti i dati di connessione.',
            ].join('\n'),
            color: 'primary',
            author: {
                name: STAFF_NAME,
                iconURL: SERVER_ICON(interaction),
            },
        });

        const button = new ButtonBuilder()
            .setCustomId('show_server_ip')
            .setLabel('Clicca per vedere IP')
            .setStyle(ButtonStyle.Primary);

        return InteractionHelper.safeReply(interaction, {
            embeds: [embed],
            components: [new ActionRowBuilder().addComponents(button)],
        });
    },
};
