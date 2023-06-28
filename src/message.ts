import { Session, h, segment } from 'koishi';
import { Config } from '.';
import { writeFileSync } from 'fs';

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

const genContent = (session: Session): Message[] => {
    return (session.elements ?? []).map((item) => {
        if (item.type === 'at')
            return {
                type: item.type,
                data: item.attrs.id,
            };
        if (item.type === 'image')
            return {
                type: item.type,
                data: item.attrs.url,
            };
        return {
            type: item.type,
            data: item.attrs.content,
        };
    });
};

export const genToCoreMessage = (session: Session, config: Config): ToCoreMessage => {
    return {
        bot_id: session.platform,
        bot_self_id: session.selfId,
        msg_id: session.messageId,
        user_type: genUserType(session),
        group_id: session.channelId.startsWith('private') ? null : session.channelId,
        user_id: session.userId,
        user_pm: genUserPermission(session),
        content: genContent(session),
    };
};

export const parseMessage = (message: Message, messageId: string) => {
    if (message.type === 'text') return segment.text(message.data);
    if (message.type === 'image') return segment.image(message.data.replace('base64://', 'data:image/png;base64,'));
    if (message.type === 'at') return segment.at(message.data);
    if (message.type === 'reply') return h('quote', { id: messageId }, segment.text(message.data));
    // if (message.type === 'file') {
    //     const b = Buffer.from(message.data.split('|')[1], 'base64');
    //     return h.file(b, 'application/json');
    // }

    if (message.type === 'node') {
        const result = h('figure');
        message.data.forEach((item) => {
            const attrs = {
                nickname: '小助手',
            };
            result.children.push(h('message', attrs, parseMessage(item, messageId)));
        });
        return result;
    }
    return segment.text('未知消息类型');
};

export const parseCoreMessage = (message: FromCoreMessage): segment[] => {
    return message.content.map((item) => {
        return parseMessage(item, message.msg_id);
    });
};
