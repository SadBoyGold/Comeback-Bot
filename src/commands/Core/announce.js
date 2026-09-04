import { SlashCommandBuilder, PermissionFlagsBits, ChannelType, MessageFlags } from 'discord.js';
import { createEmbed } from '../../utils/embeds.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { replyUserError, ErrorTypes } from '../../utils/errorHandler.js';

export default {
    data: new SlashCommandBuilder()
        .setName('announce')
        .setDescription('Invia un annuncio in un canale.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .setDMPermission(false)
        .addChannelOption(option => option
            .setName('canale')
            .setDescription('Canale in cui pubblicare l’annuncio.')
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
            .setRequired(true))
        .addStringOption(option => option
            .setName('titolo')
            .setDescription('Titolo dell’annuncio.')
            .setRequired(true)
            .setMaxLength(256))
        .addStringOption(option => option
            .setName('messaggio')
            .setDescription('Testo dell’annuncio.')
            .setRequired(true)
            .setMaxLength(4000))
        .addStringOption(option => option
            .setName('menzione')
            .setDescription('Menzione facoltativa, ad esempio @here o @everyone.')
            .setRequired(false)
            .setMaxLength(100)),

    async execute(interaction) {
        await InteractionHelper.safeDefer(interaction, { flags: MessageFlags.Ephemeral });

        const channel = interaction.options.getChannel('canale', true);
        const title = interaction.options.getString('titolo', true).trim();
        const message = interaction.options.getString('messaggio', true).trim();
        const mention = interaction.options.getString('menzione')?.trim() || '';

        if (!channel.isTextBased?.()) {
            return replyUserError(interaction, { type: ErrorTypes.VALIDATION, message: 'Il canale selezionato non è un canale testuale valido.' });
        }

        const me = interaction.guild.members.me;
        const perms = channel.permissionsFor(me);
        if (!perms?.has(PermissionFlagsBits.SendMessages) || !perms?.has(PermissionFlagsBits.EmbedLinks)) {
            return replyUserError(interaction, { type: ErrorTypes.PERMISSION, message: `Mi servono **Invia messaggi** e **Incorpora link** in ${channel}.` });
        }

        const embed = createEmbed({
            title,
            description: message,
            color: 'info',
        })
            .setAuthor({ name: `📢 ${interaction.guild.name}` })
            .setFooter({ text: `Annuncio pubblicato da ${interaction.user.tag}` });

        await channel.send({
            content: mention || undefined,
            embeds: [embed],
        });

        return InteractionHelper.safeEditReply(interaction, {
            embeds: [createEmbed({
                title: 'Annuncio Pubblicato ✅',
                description: `L’annuncio è stato inviato correttamente in ${channel}.`,
                color: 'success',
            })],
        });
    },
};
