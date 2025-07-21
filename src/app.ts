import { SERVER_PORT } from './constants';
import { AdsbFiProvider } from './providers/adsbfi-provider';
import { AircraftScanner } from './scanner';
import { WebServer } from './server';
import { logger } from './logger';

export class App {
    private readonly scanner: AircraftScanner;
    private readonly server: WebServer;

    constructor() {
        const provider = new AdsbFiProvider();
        this.scanner = new AircraftScanner(provider);
        this.server = new WebServer();

        // Set up server components
        this.server.setScanner(this.scanner);
    }

    public start(): void {
        logger.info('Starting AircraftScanner...');
        this.scanner.start();
        logger.info('AircraftScanner started.');

        // Start the server
        this.server.start(SERVER_PORT);
    }
}
