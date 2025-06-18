import { App } from './app';
import dotenv from 'dotenv';
import { runCoastDistanceTests } from './test/coast-distance';
import { runProviderTest } from './test/provider';
import { runLoiteringTests } from './test/loitering-detection';
import { testLoiteringEventCreation } from './test/loitering-event-test';
import { EmailNotifier } from './notifications/email-notifier';

dotenv.config();

// Initialize email notifier
const emailNotifier = EmailNotifier.getInstance();
emailNotifier.initialize();
console.log('Email notifications enabled using sendmail');

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
} else if (process.argv.includes('--test-email')) {
    emailNotifier.sendEmail({
        to: 'gcmrzz@gmail.com',
        subject: 'Test email',
        body: 'This is a test email'
    });
    process.exit(0);
} else {
    emailNotifier.sendEmail({
        to: 'gcmrzz@gmail.com',
        subject: 'MedPlane',
        body: 'MedPlane is running!'
    });
    // Normal operation - start the application
    const app = new App();
    app.start();
}
