import {
    SlashCommandBuilder,
    PermissionFlagsBits,
    ChannelType,
    MessageFlags,
} from 'discord.js';
import { createEmbed, successEmbed } from '../../utils/embeds.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { replyUserError, ErrorTypes } from '../../utils/errorHandler.js';
import { logEvent } from '../../utils/moderation.js';
import { sanitizeInput } from '../../utils/validation.js';

const TEXT_CHANNEL_TYPES = [ChannelType.GuildText, ChannelType.GuildAnnouncement];

export default {
    data: new SlashCommandBuilder()
        .setName('announce')
        .setDescription('Invia un annuncio elegante e personalizzato')
        .addStringOption(option => option
            .setName('titolo')
            .setDescription("Titolo dell'annuncio")
            .setRequired(true)
            .setMaxLength(256))
        .addStringOption(option => option
            .setName('messaggio')
            .setDescription("Testo dell'annuncio")
            .setRequired(true)
            .setMaxLength(4000))
        .addChannelOption(option => option
            .setName('canale')
            .setDescription("Canale in cui inviare l'annuncio")
            .addChannelTypes(...TEXT_CHANNEL_TYPES)
            .setRequired(false))
        .addStringOption(option => option
            .setName('colore')
            .setDescription("Colore dell'annuncio")
            .addChoices(
                { name: 'Blu', value: 'primary' },
                { name: 'Verde', value: 'success' },
                { name: 'Giallo', value: 'warning' },
                { name: 'Rosso', value: 'error' },
                { name: 'Viola', value: 'secondary' },
            )
            .setRequired(false))
        .addStringOption(option => option
            .setName('immagine')
            .setDescription("URL di un'immagine opzionale")
            .setRequired(false)
            .setMaxLength(1000))
        .addBooleanOption(option => option
            .setName('menzione')
            .setDescription('Menziona @everyone (predefinito: no)')
            .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .setDMPermission(false),
    category: 'moderation',
    abuseProtection: { maxAttempts: 6, windowMs: 60_000 },

    async execute(interaction, _config, client) {
        const deferred = await InteractionHelper.safeDefer(interaction, { flags: MessageFlags.Ephemeral });
        if (!deferred) return;

        const title = sanitizeInput(interaction.options.getString('titolo', true), 256);
        const message = sanitizeInput(interaction.options.getString('messaggio', true), 4000);
        const channel = interaction.options.getChannel('canale') || interaction.channel;
        const color = interaction.options.getString('colore') || 'primary';
        const imageUrl = interaction.options.getString('immagine')?.trim() || null;
        const mention = interaction.options.getBoolean('menzione') || false;

        if (!channel || !TEXT_CHANNEL_TYPES.includes(channel.type)) {
            return replyUserError(interaction, {
                type: ErrorTypes.VALIDATION,
                message: 'Seleziona un canale testuale valido.',
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

        const memberPermissions = channel.permissionsFor(interaction.member);
        const botPermissions = channel.permissionsFor(interaction.guild.members.me);
        if (!memberPermissions?.has(PermissionFlagsBits.SendMessages)) {
            return replyUserError(interaction, {
                type: ErrorTypes.PERMISSION,
                message: `Non hai il permesso di inviare messaggi in ${channel}.`,
            });
        }
        if (!botPermissions?.has(PermissionFlagsBits.SendMessages) || !botPermissions?.has(PermissionFlagsBits.EmbedLinks)) {
            return replyUserError(interaction, {
                type: ErrorTypes.PERMISSION,
                message: `Non ho i permessi necessari per pubblicare l'annuncio in ${channel}.`,
            });
        }

        const botMember = interaction.guild.members.me;
        const allowedEveryone = mention && botMember?.permissions?.has(PermissionFlagsBits.MentionEveryone);
        const content = allowedEveryone ? '@everyone' : undefined;

        const embed = createEmbed({
            title: `📢 ${title}`,
            description: message,
            color,
            image: imageUrl,
        });
        embed.setAuthor({
            name: interaction.guild.name,
            iconURL: interaction.guild.iconURL() || undefined,
        });
        embed.setFooter({ text: 'Comeback Towny • Annuncio ufficiale' });

        const sentMessage = await channel.send({
            content,
            embeds: [embed],
            allowedMentions: allowedEveryone ? { parse: ['everyone'] } : { parse: [] },
        });

        await logEvent({
            client,
            guild: interaction.guild,
            event: {
                action: 'Annuncio inviato',
                target: `${channel.name} (${channel.id})`,
                executor: `${interaction.user.tag} (${interaction.user.id})`,
                reason: title,
                metadata: { channelId: channel.id, messageId: sentMessage.id, mention: allowedEveryone },
            },
        });

        return InteractionHelper.safeEditReply(interaction, {
            embeds: [successEmbed(
                '✅ Annuncio pubblicato',
                `L'annuncio è stato pubblicato in ${channel}.\n[Apri il messaggio](${sentMessage.url})`,
            )],
        });
    },
};
