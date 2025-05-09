import express from 'express';
import { AircraftScanner } from './scanner';
import { MapVisualizer } from './map-visualizer';
import { SERVER_PORT } from './index';

export class WebServer {
    private app: express.Application;
    private scanner: AircraftScanner | null = null;
    private mapVisualizer: MapVisualizer | null = null;

    constructor() {
        this.app = express();
        this.setupRoutes();
    }

    public setScanner(scanner: AircraftScanner) {
        this.scanner = scanner;
    }

    public setMapVisualizer(visualizer: MapVisualizer) {
        this.mapVisualizer = visualizer;
    }

    private setupRoutes() {
        // API endpoint to get all aircraft
        this.app.get('/api/aircraft', (req, res) => {
            if (!this.scanner) {
                res.status(500).json({ error: 'Scanner not initialized' });
                return;
            }
            res.json({
                aircraft: this.scanner.getAircraft(),
                monitoringPoints: this.scanner.getMonitoringPoints()
            });
        });

        // API endpoint to get map data
        this.app.get('/api/map', (req, res) => {
            if (!this.mapVisualizer) {
                res.status(500).json({ error: 'Map visualizer not initialized' });
                return;
            }
            res.json({
                centerPoint: this.scanner?.getConfig().centerPoint,
                scanRadius: this.scanner?.getConfig().scanRadius,
                monitoringPoints: this.scanner?.getMonitoringPoints()
            });
        });

        // Serve static files
        this.app.use(express.static('public'));
    }

    public start(port: number = SERVER_PORT) {
        this.app.listen(port, () => {
            console.log(`Server running at http://localhost:${port}`);
        });
    }
}
