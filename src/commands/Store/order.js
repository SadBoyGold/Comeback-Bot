import { SlashCommandBuilder, PermissionFlagsBits, AttachmentBuilder } from 'discord.js';
import { createEmbed } from '../../utils/embeds.js';
import { getFromDb, setInDb } from '../../utils/database.js';
import { withErrorHandling, createError, ErrorTypes } from '../../utils/errorHandler.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';

const ORDERS_KEY = (guildId) => `guild:${guildId}:store:orders`;

function money(value) {
    return `€${Number(value || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function orderText(order, index) {
    const created = order.createdAt ? new Date(order.createdAt).toLocaleString('it-IT') : 'Sconosciuta';
    const completed = order.completedAt ? new Date(order.completedAt).toLocaleString('it-IT') : 'Non completato';
    return [
        `Ordine #${index + 1}`,
        `ID: ${order.id}`,
        `Cliente: ${order.customerTag || order.customerId}`,
        `Prodotto: ${order.item}`,
        `Prezzo: ${money(order.price)}`,
        `Pagato a: ${order.paidToTag || order.paidToId}`,
        `Creato: ${created}`,
        `Creato da: ${order.createdByTag || order.createdById}`,
        `Stato: ${order.completedAt ? 'Consegnato' : 'In attesa'}`,
        `Consegnato: ${completed}`,
        ...(order.completedByTag ? [`Consegnato da: ${order.completedByTag}`] : []),
        ...(order.note ? [`Nota: ${order.note}`] : []),
    ].join('\n');
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
            .setDescription('Invia un file di testo con tutti gli ordini'))
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

        const subcommand = interaction.options.getSubcommand();
        const guildId = interaction.guildId;
        const ordersKey = ORDERS_KEY(guildId);
        const ordersRaw = await getFromDb(ordersKey, []);
        const orders = Array.isArray(ordersRaw) ? ordersRaw : [];

        if (subcommand === 'logs') {
            const content = orders.length === 0
                ? 'COMEBACK TOWNY - REGISTRO ORDINI\n\nNessun ordine presente.\n'
                : [
                    'COMEBACK TOWNY - REGISTRO ORDINI',
                    `Generato: ${new Date().toLocaleString('it-IT')}`,
                    `Totale ordini: ${orders.length}`,
                    '',
                    ...orders.map(orderText),
                    '',
                ].join('\n\n');

            const attachment = new AttachmentBuilder(Buffer.from(content, 'utf8'), {
                name: `ordini-${new Date().toISOString().slice(0, 10)}.txt`,
            });

            return InteractionHelper.safeEditReply(interaction, {
                content: `📄 Registro ordini generato. Totale: **${orders.length}**`,
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
            if (order.completedAt) {
                throw createError('Ordine già completato', ErrorTypes.VALIDATION, `L'ordine **${order.id}** è già stato consegnato.`);
            }

            const completedAt = new Date().toISOString();
            order.completedAt = completedAt;
            order.completedById = interaction.user.id;
            order.completedByTag = interaction.user.tag;
            order.status = 'completed';
            orders[index] = order;
            await setInDb(ordersKey, orders);

            let dmSent = true;
            try {
                const customer = await interaction.client.users.fetch(order.customerId);
                await customer.send({
                    embeds: [createEmbed({
                        title: 'Ordine Consegnato',
                        description: `Il tuo ordine **${order.id}** è stato consegnato!`,
                        color: 'success',
                    }).addFields(
                        { name: 'Numero Ordine', value: `**${order.id}**`, inline: false },
                        { name: 'Prodotto', value: order.item, inline: true },
                        { name: 'Prezzo', value: money(order.price), inline: true },
                        { name: 'Data Consegna', value: `<t:${Math.floor(Date.parse(completedAt) / 1000)}:F>`, inline: false },
                    )],
                });
            } catch {
                dmSent = false;
            }

            const embed = createEmbed({
                title: 'Ordine Consegnato',
                description: `L'ordine **${order.id}** è stato segnato come consegnato.${dmSent ? '\\n\\n📩 Il cliente ha ricevuto il DM di consegna.' : '\\n\\n⚠️ Non è stato possibile inviare il DM al cliente.'}`,
                color: 'success',
            }).addFields(
                { name: 'Cliente', value: `<@${order.customerId}>`, inline: true },
                { name: 'Prodotto', value: order.item, inline: true },
                { name: 'Prezzo', value: money(order.price), inline: true },
                { name: 'Consegnato da', value: `<@${interaction.user.id}>`, inline: true },
                { name: 'Data Consegna', value: `<t:${Math.floor(Date.parse(completedAt) / 1000)}:F>`, inline: true },
            );

            return InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
        }
    }, { command: 'order' }),
};
