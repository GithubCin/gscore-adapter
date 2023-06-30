import { Context, Schema, Logger } from 'koishi';
import { GsuidCoreClient } from './client';
import { genToCoreMessage } from './message';
import {} from '@koishijs/plugin-adapter-onebot';
import { rmSync } from 'fs';
import { randomUUID } from 'crypto';
import { isEqual } from 'lodash-es';

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
    const client = new GsuidCoreClient();
    ctx.component('custom-file', (attrs, children, session) => {
        if (session.platform !== 'onebot') {
            return '该平台适配器不支持导出文件类型消息';
        }
        const onebot = session.onebot;
        if (session.subtype === 'private') {
            const id = session.channelId;
            const reg = /private:(\d+)/;
            const userId = reg.test(id) ? reg.exec(id)[1] : null;
            if (userId)
                onebot.uploadPrivateFile(userId, attrs.location, attrs.name).finally(() => rmSync(attrs.location));
            // onebot.uploadPrivateFile()
        } else {
            onebot.uploadGroupFile(session.channelId, attrs.location, attrs.name).finally(() => rmSync(attrs.location));
        }
        return `已发送文件 ${attrs.name}`;
    });
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
        // session.elements.forEach(console.log);
        genToCoreMessage(session, config).then((message) => {
            client.ws.send(Buffer.from(JSON.stringify(message)));
        });
    });
}
