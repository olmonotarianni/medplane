import express from 'express';
import path from 'path';
import { MONITORING_THRESHOLDS, SICILY_CHANNEL_BOUNDS } from './config';
import { AircraftScanner } from './scanner';

export class WebServer {
    private app: express.Application;
    private scanner: AircraftScanner | null = null;

    constructor() {
        this.app = express();
        this.setupRoutes();
    }

    public setScanner(scanner: AircraftScanner) {
        this.scanner = scanner;
    }

    private setupRoutes() {
        // Serve the main page
        this.app.get('/', (_, res) => {
            res.sendFile(path.join(process.cwd(), 'public', 'index.html'));
        });

        // API endpoint for aircraft data
        this.app.get('/api/aircraft', (_, res) => {
            if (!this.scanner) {
                res.status(500).json({ error: 'Scanner not initialized' });
                return;
            }
            res.json({
                aircraft: this.scanner.getAircraft(),
                monitoringArea: SICILY_CHANNEL_BOUNDS,
                thresholds: MONITORING_THRESHOLDS
            });
        });

        // API endpoint for map configuration
        this.app.get('/api/map', (_, res) => {
            res.json({
                monitoringArea: SICILY_CHANNEL_BOUNDS,
                thresholds: MONITORING_THRESHOLDS
            });
        });

        // Serve static files
        this.app.use(express.static('public'));
    }

    public start(port: number) {
        this.app.listen(port, () => {
            console.log(`Server running at http://localhost:${port}`);
        });
    }
}
