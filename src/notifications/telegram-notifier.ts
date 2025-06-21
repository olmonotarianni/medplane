import TelegramBot from 'node-telegram-bot-api';
import { logger } from '../logger';

export class TelegramNotifier {
    private static instance: TelegramNotifier;
    private bot: TelegramBot | null = null;
    private botToken: string;
    private chatId: string;

    private constructor() {
        this.botToken = process.env.TELEGRAM_BOT_TOKEN || '';
        this.chatId = process.env.TELEGRAM_CHAT_ID || '';

        if (!this.botToken) {
            logger.warn('Telegram configuration missing. Set TELEGRAM_BOT_TOKEN environment variable.');
        }
        if (!this.chatId) {
            logger.warn('Telegram configuration missing. Set TELEGRAM_CHAT_ID environment variable.');
        }
    }

    public static getInstance(): TelegramNotifier {
        if (!TelegramNotifier.instance) {
            TelegramNotifier.instance = new TelegramNotifier();
        }
        return TelegramNotifier.instance;
    }

    public initialize(): void {
        if (this.botToken && this.chatId) {
            try {
                this.bot = new TelegramBot(this.botToken, { polling: false });
                logger.info('Telegram notifications enabled');
            } catch (error) {
                logger.error('Failed to initialize Telegram bot:', error);
            }
        } else {
            logger.info('Telegram notifications disabled - missing configuration');
        }
    }

    public async sendMessage(message: string): Promise<void> {
        if (!this.bot) {
            logger.warn('Cannot send Telegram message - bot not initialized');
            return;
        }

        try {
            await this.bot.sendMessage(this.chatId, message, { parse_mode: 'Markdown' });
        } catch (error) {
            logger.error('Failed to send Telegram message:', error);
        }
    }

    public async sendNotification(options: { markdown: string }): Promise<void> {
        const message = options.markdown;
        await this.sendMessage(message);
    }


    public getBot(): TelegramBot | null {
        return this.bot;
    }

    public getChatId(): string {
        return this.chatId;
    }
}
