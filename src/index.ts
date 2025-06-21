import { App } from './app';
import dotenv from 'dotenv';
import { runCoastDistanceTests } from './test/coast-distance';
import { runProviderTest } from './test/provider';
import { runLoiteringTests } from './test/loitering-detection';
import { testLoiteringEventCreation } from './test/loitering-event-test';
import { TelegramNotifier } from './notifications/telegram-notifier';
import { TelegramUpdateListener } from './notifications/telegram-update-listener';

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
            console.error('Test failed:', error);
            process.exit(1);
        });
} else if (process.argv.includes('--test-loitering')) {
    runLoiteringTests();
    process.exit(0);
} else if (process.argv.includes('--test-loitering-events')) {
    testLoiteringEventCreation();
    process.exit(0);
} else if (process.argv.includes('--test-telegram')) {
    telegramNotifier.sendNotification({
        markdown: 'Bro, it\'s working! I\'m alive! 🙌'
    }).finally(() => {
        process.exit(0);
    });
} else if (process.argv.includes('--test-telegram-updates')) {
    const listener = new TelegramUpdateListener();

    // Handle graceful shutdown
    process.on('SIGINT', async () => {
        console.log('\n🛑 Shutting down...');
        await listener.stopListening();
        process.exit(0);
    });

    // Start listening for updates
    listener.startListening().catch((error) => {
        console.error('Failed to start update listener:', error);
        process.exit(1);
    });
} else if (process.argv.includes('--test-telegram-bot-info')) {
    const listener = new TelegramUpdateListener();
    listener.startListening().then(async () => {
        await listener.getBotInfo();
        await listener.stopListening();
        process.exit(0);
    }).catch((error) => {
        console.error('Failed to get bot info:', error);
        process.exit(1);
    });
} else if (process.argv.includes('--test-loitering-events-list')) {
    const { getLoiteringStorage } = require('./storage/loitering-storage');
    const storage = getLoiteringStorage();
    const events = storage.listEvents();

    console.log(`\n=== LOITERING EVENTS (${events.length} total) ===`);
    if (events.length === 0) {
        console.log('No loitering events found.');
    } else {
        events.forEach((event: any, index: number) => {
            const age = Date.now() - event.lastUpdated;
            const ageDays = Math.round(age / (24 * 60 * 60 * 1000));
            const ageHours = Math.round(age / (60 * 60 * 1000));
            console.log(`${index + 1}. ${event.icao} (${event.callsign || 'N/A'})`);
            console.log(`   ID: ${event.id}`);
            console.log(`   Age: ${ageDays} days, ${ageHours} hours`);
            console.log(`   First detected: ${new Date(event.firstDetected).toISOString()}`);
            console.log(`   Last updated: ${new Date(event.lastUpdated).toISOString()}`);
            console.log(`   Detection count: ${event.detectionCount}`);
            console.log(`   URL: https://medplane.gufoe.it/loitering/${event.id}`);
            console.log('');
        });
    }
    console.log('=====================================\n');
    process.exit(0);
} else {
    telegramNotifier.sendNotification({
        markdown: 'Ok, we\'re up and running! 🚀'
    });
    // Normal operation - start the application
    const app = new App();
    app.start();
}
