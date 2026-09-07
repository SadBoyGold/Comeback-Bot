import { EmbedBuilder, MessageFlags } from 'discord.js';
import { InteractionHelper } from '../../../utils/interactionHelper.js';
import { SHOP_PRODUCTS, PAYEES, getProduct, getPayee, REQUEST_CHANNEL_ID } from '../../../commands/Store/mcshop.js';
import { getFromDb, setInDb } from '../../../utils/database.js';

function parseChunkQuantity(raw) {
    if (raw === undefined || raw === null || raw.trim() === '') return 0;
    if (!/^\d+$/.test(raw.trim())) return null;
    const quantity = Number(raw.trim());
    return Number.isInteger(quantity) && quantity >= 0 && quantity <= 10000 ? quantity : null;
}

export default {
    name: 'mcshop_purchase_form',
    async execute(interaction) {
        // A modal submit must be acknowledged within Discord's 3-second window.
        // Defer immediately because this handler performs database and API calls.
        const acknowledged = await InteractionHelper.safeDefer(interaction, { flags: MessageFlags.Ephemeral });
        if (!acknowledged) return;
        const productValue = interaction.fields.getStringSelectValues('mcshop_form_product')?.[0];
        const payeeValue = interaction.fields.getStringSelectValues('mcshop_form_payee')?.[0];
        const product = getProduct(productValue);
        const payee = getPayee(payeeValue);
        const rawQuantity = interaction.fields.getTextInputValue('mcshop_form_chunks') ?? '';
        const quantity = parseChunkQuantity(rawQuantity);

        if (!product || !payee) {
            return InteractionHelper.safeEditReply(interaction, {
                content: '❌ I dati della richiesta non sono validi.',
            });
        }

        if (quantity === null) {
            return InteractionHelper.safeEditReply(interaction, {
                content: '❌ Inserisci una quantità di Chunk valida oppure lascia il campo vuoto.',
            });
        }

        if (productValue === 'chunks' && quantity < 1) {
            return InteractionHelper.safeEditReply(interaction, {
                content: '❌ Per acquistare Chunk devi indicare almeno 1 Chunk.',
            });
        }

        const total = Math.round((product.price + quantity * 0.5 + Number.EPSILON) * 100) / 100;
        const requestsKey = `guild:${interaction.guildId}:store:purchase_requests`;
        const counterKey = `guild:${interaction.guildId}:store:purchase_request_counter`;
        const current = Number(await getFromDb(counterKey, 0)) || 0;
        const requestNumber = current + 1;
        const requestId = `REQ-${String(requestNumber).padStart(5, '0')}`;

        const request = {
            id: requestId,
            number: requestNumber,
            guildId: interaction.guildId,
            customerId: interaction.user.id,
            customerTag: interaction.user.tag,
            product: product.label,
            productValue,
            quantity,
            price: total,
            paidToId: payee.userId,
            paidToTag: payee.label,
            status: 'pending',
            createdAt: new Date().toISOString(),
        };

        const stored = await getFromDb(requestsKey, []);
        const list = Array.isArray(stored) ? stored : [];
        list.push(request);
        await setInDb(requestsKey, list);
        await setInDb(counterKey, requestNumber);

        const channel = await interaction.guild.channels.fetch(REQUEST_CHANNEL_ID).catch(() => null);
        if (!channel?.isTextBased()) {
            return InteractionHelper.safeEditReply(interaction, {
                content: `⚠️ Richiesta **${requestId}** salvata, ma il canale delle richieste non è disponibile.`,
            });
        }

        const staffEmbed = new EmbedBuilder()
            .setColor(0xFEE75C)
            .setAuthor({
                name: 'Comeback Towny Staff',
                iconURL: interaction.guild.iconURL({ extension: 'png', size: 128 }) || undefined,
            })
            .setTitle('🛒 Nuova richiesta di acquisto')
            .setDescription('Una nuova richiesta è in attesa di approvazione.')
            .addFields(
                { name: 'Richiesta', value: `**${requestId}**`, inline: true },
                { name: 'Cliente', value: `<@${request.customerId}>`, inline: true },
                { name: 'Prodotto', value: request.product, inline: true },
                { name: 'Chunk', value: quantity > 0 ? `x${quantity}` : 'Nessuno', inline: true },
                { name: 'Totale', value: `€${total.toLocaleString('it-IT', { minimumFractionDigits: 2 })}`, inline: true },
                { name: 'Pagamento a', value: `<@${payee.userId}>`, inline: true },
            )
            .setFooter({ text: 'In attesa di approvazione staff' });

        const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = await import('discord.js');
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`mcshop_accept:${requestId}`)
                .setLabel('Accetta richiesta')
                .setEmoji('✅')
                .setStyle(ButtonStyle.Success),
        );

        const message = await channel.send({
            content: `<@${payee.userId}>`,
            embeds: [staffEmbed],
            components: [row],
        });

        request.staffChannelId = channel.id;
        request.staffMessageId = message.id;
        await setInDb(requestsKey, list);

        let dmSent = true;
        try {
            await interaction.user.send({
                embeds: [new EmbedBuilder()
                    .setColor(0x5865F2)
                    .setTitle('📨 Richiesta inviata')
                    .setDescription(`La tua richiesta **${requestId}** è stata inviata correttamente.`)
                    .addFields(
                        { name: 'Prodotto', value: request.product, inline: true },
                        { name: 'Chunk', value: quantity > 0 ? `x${quantity}` : 'Nessuno', inline: true },
                        { name: 'Totale', value: `€${total.toLocaleString('it-IT', { minimumFractionDigits: 2 })}`, inline: true },
                        { name: 'Pagamento a', value: payee.label, inline: true },
                    )
                    .setFooter({ text: 'Attendi l’accettazione da parte di owner/staff.' })],
            });
        } catch {
            dmSent = false;
        }

        return InteractionHelper.safeReply(interaction, {
            flags: MessageFlags.Ephemeral,
            embeds: [new EmbedBuilder()
                .setColor(0x57F287)
                .setTitle('✅ Richiesta inviata')
                .setDescription(
                    `La richiesta **${requestId}** è stata inviata allo staff.\n\n` +
                    'Attendi che un owner/staff la accetti. Dopo l’accettazione riceverai le istruzioni per il pagamento.' +
                    (!dmSent ? '\n\n⚠️ Non è stato possibile inviarti un DM.' : '')
                )],
        });
    },
};
