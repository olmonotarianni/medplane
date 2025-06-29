import { LoiteringEvent } from '../types';
import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../logger';

const STORAGE_DIR = path.join(process.cwd(), 'storage');
const EVENTS_FILE = path.join(STORAGE_DIR, 'loitering-events.json');

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

class LoiteringStorage {
    private events: Map<string, LoiteringEvent> = new Map();
    private readonly EVENT_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
    private cleanupIntervalId?: NodeJS.Timeout;

    constructor() {
        ensureStorageDir();
        this.loadFromDisk();
        // Set up periodic cleanup
        this.cleanupIntervalId = setInterval(() => {
            this.cleanupOldEvents();
        }, 60 * 60 * 1000); // Run cleanup every hour
    }

    private saveToDisk() {
        try {
            ensureStorageDir();
            const arr = Array.from(this.events.values());
            atomicWriteFileSync(EVENTS_FILE, JSON.stringify(arr, null, 2));
        } catch (err) {
            logger.error({ err }, 'Failed to save loitering events to disk');
        }
    }

    private loadFromDisk() {
        try {
            if (fs.existsSync(EVENTS_FILE)) {
                const data = fs.readFileSync(EVENTS_FILE, 'utf-8');
                const arr: LoiteringEvent[] = JSON.parse(data);
                this.events = new Map(arr.map(ev => [ev.id, ev]));
                logger.info(`Loaded ${arr.length} loitering events from disk.`);
            }
        } catch (err) {
            logger.error({ err }, 'Failed to load loitering events from disk');
        }
    }

    public saveEvent(event: LoiteringEvent): void {
        this.events.set(event.id, event);
        this.saveToDisk();
    }

    public getEvent(id: string): LoiteringEvent | undefined {
        return this.events.get(id);
    }

    private getEventsByIcao(icao: string): LoiteringEvent[] {
        return Array.from(this.events.values()).filter(event => event.icao === icao);
    }

    public getLatestEventByIcao(icao: string): LoiteringEvent | undefined {
        const events = this.getEventsByIcao(icao);
        return events.sort((a, b) => b.lastUpdated - a.lastUpdated)[0];
    }

    public listEvents(): LoiteringEvent[] {
        return Array.from(this.events.values());
    }

    public deleteEvent(id: string): void {
        this.events.delete(id);
        this.saveToDisk();
    }

    public clear(): void {
        this.events.clear();
        this.saveToDisk();
    }

    private cleanupOldEvents(): void {
        const now = Date.now();
        const expiryThreshold = now - this.EVENT_EXPIRY_MS;
        let cleanedCount = 0;

        for (const [id, event] of this.events.entries()) {
            if (event.lastUpdated < expiryThreshold) {
                this.events.delete(id);
                cleanedCount++;
            }
        }

        if (cleanedCount > 0) {
            logger.info(`Cleaned up ${cleanedCount} expired loitering events`);
            this.saveToDisk();
        }
    }

    public getEventCount(): number {
        return this.events.size;
    }

    public getEventAge(eventId: string): number | null {
        const event = this.events.get(eventId);
        if (!event) return null;
        return Date.now() - event.lastUpdated;
    }

    public destroy(): void {
        if (this.cleanupIntervalId) {
            clearInterval(this.cleanupIntervalId);
            this.cleanupIntervalId = undefined;
        }
    }
}

// Singleton instance
let instance: LoiteringStorage | null = null;

export function getLoiteringStorage(): LoiteringStorage {
    if (!instance) {
        instance = new LoiteringStorage();
    }
    return instance;
}
