import { createEmbed } from '../utils/embeds.js';

const DEFAULT_JAVA_SERVER = 'spiral-schools.tun.ply.gg';
const DEFAULT_BEDROCK_SERVER = '147.185.221.225:64664';
const STATUS_INTERVAL_MS = Math.max(30_000, Number(process.env.MC_STATUS_INTERVAL_MS || 60_000));
const SERVER_ALERT_ROLE_ID = '1545874417962328145';
const SERVER_STATS_CHANNEL_ID = '1545807441554309245';

const monitors = new Map();

function getConfig() {
  return {
    javaAddress: process.env.MC_SERVER_ADDRESS?.trim() || DEFAULT_JAVA_SERVER,
    bedrockAddress: process.env.MC_BEDROCK_ADDRESS?.trim() || DEFAULT_BEDROCK_SERVER,
    iconUrl: process.env.MC_SERVER_ICON_URL?.trim() || null,
    statusChannelId: process.env.MC_STATUS_CHANNEL_ID?.trim() || null,
  };
}

async function fetchServerStatus(address, bedrock = false) {
  const endpoint = bedrock
    ? `https://api.mcsrvstat.us/bedrock/3/${encodeURIComponent(address)}`
    : `https://api.mcsrvstat.us/3/${encodeURIComponent(address)}`;
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

function buildEmbed({ javaData, bedrockData, maintenance, interaction, lastChecked, javaError, bedrockError }) {
  // Java and Bedrock are treated as the same server. If either endpoint reports
  // the server online, the public status is Online. Prefer Java for player count
  // when available because Bedrock players connected through Geyser are included
  // there; otherwise fall back to Bedrock.
  const javaOnline = Boolean(javaData?.online) && !javaError;
  const bedrockOnline = Boolean(bedrockData?.online) && !bedrockError;
  const serverOnline = javaOnline || bedrockOnline;

  const javaPlayers = Number.isFinite(javaData?.players?.online) ? javaData.players.online : null;
  const bedrockPlayers = Number.isFinite(bedrockData?.players?.online) ? bedrockData.players.online : null;
  const playerCount = javaPlayers ?? bedrockPlayers ?? 0;

  const iconUrl = interaction?.guild?.iconURL({ extension: 'png', size: 128 }) || getConfig().iconUrl || undefined;

  let description;
  let statusValue;
  let color;
  if (maintenance) {
    description = '🛠️ **Il server è in fase di aggiornamento**\n\nStiamo lavorando al server. Tornerà disponibile appena i lavori saranno terminati.';
    statusValue = '🛠️ In aggiornamento';
    color = 'warning';
  } else if (serverOnline) {
    description = '🟢 **Server online**\n\nIl server è attualmente disponibile.';
    statusValue = '🟢 Online';
    color = 'success';
  } else {
    description = '🔴 **Server offline**\n\nIl server non è attualmente disponibile.';
    statusValue = '🔴 Offline';
    color = 'danger';
  }

  return createEmbed({
    title: '🎮 Comeback Towny — Stato Server',
    description,
    color,
    author: { name: 'Comeback Towny Staff', iconURL: iconUrl },
    thumbnail: iconUrl || null,
    fields: [
      { name: '📡 Stato', value: statusValue, inline: true },
      { name: '👥 Giocatori', value: `**${playerCount}** giocator${playerCount === 1 ? 'e' : 'i'} online`, inline: true },
      { name: '🔄 Ultimo controllo', value: `<t:${Math.floor(lastChecked.getTime() / 1000)}:R>`, inline: true },
    ],
  });
}

async function updateMonitor(monitor, interactionForIcon = null) {
  const now = new Date();
  const wasOnline = monitor.lastServerOnline;
  try {
    const [javaResult, bedrockResult] = await Promise.allSettled([
      fetchServerStatus(monitor.javaAddress, false),
      fetchServerStatus(monitor.bedrockAddress, true),
    ]);

    if (javaResult.status === 'fulfilled') {
      monitor.javaData = javaResult.value;
      monitor.javaError = null;
    } else {
      monitor.javaError = javaResult.reason;
    }

    if (bedrockResult.status === 'fulfilled') {
      monitor.bedrockData = bedrockResult.value;
      monitor.bedrockError = null;
    } else {
      monitor.bedrockError = bedrockResult.reason;
    }

    monitor.lastChecked = now;
  } catch (error) {
    monitor.javaError = error;
    monitor.bedrockError = error;
    monitor.lastChecked = now;
  }

  const javaOnline = Boolean(monitor.javaData?.online) && !monitor.javaError;
  const bedrockOnline = Boolean(monitor.bedrockData?.online) && !monitor.bedrockError;
  const serverOnline = javaOnline || bedrockOnline;

  if (wasOnline === false && serverOnline === true && !monitor.maintenance) {
    try {
      const channel = monitor.message.channel?.id === SERVER_STATS_CHANNEL_ID
        ? monitor.message.channel
        : await monitor.message.client.channels.fetch(SERVER_STATS_CHANNEL_ID).catch(() => monitor.message.channel);
      if (channel?.isTextBased?.()) {
        await channel.send({
          content: `<@&${SERVER_ALERT_ROLE_ID}>`,
          allowedMentions: { roles: [SERVER_ALERT_ROLE_ID] },
          embeds: [createEmbed({
            title: '🟢 Il server è online!',
            description: 'Il server Comeback Towny è stato acceso ed è nuovamente disponibile.',
            color: 'success',
            author: {
              name: 'Comeback Towny Staff',
              iconURL: interactionForIcon?.guild?.iconURL({ extension: 'png', size: 128 }) || getConfig().iconUrl || undefined,
            },
          })],
        });
      }
    } catch {}
  }

  monitor.lastServerOnline = serverOnline;

  try {
    const embed = buildEmbed({
      javaData: monitor.javaData,
      bedrockData: monitor.bedrockData,
      maintenance: monitor.maintenance,
      interaction: interactionForIcon,
      lastChecked: monitor.lastChecked,
      javaError: monitor.javaError,
      bedrockError: monitor.bedrockError,
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
    javaAddress: config.javaAddress,
    bedrockAddress: config.bedrockAddress,
    maintenance: false,
    javaData: null,
    bedrockData: null,
    javaError: null,
    bedrockError: null,
    lastChecked: new Date(),
    lastServerOnline: null,
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
