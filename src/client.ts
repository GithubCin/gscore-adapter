import type { Context } from 'koishi';
import { logger, type Config } from './index';
import WebSocket from 'ws';
import { parseCoreMessage } from './message';

export class GsuidCoreClient {
    reconnectInterval = 5000;

    ws!: WebSocket;
    public createWs(ctx: Context, config: Config): void {
        const url = `${config.isWss ? 'wss' : 'ws'}://${config.host}:${config.port}/ws/${config.botId}`;
        this.ws = new WebSocket(url);
        this.ws.on('open', () => {
            logger.info(`与[gsuid-core]成功连接! Bot_ID: ${config.botId}`);
        });
        this.ws.on('error', (err) => {
            logger.error(`与[gsuid-core]连接时发生错误: ${err}`);
        });
        this.ws.on('close', (err) => {
            logger.error(`与[gsuid-core]连接断开: ${err}`);
            setTimeout(() => {
                logger.info(`自动连接core服务器失败...${this.reconnectInterval / 1000}秒后重新连接...`);
                this.createWs(ctx, config);
            }, this.reconnectInterval);
        });
        this.ws.on('message', (data) => {
            const message = JSON.parse(data.toString());
            if (message.target_id == null) {
                message.content.forEach((element) => {
                    logger.info(`收到[gsuid-core]日志消息: ${element.data}`);
                });
            } else {
                if (config.dev) logger.info(data);
                const bot = ctx.bots[`${message.bot_id}:${message.bot_self_id}`];
                const parsed = parseCoreMessage(message, config);
                if (config.dev) logger.info(parsed);
                if (config.figureSupport) {
                    if (message.target_type === 'group') {
                        bot.sendMessage(message.target_id, parsed, message.target_id);
                    } else if (message.target_type === 'direct') {
                        bot.sendPrivateMessage(message.target_id, parsed);
                    }
                } else {
                    parsed.flat().forEach((element) => {
                        if (message.target_type === 'group') {
                            bot.sendMessage(message.target_id, [element], message.target_id);
                        } else if (message.target_type === 'direct') {
                            bot.sendPrivateMessage(message.target_id, [element]);
                        }
                    });
                }
            }
        });
    }
}
