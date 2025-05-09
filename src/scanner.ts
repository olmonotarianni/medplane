import { EventEmitter } from 'events';
import { Aircraft, Position, ScanConfig, MonitoringPoint } from './types';
import { GeoUtils } from './utils';
import { AircraftAnalyzer } from './aircraft-analyzer';
import { ScannerProvider } from './providers/base-provider';
import haversine from 'haversine';

export interface AircraftTrackPoint {
    latitude: number;
    longitude: number;
    timestamp: number;
}

export class AircraftScanner extends EventEmitter {
    private config: ScanConfig;
    private intervalId?: NodeJS.Timeout;
    private aircraft: Map<string, Aircraft & { track?: AircraftTrackPoint[] }> = new Map();
    private monitoringPoints: MonitoringPoint[];
    private analyzer: AircraftAnalyzer;

    constructor(
        config: ScanConfig,
        monitoringPoints: MonitoringPoint[],
        private provider: ScannerProvider
    ) {
        super();
        this.config = config;
        this.monitoringPoints = monitoringPoints;
        this.analyzer = new AircraftAnalyzer();
    }

    getConfig(): ScanConfig {
        return this.config;
    }

    getMonitoringPoints(): MonitoringPoint[] {
        return this.monitoringPoints;
    }

    start(): void {
        if (this.intervalId) {
            console.warn('Scanner is already running');
            return;
        }

        this.scan();
        this.intervalId = setInterval(() => {
            this.scan();
        }, this.config.updateIntervalMs);
    }

    stop(): void {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = undefined;
        }
    }

    private async scan(): Promise<void> {
        try {
            const bounds = GeoUtils.radiusToLatLonBounds(this.config.centerPoint, this.config.scanRadius);
            const result = await this.provider.scan(bounds);

            // DEBUG: log raw response
            console.log('Aircraft found:', result.aircraft.length, result.aircraft.slice(0, 3));

            // Update aircraft data and check for interesting patterns
            result.aircraft.forEach(ac => {
                this.updateAircraft(ac);
            });

            this.emit('scan', result.aircraft);
        } catch (error) {
            console.error('Error scanning aircraft:', error);
            this.emit('error', error);
        }
    }

    public updateAircraft(aircraft: Aircraft): void {
        let tracked = this.aircraft.get(aircraft.icao);
        if (!tracked) {
            tracked = { ...aircraft, track: [] };
        }

        // Add new track point
        const now = aircraft.lastUpdate ? aircraft.lastUpdate * 1000 : Date.now();
        if (!tracked.track) tracked.track = [];
        tracked.track.push({
            latitude: aircraft.position.latitude,
            longitude: aircraft.position.longitude,
            timestamp: now
        });
        // Keep only last 50 points
        if (tracked.track.length > 50) tracked.track = tracked.track.slice(-50);

        // Update only the necessary fields, preserving track and other important data
        tracked.position = aircraft.position;
        tracked.altitude = aircraft.altitude;
        tracked.speed = aircraft.speed;
        tracked.heading = aircraft.heading;
        tracked.verticalRate = aircraft.verticalRate;
        tracked.lastUpdate = aircraft.lastUpdate;
        tracked.callsign = aircraft.callsign;

        // Always run the analyzer to update monitoring status
        this.analyzer.analyzeAircraft(tracked);

        this.aircraft.set(aircraft.icao, tracked);

        // Emit event if aircraft is loitering
        if (tracked.is_loitering) {
            this.emit('loiteringAircraft', tracked);
        }
    }

    public getAircraft(): (Aircraft & { track?: AircraftTrackPoint[] })[] {
        return Array.from(this.aircraft.values());
    }

    public getAircraftInRange(point: MonitoringPoint): Aircraft[] {
        return this.getAircraft().filter(aircraft => {
            const distance = haversine(aircraft.position, point.position, { unit: 'km' });
            return distance <= point.radiusKm;
        });
    }
}
