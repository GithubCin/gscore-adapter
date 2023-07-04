import { Context, Schema, Logger } from 'koishi';
import { GsuidCoreClient } from './client';
import { genToCoreMessage } from './message';
import {} from '@koishijs/plugin-adapter-onebot';
import { DataService } from '@koishijs/plugin-console';
import { createCustomFile } from './custom-file';
import { resolve } from 'path';
import { noticeEvent } from './notice-event';

declare module '@koishijs/plugin-console' {
    namespace Console {
        interface Services {
            custom: any;
        }
    }
}
export const name = 'gscore-adapter';

export const logger = new Logger(name);
export interface Config {
    isWss: boolean;
    botId: string;
    host: string;
    port: number;
    dev: boolean;
    figureSupport: boolean;
}

export const Config: Schema<Config> = Schema.object({
    isWss: Schema.boolean().default(false),
    botId: Schema.string().default('koishi'),
    host: Schema.string().default('localhost'),
    port: Schema.number().default(8765),
    dev: Schema.boolean().description('调试输出').default(false),
    figureSupport: Schema.boolean().description('是否支持合并转发，如果当前适配器不支持，请切换为FALSE').default(true),
});

export function apply(ctx: Context, config: Config) {
    class CustomProvider extends DataService<string[]> {
        constructor(ctx: Context) {
            super(ctx, 'custom');
        }

        async get() {
            return [config.host, config.port.toString()];
        }
    }
    ctx.plugin(CustomProvider);
    ctx.using(['console'], (ctx) => {
        ctx.console.addEntry({
            dev: resolve(__dirname, '../client/index.ts'),
            prod: resolve(__dirname, '../dist'),
        });
    });
    const client = new GsuidCoreClient();
    createCustomFile(ctx);
    ctx.on('ready', () => {
        client.createWs(ctx, config);
        noticeEvent(ctx, client);
    });
    ctx.on('message', (session) => {
        if (config.dev) {
            session.elements.forEach(logger.info);
            logger.info(session);
        }
        genToCoreMessage(session, config).then((message) => {
            client.ws.send(Buffer.from(JSON.stringify(message)));
        });
    });
}
