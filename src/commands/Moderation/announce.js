import { SlashCommandBuilder, PermissionFlagsBits, ChannelType } from 'discord.js';
import { createEmbed } from '../../utils/embeds.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { replyUserError, ErrorTypes } from '../../utils/errorHandler.js';

const ANNOUNCE_ICON = '<:announcemnt:1545739524930408458>';
const STAFF_NAME = 'Comeback Towny Staff';

export default {
    slashOnly: true,
    category: 'Moderation',
    data: new SlashCommandBuilder()
        .setName('announce')
        .setDescription('Pubblica un annuncio elegante in un canale')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .setDMPermission(false)
        .addChannelOption(option => option
            .setName('canale')
            .setDescription('Canale in cui pubblicare l\'annuncio')
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
            .setRequired(true))
        .addStringOption(option => option
            .setName('titolo')
            .setDescription('Titolo grande dell\'annuncio')
            .setRequired(true)
            .setMaxLength(256))
        .addStringOption(option => option
            .setName('messaggio')
            .setDescription('Testo principale dell\'annuncio')
            .setRequired(true)
            .setMaxLength(4000))
        .addStringOption(option => option
            .setName('miniatura')
            .setDescription('URL opzionale della miniatura a destra')
            .setRequired(false)
            .setMaxLength(1000))
        .addStringOption(option => option
            .setName('immagine')
            .setDescription('URL opzionale dell\'immagine grande in fondo')
            .setRequired(false)
            .setMaxLength(1000))
        .addBooleanOption(option => option
            .setName('everyone')
            .setDescription('Menziona @everyone')
            .setRequired(false)),

    async execute(interaction) {
        const deferred = await InteractionHelper.safeDefer(interaction, { flags: 64 });
        if (!deferred) return;

        const channel = interaction.options.getChannel('canale', true);
        const title = interaction.options.getString('titolo', true).trim();
        const message = interaction.options.getString('messaggio', true).trim();
        const thumbnail = interaction.options.getString('miniatura')?.trim();
        const image = interaction.options.getString('immagine')?.trim();
        const everyone = interaction.options.getBoolean('everyone') ?? false;

        if (!channel.isTextBased()) {
            return replyUserError(interaction, {
                type: ErrorTypes.VALIDATION,
                message: 'Il canale selezionato non è un canale testuale valido.',
            });
        }

        const serverIcon = interaction.guild?.iconURL({ extension: 'png', size: 128 }) || undefined;
        const embed = createEmbed({
            title: `${ANNOUNCE_ICON} ${title}`,
            description: message,
            color: 'primary',
            thumbnail: thumbnail || null,
            image: image || null,
            author: {
                name: STAFF_NAME,
                iconURL: serverIcon,
            },
        });

        try {
            const sent = await channel.send({
                content: everyone ? '@everyone' : undefined,
                embeds: [embed],
                allowedMentions: everyone ? { parse: ['everyone'] } : { parse: [] },
            });

            return InteractionHelper.safeEditReply(interaction, {
                embeds: [createEmbed({
                    title: '✅ Annuncio pubblicato',
                    description: `L'annuncio è stato pubblicato correttamente in ${channel}.\n\n[Apri annuncio](https://discord.com/channels/${interaction.guildId}/${channel.id}/${sent.id})`,
                    color: 'success',
                })],
            });
        } catch {
            return replyUserError(interaction, {
                type: ErrorTypes.UNKNOWN,
                message: `Non riesco a pubblicare l'annuncio in ${channel}. Controlla che io abbia **Visualizza Canale**, **Invia Messaggi** e **Incorpora Link**.`,
            });
        }
    },
};
