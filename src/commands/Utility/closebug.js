import { SlashCommandBuilder, PermissionFlagsBits, ChannelType } from 'discord.js';
import { createEmbed } from '../../utils/embeds.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { replyUserError, ErrorTypes } from '../../utils/errorHandler.js';

const TICKET_CHANNEL_ID = '1540594049206063235';
const TICKET_URL = 'https://discord.com/channels/1540459084673851402/1540594049206063235';

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
                message: 'Questo comando può essere usato solo dentro un thread di segnalazione bug.',
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

        let domanda = 'Segnalazione bug';
        try {
            const starter = await channel.fetchStarterMessage();
            if (starter?.content?.trim()) domanda = starter.content.trim().slice(0, 1000);
        } catch {}

        const originalName = channel.name || 'segnalazione';
        const resolvedName = originalName.startsWith('[RISOLTO]') ? originalName : `[RISOLTO] ${originalName}`.slice(0, 100);
        const now = Math.floor(Date.now() / 1000);

        const resolvedEmbed = createEmbed({
            title: '✅ | Segnalazione Risolta',
            description: 'La segnalazione è stata risolta con successo. Questa discussione verrà ora chiusa.',
            color: 'success',
        }).addFields(
            { name: 'Domanda', value: domanda, inline: false },
            { name: 'Soluzione', value: soluzione, inline: false },
            { name: 'Risolto da', value: `<@${interaction.user.id}>`, inline: true },
            { name: 'Data', value: `<t:${now}:F>`, inline: true },
            ...(motivo ? [{ name: 'Motivo', value: motivo, inline: false }] : []),
        );

        const helpEmbed = createEmbed({
            title: '💬 | Hai ancora bisogno di aiuto?',
            description: `Se il problema non è ancora risolto o hai bisogno di ulteriore assistenza, apri un ticket in <#${TICKET_CHANNEL_ID}>.\n\n[🎫 Apri un ticket](${TICKET_URL})`,
            color: 'primary',
        });

        try {
            await channel.send({ embeds: [resolvedEmbed, helpEmbed] });
            await channel.setName(resolvedName, `Bug risolto da ${interaction.user.tag}`).catch(() => null);
            await channel.setLocked(true, `Bug risolto da ${interaction.user.tag}`).catch(() => null);
            await channel.setArchived(true, `Bug risolto da ${interaction.user.tag}`).catch(() => null);
        } catch {
            return replyUserError(interaction, {
                type: ErrorTypes.UNKNOWN,
                message: 'Non riesco a pubblicare la soluzione o a chiudere questo thread. Controlla i permessi **Gestisci Thread** e **Invia Messaggi**.',
            });
        }

        return InteractionHelper.safeEditReply(interaction, {
            embeds: [createEmbed({
                title: '✅ | Bug Chiuso',
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
