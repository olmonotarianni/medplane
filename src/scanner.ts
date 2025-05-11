import { EventEmitter } from 'events';
import { AircraftAnalyzer } from './aircraft-analyzer';
import { SICILY_CHANNEL_BOUNDS } from './config';
import { ScannerProvider } from './providers/base-provider';
import { Aircraft } from './types';

export interface AircraftTrackPoint {
    latitude: number;
    longitude: number;
    timestamp: number;
}

export interface TrackedAircraft extends Aircraft {
    track: AircraftTrackPoint[];
}

export class AircraftScanner extends EventEmitter {
    private intervalId?: NodeJS.Timeout;
    private aircraft: Map<string, TrackedAircraft> = new Map();
    private analyzer: AircraftAnalyzer;
    private updateIntervalMs = 15000; // 15 seconds default update interval

    constructor(private provider: ScannerProvider) {
        super();
        this.analyzer = new AircraftAnalyzer();
    }

    start(): void {
        if (this.intervalId) {
            console.warn('Scanner is already running');
            return;
        }
        this.scan();
        this.intervalId = setInterval(() => {
            this.scan();
        }, this.updateIntervalMs);
    }

    stop(): void {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = undefined;
        }
    }

    private async scan(): Promise<void> {
        try {
            const result = await this.provider.scan(SICILY_CHANNEL_BOUNDS);

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
            tracked = this.createTrackedAircraft(aircraft);
        }
        this.addTrackPoint(tracked, aircraft);
        this.updateTrackedFields(tracked, aircraft);
        this.analyzer.analyzeAircraft(tracked);
        this.aircraft.set(aircraft.icao, tracked);
        if (tracked.is_loitering) {
            this.emit('loiteringAircraft', tracked);
        }
    }

    private createTrackedAircraft(aircraft: Aircraft): TrackedAircraft {
        return {
            ...aircraft,
            track: [],
            is_loitering: false,
            is_monitored: false,
            not_monitored_reason: null
        };
    }

    private addTrackPoint(tracked: TrackedAircraft, aircraft: Aircraft): void {
        const now = aircraft.lastUpdate ? aircraft.lastUpdate * 1000 : Date.now();
        tracked.track.push({
            latitude: aircraft.position.latitude,
            longitude: aircraft.position.longitude,
            timestamp: now
        });
        // Keep only last 50 points
        if (tracked.track.length > 50) tracked.track = tracked.track.slice(-50);
    }

    private updateTrackedFields(tracked: TrackedAircraft, aircraft: Aircraft): void {
        tracked.position = aircraft.position;
        tracked.altitude = aircraft.altitude;
        tracked.speed = aircraft.speed;
        tracked.heading = aircraft.heading;
        tracked.verticalRate = aircraft.verticalRate;
        tracked.lastUpdate = aircraft.lastUpdate;
        tracked.callsign = aircraft.callsign;
    }

    public getAircraft(): TrackedAircraft[] {
        return Array.from(this.aircraft.values());
    }

    public getAircraftInBounds(): TrackedAircraft[] {
        return this.getAircraft().filter(aircraft => {
            const { latitude, longitude } = aircraft.position;
            return (
                latitude >= SICILY_CHANNEL_BOUNDS.minLat &&
                latitude <= SICILY_CHANNEL_BOUNDS.maxLat &&
                longitude >= SICILY_CHANNEL_BOUNDS.minLon &&
                longitude <= SICILY_CHANNEL_BOUNDS.maxLon
            );
        });
    }
}
