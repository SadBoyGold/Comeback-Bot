import { SlashCommandBuilder, PermissionFlagsBits, ChannelType } from 'discord.js';
import { createEmbed } from '../../utils/embeds.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { replyUserError, ErrorTypes } from '../../utils/errorHandler.js';

export default {
    slashOnly: true,
    category: 'Utility',
    data: new SlashCommandBuilder()
        .setName('closebug')
        .setDescription('Chiude una segnalazione bug e pubblica la soluzione')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageThreads)
        .setDMPermission(false)
        .addStringOption(option => option
            .setName('soluzione')
            .setDescription('La soluzione da mostrare nella segnalazione')
            .setRequired(true)
            .setMaxLength(1000))
        .addStringOption(option => option
            .setName('motivo')
            .setDescription('Motivo opzionale della chiusura')
            .setRequired(false)
            .setMaxLength(500)),

    async execute(interaction) {
        const deferred = await InteractionHelper.safeDefer(interaction, { flags: 64 });
        if (!deferred) return;

        const channel = interaction.channel;

        if (!channel || !channel.isThread?.()) {
            return replyUserError(interaction, {
                type: ErrorTypes.VALIDATION,
                message: 'Questo comando può essere usato solo dentro una discussione (thread) di segnalazione bug.',
            });
        }

        if (![ChannelType.PublicThread, ChannelType.PrivateThread, ChannelType.AnnouncementThread].includes(channel.type)) {
            return replyUserError(interaction, {
                type: ErrorTypes.VALIDATION,
                message: 'Questo comando può essere usato solo dentro un thread valido.',
            });
        }

        const soluzione = interaction.options.getString('soluzione', true).trim();
        const motivo = interaction.options.getString('motivo')?.trim();

        // Try to recover the original bug report/question from the thread starter message.
        let domanda = 'Segnalazione bug';
        try {
            const starter = await channel.fetchStarterMessage();
            const starterText = starter?.content?.trim();
            if (starterText) domanda = starterText.slice(0, 1000);
        } catch {
            // Keep the fallback title if Discord does not expose the starter message.
        }

        const wasLocked = channel.locked === true;
        const wasArchived = channel.archived === true;
        const originalName = channel.name || 'Segnalazione';
        const resolvedName = originalName.startsWith('[RISOLTO]')
            ? originalName
            : `[RISOLTO] ${originalName}`.slice(0, 100);

        const embed = createEmbed({
            title: 'Segnalazione Risolta ✅',
            description: 'Questa segnalazione bug è stata risolta e la discussione verrà chiusa.',
            color: 'success',
        }).addFields(
            { name: 'Domanda', value: domanda, inline: false },
            { name: 'Soluzione', value: soluzione, inline: false },
            { name: 'Risolto da', value: `<@${interaction.user.id}>`, inline: true },
            { name: 'Data', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true },
            ...(motivo ? [{ name: 'Motivo', value: motivo, inline: false }] : []),
        ).setFooter({ text: `Thread: ${channel.id}` });

        try {
            await channel.send({ embeds: [embed] });

            await channel.setName(resolvedName, `Bug risolto da ${interaction.user.tag}`).catch(() => null);

            await channel.setLocked(true, `Bug risolto da ${interaction.user.tag}`).catch(() => null);
            await channel.setArchived(true, `Bug risolto da ${interaction.user.tag}`).catch(() => null);
        } catch (error) {
            return replyUserError(interaction, {
                type: ErrorTypes.UNKNOWN,
                message: 'Non riesco a pubblicare la soluzione o a chiudere questo thread. Controlla che il bot abbia i permessi **Gestisci Thread** e **Invia Messaggi**.',
            });
        }

        return InteractionHelper.safeEditReply(interaction, {
            embeds: [createEmbed({
                title: 'Bug Chiuso ✅',
                description: `La segnalazione **${resolvedName}** è stata chiusa correttamente.`,
                color: 'success',
            }).addFields(
                { name: 'Soluzione pubblicata', value: '✅ Sì', inline: true },
                { name: 'Thread bloccato', value: '🔒 Sì', inline: true },
                { name: 'Thread archiviato', value: '📦 Sì', inline: true },
            )],
        });
    },
};
