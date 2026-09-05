import { SlashCommandBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { createEmbed } from '../../utils/embeds.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { startMinecraftMonitor } from '../../services/minecraftServerStatusService.js';

export default {
  slashOnly: true,
  category: 'Utility',
  data: new SlashCommandBuilder()
    .setName('mcserverstat')
    .setDescription('Mostra e aggiorna automaticamente lo stato del server Minecraft')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false),

  async execute(interaction) {
    await InteractionHelper.safeDefer(interaction, { flags: 64 });

    const placeholder = createEmbed({
      title: '🎮 Comeback Towny — Stato Server',
      description: '⏳ **Controllo del server in corso...**\n\nSto verificando se il server è online e quanti giocatori sono presenti.',
      color: 'primary',
      author: {
        name: 'Comeback Towny Staff',
        iconURL: interaction.guild?.iconURL({ extension: 'png', size: 128 }) || undefined,
      },
    });

    try {
      const alertButton = new ButtonBuilder()
        .setCustomId('mcserver_alert_toggle')
        .setLabel('🔔 Avvisi accensione')
        .setStyle(ButtonStyle.Secondary);

      const message = await interaction.channel.send({
        embeds: [placeholder],
        components: [new ActionRowBuilder().addComponents(alertButton)],
      });
      await startMinecraftMonitor({ guildId: interaction.guildId, message, interaction });

      return InteractionHelper.safeEditReply(interaction, {
        embeds: [createEmbed({
          title: '✅ Stato server attivato',
          description: `Il pannello di stato è stato pubblicato in ${interaction.channel}.\n\nIl bot controllerà automaticamente il server ogni minuto e aggiornerà il messaggio.`,
          color: 'success',
        })],
      });
    } catch (error) {
      return InteractionHelper.safeEditReply(interaction, {
        embeds: [createEmbed({
          title: '❌ Errore',
          description: 'Non sono riuscito a creare il pannello di stato. Controlla che io possa **Inviare Messaggi** e **Incorporare Link** nel canale.',
          color: 'danger',
        })],
      });
    }
  },
};
