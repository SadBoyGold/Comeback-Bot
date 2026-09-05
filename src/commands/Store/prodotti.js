import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { getColor } from '../../config/bot.js';

const STORE_ICON = '🛒';

function buildProductsEmbed(guild) {
    const embed = new EmbedBuilder()
        .setColor(getColor('primary') || '#336699')
        .setAuthor({
            name: 'Comeback Towny Staff',
            iconURL: guild?.iconURL({ extension: 'png', size: 128 }) || undefined,
        })
        .setTitle(`${STORE_ICON} COME BACK TOWNY — LISTINO`)
        .setDescription(
            '## 💰 LISTINO PRODOTTI\n\n' +
            '### ⛏️ CHUNK DELLA CITTÀ — €0,50\n' +
            'Scegli tu quanti Chunk acquistare!\n' +
            '• 1 Chunk → €0,50\n' +
            '• 5 Chunk → €2,50\n' +
            '• 10 Chunk → €5\n' +
            '• 20 Chunk → €10\n' +
            '• 50 Chunk → €25\n' +
            '• 100 Chunk → €50\n\n' +
            '**Puoi acquistare qualsiasi quantità di Chunk.**\n\n' +
            '---\n\n' +
            '### 🌱 Pacchetto Starter — €2\n' +
            '• Armatura completa in Ferro\n• Spada in Ferro\n• Piccone in Ferro\n• Ascia in Ferro\n• Pala in Ferro\n• Risorse di base\n• **2 Chunk**\n\n' +
            '### 💎 Pacchetto Starter Extra — €5\n' +
            '• Armatura completa in Diamante\n• Spada in Diamante\n• Piccone in Diamante\n• Ascia in Diamante\n• Pala in Diamante\n• Risorse utili\n• **5 Chunk**\n\n' +
            '### 👑 Pacchetto Starter Premium — €7\n' +
            '• Armatura completa in Diamante\n• Spada in Diamante\n• Piccone in Diamante\n• Ascia in Diamante\n• Pala in Diamante\n• Zappa in Diamante\n• Risorse extra\n• **15 Chunk**\n\n' +
            '### ⚔️ Pacchetto Guerriero — €5\n' +
            '• Spada in Diamante\n• Armatura completa in Diamante\n• Scudo\n• Risorse da combattimento\n• **3 Chunk**\n\n' +
            '### ⛏️ Pacchetto Minatore — €3\n' +
            '• Piccone in Diamante\n• Ascia in Diamante\n• Pala in Diamante\n• Torce\n• Risorse per il mining\n• Cibo\n\n' +
            '### 🌾 Pacchetto Agricoltore — €1,50\n' +
            '• Strumenti per l\'agricoltura\n• Semi\n• Farina d\'ossa\n• Cibo\n• Risorse per l\'agricoltura\n\n' +
            '### 🏗️ Pacchetto Costruttore — €3\n' +
            '• Blocchi da costruzione\n• Blocchi decorativi\n• Legno e pietra\n• Vetro\n• Materiali da costruzione'
        )
        .addFields({
            name: '💵 PAGAMENTO',
            value: '**Accettiamo esclusivamente pagamenti in contanti.**',
            inline: false,
        })
        .setFooter({ text: 'Comeback Towny • Listino ufficiale' });

    return embed;
}

export default {
    slashOnly: true,
    category: 'Store',
    data: new SlashCommandBuilder()
        .setName('prodotti')
        .setDescription('Mostra il listino completo dei prodotti')
        .setDMPermission(false),

    async execute(interaction) {
        const deferred = await InteractionHelper.safeDefer(interaction);
        if (!deferred) return;

        return InteractionHelper.safeEditReply(interaction, {
            embeds: [buildProductsEmbed(interaction.guild)],
        });
    },
};

export { buildProductsEmbed };
