import { Context, Dict, h, Logger, Quester, Session } from 'koishi';
import { logger, Config } from './index';
import WebSocket from 'ws';
import { parseCoreMessage } from './message';

export class GsCoreClient {
    // constructor(config: Config) {
    //     if (this.ws == null) {
    //         this.createWs(config);
    //     }
    // }
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
            logger.info(`收到core服务器消息: ${data}`);
            const message = JSON.parse(data.toString());
            // console.log(message);
            if (message.target_id == null) {
                message.content.forEach((element) => {
                    logger.info(element.data);
                });
            } else {
                const bot = ctx.bots[`${message.bot_id}:${message.bot_self_id}`];
                if (message.target_type === 'group') {
                    bot.sendMessage(message.target_id, parseCoreMessage(message));
                } else if (message.target_type === 'direct') {
                    bot.sendPrivateMessage(message.target_id, parseCoreMessage(message));
                }
            }
        });
    }
}
