import { LoiteringEvent } from '../types';

class LoiteringStorage {
    private events: Map<string, LoiteringEvent> = new Map();

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
}

// Singleton instance
let instance: LoiteringStorage | null = null;

export function getLoiteringStorage(): LoiteringStorage {
    if (!instance) {
        instance = new LoiteringStorage();
    }
    return instance;
}
