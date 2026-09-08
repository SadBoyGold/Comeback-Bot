import {
    ActionRowBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ButtonBuilder,
    ButtonStyle,
    StringSelectMenuBuilder,
    EmbedBuilder,
    MessageFlags,
    PermissionFlagsBits,
} from 'discord.js';
import { buildProductsEmbed, buildPaymentEmbed } from '../../../commands/Store/prodotti.js';
import { InteractionHelper } from '../../../utils/interactionHelper.js';
import { SHOP_PRODUCTS, getPayee, REQUEST_CHANNEL_ID, PAYEES, getProduct } from '../../../commands/Store/mcshop.js';
import { getFromDb, setInDb } from '../../../utils/database.js';

function productSelectRow() {
    const menu = new StringSelectMenuBuilder()
        .setCustomId('mcshop_product')
        .setPlaceholder('Seleziona cosa vuoi comprare')
        .addOptions(SHOP_PRODUCTS.map((product) => ({
            label: product.label,
            value: product.value,
            description: product.description,
            emoji: product.value === 'chunks' ? '⛏️' : '🛒',
        })));
    return new ActionRowBuilder().addComponents(menu);
}

function payeeSelectRow(productValue, quantity) {
    const menu = new StringSelectMenuBuilder()
        .setCustomId(`mcshop_payee:${productValue}:${quantity}`)
        .setPlaceholder('Scegli a chi vuoi pagare')
        .addOptions(PAYEES.map((payee) => ({
            label: payee.label,
            value: payee.value,
            description: payee.description,
            emoji: '💶',
        })));
    return new ActionRowBuilder().addComponents(menu);
}

function paymentStepEmbed(product, quantity) {
    const total = Math.round((product.price + quantity * 0.5 + Number.EPSILON) * 100) / 100;
    return new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('💳 Ultimo passaggio')
        .setDescription(
            `**Prodotto:** ${product.label}\n` +
            `**Chunk aggiuntivi:** ${quantity > 0 ? `x${quantity}` : 'Nessuno'}\n` +
            `**Totale:** €${total.toLocaleString('it-IT', { minimumFractionDigits: 2 })}\n\n` +
            'Seleziona **a chi vuoi pagare** per completare la richiesta.'
        );
}

