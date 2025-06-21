import { EventEmitter } from 'events';
import { AircraftAnalyzer } from './aircraft-analyzer';
import { SICILY_CHANNEL_BOUNDS } from './config';
import { ScannerProvider } from './providers/base-provider';
import { Aircraft, ExtendedPosition, LoiteringEvent } from './types';
import { getLoiteringStorage } from './storage/loitering-storage';
import { TelegramNotifier } from './notifications/telegram-notifier';
import * as fs from 'fs';
import * as path from 'path';
import { logger } from './logger';

const STORAGE_DIR = path.join(process.cwd(), 'storage');
const AIRCRAFT_FILE = path.join(STORAGE_DIR, 'aircraft-states.json');

function ensureStorageDir() {
    if (!fs.existsSync(STORAGE_DIR)) {
        fs.mkdirSync(STORAGE_DIR, { recursive: true });
    }
}

function atomicWriteFileSync(filePath: string, data: string) {
    const tmpPath = filePath + '.tmp';
    fs.writeFileSync(tmpPath, data);
    fs.renameSync(tmpPath, filePath);
}

export class AircraftScanner extends EventEmitter {
    private aircraft: Map<string, Aircraft> = new Map();
    private analyzer: AircraftAnalyzer;
    private updateIntervalMs = 10000; // 10 seconds default update interval
    private loiteringStorage = getLoiteringStorage();
    private readonly INACTIVITY_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes of inactivity
    private running = false;
    private telegramNotifier: TelegramNotifier;

    constructor(private provider: ScannerProvider) {
        super();
        this.analyzer = new AircraftAnalyzer();
        this.telegramNotifier = TelegramNotifier.getInstance();
        ensureStorageDir();
        this.loadAircraftFromDisk();
    }

    private saveAircraftToDisk() {
        try {
            ensureStorageDir();
            const arr = Array.from(this.aircraft.values());
            atomicWriteFileSync(AIRCRAFT_FILE, JSON.stringify(arr, null, 2));
        } catch (err) {
            logger.error('Failed to save aircraft states to disk:', err);
        }
    }

    private loadAircraftFromDisk() {
        try {
            if (fs.existsSync(AIRCRAFT_FILE)) {
                const data = fs.readFileSync(AIRCRAFT_FILE, 'utf-8');
                const arr: Aircraft[] = JSON.parse(data);
                this.aircraft = new Map(arr.map(ac => [ac.icao, ac]));
                logger.info(`Loaded ${arr.length} aircraft states from disk.`);
            }
        } catch (err) {
            logger.error('Failed to load aircraft states from disk:', err);
        }
    }

    async start(): Promise<void> {
        if (this.running) {
            logger.warn('Scanner is already running');
            return;
        }
        this.running = true;
        logger.info(`Scanner started with ${this.loiteringStorage.getEventCount()} existing loitering events`);
        while (this.running) {
            try {
                await this.scan();
                this.cleanupInactiveAircraft();
            } catch (error) {
                logger.error('Error in scanner:', error);
            } finally {
                await new Promise(resolve => setTimeout(resolve, this.updateIntervalMs));
            }
        }
    }

    stop(): void {
        this.running = false;
    }

    private cleanupInactiveAircraft(): void {
        const now = Date.now();
        const inactiveThreshold = now - this.INACTIVITY_THRESHOLD_MS;
        let removed = false;
        for (const [icao, aircraft] of this.aircraft.entries()) {
            const latest = aircraft.track[0]?.timestamp ? aircraft.track[0].timestamp * 1000 : 0;
            if (latest < inactiveThreshold) {
                this.aircraft.delete(icao);
                removed = true;
                // Note: Loitering events are preserved for 7 days regardless of aircraft activity
            }
        }
        if (removed) this.saveAircraftToDisk();
    }

    private async scan(): Promise<void> {
        try {
            const result = await this.provider.scan(SICILY_CHANNEL_BOUNDS);

            // Update aircraft data and check for interesting patterns
            result.aircraft.forEach(scanAc => {
                // Convert ScanAircraft to Aircraft (single-point track, default fields)
                const aircraft: Aircraft = {
                    icao: scanAc.icao,
                    callsign: scanAc.callsign,
                    is_monitored: false,
                    is_loitering: false,
                    not_monitored_reason: null,
                    track: [{
                        latitude: scanAc.latitude,
                        longitude: scanAc.longitude,
                        timestamp: scanAc.timestamp,
                        altitude: scanAc.altitude,
                        speed: scanAc.speed,
                        heading: scanAc.heading,
                        verticalRate: scanAc.verticalRate
                    }]
                };
                this.updateAircraft(aircraft);
            });

            this.emit('scan', result.aircraft);
        } catch (error) {
            logger.error('Error scanning aircraft:', error);
            this.emit('error', error);
        }
    }

