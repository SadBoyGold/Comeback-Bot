import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
} from 'discord.js';
import { InteractionHelper } from '../../../utils/interactionHelper.js';
import { getProduct, getPayee } from '../../../commands/Store/mcshop.js';

export default {
    name: 'mcshop_payee',
    async execute(interaction, _client, args) {
        const productValue = args[0];
        const quantity = Number(args[1] || 0);
        const payeeValue = interaction.values[0];
        const product = getProduct(productValue);
        const payee = getPayee(payeeValue);
        if (!product || !payee || !Number.isInteger(quantity) || quantity < 0) {
            return InteractionHelper.safeReply(interaction, { content: '❌ Dati della richiesta non validi.' });
        }
        if (productValue === 'chunks' && quantity < 1) {
            return InteractionHelper.safeReply(interaction, { content: '❌ Per i Chunk devi indicare almeno 1 Chunk.' });
        }

        const total = Math.round((product.price + quantity * 0.5 + Number.EPSILON) * 100) / 100;
        const embed = new EmbedBuilder()
            .setColor(0x57F287)
            .setTitle('✅ Controlla la richiesta')
            .setDescription(
                `**Prodotto:** ${product.label}\n` +
                `**Chunk aggiuntivi:** ${quantity > 0 ? `x${quantity}` : 'Nessuno'}\n` +
                `**Totale:** €${total.toLocaleString('it-IT', { minimumFractionDigits: 2 })}\n` +
                `**Pagamento a:** ${payee.label}\n\n` +
                'Premi **Invia richiesta** per mandare la richiesta allo staff.'
            );

        return InteractionHelper.safeEditReply(interaction, {
            embeds: [embed],
            components: [new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`mcshop_submit:${productValue}:${quantity}:${payeeValue}`)
                    .setLabel('Invia richiesta')
                    .setEmoji('📨')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId('mcshop_cancel')
                    .setLabel('Annulla')
                    .setStyle(ButtonStyle.Danger),
            )],
        });
    },
};
