import { EventEmitter } from 'events';
import { AircraftAnalyzer } from './tracking/aircraft-analyzer';
import { SICILY_CHANNEL_BOUNDS } from './config';
import { ScannerProvider } from './providers/base-provider';
import { Aircraft, ExtendedPosition, LoiteringEvent } from './types';
import { getLoiteringStorage } from './storage/loitering-storage';

export interface AircraftTrackPoint extends ExtendedPosition {
    timestamp: number;
}

export interface TrackedAircraft extends Aircraft {
    track: AircraftTrackPoint[];
}

export class AircraftScanner extends EventEmitter {
    private intervalId?: NodeJS.Timeout;
    private aircraft: Map<string, TrackedAircraft> = new Map();
    private analyzer: AircraftAnalyzer;
    private updateIntervalMs = 10000; // 10 seconds default update interval
    private isScanning = false;
    private loiteringStorage = getLoiteringStorage();

    constructor(private provider: ScannerProvider) {
        super();
        this.analyzer = new AircraftAnalyzer();
    }

    start(): void {
        if (this.intervalId) {
            console.warn('Scanner is already running');
            return;
        }

        // Schedule the first scan
        this.scheduleNextScan();

        // Set up regular scanning interval
        this.intervalId = setInterval(() => {
            this.scheduleNextScan();
        }, this.updateIntervalMs);
    }

    stop(): void {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = undefined;
        }
    }

    private scheduleNextScan(): void {
        if (!this.isScanning) {
            this.isScanning = true;
            this.scan().finally(() => {
                this.isScanning = false;
            });
        } else {
            console.log('Skipping scan - previous scan still in progress');
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

        // Check previous loitering state to detect changes
        const wasLoitering = tracked.is_loitering;

        // Analyze aircraft with the analyzer
        const isLoiteringNow = this.analyzer.analyzeAircraft(tracked);

        // If loitering is detected (new or continued)
        if (isLoiteringNow) {
            this.handleLoiteringDetection(tracked);
            this.emit('loiteringAircraft', tracked);
        }

        this.aircraft.set(aircraft.icao, tracked);
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

        // Create the new track point
        const newPoint = {
            latitude: aircraft.position.latitude,
            longitude: aircraft.position.longitude,
            altitude: aircraft.altitude,
            speed: aircraft.speed,
            heading: aircraft.heading,
            verticalRate: aircraft.verticalRate,
            timestamp: now
        };

        // Check if this point is different from the last point
        const lastPoint = tracked.track[tracked.track.length - 1];
        if (lastPoint) {
            const isDuplicate =
                lastPoint.latitude === newPoint.latitude &&
                lastPoint.longitude === newPoint.longitude &&
                lastPoint.altitude === newPoint.altitude &&
                lastPoint.speed === newPoint.speed &&
                lastPoint.heading === newPoint.heading &&
                lastPoint.verticalRate === newPoint.verticalRate;

            if (isDuplicate) {
                return; // Skip adding duplicate point
            }
        }

        // Add the new point
        tracked.track.push(newPoint);

        // Keep only last 50 points
        if (tracked.track.length > 50) {
            tracked.track = tracked.track.slice(-50);
        }
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

    private handleLoiteringDetection(aircraft: TrackedAircraft): void {
        // Check if we already have an event for this aircraft
        let event = this.loiteringStorage.getEventByIcao(aircraft.icao);
        const now = Date.now();

        if (event) {
            // Update existing event
            event.lastUpdated = now;
            event.detectionCount += 1;

            // Update aircraft state
            event.aircraftState = {
                altitude: aircraft.altitude,
                speed: aircraft.speed,
                heading: aircraft.heading,
                verticalRate: aircraft.verticalRate,
                position: { ...aircraft.position }
            };

            // Update track with the latest data
            event.track = [...aircraft.track];
        } else {
            // Create new event
            event = {
                id: aircraft.icao, // Use ICAO as the ID
                icao: aircraft.icao,
                callsign: aircraft.callsign,
                firstDetected: now,
                lastUpdated: now,
                detectionCount: 1,
                intersectionPoints: [], // We don't need intersection points for basic loitering detection
                aircraftState: {
                    altitude: aircraft.altitude,
                    speed: aircraft.speed,
                    heading: aircraft.heading,
                    verticalRate: aircraft.verticalRate,
                    position: { ...aircraft.position }
                },
                track: [...aircraft.track]
            };
        }

        // Store the event in memory
        this.loiteringStorage.saveEvent(event);
        console.log(`Loitering event ${event.id ? 'updated' : 'created'} for aircraft ${aircraft.icao}`);
    }

    public getLoiteringEvents(): LoiteringEvent[] {
        return this.loiteringStorage.listEvents();
    }

    public getLoiteringEvent(icao: string): LoiteringEvent | undefined {
        return this.loiteringStorage.getEventByIcao(icao);
    }
}
