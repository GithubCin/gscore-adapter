import { Context, Schema, Logger } from 'koishi';
import { GsuidCoreClient } from './client';
import { genToCoreMessage } from './message';
import {} from '@koishijs/plugin-adapter-onebot';
import { rmSync } from 'fs';
import { randomUUID } from 'crypto';
import { isEqual } from 'lodash';
import { createCustomFile } from './custom-file';

export const name = 'gscore-adapter';

export const logger = new Logger(name);
export interface Config {
    isWss: boolean;
    botId: string;
    host: string;
    port: number;
    dev: boolean;
}

export const Config: Schema<Config> = Schema.object({
    isWss: Schema.boolean().default(false),
    botId: Schema.string().default('koishi'),
    host: Schema.string().default('localhost'),
    port: Schema.number().default(8765),
    dev: Schema.boolean().description('调试输出').default(false),
});

export function apply(ctx: Context, config: Config) {
    const client = new GsuidCoreClient();
    createCustomFile(ctx);
    ctx.on('ready', () => {
        client.createWs(ctx, config);
        ctx.bots.forEach((bot) => {
            //处理接收的文件
            const logMap = new Map();
            bot?.socket?.on('message', (data) => {
                let parsed;
                try {
                    parsed = JSON.parse(data.toString());
                } catch (error) {
                    return logger.warn('cannot parse message', data);
                }
                if (parsed.post_type === 'notice' && parsed.notice_type.includes('file') && parsed.file != null) {
                    const tmp = logMap.get(parsed.time);
                    if (isEqual(tmp, parsed)) return;
                    logMap.set(parsed.time, parsed);
                    if (parsed.file.name.includes('.json')) {
                        ctx.http
                            .file(parsed.file.url)
                            .then((res) => {
                                const b = Buffer.from(res.data);
                                const content = `${parsed.file.name}|${b.toString('base64')}`;
                                const message = {
                                    bot_id: 'onebot',
                                    bot_self_id: String(parsed.self_id),
                                    msg_id: randomUUID(),
                                    user_type: 'direct',
                                    group_id: null,
                                    user_id: String(parsed.user_id),
                                    user_pm: 6,
                                    content: [
                                        {
                                            type: 'file',
                                            data: content,
                                        },
                                    ],
                                };
                                client.ws.send(Buffer.from(JSON.stringify(message)));
                            })
                            .catch((e) => {
                                logger.error(e);
                            });
                    }
                }
            });
        });
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
