import { App } from './app';
import dotenv from 'dotenv';
import { runCoastDistanceTests } from './test/coast-distance';
import { runProviderTest } from './test/provider';
import { runLoiteringTests } from './test/loitering-detection';
import { testLoiteringEventCreation } from './test/loitering-event-test';
import { TelegramNotifier } from './notifications/telegram-notifier';
import { TelegramUpdateListener } from './notifications/telegram-update-listener';
import { logger } from './logger';

(async () => {
    dotenv.config();

    // Initialize Telegram notifier
    const telegramNotifier = TelegramNotifier.getInstance();
    telegramNotifier.initialize();

    // Check command line arguments for test modes
    if (process.argv.includes('--test-coast-distance')) {
        runCoastDistanceTests();
        process.exit(0);
    } else if (process.argv.includes('--test-airdata-provider')) {
        // Handle the async test properly
        runProviderTest()
            .then(() => process.exit(0))
            .catch((error) => {
                logger.error('Test failed:', error);
                process.exit(1);
            });
    } else if (process.argv.includes('--test-loitering')) {
        runLoiteringTests();
        process.exit(0);
    } else if (process.argv.includes('--test-loitering-events')) {
        testLoiteringEventCreation();
        process.exit(0);
    } else if (process.argv.includes('--test-telegram')) {
        await telegramNotifier.sendNotification({
            markdown: 'This is a test notification from MedPlane'
        });
        process.exit(0);
    } else if (process.argv.includes('--test-telegram-updates')) {
        const listener = new TelegramUpdateListener();
        // Handle graceful shutdown
        process.on('SIGINT', async () => {
            logger.info('\n🛑 Shutting down...');
            await listener.stopListening();
            process.exit(0);
        });
        // Start listening for updates
        await listener.startListening().catch((error) => {
            logger.error('Failed to start update listener:', error);
            process.exit(1);
        });
    } else if (process.argv.includes('--test-telegram-bot-info')) {
        const listener = new TelegramUpdateListener();
        await listener.startListening();
        await listener.getBotInfo();
        await listener.stopListening();
        process.exit(0);
    } else if (process.argv.includes('--test-loitering-events-list')) {
        const { getLoiteringStorage } = require('./storage/loitering-storage');
        const storage = getLoiteringStorage();
        const events = storage.listEvents();

        logger.info(`\n=== LOITERING EVENTS (${events.length} total) ===`);
        if (events.length === 0) {
            logger.info('No loitering events found.');
        } else {
            events.forEach((event: any, index: number) => {
                const age = Date.now() - event.lastUpdated;
                const ageDays = Math.round(age / (24 * 60 * 60 * 1000));
                const ageHours = Math.round(age / (60 * 60 * 1000));
                logger.info(`${index + 1}. ${event.icao} (${event.callsign || 'N/A'})`);
                logger.info(`   ID: ${event.id}`);
                logger.info(`   Age: ${ageDays} days, ${ageHours} hours`);
                logger.info(`   First detected: ${new Date(event.firstDetected).toISOString()}`);
                logger.info(`   Last updated: ${new Date(event.lastUpdated).toISOString()}`);
                logger.info(`   Detection count: ${event.detectionCount}`);
                logger.info(`   URL: https://medplane.gufoe.it/loitering/${event.id}`);
                logger.info('');
            });
        }
        logger.info('=====================================\n');
        process.exit(0);
    } else {
        await telegramNotifier.sendNotification({
            markdown: 'MedPlane updated to new version! 🚀'
        });
        // Normal operation - start the application
        const app = new App();
        app.start();
    }
})();
