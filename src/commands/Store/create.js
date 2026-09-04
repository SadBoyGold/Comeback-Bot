import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { createEmbed, errorEmbed } from '../../utils/embeds.js';
import { getFromDb, setInDb } from '../../utils/database.js';
import { withErrorHandling, createError, ErrorTypes } from '../../utils/errorHandler.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';

const ORDERS_KEY = (guildId) => `guild:${guildId}:store:orders`;
const COUNTER_KEY = (guildId) => `guild:${guildId}:store:order_counter`;

function formatOrderId(number) {
    return `CB-${String(number).padStart(5, '0')}`;
}

export default {
    slashOnly: true,
    data: new SlashCommandBuilder()
        .setName('create')
        .setDescription('Create store records')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .setDMPermission(false)
        .addSubcommand(sub => sub
            .setName('order')
            .setDescription('Create a new store order')
            .addUserOption(option => option
                .setName('customer')
                .setDescription('Customer who placed the order')
                .setRequired(true))
            .addStringOption(option => option
                .setName('item')
                .setDescription('What the customer bought')
                .setRequired(true)
                .setMaxLength(200))
            .addStringOption(option => option
                .setName('price')
                .setDescription('Amount paid for the order (es. 1,50 oppure 1.50)')
                .setRequired(true)
                .setMaxLength(20))
            .addUserOption(option => option
                .setName('paid_to')
                .setDescription('Staff member who received the payment')
                .setRequired(true))
            .addStringOption(option => option
                .setName('note')
                .setDescription('Optional note about the order')
                .setRequired(false)
                .setMaxLength(500)))
        ,

    execute: withErrorHandling(async (interaction, config, client) => {
        const deferred = await InteractionHelper.safeDefer(interaction, { flags: 64 });
        if (!deferred) return;

        if (!interaction.guildId) {
            return InteractionHelper.safeEditReply(interaction, {
                embeds: [errorEmbed('Server Only', 'This command can only be used inside the server.')],
            });
        }

        const customer = interaction.options.getUser('customer');
        const item = interaction.options.getString('item', true).trim();
        const priceInput = interaction.options.getString('price', true).trim().replace(',', '.');
        const price = Number(priceInput);

        if (!Number.isFinite(price) || price < 0) {
            throw createError('Prezzo non valido', ErrorTypes.VALIDATION, 'Inserisci un prezzo valido, ad esempio **1,50** oppure **1.50**.');
        }

        const roundedPrice = Math.round((price + Number.EPSILON) * 100) / 100;
        const paidTo = interaction.options.getUser('paid_to');
        const note = interaction.options.getString('note')?.trim() || null;

        if (customer.bot) {
            throw createError('Invalid customer', ErrorTypes.VALIDATION, 'A bot cannot be the customer of an order.');
        }
        if (paidTo.bot) {
            throw createError('Invalid recipient', ErrorTypes.VALIDATION, 'A bot cannot receive an order payment.');
        }

        const guildId = interaction.guildId;
        const ordersKey = ORDERS_KEY(guildId);
        const counterKey = COUNTER_KEY(guildId);
        const currentCounter = Number(await getFromDb(counterKey, 0)) || 0;
        const nextCounter = currentCounter + 1;
        const orderId = formatOrderId(nextCounter);
        const createdAt = new Date().toISOString();

        const orders = await getFromDb(ordersKey, []);
        if (!Array.isArray(orders)) {
            throw createError('Order database error', ErrorTypes.DATABASE, 'The order storage is invalid.');
        }

        const order = {
            id: orderId,
            number: nextCounter,
            guildId,
            customerId: customer.id,
            customerTag: customer.tag,
            item,
            price: roundedPrice,
            paidToId: paidTo.id,
            paidToTag: paidTo.tag,
            note,
            createdAt,
            createdById: interaction.user.id,
            createdByTag: interaction.user.tag,
        };

        orders.push(order);
        await setInDb(ordersKey, orders);
        await setInDb(counterKey, nextCounter);

        const embed = createEmbed({
            title: 'Order Created',
            description: `Order **${orderId}** has been saved successfully.`,
            color: 'success',
        }).addFields(
            { name: 'Customer', value: `<@${customer.id}>`, inline: true },
            { name: 'Item', value: item, inline: true },
            { name: 'Price', value: `€${roundedPrice.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, inline: true },
            { name: 'Paid To', value: `<@${paidTo.id}>`, inline: true },
            { name: 'Created', value: `<t:${Math.floor(Date.parse(createdAt) / 1000)}:F>`, inline: true },
            { name: 'Created By', value: `<@${interaction.user.id}>`, inline: true },
            ...(note ? [{ name: 'Note', value: note, inline: false }] : []),
        );

        return InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
    }, { command: 'create order' }),
};
