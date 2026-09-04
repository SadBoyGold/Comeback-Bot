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
        `Customer: <@${order.customerId}>`,
        `Item: **${order.item}**`,
        `Price: **€${Number(order.price).toLocaleString()}**`,
        `Paid to: <@${order.paidToId}>`,
        `Created: <t:${timestamp}:F>`,
        order.note ? `Note: ${order.note}` : null,
    ].filter(Boolean).join('\n');
}

export default {
    slashOnly: true,
    data: new SlashCommandBuilder()
        .setName('check')
        .setDescription('Check store records')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .setDMPermission(false)
        .addSubcommand(sub => sub
            .setName('order')
            .setDescription('Check a store order')
            .addStringOption(option => option
                .setName('order_id')
                .setDescription('Order ID, for example CB-00027')
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
            throw createError('Order not found', ErrorTypes.VALIDATION, `No order with ID **${orderId}** exists.`);
        }

        const timestamp = Math.floor(Date.parse(order.createdAt) / 1000);
        const embed = createEmbed({
            title: `Order ${order.id}`,
            description: 'Store order details',
            color: 'primary',
        }).addFields(
            { name: 'Customer', value: `<@${order.customerId}>`, inline: true },
            { name: 'Item', value: order.item, inline: true },
            { name: 'Price', value: `€${Number(order.price).toLocaleString()}`, inline: true },
            { name: 'Paid To', value: `<@${order.paidToId}>`, inline: true },
            { name: 'Order Date', value: `<t:${timestamp}:F>`, inline: true },
            { name: 'Created By', value: `<@${order.createdById}>`, inline: true },
            ...(order.note ? [{ name: 'Note', value: order.note, inline: false }] : []),
        ).setFooter({ text: `Order ID: ${order.id}` });

        return InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
    }, { command: 'check order' }),
};
