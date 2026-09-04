import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';
import { createEmbed, successEmbed } from '../../utils/embeds.js';
import { logEvent } from '../../utils/moderation.js';
import { logger } from '../../utils/logger.js';
import { sanitizeMarkdown } from '../../utils/validation.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { replyUserError, ErrorTypes } from '../../utils/errorHandler.js';

export default {
    data: new SlashCommandBuilder()
        .setName('dm')
        .setDescription('Invia un messaggio privato professionale a un utente')
        .addUserOption(option => option
            .setName('utente')
            .setDescription('Utente che riceverà il messaggio')
            .setRequired(true))
        .addStringOption(option => option
            .setName('messaggio')
            .setDescription('Contenuto del messaggio')
            .setRequired(true)
            .setMaxLength(4000))
        .addStringOption(option => option
            .setName('titolo')
            .setDescription('Titolo opzionale del messaggio')
            .setRequired(false)
            .setMaxLength(256))
        .addStringOption(option => option
            .setName('immagine')
            .setDescription("URL di un'immagine opzionale")
            .setRequired(false)
            .setMaxLength(1000))
        .addBooleanOption(option => option
            .setName('anonimo')
            .setDescription('Nasconde il tuo nome e mostra solo lo Staff')
            .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
        .setDMPermission(false),
    category: 'moderation',

    async execute(interaction, _config, client) {
        const deferred = await InteractionHelper.safeDefer(interaction, { flags: MessageFlags.Ephemeral });
        if (!deferred) return;

        const targetUser = interaction.options.getUser('utente', true);
        const message = sanitizeMarkdown(interaction.options.getString('messaggio', true).trim());
        const title = interaction.options.getString('titolo')?.trim() || 'Messaggio dallo Staff';
        const imageUrl = interaction.options.getString('immagine')?.trim() || null;
        const anonymous = interaction.options.getBoolean('anonimo') || false;

        if (targetUser.bot) {
            return replyUserError(interaction, {
                type: ErrorTypes.VALIDATION,
                message: 'Non puoi inviare messaggi privati agli account bot.',
            });
        }
        if (!message) {
            return replyUserError(interaction, {
                type: ErrorTypes.VALIDATION,
                message: 'Il messaggio non può essere vuoto.',
            });
        }
        if (imageUrl) {
            try {
                new URL(imageUrl);
            } catch {
                return replyUserError(interaction, {
                    type: ErrorTypes.VALIDATION,
                    message: "L'URL dell'immagine non è valido.",
                });
            }
        }

        try {
            const dmChannel = await targetUser.createDM();
            const embed = createEmbed({
                title: `📩 ${title}`,
                description: message,
                color: 'primary',
                image: imageUrl,
            });
            embed.setAuthor({
                name: anonymous ? 'Comeback Towny • Staff' : `Comeback Towny • ${interaction.user.tag}`,
                iconURL: client.user.displayAvatarURL({ size: 256 }),
            });
            embed.setFooter({ text: 'Messaggio diretto inviato dallo Staff di Comeback Towny.' });

            await dmChannel.send({ embeds: [embed] });

            await logEvent({
                client: interaction.client,
                guild: interaction.guild,
                event: {
                    action: 'DM inviato',
                    target: `${targetUser.tag} (${targetUser.id})`,
                    executor: `${interaction.user.tag} (${interaction.user.id})`,
                    reason: `Anonimo: ${anonymous ? 'Sì' : 'No'}`,
                    metadata: { userId: targetUser.id, moderatorId: interaction.user.id, anonymous, messageLength: message.length },
                },
            });

            return InteractionHelper.safeEditReply(interaction, {
                embeds: [successEmbed(
                    '✅ Messaggio inviato',
                    `Il messaggio è stato inviato correttamente a **${targetUser.tag}**.`,
                )],
            });
        } catch (error) {
            logger.error('Errore comando DM:', error);
            if (error.code === 50007) {
                return replyUserError(interaction, {
                    type: ErrorTypes.UNKNOWN,
                    message: `Non posso inviare un DM a **${targetUser.tag}**. Potrebbe avere i messaggi privati disattivati.`,
                });
            }
            return replyUserError(interaction, {
                type: ErrorTypes.UNKNOWN,
                message: `Impossibile inviare il DM: ${error.message}`,
            });
        }
    },
};
