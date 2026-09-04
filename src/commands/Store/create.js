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
        .setDescription('Gestisci gli ordini del negozio')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .setDMPermission(false)
        .addSubcommand(sub => sub
            .setName('order')
            .setDescription('Crea un nuovo ordine')
            .addUserOption(option => option
                .setName('customer')
                .setDescription("Cliente che ha effettuato l'ordine")
                .setRequired(true))
            .addStringOption(option => option
                .setName('item')
                .setDescription('Cosa ha acquistato il cliente')
                .setRequired(true)
                .setMaxLength(200))
            .addStringOption(option => option
                .setName('price')
                .setDescription('Importo pagato, ad esempio 1,50 oppure 1.50')
                .setRequired(true)
                .setMaxLength(20))
            .addUserOption(option => option
                .setName('paid_to')
                .setDescription('Staff che ha ricevuto il pagamento')
                .setRequired(true))
            .addStringOption(option => option
                .setName('note')
                .setDescription("Nota opzionale sull'ordine")
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

        // Send the customer their order number/details by DM.
        let dmSent = true;
        try {
            await customer.send({
                embeds: [createEmbed({
                    title: '<:shoppingcarticon:1545504531335479347> | Ordine Creato',
                    description: `Il tuo ordine è stato registrato con successo!`,
                    color: 'success',
                }).addFields(
                    { name: 'Numero Ordine', value: `**${orderId}**`, inline: false },
                    { name: 'Prodotto', value: item, inline: true },
                    { name: 'Prezzo', value: `€${roundedPrice.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, inline: true },
                    { name: 'Pagato a', value: `<@${paidTo.id}>`, inline: true },
                    { name: 'Data Ordine', value: `<t:${Math.floor(Date.parse(createdAt) / 1000)}:F>`, inline: false },
                    ...(note ? [{ name: 'Nota', value: note, inline: false }] : []),
                )],
            });
        } catch (dmError) {
            dmSent = false;
        }

        const embed = createEmbed({
            title: '<:shoppingcarticon:1545504531335479347> | Ordine Creato',
            description: `L'ordine **${orderId}** è stato salvato correttamente.${dmSent ? '\n\n📩 Il cliente ha ricevuto un DM con il numero dell\'ordine.' : '\n\n⚠️ Non è stato possibile inviare il DM al cliente.'}`, 
            color: 'success',
        }).addFields(
            { name: 'Cliente', value: `<@${customer.id}>`, inline: true },
            { name: 'Prodotto', value: item, inline: true },
            { name: 'Prezzo', value: `€${roundedPrice.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, inline: true },
            { name: 'Pagato a', value: `<@${paidTo.id}>`, inline: true },
            { name: 'Creato', value: `<t:${Math.floor(Date.parse(createdAt) / 1000)}:F>`, inline: true },
            { name: 'Creato da', value: `<@${interaction.user.id}>`, inline: true },
            ...(note ? [{ name: 'Nota', value: note, inline: false }] : []),
        );

        return InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
    }, { command: 'create order' }),
};
