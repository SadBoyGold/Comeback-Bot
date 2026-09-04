import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';
import { successEmbed, createEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { replyUserError, ErrorTypes } from '../../utils/errorHandler.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { getTicketPermissionContext } from '../../utils/ticket/ticketPermissions.js';
import { closeTicket } from '../../services/ticket.js';

function cleanSolvedName(name) {
    const stripped = String(name || '').replace(/^\[RISOLTO\]\s*/i, '');
    return `[RISOLTO] ${stripped}`.slice(0, 100);
}

async function closeSupportThread(interaction) {
    const thread = interaction.channel;
    if (!thread?.isThread?.()) return false;

    const canClose =
        interaction.memberPermissions?.has(PermissionFlagsBits.ManageThreads) ||
        interaction.memberPermissions?.has(PermissionFlagsBits.ManageChannels) ||
        interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild);

    if (!canClose) {
        await replyUserError(interaction, {
            type: ErrorTypes.PERMISSION,
            message: 'Ti serve il permesso **Gestisci discussioni**, **Gestisci canali** oppure **Gestisci server** per chiudere questa segnalazione.',
        });
        return true;
    }

    const solution = interaction.options?.getString('soluzione')?.trim() || '';
    const reason = interaction.options?.getString('motivo')?.trim() || 'Segnalazione risolta dal team di moderazione.';

    const starter = await thread.fetchStarterMessage().catch(() => null);
    const question = starter?.content?.trim() || thread.name || 'Segnalazione senza testo disponibile.';

    const solvedEmbed = createEmbed({
        title: 'Segnalazione Risolta ✅',
        description: 'Questa segnalazione è stata risolta dal team di moderazione.',
        color: 'success',
    }).addFields(
        { name: 'Domanda', value: question.slice(0, 1024), inline: false },
        { name: 'Soluzione', value: (solution || 'Nessuna soluzione aggiuntiva fornita.').slice(0, 1024), inline: false },
        { name: 'Risolto da', value: `<@${interaction.user.id}>`, inline: true },
        { name: 'Motivo', value: reason.slice(0, 1024), inline: true },
    ).setFooter({ text: 'Thread bloccato • Comeback Towny' });

    await thread.send({ embeds: [solvedEmbed] });

    await thread.setName(cleanSolvedName(thread.name), `Segnalazione chiusa da ${interaction.user.tag}`).catch(() => {});
    await thread.setLocked(true, `Segnalazione chiusa da ${interaction.user.tag}`).catch(() => {});
    await thread.setArchived(true, `Segnalazione chiusa da ${interaction.user.tag}`).catch(() => {});

    await InteractionHelper.safeEditReply(interaction, {
        embeds: [successEmbed(
            'Segnalazione Chiusa ✅',
            `La segnalazione **${thread.name}** è stata risolta e il thread è stato bloccato.`,
        )],
    });

    logger.info('Support thread closed', {
        userId: interaction.user.id,
        userTag: interaction.user.tag,
        channelId: thread.id,
        channelName: thread.name,
        guildId: interaction.guildId,
        reason,
        solutionProvided: Boolean(solution),
        commandName: 'close',
    });
    return true;
}

export default {
    data: new SlashCommandBuilder()
        .setName('close')
        .setDescription('Chiudi e risolvi una segnalazione o un ticket.')
        .setDMPermission(false)
        .addStringOption((option) =>
            option
                .setName('soluzione')
                .setDescription('Soluzione da mostrare nel messaggio di chiusura (facoltativa).')
                .setRequired(false)
                .setMaxLength(1000),
        )
        .addStringOption((option) =>
            option
                .setName('motivo')
                .setDescription('Motivo della chiusura (facoltativo).')
                .setRequired(false)
                .setMaxLength(500),
        ),

    async execute(interaction, guildConfig, client) {
        const deferred = await InteractionHelper.safeDefer(interaction, { flags: MessageFlags.Ephemeral });
        if (!deferred) return;

        if (await closeSupportThread(interaction)) return;

        const permissionContext = await getTicketPermissionContext({ client, interaction });
        if (!permissionContext.ticketData) {
            return await replyUserError(interaction, {
                type: ErrorTypes.VALIDATION,
                message: 'Questo comando può essere usato solo dentro un ticket o una discussione di supporto valida.',
            });
        }

        if (!permissionContext.canCloseTicket) {
            return await replyUserError(interaction, {
                type: ErrorTypes.PERMISSION,
                message: 'Ti serve **Gestisci canali**, il ruolo staff configurato oppure essere il creatore del ticket per chiuderlo.',
            });
        }

        const reason = interaction.options?.getString('motivo')?.trim() || 'Chiuso senza un motivo specifico.';
        await closeTicket(interaction.channel, interaction.user, reason);

        await InteractionHelper.safeEditReply(interaction, {
            embeds: [successEmbed(
                'Ticket Chiuso ✅',
                'Il ticket è stato chiuso correttamente.',
            )],
        });

        logger.info('Ticket closed successfully', {
            userId: interaction.user.id,
            userTag: interaction.user.tag,
            channelId: interaction.channel.id,
            channelName: interaction.channel.name,
            guildId: interaction.guildId,
            reason,
            commandName: 'close',
        });
    },
};
