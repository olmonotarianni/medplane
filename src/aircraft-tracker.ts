import { Aircraft, Position } from './types';
import { GeoUtils } from './utils';

interface TrackedAircraft extends Aircraft {
    headingHistory: Array<{ heading: number; timestamp: number }>;
    lastUpdate: number;
    suspiciousBehavior: boolean;
}

interface MonitoringPoint {
    position: Position;
    radiusKm: number;
    minHeadingChange: number; // Minimum heading change in degrees to trigger alert
    minTimeWindow: number;    // Time window in seconds to consider for heading changes
}

export class AircraftTracker {
    private trackedAircraft: Map<string, TrackedAircraft> = new Map();
    private monitoringPoints: MonitoringPoint[] = [];
    private maxHistorySize: number = 10; // Keep last 10 heading measurements

    constructor(points: MonitoringPoint[]) {
        this.monitoringPoints = points;
    }

    addMonitoringPoint(point: MonitoringPoint): void {
        this.monitoringPoints.push(point);
    }

    updateAircraft(aircraft: Aircraft): void {
        const now = Date.now();
        const existing = this.trackedAircraft.get(aircraft.icao24);

        if (existing) {
            // Update existing aircraft
            existing.headingHistory.push({ heading: aircraft.heading, timestamp: now });
            if (existing.headingHistory.length > this.maxHistorySize) {
                existing.headingHistory.shift();
            }
            existing.lastUpdate = now;
            existing.suspiciousBehavior = this.checkSuspiciousBehavior(existing);

            // Update other properties
            Object.assign(existing, aircraft);
        } else {
            // Add new aircraft
            this.trackedAircraft.set(aircraft.icao24, {
                ...aircraft,
                headingHistory: [{ heading: aircraft.heading, timestamp: now }],
                lastUpdate: now,
                suspiciousBehavior: false
            });
        }
    }

    private checkSuspiciousBehavior(aircraft: TrackedAircraft): boolean {
        // Check if aircraft is within any monitoring point
        const isInMonitoringArea = this.monitoringPoints.some(point => {
            const distance = GeoUtils.calculateDistance(aircraft.position, point.position);
            return distance <= point.radiusKm;
        });

        if (!isInMonitoringArea) return false;

        // Calculate heading changes
        if (aircraft.headingHistory.length < 2) return false;

        const headingChanges = [];
        for (let i = 1; i < aircraft.headingHistory.length; i++) {
            const change = Math.abs(aircraft.headingHistory[i].heading - aircraft.headingHistory[i-1].heading);
            // Handle circular nature of headings (e.g., change from 350° to 10° is 20°, not 340°)
            const normalizedChange = Math.min(change, 360 - change);
            headingChanges.push(normalizedChange);
        }

        // Check if any heading change exceeds threshold
        return headingChanges.some(change =>
            change > this.monitoringPoints[0].minHeadingChange
        );
    }

    getSuspiciousAircraft(): TrackedAircraft[] {
        return Array.from(this.trackedAircraft.values())
            .filter(aircraft => aircraft.suspiciousBehavior);
    }

    cleanupOldAircraft(maxAgeMs: number = 300000): void { // 5 minutes default
        const now = Date.now();
        for (const [icao24, aircraft] of this.trackedAircraft) {
            if (now - aircraft.lastUpdate > maxAgeMs) {
                this.trackedAircraft.delete(icao24);
            }
        }
    }
}
