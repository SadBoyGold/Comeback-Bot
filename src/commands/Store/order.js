import { AttachmentBuilder, SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { createEmbed, errorEmbed } from '../../utils/embeds.js';
import { getFromDb, setInDb } from '../../utils/database.js';
import { withErrorHandling, createError, ErrorTypes } from '../../utils/errorHandler.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';

const ORDERS_KEY = (guildId) => `guild:${guildId}:store:orders`;

function formatDate(iso) {
    const date = new Date(iso);
    return new Intl.DateTimeFormat('it-IT', {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: 'Europe/Rome',
    }).format(date);
}

function buildOrderLine(order, index) {
    const status = order.completed ? 'COMPLETATO' : 'APERTO';
    return [
        `ORDINE ${order.id}`,
        `Stato: ${status}`,
        `Cliente: ${order.customerTag || order.customerId}`,
        `Cliente ID: ${order.customerId}`,
        `Articolo: ${order.item}`,
        `Prezzo: €${Number(order.price).toLocaleString('it-IT')}`,
        `Pagato a: ${order.paidToTag || order.paidToId}`,
        `Data ordine: ${formatDate(order.createdAt)}`,
        `Creato da: ${order.createdByTag || order.createdById}`,
        order.completedAt ? `Completato il: ${formatDate(order.completedAt)}` : null,
        order.completedByTag ? `Completato da: ${order.completedByTag}` : null,
        order.note ? `Nota: ${order.note}` : null,
        '',
    ].filter(Boolean).join('\n');
}

export default {
    slashOnly: true,
    data: new SlashCommandBuilder()
        .setName('order')
        .setDescription('Gestisci gli ordini del negozio')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .setDMPermission(false)
        .addSubcommand(sub => sub
            .setName('logs')
            .setDescription('Scarica il registro completo di tutti gli ordini'))
        .addSubcommand(sub => sub
            .setName('complete')
            .setDescription('Segna un ordine come consegnato e avvisa il cliente')
            .addStringOption(option => option
                .setName('order_id')
                .setDescription('ID ordine, ad esempio CB-00027')
                .setRequired(true)
                .setMaxLength(20))),

    execute: withErrorHandling(async (interaction) => {
        const deferred = await InteractionHelper.safeDefer(interaction, { flags: 64 });
        if (!deferred) return;

        if (!interaction.guildId) {
            return InteractionHelper.safeEditReply(interaction, {
                embeds: [errorEmbed('Solo server', 'Questo comando può essere usato solo nel server.')],
            });
        }

        const subcommand = interaction.options.getSubcommand();
        const ordersKey = ORDERS_KEY(interaction.guildId);
        const orders = await getFromDb(ordersKey, []);

        if (!Array.isArray(orders)) {
            throw createError('Errore ordini', ErrorTypes.DATABASE, 'Il registro degli ordini non è valido.');
        }

        if (subcommand === 'logs') {
            if (orders.length === 0) {
                return InteractionHelper.safeEditReply(interaction, {
                    embeds: [createEmbed({
                        title: '📋 Registro ordini',
                        description: 'Non ci sono ancora ordini registrati.',
                        color: 'primary',
                    })],
                });
            }

            const content = [
                'COMEBACK TOWNY — REGISTRO ORDINI',
                `Generato il: ${formatDate(new Date().toISOString())}`,
                `Totale ordini: ${orders.length}`,
                '',
                ...orders.map(buildOrderLine),
            ].join('\n');

            const attachment = new AttachmentBuilder(Buffer.from(content, 'utf8'), {
                name: `ordini-${new Date().toISOString().slice(0, 10)}.txt`,
            });

            const open = orders.filter(order => !order.completed).length;
            const completed = orders.length - open;

            return InteractionHelper.safeEditReply(interaction, {
                embeds: [createEmbed({
                    title: '📋 Registro ordini',
                    description: `Ho preparato il file con **${orders.length}** ordini.`,
                    color: 'primary',
                }).addFields(
                    { name: 'Ordini aperti', value: String(open), inline: true },
                    { name: 'Ordini completati', value: String(completed), inline: true },
                )],
                files: [attachment],
            });
        }

        if (subcommand === 'complete') {
            const orderId = interaction.options.getString('order_id', true).trim().toUpperCase();
            const index = orders.findIndex(entry => String(entry.id).toUpperCase() === orderId);

            if (index === -1) {
                throw createError('Ordine non trovato', ErrorTypes.VALIDATION, `Non esiste alcun ordine con ID **${orderId}**.`);
            }

            const order = orders[index];
            if (order.completed) {
                throw createError('Ordine già completato', ErrorTypes.VALIDATION, `L'ordine **${order.id}** è già stato segnato come consegnato.`);
            }

            const completedAt = new Date().toISOString();
            orders[index] = {
                ...order,
                completed: true,
                completedAt,
                completedById: interaction.user.id,
                completedByTag: interaction.user.tag,
            };
            await setInDb(ordersKey, orders);

            let dmSent = true;
            try {
                const customer = await interaction.client.users.fetch(order.customerId);
                await customer.send({
                    embeds: [createEmbed({
                        title: '✅ Ordine consegnato!',
                        description: `Il tuo ordine **${order.id}** è stato consegnato con successo. Grazie per il tuo acquisto!`,
                        color: 'success',
                    }).addFields(
                        { name: 'Ordine', value: order.id, inline: true },
                        { name: 'Articolo', value: order.item, inline: true },
                        { name: 'Prezzo', value: `€${Number(order.price).toLocaleString('it-IT')}`, inline: true },
                        { name: 'Consegnato il', value: `<t:${Math.floor(Date.parse(completedAt) / 1000)}:F>`, inline: false },
                    )],
                });
            } catch {
                dmSent = false;
            }

            return InteractionHelper.safeEditReply(interaction, {
                embeds: [createEmbed({
                    title: '✅ Ordine completato',
                    description: `L'ordine **${order.id}** è stato segnato come consegnato.`,
                    color: 'success',
                }).addFields(
                    { name: 'Cliente', value: `<@${order.customerId}>`, inline: true },
                    { name: 'Articolo', value: order.item, inline: true },
                    { name: 'Completato da', value: `<@${interaction.user.id}>`, inline: true },
                    { name: 'DM al cliente', value: dmSent ? '✅ Inviato' : '⚠️ Non inviato (DM chiusi/bloccati)', inline: false },
                ).setFooter({ text: `Ordine: ${order.id}` })],
            });
        }
    }, { command: 'order' }),
};