    public updateAircraft(aircraft: Aircraft): void {
        let tracked = this.aircraft.get(aircraft.icao);
        if (!tracked) {
            // New aircraft, add to map
            this.aircraft.set(aircraft.icao, aircraft);
            this.saveAircraftToDisk();
            tracked = aircraft;
        } else {
            // Existing: update track (prepend new point if different)
            const latest = aircraft.track[0];
            const prev = tracked.track[0];
            if (!prev || !latest ||
                prev.latitude !== latest.latitude ||
                prev.longitude !== latest.longitude ||
                prev.altitude !== latest.altitude ||
                prev.speed !== latest.speed ||
                prev.heading !== latest.heading ||
                prev.verticalRate !== latest.verticalRate) {
                tracked.track.unshift(latest);
                if (tracked.track.length > 50) tracked.track.length = 50;
                this.saveAircraftToDisk();
            }
            tracked.callsign = aircraft.callsign;
        }

        // Analyze aircraft with the analyzer
        const analysis = this.analyzer.analyzeAircraft(tracked);
        tracked.is_monitored = analysis.is_monitored;
        tracked.not_monitored_reason = analysis.not_monitored_reason;
        tracked.is_loitering = analysis.is_loitering;

        // If loitering is detected (new or continued)
        if (tracked.is_loitering) {
            this.handleLoiteringDetection(tracked);
            this.emit('loiteringAircraft', tracked);
        }
    }

    public getAircraft(): Aircraft[] {
        return Array.from(this.aircraft.values());
    }

    private async handleLoiteringDetection(aircraft: Aircraft): Promise<void> {
        // Check if we already have an event for this aircraft
        let event = this.loiteringStorage.getEventByIcao(aircraft.icao);
        const now = Date.now();
        const isNewEvent = !event;

        if (event) {
            // Update existing event
            event.lastUpdated = now;
            event.detectionCount += 1;

            // Update aircraft state with latest position
            const latestPosition = aircraft.track[0];
            if (latestPosition) {
                event.aircraftState = {
                    altitude: latestPosition.altitude,
                    speed: latestPosition.speed,
                    heading: latestPosition.heading,
                    verticalRate: latestPosition.verticalRate,
                    position: {
                        latitude: latestPosition.latitude,
                        longitude: latestPosition.longitude
                    }
                };
            }

            // Update track with the latest data
            event.track = [...aircraft.track];
        } else {
            // Create new event
            const latestPosition = aircraft.track[0];
            if (!latestPosition) return;

            event = {
                id: aircraft.icao, // Use ICAO as the ID
                icao: aircraft.icao,
                callsign: aircraft.callsign,
                firstDetected: now,
                lastUpdated: now,
                detectionCount: 1,
                intersectionPoints: [], // We don't need intersection points for basic loitering detection
                aircraftState: {
                    altitude: latestPosition.altitude,
                    speed: latestPosition.speed,
                    heading: latestPosition.heading,
                    verticalRate: latestPosition.verticalRate,
                    position: {
                        latitude: latestPosition.latitude,
                        longitude: latestPosition.longitude
                    }
                },
                track: [...aircraft.track]
            };
        }

        // Store the event in memory
        this.loiteringStorage.saveEvent(event);

        // Send Telegram notification for new events
        if (isNewEvent) {
            logger.info(`🚨 New loitering event detected: ${aircraft.icao}`);
            try {
                await this.telegramNotifier.sendNotification({
                    markdown: `🚨 **Loitering aircraft detected: ${aircraft.icao}**\n\nPlease click (here)[https://medplane.gufoe.it/loitering/${event.id}] to see the event details`
                });
            } catch (error) {
                logger.error('Failed to send Telegram notification:', error);
            }
        }
    }

    public getLoiteringEvents(): LoiteringEvent[] {
        return this.loiteringStorage.listEvents();
    }

    public getLoiteringEvent(icao: string): LoiteringEvent | undefined {
        return this.loiteringStorage.getEventByIcao(icao);
    }
}
