import { Context, Schema, Logger } from 'koishi';
import { GsCoreClient } from './client';
import { genToCoreMessage } from './message';

export const name = 'gscore-adapter';

export const logger = new Logger(name);
export interface Config {
    isWss: boolean;
    botId: string;
    host: string;
    port: number;
}

export const Config: Schema<Config> = Schema.object({
    isWss: Schema.boolean().default(false),
    botId: Schema.string().default('koishi'),
    host: Schema.string().default('localhost'),
    port: Schema.number().default(8765),
});

export function apply(ctx: Context, config: Config) {
    const client = new GsCoreClient();
    ctx.on('ready', () => {
        client.createWs(ctx, config);
    });
    // write your plugin here
    ctx.on('message', (session) => {
        // session.elements.forEach((i) => console.log(i));
        // console.log(genToCoreMessage(session, config));
        client.ws.send(Buffer.from(JSON.stringify(genToCoreMessage(session, config))));
    });
    ctx.on('guild-file-added', async (session) => {
        // console.log(session);
        // const c = await session.getChannel(session.channelId);
        // session.elements.forEach((i) => console.log(i));
    });
    // console.log(ctx.events);
}
