import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { replyUserError, ErrorTypes } from '../../utils/errorHandler.js';
import { buildProductsEmbed } from './prodotti.js';

export default {
    slashOnly: true,
    category: 'Store',
    data: new SlashCommandBuilder()
        .setName('prodottidm')
        .setDescription('Invia il listino prodotti tramite DM a un utente')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .setDMPermission(false)
        .addUserOption(option => option
            .setName('utente')
            .setDescription('Utente a cui inviare il listino')
            .setRequired(true)),

    async execute(interaction) {
        const deferred = await InteractionHelper.safeDefer(interaction, { flags: 64 });
        if (!deferred) return;

        const targetUser = interaction.options.getUser('utente', true);

        if (targetUser.bot) {
            return replyUserError(interaction, {
                type: ErrorTypes.VALIDATION,
                message: 'Non puoi inviare il listino a un account bot.',
            });
        }

        try {
            await targetUser.send({
                embeds: [buildProductsEmbed(interaction.guild)],
            });

            return InteractionHelper.safeEditReply(interaction, {
                content: `✅ Listino inviato correttamente in DM a **${targetUser.tag}**.`,
            });
        } catch (error) {
            if (error?.code === 50007) {
                return replyUserError(interaction, {
                    type: ErrorTypes.UNKNOWN,
                    message: `Non è stato possibile inviare un DM a **${targetUser.tag}**. Potrebbe avere i messaggi privati disattivati.`,
                });
            }

            return replyUserError(interaction, {
                type: ErrorTypes.UNKNOWN,
                message: `Impossibile inviare il listino a **${targetUser.tag}**.`,
            });
        }
    },
};
