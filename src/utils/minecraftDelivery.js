const PACKAGES = [
    { key: 'starter_premium', names: ['pacchetto starter premium', 'starter premium'], baseChunks: 15 },
    { key: 'starter_extra', names: ['pacchetto starter extra', 'starter extra'], baseChunks: 5 },
    { key: 'starter', names: ['pacchetto starter', 'starter'], baseChunks: 2 },
    { key: 'warrior', names: ['pacchetto guerriero', 'guerriero', 'warrior'], baseChunks: 3 },
    { key: 'miner', names: ['pacchetto minatore', 'minatore', 'miner'], baseChunks: 0 },
    { key: 'farmer', names: ['pacchetto agricoltore', 'agricoltore', 'farmer'], baseChunks: 0 },
    { key: 'builder', names: ['pacchetto costruttore', 'costruttore', 'builder'], baseChunks: 0 },
    { key: 'chunks', names: ['chunk della città', 'chunk della citta', 'chunks', 'chunk'], baseChunks: 0 },
];

function normalize(value = '') {
    return String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function parseChunkCount(text) {
    const value = normalize(text);
    const patterns = [
        /(?:chunk|chunks)\s*(?:aggiuntivi|aggiuntive|extra|in piu)?\s*(?:della citta)?\s*(?:x|:|=|-)\s*(\d{1,5})/i,
        /(\d{1,5})\s*(?:chunk|chunks)\b/i,
        /(?:quantita|quantita di chunk|chunk aggiuntivi|chunk extra|extra chunks?)\s*[:=x-]?\s*(\d{1,5})/i,
        /(?:aggiuntivi|aggiuntive|extra)\s*(?:chunk|chunks)?\s*[:=x-]?\s*(\d{1,5})/i,
    ];
    for (const pattern of patterns) {
        const match = value.match(pattern);
        if (match) {
            const amount = Number(match[1]);
            if (Number.isInteger(amount) && amount >= 0 && amount <= 10000) return amount;
        }
    }
    return null;
}

export function resolveMinecraftOrder(order) {
    const item = normalize(order?.item || '');
    const note = normalize(order?.note || '');
    const combined = `${item} ${note}`;
    const product = PACKAGES.find(candidate => candidate.names.some(name => item.includes(normalize(name))));
    if (!product) {
        throw new Error(`Il prodotto "${order?.item || 'sconosciuto'}" non corrisponde a un pacchetto Minecraft supportato. Usa uno dei pacchetti del negozio.`);
    }

    const storedChunks = Number(order?.chunks);
    const hasStoredChunks = Number.isInteger(storedChunks) && storedChunks >= 0 && storedChunks <= 10000;

    if (product.key === 'chunks') {
        const quantity = hasStoredChunks && storedChunks > 0 ? storedChunks : parseChunkCount(combined);
        if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10000) {
            throw new Error('Quantità Chunk non trovata. In /create order inserisci il campo `chunks`, oppure scrivi `Chunk della Città x10` nel prodotto o `Quantità: 10 Chunk` nella nota.');
        }
        return { packageKey: 'chunks', extraChunks: quantity, totalChunks: quantity, packageLabel: 'Chunk della Città' };
    }

    let extraChunks = hasStoredChunks ? storedChunks : null;
    if (extraChunks === null || extraChunks === 0) {
        const parsedFromNote = parseChunkCount(note);
        if (parsedFromNote !== null && /aggiunt|extra|in piu/i.test(note)) extraChunks = parsedFromNote;
        else if (extraChunks === null) extraChunks = 0;
    }
    if (!Number.isInteger(extraChunks) || extraChunks < 0 || extraChunks > 10000) {
        throw new Error('Quantità di Chunk aggiuntivi non valida.');
    }
    return {
        packageKey: product.key,
        extraChunks,
        totalChunks: product.baseChunks + extraChunks,
        packageLabel: order.item,
    };
}

export async function sendMinecraftDelivery({ orderId, username, townName, packageKey, extraChunks }) {
    const baseUrl = process.env.MINECRAFT_DELIVERY_URL?.trim();
    const token = process.env.MINECRAFT_DELIVERY_TOKEN?.trim();
    if (!baseUrl || !token) {
        throw new Error('Consegna Minecraft non configurata. Imposta MINECRAFT_DELIVERY_URL e MINECRAFT_DELIVERY_TOKEN nel file .env del bot.');
    }

    const body = new URLSearchParams({
        orderId,
        username,
        townName,
        packageKey,
        extraChunks: String(extraChunks),
    });

    let response;
    try {
        response = await fetch(baseUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8',
                'Accept': 'application/json',
            },
            body,
            signal: AbortSignal.timeout(15000),
        });
    } catch (error) {
        throw new Error(`Il plugin Minecraft non è raggiungibile (${error.name === 'TimeoutError' ? 'timeout' : 'connessione fallita'}). L'ordine NON è stato segnato come completato.`);
    }

    const raw = await response.text();
    let result;
    try { result = JSON.parse(raw); } catch { result = null; }
    if (!response.ok || !result?.ok) {
        throw new Error(result?.message || `Il plugin Minecraft ha rifiutato la consegna (HTTP ${response.status}). L'ordine NON è stato segnato come completato.`);
    }
    if (String(result.orderId || '').toUpperCase() !== orderId.toUpperCase()) {
        throw new Error('Risposta del plugin non valida: ID ordine differente. Verifica manualmente il registro consegne.');
    }
    if (String(result.username || '').toLowerCase() !== username.toLowerCase() || String(result.townName || '').toLowerCase() !== townName.toLowerCase() || String(result.packageKey || '') !== packageKey) {
        throw new Error('Il plugin segnala che questo ID ordine è già stato usato per una consegna diversa. Controlla il registro prima di riprovare.');
    }
    return result;
}
