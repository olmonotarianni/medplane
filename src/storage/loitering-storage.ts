import { LoiteringEvent } from '../types';

class LoiteringStorage {
    private events: Map<string, LoiteringEvent> = new Map();
    private readonly EVENT_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
    private cleanupIntervalId?: NodeJS.Timeout;

    constructor() {
        // Set up periodic cleanup
        this.cleanupIntervalId = setInterval(() => {
            this.cleanupOldEvents();
        }, 60 * 60 * 1000); // Run cleanup every hour
    }

    public saveEvent(event: LoiteringEvent): void {
        this.events.set(event.id, event);
    }

    public getEvent(id: string): LoiteringEvent | undefined {
        return this.events.get(id);
    }

    public getEventByIcao(icao: string): LoiteringEvent | undefined {
        return Array.from(this.events.values()).find(event => event.icao === icao);
    }

    public listEvents(): LoiteringEvent[] {
        return Array.from(this.events.values());
    }

    public deleteEvent(id: string): void {
        this.events.delete(id);
    }

    public clear(): void {
        this.events.clear();
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
            console.log(`Cleaned up ${cleanedCount} expired loitering events`);
        }
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
