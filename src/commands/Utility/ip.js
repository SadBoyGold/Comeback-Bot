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
                '‼️ **IL SERVER NON È ATTIVO 24/7** ‼️',
                '',
                'Al momento, il server non sarà attivo 24/7. Stiamo preparando un nuovo server con specifiche migliori e, una volta pronto, avrà un orario di apertura più ampio*.',
                '',
                "*Il server non sarà effettivamente attivo **24/7**: avrà semplicemente un avvio e uno spegnimento programmati, così da garantire l'apertura nelle fasce orarie principali. Al momento, non disponiamo dei fondi o delle risorse necessarie per mantenerlo online **24/7**.",
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
