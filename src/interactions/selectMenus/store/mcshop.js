import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    MessageFlags,
} from 'discord.js';
import { InteractionHelper } from '../../../utils/interactionHelper.js';
import { getProduct, PAYEES } from '../../../commands/Store/mcshop.js';

export default {
    name: 'mcshop_product',
    async execute(interaction, _client) {
        const productValue = interaction.values[0];
        const product = getProduct(productValue);
        if (!product) {
            return InteractionHelper.safeReply(interaction, { flags: MessageFlags.Ephemeral, content: '❌ Prodotto non valido.' });
        }

        const quantityButton = new ButtonBuilder()
            .setCustomId(`mcshop_quantity:${productValue}`)
            .setLabel(productValue === 'chunks' ? 'Inserisci quantità Chunk' : 'Aggiungi Chunk (opzionale)')
            .setEmoji('⛏️')
            .setStyle(ButtonStyle.Secondary);

        const components = [new ActionRowBuilder().addComponents(quantityButton)];
        if (productValue !== 'chunks') {
            components.push(new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`mcshop_no_quantity:${productValue}`)
                    .setLabel('Nessun Chunk')
                    .setStyle(ButtonStyle.Secondary),
            ));
        }
        components.push(new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('mcshop_cancel')
                .setLabel('Annulla')
                .setStyle(ButtonStyle.Danger),
        ));

        const embed = new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle('🛒 Dettagli richiesta')
            .setDescription(
                `**Prodotto:** ${product.label}\n` +
                `**Prezzo base:** €${product.price.toLocaleString('it-IT', { minimumFractionDigits: 2 })}\n\n` +
                (productValue === 'chunks'
                    ? 'Per i Chunk, la quantità è obbligatoria.'
                    : 'Puoi aggiungere Chunk a **€0,50 ciascuno** oppure continuare senza Chunk aggiuntivi.')
            );

        await interaction.deferUpdate();
        return interaction.editReply({
            embeds: [embed],
            components,
        });
    },
};
