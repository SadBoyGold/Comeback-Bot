import { SlashCommandBuilder, PermissionFlagsBits, PermissionsBitField, ChannelType, MessageFlags } from 'discord.js';
import { createEmbed, successEmbed, infoEmbed, warningEmbed } from '../../utils/embeds.js';
import { logEvent } from '../../utils/moderation.js';
import { logger } from '../../utils/logger.js';
import { sanitizeMarkdown } from '../../utils/validation.js';

import { InteractionHelper } from '../../utils/interactionHelper.js';
import { replyUserError, ErrorTypes } from '../../utils/errorHandler.js';
export default {
    data: new SlashCommandBuilder()
        .setName("dm")
        .setDescription("Invia un messaggio privato a un utente (Staff)")
        .addUserOption(option => option
            .setName("utente")
            .setDescription("Utente a cui inviare il messaggio")
            .setRequired(true)
        )
        .addStringOption(option => option
            .setName("messaggio")
            .setDescription("Messaggio da inviare")
            .setRequired(true)
            .setMaxLength(2000)
        )
        .addBooleanOption(option => option
            .setName("anonimo")
            .setDescription("Nascondi il nome dello staff")
            .setRequired(false)
        )
        .addStringOption(option => option
            .setName("titolo")
            .setDescription("Titolo opzionale del messaggio")
            .setRequired(false)
            .setMaxLength(256)
        )
        .addStringOption(option => option
            .setName("immagine")
            .setDescription("URL opzionale dell'immagine")
            .setRequired(false)
            .setMaxLength(1000)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
        .setDMPermission(false),

    category: "moderation",

    async execute(interaction, config, client) {
        const deferSuccess = await InteractionHelper.safeDefer(interaction);
        if (!deferSuccess) {
            logger.warn(`DM interaction defer failed`, {
                userId: interaction.user.id,
                guildId: interaction.guildId,
                commandName: 'dm'
            });
            return;
        }

    const targetUser = interaction.options.getUser("utente");
        const message = interaction.options.getString("messaggio");
        const anonymous = interaction.options.getBoolean("anonimo") || false;
        const customTitle = interaction.options.getString("titolo")?.trim();
        const image = interaction.options.getString("immagine")?.trim();

        try {
            
            if (message.length > 2000) {
                return await replyUserError(interaction, { type: ErrorTypes.UNKNOWN, message: 'Il messaggio deve contenere meno di 2000 caratteri.' });
            }

            if (targetUser.bot) {
                return await replyUserError(interaction, { type: ErrorTypes.UNKNOWN, message: 'Non puoi inviare messaggi privati agli account bot.' });
            }

            const sanitized = sanitizeMarkdown(message);

            const dmChannel = await targetUser.createDM();
            
            const dmAuthor = anonymous
                ? { name: 'Comeback Towny Staff', iconURL: interaction.guild?.iconURL({ extension: 'png', size: 128 }) || undefined }
                : { name: interaction.user.displayName || interaction.user.tag, iconURL: interaction.user.displayAvatarURL({ extension: 'png', size: 128 }) };

            const dmEmbed = createEmbed({
                title: `<:messageicon:1545504279819849768> | ${customTitle || (anonymous ? 'Messaggio dallo Staff' : `Messaggio da ${interaction.user.tag}`)}`,
                description: sanitized,
                color: 'primary',
                author: dmAuthor,
                image: image || null,
            }).setFooter({
                text: 'Non è possibile rispondere a questo messaggio.'
            });

            await dmChannel.send({ embeds: [dmEmbed] });

            await logEvent({
                client: interaction.client,
                guild: interaction.guild,
                event: {
                    action: "Messaggio privato inviato",
                    target: `${targetUser.tag} (${targetUser.id})`,
                    executor: `${interaction.user.tag} (${interaction.user.id})`,
                    reason: `Anonimo: ${anonymous ? 'Sì' : 'No'}`,
                    metadata: {
                        userId: targetUser.id,
                        moderatorId: interaction.user.id,
                        anonymous,
                        messageLength: sanitized.length
                    }
                }
            });

            return await InteractionHelper.safeEditReply(interaction, {
                embeds: [
                    successEmbed(
                        "✅ | Messaggio inviato",
                        `Il messaggio è stato inviato correttamente a ${targetUser.tag}.`
                    ),
                ],
            });
        } catch (error) {
            logger.error('DM command error:', error);
            
if (error.code === 50007) {
                return await replyUserError(interaction, { type: ErrorTypes.UNKNOWN, message: `Non è stato possibile inviare un DM a ${targetUser.tag}. Potrebbe avere i messaggi privati disattivati.` });
            }
            
            return await replyUserError(interaction, { type: ErrorTypes.UNKNOWN, message: `Impossibile inviare il messaggio: ${error.message}` });
        }
    }
};