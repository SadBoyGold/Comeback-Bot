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
            .setDescription('Crea un nuovo ordine del negozio')
            .addUserOption(option => option
                .setName('customer')
                .setDescription("Cliente che ha effettuato l'ordine")
                .setRequired(true))
            .addStringOption(option => option
                .setName('item')
                .setDescription('Cosa ha acquistato il cliente')
                .setRequired(true)
                .setMaxLength(200))
            .addIntegerOption(option => option
                .setName('price')
                .setDescription("Importo pagato per l'ordine")
                .setRequired(true)
                .setMinValue(0))
            .addUserOption(option => option
                .setName('paid_to')
                .setDescription('Membro dello staff che ha ricevuto il pagamento')
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
        const price = interaction.options.getInteger('price', true);
        const paidTo = interaction.options.getUser('paid_to');
        const note = interaction.options.getString('note')?.trim() || null;

        if (customer.bot) {
            throw createError('Cliente non valido', ErrorTypes.VALIDATION, 'Un bot non può essere il cliente di un ordine.');
        }
        if (paidTo.bot) {
            throw createError('Destinatario non valido', ErrorTypes.VALIDATION, 'Un bot non può ricevere il pagamento di un ordine.');
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
            throw createError('Errore database ordini', ErrorTypes.DATABASE, 'Il registro degli ordini non è valido.');
        }

        const order = {
            id: orderId,
            number: nextCounter,
            guildId,
            customerId: customer.id,
            customerTag: customer.tag,
            item,
            price,
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

        let dmSent = true;
        try {
            await customer.send({
                embeds: [createEmbed({
                    title: '🛍️ Nuovo ordine',
                    description: `Il tuo ordine **${orderId}** è stato creato con successo! Conserva questo numero per controllare il tuo ordine.`,
                    color: 'success',
                }).addFields(
                    { name: 'Numero ordine', value: orderId, inline: true },
                    { name: 'Articolo', value: item, inline: true },
                    { name: 'Prezzo', value: `€${price.toLocaleString('it-IT')}`, inline: true },
                    { name: 'Pagato a', value: `<@${paidTo.id}>`, inline: true },
                    { name: 'Data ordine', value: `<t:${Math.floor(Date.parse(createdAt) / 1000)}:F>`, inline: true },
                )],
            });
        } catch {
            dmSent = false;
        }

        const embed = createEmbed({
            title: '✅ Ordine creato',
            description: `L'ordine **${orderId}** è stato salvato con successo.`,
            color: 'success',
        }).addFields(
            { name: 'Cliente', value: `<@${customer.id}>`, inline: true },
            { name: 'Articolo', value: item, inline: true },
            { name: 'Prezzo', value: `€${price.toLocaleString()}`, inline: true },
            { name: 'Pagato a', value: `<@${paidTo.id}>`, inline: true },
            { name: 'Creato il', value: `<t:${Math.floor(Date.parse(createdAt) / 1000)}:F>`, inline: true },
            { name: 'Creato da', value: `<@${interaction.user.id}>`, inline: true },
            ...(note ? [{ name: 'Nota', value: note, inline: false }] : []),
            { name: 'DM cliente', value: dmSent ? '✅ Inviato' : '⚠️ Non inviato (DM chiusi/bloccati)', inline: false },
        );

        return InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
    }, { command: 'create order' }),
};
