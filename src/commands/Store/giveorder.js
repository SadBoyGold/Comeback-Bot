import {
    SlashCommandBuilder,
    PermissionFlagsBits,
    ModalBuilder,
    ActionRowBuilder,
    TextInputBuilder,
    TextInputStyle,
} from 'discord.js';
import { withErrorHandling } from '../../utils/errorHandler.js';

export default {
    slashOnly: true,
    data: new SlashCommandBuilder()
        .setName('giveorder')
        .setDescription('Consegna un ordine Minecraft e lo segna come completato')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .setDMPermission(false)
        .addStringOption(option => option
            .setName('order_id')
            .setDescription('ID ordine, ad esempio CB-00027')
            .setRequired(true)
            .setMaxLength(20)),

    execute: withErrorHandling(async (interaction) => {
        if (!interaction.inGuild()) {
            return interaction.reply({ content: 'Questo comando può essere usato solo nel server Discord.', ephemeral: true });
        }
        const orderId = interaction.options.getString('order_id', true).trim().toUpperCase();
        if (!/^[A-Z0-9-]{1,20}$/.test(orderId)) {
            return interaction.reply({ content: 'ID ordine non valido.', ephemeral: true });
        }

        const modal = new ModalBuilder()
            .setCustomId(`giveorder_modal:${orderId}`)
            .setTitle(`Consegna ${orderId}`)
            .addComponents(
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('minecraft_username')
                        .setLabel('Username Minecraft')
                        .setPlaceholder('Es. Steve')
                        .setStyle(TextInputStyle.Short)
                        .setMinLength(3)
                        .setMaxLength(16)
                        .setRequired(true),
                ),
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('town_name')
                        .setLabel('Nome della città Towny')
                        .setPlaceholder('Es. Comeback')
                        .setStyle(TextInputStyle.Short)
                        .setMinLength(1)
                        .setMaxLength(64)
                        .setRequired(true),
                ),
            );
        return interaction.showModal(modal);
    }, { command: 'giveorder' }),
};
