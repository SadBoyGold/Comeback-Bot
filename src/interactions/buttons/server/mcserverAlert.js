import { MessageFlags } from 'discord.js';

const SERVER_ALERT_ROLE_ID = '1545874417962328145';

export default {
  name: 'mcserver_alert_toggle',
  async execute(interaction) {
    if (!interaction.guild) {
      return interaction.reply({ content: '❌ Questo pulsante può essere usato solo nel server.', flags: MessageFlags.Ephemeral });
    }

    const member = interaction.member;
    const role = interaction.guild.roles.cache.get(SERVER_ALERT_ROLE_ID)
      || await interaction.guild.roles.fetch(SERVER_ALERT_ROLE_ID).catch(() => null);

    if (!role) {
      return interaction.reply({ content: '❌ Il ruolo degli avvisi non è stato trovato.', flags: MessageFlags.Ephemeral });
    }

    if (role.position >= interaction.guild.members.me.roles.highest.position) {
      return interaction.reply({ content: '❌ Non posso gestire questo ruolo. Sposta il ruolo degli avvisi sotto il mio ruolo.', flags: MessageFlags.Ephemeral });
    }

    const hasRole = member.roles.cache.has(role.id);
    try {
      if (hasRole) {
        await member.roles.remove(role);
        return interaction.reply({ content: '🔕 Avvisi accensione **disattivati**. Non riceverai più il ping quando il server torna online.', flags: MessageFlags.Ephemeral });
      }

      await member.roles.add(role);
      return interaction.reply({ content: '🔔 Avvisi accensione **attivati**! Riceverai un ping quando il server torna online.', flags: MessageFlags.Ephemeral });
    } catch {
      return interaction.reply({ content: '❌ Non riesco a modificare il ruolo. Controlla i permessi del bot.', flags: MessageFlags.Ephemeral });
    }
  },
};
