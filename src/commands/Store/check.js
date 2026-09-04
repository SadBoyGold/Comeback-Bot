import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { createEmbed, errorEmbed } from '../../utils/embeds.js';
import { getFromDb } from '../../utils/database.js';
import { withErrorHandling, createError, ErrorTypes } from '../../utils/errorHandler.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';

const ORDERS_KEY = (guildId) => `guild:${guildId}:store:orders`;

function formatOrder(order) {
    const timestamp = Math.floor(Date.parse(order.createdAt) / 1000);
    return [
        `**${order.id}**`,
        `Cliente: <@${order.customerId}>`,
        `Prodotto: **${order.item}**`,
        `Prezzo: **€${Number(order.price).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}**`,
        `Paid to: <@${order.paidToId}>`,
        `Created: <t:${timestamp}:F>`,
        order.note ? `Nota: ${order.note}` : null,
    ].filter(Boolean).join('\n');
}

export default {
    slashOnly: true,
    data: new SlashCommandBuilder()
        .setName('check')
        .setDescription('Controlla gli ordini del negozio')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .setDMPermission(false)
        .addSubcommand(sub => sub
            .setName('order')
            .setDescription('Controlla un ordine del negozio')
            .addStringOption(option => option
                .setName('order_id')
                .setDescription('ID ordine, ad esempio CB-00027')
                .setRequired(true)
                .setMaxLength(20)))
        ,

    execute: withErrorHandling(async (interaction, config, client) => {
        const deferred = await InteractionHelper.safeDefer(interaction, { flags: 64 });
        if (!deferred) return;

        const orderId = interaction.options.getString('order_id', true).trim().toUpperCase();
        const orders = await getFromDb(ORDERS_KEY(interaction.guildId), []);
        const order = Array.isArray(orders)
            ? orders.find(entry => String(entry.id).toUpperCase() === orderId)
            : null;

        if (!order) {
            throw createError('Ordine non trovato', ErrorTypes.VALIDATION, `Non esiste alcun ordine con ID **${orderId}**.`);
        }

        const timestamp = Math.floor(Date.parse(order.createdAt) / 1000);
        const embed = createEmbed({
            title: `Ordine ${order.id}`,
            description: "Dettagli dell'ordine",
            color: 'primary',
        }).addFields(
            { name: 'Cliente', value: `<@${order.customerId}>`, inline: true },
            { name: 'Prodotto', value: order.item, inline: true },
            { name: 'Prezzo', value: `€${Number(order.price).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, inline: true },
            { name: 'Pagato a', value: `<@${order.paidToId}>`, inline: true },
            { name: 'Data ordine', value: `<t:${timestamp}:F>`, inline: true },
            { name: 'Creato da', value: `<@${order.createdById}>`, inline: true },
            ...(order.note ? [{ name: 'Nota', value: order.note, inline: false }] : []),
        ).setFooter({ text: `ID ordine: ${order.id}` });

        return InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
    }, { command: 'check order' }),
};
