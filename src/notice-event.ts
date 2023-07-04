import { Context } from 'koishi';
import { randomUUID } from 'node:crypto';
import { logger } from '.';
import { GsuidCoreClient } from './client';
import { isEqual } from 'lodash';

//对早期onebot对文件上传事件不响应做的兼容
export const noticeEvent = (ctx: Context, client: GsuidCoreClient) => {
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
};
