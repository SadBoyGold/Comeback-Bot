import { createEmbed } from '../utils/embeds.js';

const DEFAULT_SERVER = 'spiral-schools.tun.ply.gg';
const STATUS_INTERVAL_MS = Math.max(30_000, Number(process.env.MC_STATUS_INTERVAL_MS || 60_000));

const monitors = new Map();

function getConfig() {
  return {
    address: process.env.MC_SERVER_ADDRESS?.trim() || DEFAULT_SERVER,
    iconUrl: process.env.MC_SERVER_ICON_URL?.trim() || null,
    statusChannelId: process.env.MC_STATUS_CHANNEL_ID?.trim() || null,
  };
}

async function fetchServerStatus(address) {
  const endpoint = `https://api.mcsrvstat.us/3/${encodeURIComponent(address)}`;
  const response = await fetch(endpoint, {
    headers: { 'User-Agent': 'Comeback-Towny-Discord-Bot/1.0' },
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    throw new Error(`Minecraft status API returned HTTP ${response.status}`);
  }

  return response.json();
}

function formatVersion(data) {
  if (typeof data?.version === 'string' && data.version.trim()) return data.version.trim();
  if (typeof data?.protocol?.name === 'string' && data.protocol.name.trim()) return data.protocol.name.trim();
  return 'Non disponibile';
}

function buildEmbed({ data, maintenance, interaction, lastChecked, error }) {
  const online = Boolean(data?.online) && !error;
  const playersOnline = Number.isFinite(data?.players?.online) ? data.players.online : 0;
  const playersMax = Number.isFinite(data?.players?.max) ? data.players.max : 0;
  const iconUrl = interaction?.guild?.iconURL({ extension: 'png', size: 128 }) || getConfig().iconUrl || undefined;

  let title = '🎮 Comeback Towny — Stato Server';
  let description;

  if (maintenance) {
    description = '🛠️ **Il server è in fase di aggiornamento**\n\nStiamo lavorando al server. Tornerà disponibile appena i lavori saranno terminati.';
  } else if (online) {
    description = '🟢 **Il server è online!**\n\nPuoi entrare su Comeback Towny in qualsiasi momento durante gli orari di apertura.';
  } else {
    description = '🔴 **Il server è offline**\n\nAl momento il server non è raggiungibile.';
  }

  if (error) {
    description += '\n\n⚠️ Il controllo automatico ha avuto un problema temporaneo.';
  }

  return createEmbed({
    title,
    description,
    color: maintenance ? 'warning' : online ? 'success' : 'danger',
    author: {
      name: 'Comeback Towny Staff',
      iconURL: iconUrl,
    },
    thumbnail: iconUrl || null,
    fields: [
      {
        name: '📡 Stato',
        value: maintenance ? '🛠️ In aggiornamento' : online ? '🟢 Online' : '🔴 Offline',
        inline: true,
      },
      {
        name: '👥 Giocatori',
        value: online ? `**${playersOnline}** / ${playersMax || '?'}` : '0',
        inline: true,
      },
      {
        name: '🌐 Java',
        value: `\`${getConfig().address}\``,
        inline: false,
      },
      {
        name: '🧩 Versione',
        value: online ? `\`${formatVersion(data)}\`` : 'Non disponibile',
        inline: true,
      },
      {
        name: '🔄 Ultimo controllo',
        value: `<t:${Math.floor(lastChecked.getTime() / 1000)}:R>`,
        inline: true,
      },
    ],
  });
}

async function updateMonitor(monitor, interactionForIcon = null) {
  const now = new Date();
  try {
    const data = await fetchServerStatus(monitor.address);
    monitor.lastData = data;
    monitor.lastError = null;
    monitor.lastChecked = now;
  } catch (error) {
    monitor.lastError = error;
    monitor.lastChecked = now;
  }

  try {
    const embed = buildEmbed({
      data: monitor.lastData,
      maintenance: monitor.maintenance,
      interaction: interactionForIcon,
      lastChecked: monitor.lastChecked,
      error: monitor.lastError,
    });
    await monitor.message.edit({ embeds: [embed] });
  } catch (error) {
    // If the message/channel was deleted or is inaccessible, stop monitoring it.
    monitor.stop?.();
  }
}

export async function startMinecraftMonitor({ guildId, message, interaction }) {
  stopMinecraftMonitor(guildId);

  const config = getConfig();
  const monitor = {
    guildId,
    message,
    address: config.address,
    maintenance: false,
    lastData: null,
    lastError: null,
    lastChecked: new Date(),
    timer: null,
  };

  monitor.stop = () => {
    if (monitor.timer) clearInterval(monitor.timer);
    monitors.delete(guildId);
  };

  monitors.set(guildId, monitor);

  await updateMonitor(monitor, interaction);
  monitor.timer = setInterval(() => updateMonitor(monitor, interaction).catch(() => {}), STATUS_INTERVAL_MS);
  monitor.timer.unref?.();

  return monitor;
}

export async function setMinecraftMaintenance(guildId, maintenance, interaction = null) {
  const monitor = monitors.get(guildId);
  if (!monitor) return false;

  monitor.maintenance = maintenance;
  await updateMonitor(monitor, interaction);
  return true;
}

export function getMinecraftMonitor(guildId) {
  return monitors.get(guildId) || null;
}

export function stopMinecraftMonitor(guildId) {
  const monitor = monitors.get(guildId);
  monitor?.stop?.();
}
