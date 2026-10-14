import { MessageFlags, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { getFromDb, setInDb } from '../../../utils/database.js';
import { InteractionHelper } from '../../../utils/interactionHelper.js';
import { createEmbed } from '../../../utils/embeds.js';
import { resolveMinecraftOrder, sendMinecraftDelivery } from '../../../utils/minecraftDelivery.js';

const ORDERS_KEY = (guildId) => `guild:${guildId}:store:orders`;
const money = (value) => `€${Number(value || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default {
    name: 'giveorder_modal',
    async execute(interaction) {
        if (!interaction.inGuild() || !interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
            return InteractionHelper.safeReply(interaction, { flags: MessageFlags.Ephemeral, content: '❌ Solo owner/staff autorizzati possono consegnare ordini.' });
        }

        const orderId = String(interaction.customId.split(':')[1] || '').trim().toUpperCase();
        const username = interaction.fields.getTextInputValue('minecraft_username').trim();
        const townName = interaction.fields.getTextInputValue('town_name').trim();
        if (!/^[A-Za-z0-9_]{3,16}$/.test(username)) {
            return InteractionHelper.safeReply(interaction, { flags: MessageFlags.Ephemeral, content: '❌ Username Minecraft non valido. Usa da 3 a 16 lettere, numeri o underscore.' });
        }
        if (!townName || townName.length > 64) {
            return InteractionHelper.safeReply(interaction, { flags: MessageFlags.Ephemeral, content: '❌ Inserisci un nome città Towny valido.' });
        }

        const deferred = await InteractionHelper.safeDefer(interaction, { flags: MessageFlags.Ephemeral });
        if (!deferred) return;

        const ordersKey = ORDERS_KEY(interaction.guildId);
        const orders = await getFromDb(ordersKey, []);
        const list = Array.isArray(orders) ? orders : [];
        const index = list.findIndex(entry => String(entry.id).toUpperCase() === orderId);
        if (index < 0) {
            return InteractionHelper.safeEditReply(interaction, { content: `❌ Non esiste alcun ordine con ID **${orderId}**.` });
        }
        const order = list[index];
        if (order.completedAt || order.status === 'completed') {
            return InteractionHelper.safeEditReply(interaction, { content: `⚠️ L'ordine **${order.id}** risulta già completato. Non ho inviato una seconda consegna.` });
        }

        let delivery;
        try {
            delivery = resolveMinecraftOrder(order);
        } catch (error) {
            return InteractionHelper.safeEditReply(interaction, { content: `❌ ${error.message}` });
        }

        let result;
        try {
            result = await sendMinecraftDelivery({
                orderId: order.id,
                username,
                townName,
                packageKey: delivery.packageKey,
                extraChunks: delivery.extraChunks,
            });
        } catch (error) {
            return InteractionHelper.safeEditReply(interaction, {
                content: `❌ **Consegna non confermata**\n${error.message}\n\nL'ordine non è stato segnato come completato. Prima di riprovare, controlla il registro del plugin se la richiesta ha avuto un timeout.`,
            });
        }

        const completedAt = new Date().toISOString();
        order.completedAt = completedAt;
        order.completedById = interaction.user.id;
        order.completedByTag = interaction.user.tag;
        order.status = 'completed';
        order.minecraftUsername = username;
        order.townName = townName;
        order.deliveryPackage = delivery.packageKey;
        order.deliveryChunks = Number(result.chunkCount ?? delivery.totalChunks ?? 0);
        order.deliveryConfirmedAt = completedAt;
        order.deliveryReceipt = result.receipt || null;
        list[index] = order;

        let orderSaved = true;
        try {
            await setInDb(ordersKey, list);
        } catch {
            orderSaved = false;
        }

        const staffAuthor = {
            name: 'Comeback Towny Staff',
            iconURL: interaction.guild?.iconURL({ extension: 'png', size: 128 }) || undefined,
        };
        let dmSent = true;
        try {
            const customer = await interaction.client.users.fetch(order.customerId);
            await customer.send({
                embeds: [createEmbed({
                    title: '📦 | Ordine Consegnato',
                    description:
                        `Grazie mille per il tuo acquisto! 💙\n\n` +
                        `Il tuo ordine **${order.id}** è stato consegnato con successo in Minecraft. ` +
                        `Dovresti trovare tutti gli oggetti del pacchetto nel tuo inventario.\n\n` +
                        (order.deliveryChunks > 0
                            ? `**Hai ricevuto ${order.deliveryChunks} Chunk bonus per la tua città!**\n` +
                              `Per usarli, vai nel punto di terra che vuoi reclamare e scrivi **/town claim** ` +
                              `(oppure **/t claim**). I chunk bonus aumentano il limite della città: non reclamano automaticamente il terreno. ` +
                              `Devi avere i permessi necessari e il terreno deve rispettare le regole di Towny.\n\n`
                            : '') +
                        `Se ti manca qualche oggetto o hai un problema con la consegna, ` +
                        `apri un ticket qui: https://discord.com/channels/1540459084673851402/1540594049206063235\n\n` +
                        `Grazie per aver supportato il server e buon divertimento!`,
                    color: 'success',
                    author: staffAuthor,
                }).addFields(
                    { name: 'Numero Ordine', value: `**${order.id}**`, inline: false },
                    { name: 'Prodotto', value: order.item, inline: true },
                    { name: 'Prezzo', value: money(order.price), inline: true },
                    { name: 'Username Minecraft', value: `\`${username}\``, inline: true },
                    { name: 'Città Towny', value: townName, inline: true },
                    { name: 'Chunk bonus aggiunti', value: String(order.deliveryChunks), inline: true },
                    { name: 'Assistenza', value: '[Apri un ticket](https://discord.com/channels/1540459084673851402/1540594049206063235)', inline: false },
                    { name: 'Data Consegna', value: `<t:${Math.floor(Date.parse(completedAt) / 1000)}:F>`, inline: false },
                )],
            });
        } catch {
            dmSent = false;
        }

        const embed = new EmbedBuilder()
            .setColor(0x57F287)
            .setAuthor(staffAuthor)
            .setTitle('📦 | Ordine Consegnato')
            .setDescription(
                `Il plugin Minecraft ha confermato la consegna dell'ordine **${order.id}**.` +
                `${dmSent ? '\n\n📩 Il cliente ha ricevuto il messaggio di consegna.' : '\n\n⚠️ Non è stato possibile inviare il DM al cliente.'}` +
                `${orderSaved ? '' : '\n\n🚨 **Attenzione:** consegna avvenuta, ma il bot non è riuscito a salvare lo stato nel database. Non ripetere la consegna; controlla il database e il registro plugin.'}`
            )
            .addFields(
                { name: 'Cliente Discord', value: `<@${order.customerId}>`, inline: true },
                { name: 'Username Minecraft', value: username, inline: true },
                { name: 'Città Towny', value: townName, inline: true },
                { name: 'Prodotto', value: order.item, inline: true },
                { name: 'Chunk consegnati', value: String(order.deliveryChunks), inline: true },
                { name: 'Consegnato da', value: `<@${interaction.user.id}>`, inline: true },
                { name: 'Data', value: `<t:${Math.floor(Date.parse(completedAt) / 1000)}:F>`, inline: false },
            );
        return InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
    },
};
