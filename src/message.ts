import { Context, Session, h, segment } from 'koishi';
import { Config, logger } from '.';
import { mkdir, mkdirSync, writeFileSync } from 'fs';
import { randomUUID } from 'node:crypto';
import { join, resolve } from 'path';

interface Message {
    type?: string;
    data?: any;
}
interface ToCoreMessage {
    bot_id: string | 'bot';
    bot_self_id: string;
    msg_id: string;
    user_type: string | 'group' | 'direct' | 'channel' | 'sub_channel';
    group_id?: string;
    user_id?: string;
    user_pm: number;
    content: Message[];
}

interface FromCoreMessage {
    bot_id: string | 'bot';
    bot_self_id: string;
    msg_id: string;
    target_type: string | 'group' | 'direct' | 'channel' | 'sub_channel';
    target_id: string;
    content: Message[];
}

const genUserType = (session: Session): string => {
    if (session.subtype === 'group') {
        return 'group';
    } else if (session.subtype === 'private') {
        return 'direct';
    } else if (session.subtype === 'channel') {
        return 'channel';
    } else if (session.subtype === 'sub_channel') {
        return 'sub_channel';
    } else {
        return 'unknown';
    }
};

const genUserPermission = (session: Session): number => {
    if (session.subtype === 'group') {
        if (session.author?.roles?.includes('admin')) {
            return 3;
        }
        if (session.author?.roles?.includes('owner')) {
            return 2;
        }
        return 6;
    } else if (session.subtype === 'private') {
        return 6;
    } else {
        return 6;
    }
};

const genContent = async (session: Session): Promise<Message[]> => {
    if (session.elements == null) return [];
    const m: Message[] = [];
    for (const item of session.elements) {
        if (item.type === 'at') {
            m.push({
                type: item.type,
                data: item.attrs.id,
            });
        }

        if (item.type === 'image') {
            m.push({
                type: item.type,
                data: item.attrs.url,
            });
        }

        if (item.type === 'text') {
            m.push({
                type: item.type,
                data: item.attrs.content,
            });
        }

        if (item.type === 'file') {
            try {
                const res = await session.app.http.file(item.attrs.url);
                const b = Buffer.from(res.data);
                const content = `${item.attrs.name}|${b.toString('base64')}`;
                m.push({
                    type: item.type,
                    data: content,
                });
            } catch (error) {
                logger.error(`下载文件失败: ${error}`);
            }
        }
    }
    return m;
};

export const genToCoreMessage = async (session: Session, config: Config): Promise<ToCoreMessage> => {
    return {
        bot_id: session.platform,
        bot_self_id: session.selfId,
        msg_id: session.messageId,
        user_type: genUserType(session),
        group_id: session.channelId?.startsWith('private') ? null : session.channelId,
        user_id: session.userId,
        user_pm: genUserPermission(session),
        content: await genContent(session),
    };
};

export const parseMessage = (message: Message, messageId: string, config: Config) => {
    if (message.type === 'text') return segment.text(message.data);
    if (message.type === 'image')
        return h('image', { url: message.data.replace('base64://', 'data:image/png;base64,') });
    if (message.type === 'at') return segment.at(message.data);
    if (message.type === 'reply') return h('', {}, [h('quote', { id: messageId }), segment.text(message.data)]);
    if (message.type === 'file') {
        const [name, file] = message.data.split('|');
        const id = randomUUID();
        mkdirSync(`./data`, { recursive: true });
        writeFileSync(`./data/${id}`, file, 'base64');
        const location = resolve(join('.', 'data'), id);
        return h('custom-file', { name, location });
    }

    if (message.type === 'node') {
        if (config.figureSupport) {
            const result = h('figure');
            message.data.forEach((item) => {
                const attrs = {
                    nickname: '小助手',
                };
                result.children.push(h('message', attrs, parseMessage(item, messageId, config)));
            });
            return result;
        }
        return message.data.map((i) => parseMessage(i, messageId, config));
    }
    return segment.text('未知消息类型');
};

export const parseCoreMessage = (message: FromCoreMessage, config: Config): segment[] => {
    return  message.content.map((item) => {
        return parseMessage(item, message.msg_id, config);
    });
};
