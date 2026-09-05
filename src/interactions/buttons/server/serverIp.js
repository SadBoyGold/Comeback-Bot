import { MessageFlags } from 'discord.js';

export default {
  name: 'show_server_ip',
  async execute(interaction) {
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      embeds: [{
        title: '🌐 Comeback Towny — Dati di Accesso',
        color: 0x336699,
        description: [
          '**☕ JAVA EDITION**',
          '`spiral-schools.tun.ply.gg`',
          '',
          '**📱 BEDROCK EDITION**',
          '`147.185.221.225`',
          '**Porta:** `64664`',
          '',
          '✅ **Minecraft Premium:** disponibile',
          '✅ **Minecraft Cracked:** disponibile',
        ].join('\n'),
        footer: {
          text: 'Comeback Towny • Buon divertimento!'
        }
      }]
    });
  },
};
