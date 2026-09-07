import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { createEmbed } from '../../utils/embeds.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { getMinecraftMonitor, setMinecraftMaintenance } from '../../services/minecraftServerStatusService.js';

export default {
  slashOnly: true,
  category: 'Utility',
  data: new SlashCommandBuilder()
    .setName('mcserverupdate')
    .setDescription('Imposta il server come in aggiornamento o di nuovo online')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false)
    .addStringOption(option => option
      .setName('stato')
      .setDescription('Stato da mostrare nel pannello')
      .setRequired(false)
      .addChoices(
        { name: '🛠️ In aggiornamento', value: 'aggiornamento' },
        { name: '🟢 Online / normale', value: 'online' },
      )),

  async execute(interaction) {
    await InteractionHelper.safeDefer(interaction, { flags: 64 });

    const monitor = getMinecraftMonitor(interaction.guildId);
    if (!monitor) {
      return InteractionHelper.safeEditReply(interaction, {
        embeds: [createEmbed({
          title: '⚠️ Pannello non attivo',
          description: 'Prima usa **/mcserverstat** per creare il pannello di stato automatico.',
          color: 'warning',
        })],
      });
    }

    const state = interaction.options.getString('stato') || 'aggiornamento';
    const maintenance = state === 'aggiornamento';

    try {
      await setMinecraftMaintenance(interaction.guildId, maintenance, interaction);

      return InteractionHelper.safeEditReply(interaction, {
        embeds: [createEmbed({
          title: maintenance ? '🛠️ Modalità aggiornamento attivata' : '🟢 Modalità normale attivata',
          description: maintenance
            ? 'Il pannello ora mostrerà che **il server è in fase di aggiornamento** mentre continua a controllare lo stato reale del server.'
            : 'Il pannello è tornato alla modalità normale e mostrerà lo stato reale del server.',
          color: maintenance ? 'warning' : 'success',
        })],
      });
    } catch {
      return InteractionHelper.safeEditReply(interaction, {
        embeds: [createEmbed({
          title: '❌ Errore',
          description: 'Non sono riuscito ad aggiornare il pannello di stato.',
          color: 'danger',
        })],
      });
    }
  },
};