export default [
    {
        name: 'mcshop_view_products',
        async execute(interaction) {
            return InteractionHelper.safeReply(interaction, {
                flags: MessageFlags.Ephemeral,
                embeds: [buildProductsEmbed(interaction.guild), buildPaymentEmbed(interaction.guild)],
            });
        },
    },
    {
        name: 'mcshop_request',
        async execute(interaction) {
            const embed = new EmbedBuilder()
                .setColor(0x5865F2)
                .setTitle('📝 Richiesta di acquisto')
                .setDescription('Seleziona **cosa vuoi comprare** dal menu qui sotto.\n\nSuccessivamente potrai indicare eventuali Chunk aggiuntivi e scegliere a chi effettuare il pagamento.')
                .setFooter({ text: 'Comeback Towny • Richiesta privata' });

            return InteractionHelper.safeReply(interaction, {
                flags: MessageFlags.Ephemeral,
                embeds: [embed],
                components: [
                    productSelectRow(),
                    new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setCustomId('mcshop_cancel')
                            .setLabel('Annulla')
                            .setStyle(ButtonStyle.Danger)
                    ),
                ],
            });
        },
    },
    {
        name: 'mcshop_quantity',
        async execute(interaction, _client, args) {
            const productValue = args[0];
            const product = getProduct(productValue);
            if (!product) {
                return InteractionHelper.safeReply(interaction, { flags: MessageFlags.Ephemeral, content: '❌ Prodotto non valido.' });
            }

            const modal = new ModalBuilder()
                .setCustomId(`mcshop_quantity:${productValue}`)
                .setTitle(productValue === 'chunks' ? 'Quantità Chunk' : 'Chunk aggiuntivi');

            const input = new TextInputBuilder()
                .setCustomId('mcshop_chunks')
                .setLabel(productValue === 'chunks' ? 'Quanti Chunk vuoi acquistare?' : 'Quanti Chunk aggiuntivi vuoi?')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('Esempio: 3')
                .setRequired(productValue === 'chunks')
                .setMaxLength(5);

            modal.addComponents(new ActionRowBuilder().addComponents(input));
            return InteractionHelper.safeShowModal(interaction, modal);
        },
    },
    {
        name: 'mcshop_no_quantity',
        async execute(interaction, _client, args) {
            const productValue = args[0];
            const product = getProduct(productValue);
            if (!product || productValue === 'chunks') {
                return InteractionHelper.safeReply(interaction, { flags: MessageFlags.Ephemeral, content: '❌ Questa scelta non è disponibile per questo prodotto.' });
            }

            await interaction.deferUpdate();
            return interaction.editReply({
                embeds: [paymentStepEmbed(product, 0)],
                components: [
                    payeeSelectRow(productValue, 0),
                    new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setCustomId('mcshop_cancel')
                            .setLabel('Annulla')
                            .setStyle(ButtonStyle.Danger)
                    ),
                ],
            });
        },
    },
    {
        name: 'mcshop_submit',
        async execute(interaction, _client, args) {
            const [productValue, quantityRaw, payeeValue] = args;
            const product = getProduct(productValue);
            const payee = getPayee(payeeValue);
            const quantity = Number(quantityRaw || 0);
            if (!product || !payee || !Number.isInteger(quantity) || quantity < 0) {
                return InteractionHelper.safeReply(interaction, { flags: MessageFlags.Ephemeral, content: '❌ Dati della richiesta non validi.' });
            }
            if (productValue === 'chunks' && quantity < 1) {
                return InteractionHelper.safeReply(interaction, { flags: MessageFlags.Ephemeral, content: '❌ Devi indicare almeno 1 Chunk.' });
            }

            const guild = interaction.guild;
            const requestsKey = `guild:${interaction.guildId}:store:purchase_requests`;
            const counterKey = `guild:${interaction.guildId}:store:purchase_request_counter`;
            const current = Number(await getFromDb(counterKey, 0)) || 0;
            const requestNumber = current + 1;
            const requestId = `REQ-${String(requestNumber).padStart(5, '0')}`;
            const total = Math.round((product.price + quantity * 0.5 + Number.EPSILON) * 100) / 100;
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

            const requests = await getFromDb(requestsKey, []);
            const list = Array.isArray(requests) ? requests : [];
            list.push(request);
            await setInDb(requestsKey, list);
            await setInDb(counterKey, requestNumber);

            const channel = await guild.channels.fetch(REQUEST_CHANNEL_ID).catch(() => null);
            if (!channel?.isTextBased()) {
                return InteractionHelper.safeReply(interaction, { flags: MessageFlags.Ephemeral, content: `⚠️ Richiesta **${requestId}** salvata, ma il canale delle richieste non è disponibile.` });
            }

            const staffEmbed = new EmbedBuilder()
                .setColor(0xFEE75C)
                .setAuthor({
                    name: 'Comeback Towny Staff',
                    iconURL: guild.iconURL({ extension: 'png', size: 128 }) || undefined,
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
                    )
                ],
                components: [],
            });
        },
    },
    {
        name: 'mcshop_accept',
        async execute(interaction, _client, args) {
            if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
                return InteractionHelper.safeReply(interaction, { content: '❌ Solo owner/staff possono accettare le richieste.' });
            }

            const requestId = args[0];
            const requestsKey = `guild:${interaction.guildId}:store:purchase_requests`;
            const requests = await getFromDb(requestsKey, []);
            const list = Array.isArray(requests) ? requests : [];
            const index = list.findIndex((entry) => String(entry.id).toUpperCase() === String(requestId).toUpperCase());
            if (index === -1) {
                return InteractionHelper.safeReply(interaction, { content: '❌ Richiesta non trovata.' });
            }

            const request = list[index];
            if (request.status !== 'pending') {
                return InteractionHelper.safeReply(interaction, { content: `⚠️ La richiesta **${request.id}** è già stata elaborata.` });
            }

            request.status = 'accepted';
            request.acceptedAt = new Date().toISOString();
            request.acceptedById = interaction.user.id;
            request.acceptedByTag = interaction.user.tag;
            list[index] = request;
            await setInDb(requestsKey, list);

            const acceptedEmbed = new EmbedBuilder()
                .setColor(0x57F287)
                .setAuthor({
                    name: 'Comeback Towny Staff',
                    iconURL: interaction.guild?.iconURL({ extension: 'png', size: 128 }) || undefined,
                })
                .setTitle('✅ Richiesta accettata')
                .setDescription(`La richiesta **${request.id}** è stata accettata.\n\n📦 **Dopo il pagamento**\nUna volta ricevuto il pagamento, lo staff creerà l’**ordine ufficiale**.`)
                .addFields(
                    { name: 'Cliente', value: `<@${request.customerId}>`, inline: true },
                    { name: 'Prodotto', value: request.product, inline: true },
                    { name: 'Chunk', value: request.quantity > 0 ? `x${request.quantity}` : 'Nessuno', inline: true },
                    { name: 'Totale', value: `€${Number(request.price).toLocaleString('it-IT', { minimumFractionDigits: 2 })}`, inline: true },
                    { name: 'Pagamento a', value: `<@${request.paidToId}>`, inline: true },
                    { name: 'Accettata da', value: `<@${interaction.user.id}>`, inline: true },
                )
                .setFooter({ text: 'In attesa del pagamento' });

            await InteractionHelper.safeEditReply(interaction, {
                content: `<@${request.paidToId}>`,
                embeds: [acceptedEmbed],
                components: [],
            });

            try {
                const customer = await interaction.client.users.fetch(request.customerId);
                await customer.send({
                    embeds: [new EmbedBuilder()
                        .setColor(0x57F287)
                        .setTitle('✅ Richiesta accettata')
                        .setDescription(`La tua richiesta **${request.id}** è stata accettata da owner/staff.\n\n📦 **Dopo il pagamento**\nUna volta ricevuto il pagamento, lo staff creerà l’**ordine ufficiale** e riceverai il relativo **numero d’ordine**.`)
                        .addFields(
                            { name: 'Totale da pagare', value: `€${Number(request.price).toLocaleString('it-IT', { minimumFractionDigits: 2 })}`, inline: true },
                            { name: 'Pagamento a', value: request.paidToTag || `<@${request.paidToId}>`, inline: true },
                        )
                        .setFooter({ text: 'Dopo il pagamento, lo staff creerà il tuo ordine ufficiale.' })],
                });
            } catch {
                // The request remains accepted even when DMs are closed.
            }
        },
    },
    {
        name: 'mcshop_cancel',
        async execute(interaction) {
            await interaction.deferUpdate();
            return interaction.editReply({
                content: '❌ Richiesta annullata.',
                embeds: [],
                components: [],
            });
        },
    },
];
