import { Context, Schema, Logger } from 'koishi';
import { GsuidCoreClient } from './client';
import { genToCoreMessage } from './message';
import { DataService } from '@koishijs/plugin-console';
import { createCustomFile } from './custom-file';
import { resolve } from 'path';

export const reusable = true; // 声明此插件可重用

export const inject = ['database'];

declare module '@koishijs/plugin-console' {
    namespace Console {
        interface Services {
            ['gscore-custom']: any;
        }
    }
}
export const name = 'gscore-adapter';

export const logger = new Logger(name);
export interface Config {
    isWss: boolean;
    isHttps: boolean;
    botId: string;
    host: string;
    port: number;
    wsPath: string;
    dev: boolean;
    figureSupport: boolean;
    httpPath: string;
    imgType: 'image' | 'img',
    passive: boolean
}

export const Config: Schema<Config> = Schema.object({
    isWss: Schema.boolean().default(false).description('是否使用wss'),
    isHttps: Schema.boolean().default(false).description('是否使用https'),
    botId: Schema.string().default('koishi').description('机器人ID'),
    host: Schema.string().default('localhost').description('主机地址'),
    port: Schema.number().default(8765).description('端口'),
    wsPath: Schema.string().default('ws').description('ws路径'),
    httpPath: Schema.string().default('genshinuid').description('http路径'),
    dev: Schema.boolean().description('调试输出').default(false),
    figureSupport: Schema.boolean().description('兼容项：是否支持合并转发，如果当前适配器不支持，请切换为FALSE').default(true),
    imgType: Schema.union(['image', 'img']).description('兼容项：图片消息元素类型，新版本使用img，旧版本使用image').default('img'),
    passive: Schema.boolean().description('兼容项：passive消息元素包裹，用于获取消息上下文').default(true),
});

export function apply(ctx: Context, config: Config) {
    class GSCOREProvider extends DataService<string[]> {
        constructor(ctx: Context) {
            super(ctx, 'gscore-custom');
        }

        async get() {
            return [config.host, config.port.toString(), config.isHttps ? 'https:' : 'http:', config.httpPath];
        }
    }
    ctx.plugin(GSCOREProvider);
    ctx.inject(['console'], (ctx) => {
        ctx.console.addEntry({
            dev: resolve(__dirname, '../client/index.ts'),
            prod: resolve(__dirname, '../dist'),
        });
    });
    const client = new GsuidCoreClient();
    createCustomFile(ctx);
    ctx.on('ready', () => {
        client.createWs(ctx, config);
    });
    ctx.on('message', (session) => {
        if (config.dev) {
            session.elements.forEach(logger.info);
            logger.info(session);
        }
        genToCoreMessage(session, ctx).then((message) => {
            client.ws.send(Buffer.from(JSON.stringify(message)));
        });
    });
    ctx.on('dispose', () => {
        // 在插件停用时关闭端口
        client.isDispose = true;
        client.ws.close();
    });
}
