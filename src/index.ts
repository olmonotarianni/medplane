import { App } from './app';
import { runCoastDistanceTests } from './test/coast-distance';
import { runProviderTest } from './test/provider';

// Check command line arguments for test modes
if (process.argv.includes('--test-coast-distance')) {
    runCoastDistanceTests();
    process.exit(0);
} else if (process.argv.includes('--test-airdata-provider')) {
    runProviderTest();
    process.exit(0);
} else {
    // Normal operation - start the application
    const app = new App();
    app.start();
}
