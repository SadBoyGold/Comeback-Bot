import {
    SlashCommandBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    PermissionFlagsBits,
    EmbedBuilder,
} from 'discord.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { getColor } from '../../config/bot.js';

const SHOP_ICON = '<:shoppingcarticon:1545504531335479347>';

export const SHOP_PRODUCTS = [
    { value: 'starter', label: 'Pacchetto Starter', description: '€2 • 2 Chunk', price: 2 },
    { value: 'starter_extra', label: 'Pacchetto Starter Extra', description: '€5 • 5 Chunk', price: 5 },
    { value: 'starter_premium', label: 'Pacchetto Starter Premium', description: '€7 • 15 Chunk', price: 7 },
    { value: 'guerriero', label: 'Pacchetto Guerriero', description: '€5 • 3 Chunk', price: 5 },
    { value: 'minatore', label: 'Pacchetto Minatore', description: '€3', price: 3 },
    { value: 'agricoltore', label: 'Pacchetto Agricoltore', description: '€1,50', price: 1.5 },
    { value: 'costruttore', label: 'Pacchetto Costruttore', description: '€3', price: 3 },
    { value: 'chunks', label: 'Chunk della Città', description: '€0,50 per Chunk', price: 0 },
];

export const PAYEES = [
    { value: 'titti', label: 'Titti', description: 'Pagamento a Titti', userId: '862382528648183838' },
    { value: 'efan', label: 'Efan', description: 'Pagamento a Efan', userId: '855520409499729920' },
];

export const REQUEST_CHANNEL_ID = '1546601787585470465';
export const SHOP_ICON_EMOJI = SHOP_ICON;

export function getProduct(value) {
    return SHOP_PRODUCTS.find((product) => product.value === value) || null;
}

export function getPayee(value) {
    return PAYEES.find((payee) => payee.value === value) || null;
}

function buildShopEmbed(guild) {
    return new EmbedBuilder()
        .setColor(getColor('primary') || '#5865F2')
        .setAuthor({
            name: 'Comeback Towny Staff',
            iconURL: guild?.iconURL({ extension: 'png', size: 128 }) || undefined,
        })
        .setTitle(`${SHOP_ICON} Comeback Towny • Negozio`)
        .setDescription(
            'Benvenuto nel **negozio ufficiale di Comeback Towny**.\n\n' +
            'Visualizza il listino oppure crea una richiesta di acquisto.\n\n' +
            '💵 **Pagamento:** esclusivamente in contanti.\n' +
            '📋 Dopo la richiesta, **owner/staff** la valuteranno prima del pagamento.\n' +
            '✅ Una volta ricevuto il pagamento, lo staff creerà l’ordine ufficiale.'
        )
        .addFields({
            name: '🛒 Come funziona',
            value: '1. Scegli il prodotto\n2. Inserisci eventuali Chunk\n3. Scegli a chi pagare\n4. Invia la richiesta\n5. Attendi l’accettazione dello staff',
            inline: false,
        })
        .setFooter({ text: 'Comeback Towny • Richieste acquisto' });
}

export default {
    slashOnly: true,
    category: 'Store',
    data: new SlashCommandBuilder()
        .setName('mcshop')
        .setDescription('Invia il pannello del negozio Comeback Towny')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .setDMPermission(false),

    async execute(interaction) {
        const buttons = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('mcshop_view_products')
                .setLabel('Visualizza Prodotti')
                .setEmoji('🛒')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('mcshop_request')
                .setLabel('Crea una richiesta di acquisto')
                .setEmoji('📝')
                .setStyle(ButtonStyle.Primary),
        );

        return InteractionHelper.safeReply(interaction, {
            embeds: [buildShopEmbed(interaction.guild)],
            components: [buttons],
        });
    },
};
