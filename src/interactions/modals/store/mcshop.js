import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    StringSelectMenuBuilder,
    MessageFlags,
} from 'discord.js';
import { InteractionHelper } from '../../../utils/interactionHelper.js';
import { getProduct, PAYEES } from '../../../commands/Store/mcshop.js';

export default {
    name: 'mcshop_quantity',
    async execute(interaction, _client, args) {
        const productValue = args[0];
        const product = getProduct(productValue);
        if (!product) {
            return InteractionHelper.safeReply(interaction, { flags: MessageFlags.Ephemeral, content: '❌ Prodotto non valido.' });
        }

        const quantity = Number(interaction.fields.getTextInputValue('mcshop_chunks') || 0);
        if (!Number.isInteger(quantity) || quantity < 0 || quantity > 10000 || (productValue === 'chunks' && quantity < 1)) {
            return InteractionHelper.safeReply(interaction, {
                flags: MessageFlags.Ephemeral,
                content: productValue === 'chunks'
                    ? '❌ Inserisci una quantità di Chunk valida (minimo 1).'
                    : '❌ Inserisci un numero intero valido di Chunk (0 oppure un valore positivo).',
            });
        }

        const total = Math.round((product.price + quantity * 0.5 + Number.EPSILON) * 100) / 100;
        const menu = new StringSelectMenuBuilder()
            .setCustomId(`mcshop_payee:${productValue}:${quantity}`)
            .setPlaceholder('Scegli a chi vuoi pagare')
            .addOptions(PAYEES.map((payee) => ({
                label: payee.label,
                value: payee.value,
                description: payee.description,
                emoji: '💶',
            })));

        const embed = new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle('💳 Ultimo passaggio')
            .setDescription(
                `**Prodotto:** ${product.label}\n` +
                `**Chunk aggiuntivi:** ${quantity > 0 ? `x${quantity}` : 'Nessuno'}\n` +
                `**Totale:** €${total.toLocaleString('it-IT', { minimumFractionDigits: 2 })}\n\n` +
                'Seleziona **a chi vuoi pagare** per completare la richiesta.'
            );

        return InteractionHelper.safeReply(interaction, {
            flags: MessageFlags.Ephemeral,
            embeds: [embed],
            components: [
                new ActionRowBuilder().addComponents(menu),
                new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId('mcshop_cancel')
                        .setLabel('Annulla')
                        .setStyle(ButtonStyle.Danger),
                ),
            ],
        });
    },
};
