import TelegramBot from 'node-telegram-bot-api';

export class TelegramNotifier {
    private static instance: TelegramNotifier;
    private bot: TelegramBot | null = null;
    private botToken: string;
    private chatId: string;

    private constructor() {
        this.botToken = process.env.TELEGRAM_BOT_TOKEN || '';
        this.chatId = process.env.TELEGRAM_CHAT_ID || '';

        if (!this.botToken) {
            console.warn('Telegram configuration missing. Set TELEGRAM_BOT_TOKEN environment variable.');
        }
        if (!this.chatId) {
            console.warn('Telegram configuration missing. Set TELEGRAM_CHAT_ID environment variable.');
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
                console.log('Telegram notifications enabled');
            } catch (error) {
                console.error('Failed to initialize Telegram bot:', error);
            }
        } else {
            console.log('Telegram notifications disabled - missing configuration');
        }
    }

    public async sendMessage(message: string): Promise<void> {
        if (!this.bot) {
            console.warn('Cannot send Telegram message - bot not initialized');
            return;
        }

        try {
            console.log('Sending Telegram message:', message);
            await this.bot.sendMessage(this.chatId, message, { parse_mode: 'Markdown' });
            console.log('Telegram message sent successfully');
        } catch (error) {
            if (error instanceof Error) {
                console.error('Failed to send Telegram message:', error.message);
            } else {
                console.error('Failed to send Telegram message:', error);
            }
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
