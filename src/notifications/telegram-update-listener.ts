import TelegramBot from 'node-telegram-bot-api';
import { logger } from '../logger';

export class TelegramUpdateListener {
    private bot: TelegramBot | null = null;
    private botToken: string;
    private isListening: boolean = false;

    constructor() {
        this.botToken = process.env.TELEGRAM_BOT_TOKEN || '';

        if (!this.botToken) {
            logger.warn('Telegram bot token missing. Set TELEGRAM_BOT_TOKEN environment variable.');
        }
    }

    public async startListening(): Promise<void> {
        if (!this.botToken) {
            logger.error('Cannot start listening - missing bot token');
            return;
        }

        if (this.isListening) {
            logger.warn('Already listening for updates');
            return;
        }

        try {
            this.bot = new TelegramBot(this.botToken, { polling: true });
            this.isListening = true;

            logger.info('Started listening for Telegram updates...');

            // Handle incoming messages
            this.bot.on('message', (msg) => {
                logger.info(`📨 Message from ${msg.from?.first_name} ${msg.from?.last_name} (@${msg.from?.username}): ${msg.text}`);
            });

            // Handle other types of updates
            this.bot.on('callback_query', (callbackQuery) => {
                logger.info(`🔘 Callback query from ${callbackQuery.from?.first_name}: ${callbackQuery.data}`);
            });

            this.bot.on('inline_query', (inlineQuery) => {
                logger.info(`🔍 Inline query from ${inlineQuery.from?.first_name}: ${inlineQuery.query}`);
            });

            this.bot.on('polling_error', (error) => {
                logger.error('Polling error:', error);
            });

            logger.info('✅ Telegram update listener is active!');
            logger.info('📱 Send messages to your bot to see them here');
            logger.info('⏹️  Press Ctrl+C to stop listening');

        } catch (error) {
            logger.error('Failed to start Telegram update listener:', error);
            this.isListening = false;
        }
    }

    public async stopListening(): Promise<void> {
        if (this.bot && this.isListening) {
            await this.bot.stopPolling();
            this.isListening = false;
            logger.info('Stopped listening for Telegram updates');
        }
    }

    public isActive(): boolean {
        return this.isListening;
    }

    public async getBotInfo(): Promise<void> {
        if (!this.bot) {
            logger.error('Bot not initialized');
            return;
        }

        try {
            const me = await this.bot.getMe();
            logger.info('\n=== BOT INFO ===');
            logger.info('ID:', me.id);
            logger.info('Name:', me.first_name);
            logger.info('Username:', me.username);
            logger.info('===============\n');
        } catch (error) {
            logger.error('Failed to get bot info:', error);
        }
    }

    public async getChatInfo(chatId: string): Promise<void> {
        if (!this.bot) {
            logger.error('Bot not initialized');
            return;
        }

        try {
            const chat = await this.bot.getChat(chatId);
            logger.info('\n=== CHAT INFO ===');
            logger.info('ID:', chat.id);
            logger.info('Type:', chat.type);
            logger.info('Title:', chat.title);
            logger.info('Username:', chat.username);
            logger.info('First Name:', chat.first_name);
            logger.info('Last Name:', chat.last_name);
            logger.info('================\n');
        } catch (error) {
            logger.error('Failed to get chat info:', error);
        }
    }
}
