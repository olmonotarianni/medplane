import TelegramBot from 'node-telegram-bot-api';

export class TelegramUpdateListener {
    private bot: TelegramBot | null = null;
    private botToken: string;
    private isListening: boolean = false;

    constructor() {
        this.botToken = process.env.TELEGRAM_BOT_TOKEN || '';

        if (!this.botToken) {
            console.warn('Telegram bot token missing. Set TELEGRAM_BOT_TOKEN environment variable.');
        }
    }

    public async startListening(): Promise<void> {
        if (!this.botToken) {
            console.error('Cannot start listening - missing bot token');
            return;
        }

        if (this.isListening) {
            console.warn('Already listening for updates');
            return;
        }

        try {
            this.bot = new TelegramBot(this.botToken, { polling: true });
            this.isListening = true;

            console.log('Started listening for Telegram updates...');
            console.log('Send any message to your bot to see the updates');

            // Handle incoming messages
            this.bot.on('message', (msg) => {
                console.log('\n=== INCOMING MESSAGE ===');
                console.log('Message ID:', msg.message_id);
                console.log('From:', msg.from?.first_name, msg.from?.last_name, `(@${msg.from?.username})`);
                console.log('Chat ID:', msg.chat.id);
                console.log('Chat Type:', msg.chat.type);
                console.log('Text:', msg.text);
                console.log('Date:', new Date(msg.date * 1000).toISOString());
                console.log('========================\n');
            });

            // Handle other types of updates
            this.bot.on('callback_query', (callbackQuery) => {
                console.log('\n=== CALLBACK QUERY ===');
                console.log('ID:', callbackQuery.id);
                console.log('From:', callbackQuery.from?.first_name, callbackQuery.from?.last_name);
                console.log('Data:', callbackQuery.data);
                console.log('Message:', callbackQuery.message?.text);
                console.log('=====================\n');
            });

            this.bot.on('inline_query', (inlineQuery) => {
                console.log('\n=== INLINE QUERY ===');
                console.log('ID:', inlineQuery.id);
                console.log('From:', inlineQuery.from?.first_name, inlineQuery.from?.last_name);
                console.log('Query:', inlineQuery.query);
                console.log('===================\n');
            });

            this.bot.on('polling_error', (error) => {
                if (error instanceof Error) {
                    console.error('Polling error:', error.message);
                } else {
                    console.error('Polling error:', error);
                }
            });

            console.log('✅ Telegram update listener is active!');
            console.log('📱 Send messages to your bot to see them here');
            console.log('⏹️  Press Ctrl+C to stop listening');

        } catch (error) {
            console.error('Failed to start Telegram update listener:', error);
            this.isListening = false;
        }
    }

    public async stopListening(): Promise<void> {
        if (this.bot && this.isListening) {
            await this.bot.stopPolling();
            this.isListening = false;
            console.log('Stopped listening for Telegram updates');
        }
    }

    public isActive(): boolean {
        return this.isListening;
    }

    public async getBotInfo(): Promise<void> {
        if (!this.bot) {
            console.error('Bot not initialized');
            return;
        }

        try {
            const me = await this.bot.getMe();
            console.log('\n=== BOT INFO ===');
            console.log('ID:', me.id);
            console.log('Name:', me.first_name);
            console.log('Username:', me.username);
            console.log('===============\n');
        } catch (error) {
            console.error('Failed to get bot info:', error);
        }
    }

    public async getChatInfo(chatId: string): Promise<void> {
        if (!this.bot) {
            console.error('Bot not initialized');
            return;
        }

        try {
            const chat = await this.bot.getChat(chatId);
            console.log('\n=== CHAT INFO ===');
            console.log('ID:', chat.id);
            console.log('Type:', chat.type);
            console.log('Title:', chat.title);
            console.log('Username:', chat.username);
            console.log('First Name:', chat.first_name);
            console.log('Last Name:', chat.last_name);
            console.log('================\n');
        } catch (error) {
            console.error('Failed to get chat info:', error);
        }
    }
}
