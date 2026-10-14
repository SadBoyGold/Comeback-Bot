# Comeback Towny Minecraft order delivery

The `/giveorder` command is under `src/commands/Store/giveorder.js`; its private form handler is `src/interactions/modals/store/giveorder.js`. The direct staff `/givepack` command is under `src/commands/Store/givepack.js`. Both use `src/utils/minecraftDelivery.js` to request delivery from the Paper plugin and wait for a plugin confirmation.

## Configure

Add these variables to the bot's private `.env` file (do not commit or share the token):

```env
MINECRAFT_DELIVERY_URL=http://127.0.0.1:8765/deliver
MINECRAFT_DELIVERY_TOKEN=THE_SAME_RANDOM_SECRET_AS_THE_PLUGIN_CONFIG
```

The bot must run on the same Windows PC as the Minecraft server for the default localhost endpoint. The plugin rejects non-local connections; do not expose it directly to the internet.

## Command

`/giveorder order_id:CB-00027` opens a private modal for Minecraft username and Towny town. It resolves the product from the existing order, sends the delivery request, and only marks the order completed after the plugin confirms it. The customer then receives the `Ordine Consegnato` DM.

Use `/create order`'s optional `chunks` field to store additional chunks for a package or the total quantity for a Chunk-only order. If using a note instead, use `Chunk aggiuntivi: 3` or `Quantità: 10 Chunk`.

The existing `/order complete` is blocked for recognized Minecraft package orders to prevent staff from marking a package delivered without a plugin receipt.

## Commands provided by the Paper plugin

- Discord `/givepack player:<username> town:<town> package:<package> [extra_chunks] [reference]` delivers a package directly.
- In-game `/givepack <player> <town> <package> [extraChunks] [reference]` and `/givechunk <town> <amount> [reference]` are also available to authorized staff.
- `/comebackdelivery status <orderId>`

The plugin project is in the separate `ComebackTowny-Plugin` source archive. Build it with JDK 25 and Gradle; a compiled JAR is not included because this environment could not resolve Paper's API dependency.


## Pack contents and Towny chunks

The Paper plugin reads each package inventory from `plugins/ComebackTowny/config.yml`. The included default config now contains a complete item list for each package, including swords for Starter/Starter Extra/Premium and a sword, shield, bow, arrows, and golden apples for Warrior. Package Chunk amounts are Towny bonus claim capacity: Starter 2, Starter Extra 5, Starter Premium 15, Warrior 3. They increase the town's bonus claim allowance; they do not automatically claim land.
