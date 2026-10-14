import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { withErrorHandling } from '../../utils/errorHandler.js';
import { sendMinecraftDelivery } from '../../utils/minecraftDelivery.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { randomUUID } from 'node:crypto';

const PACKAGES = [
    { name: 'Starter', value: 'starter' },
    { name: 'Starter Extra', value: 'starter_extra' },
    { name: 'Starter Premium', value: 'starter_premium' },
    { name: 'Guerriero', value: 'warrior' },
    { name: 'Minatore', value: 'miner' },
    { name: 'Agricoltore', value: 'farmer' },
    { name: 'Costruttore', value: 'builder' },
    { name: 'Solo Chunk della Città', value: 'chunks' },
];

export default {
    slashOnly: true,
    data: new SlashCommandBuilder()
        .setName('givepack')
        .setDescription('Consegna un pacchetto Minecraft o aggiunge Chunk bonus con Towny')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .setDMPermission(false)
        .addStringOption(option => option
            .setName('player')
            .setDescription('Username Minecraft del destinatario')
            .setRequired(true)
            .setMinLength(3)
            .setMaxLength(16))
        .addStringOption(option => option
            .setName('town')
            .setDescription('Nome esatto della città Towny')
            .setRequired(true)
            .setMaxLength(64))
        .addStringOption(option => option
            .setName('package')
            .setDescription('Pacchetto da consegnare')
            .setRequired(true)
            .addChoices(...PACKAGES))
        .addIntegerOption(option => option
            .setName('extra_chunks')
            .setDescription('Chunk bonus aggiuntivi oltre a quelli inclusi nel pacchetto; per solo Chunk è la quantità totale')
            .setRequired(false)
            .setMinValue(0)
            .setMaxValue(10000))
        .addStringOption(option => option
            .setName('reference')
            .setDescription('Riferimento univoco facoltativo per evitare doppie consegne')
            .setRequired(false)
            .setMinLength(3)
            .setMaxLength(32)),

    execute: withErrorHandling(async (interaction) => {
        if (!interaction.inGuild()) {
            return interaction.reply({ content: 'Questo comando può essere usato solo nel server Discord.', ephemeral: true });
        }

        const username = interaction.options.getString('player', true).trim();
        const townName = interaction.options.getString('town', true).trim();
        const packageKey = interaction.options.getString('package', true);
        const extraChunks = interaction.options.getInteger('extra_chunks') ?? 0;
        const referenceInput = interaction.options.getString('reference')?.trim();
        const reference = (referenceInput || `DISCORD-${randomUUID().replaceAll('-', '').slice(0, 20)}`).toUpperCase();

        if (!/^[A-Za-z0-9_]{3,16}$/.test(username)) {
            return interaction.reply({ content: 'Username Minecraft non valido. Usa 3-16 caratteri: lettere, numeri e underscore.', ephemeral: true });
        }
        if (!townName || townName.length > 64) {
            return interaction.reply({ content: 'Nome della città Towny non valido.', ephemeral: true });
        }
        if (!/^[A-Z0-9-]{3,32}$/.test(reference)) {
            return interaction.reply({ content: 'Reference non valida: usa 3-32 lettere, numeri o trattini.', ephemeral: true });
        }
        if (packageKey === 'chunks' && extraChunks < 1) {
            return interaction.reply({ content: 'Per “Solo Chunk della Città”, imposta `extra_chunks` alla quantità da assegnare.', ephemeral: true });
        }

        await InteractionHelper.safeDefer(interaction, { flags: 64 });
        try {
            const result = await sendMinecraftDelivery({
                orderId: reference,
                username,
                townName,
                packageKey,
                extraChunks,
            });
            const chunkCount = Number(result.chunkCount ?? 0);
            return InteractionHelper.safeEditReply(interaction, {
                content: `✅ **Consegna confermata dal server Minecraft**\n• Riferimento: **${reference}**\n• Giocatore: **${username}**\n• Città Towny: **${townName}**\n• Pacchetto: **${PACKAGES.find(item => item.value === packageKey)?.name ?? packageKey}**\n• Bonus Chunk aggiunti: **${chunkCount}**\nGli oggetti del pacchetto sono stati consegnati dall'implementazione Paper se previsti dal pacchetto.`,
            });
        } catch (error) {
            return InteractionHelper.safeEditReply(interaction, {
                content: `❌ **Consegna non confermata**\n${error.message}\nNon considerare il pacchetto consegnato finché il plugin non conferma il risultato. Riferimento: **${reference}**`,
            });
        }
    }, { command: 'givepack' }),
};
