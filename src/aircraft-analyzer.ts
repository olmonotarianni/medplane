import { MONITORING_THRESHOLDS, SICILY_CHANNEL_BOUNDS } from './config';
import { Aircraft, Position } from './types';
import { GeoUtils } from './utils';

interface AircraftTrajectory {
    positions: Position[];
    timestamps: number[];
    lastUpdate: number;
    outOfRangeSince?: number;
}

export class AircraftAnalyzer {
    // Altitude and speed ranges
    private static readonly ALTITUDE_RANGE = { min: 5000, max: 25000 }; // feet
    private static readonly SPEED_RANGE = { min: 100, max: 300 }; // knots
    // Loitering and cleanup thresholds
    private static readonly LOITERING_THRESHOLD_MS = MONITORING_THRESHOLDS.loitering.minDuration * 1000;
    private static readonly MAX_RADIUS_KM = MONITORING_THRESHOLDS.loitering.maxRadius;
    private static readonly MAX_OUTOFRANGE_MS = 30 * 1000; // 30 sec
    private static readonly CLEANUP_THRESHOLD_MS = 15 * 60 * 1000; // 15 min
    private static readonly MAX_TRACE_AGE_MS = 20 * 60 * 1000; // 20 min
    // Minimum distance from coast (km) to be considered over the sea
    private static readonly MIN_DISTANCE_FROM_COAST_KM = MONITORING_THRESHOLDS.coast.minDistance;

    private trajectories: Map<string, AircraftTrajectory> = new Map();

    private isInSicilyChannel(position: Position): boolean {
        return position.latitude >= SICILY_CHANNEL_BOUNDS.minLat &&
               position.latitude <= SICILY_CHANNEL_BOUNDS.maxLat &&
               position.longitude >= SICILY_CHANNEL_BOUNDS.minLon &&
               position.longitude <= SICILY_CHANNEL_BOUNDS.maxLon;
    }

    private isInTargetAltitude(altitude: number): boolean {
        return altitude >= MONITORING_THRESHOLDS.altitude.min &&
               altitude <= MONITORING_THRESHOLDS.altitude.max;
    }

    private isInTargetSpeed(speed: number): boolean {
        return speed >= MONITORING_THRESHOLDS.speed.min &&
               speed <= MONITORING_THRESHOLDS.speed.max;
    }

    private isOverSea(position: Position): boolean {
        // Use GeoUtils.minDistanceToCoastline to determine if over sea
        const distance = GeoUtils.minDistanceToCoastline(position);
        return distance !== null && distance >= AircraftAnalyzer.MIN_DISTANCE_FROM_COAST_KM;
    }

    private calculateDistance(a: Position, b: Position): number {
        return GeoUtils.calculateDistance(a, b);
    }

    private maxRadius(positions: Position[]): number {
        if (positions.length < 2) return 0;
        const lat = positions.reduce((sum, p) => sum + p.latitude, 0) / positions.length;
        const lon = positions.reduce((sum, p) => sum + p.longitude, 0) / positions.length;
        const centroid = { latitude: lat, longitude: lon };
        return Math.max(...positions.map(p => this.calculateDistance(p, centroid)));
    }

    private getCurrentTimestamp(aircraft: Aircraft): number {
        // lastUpdate is in seconds, convert to ms
        return aircraft.lastUpdate ? aircraft.lastUpdate * 1000 : Date.now();
    }

    private getOrCreateTrajectory(aircraft: Aircraft, now: number): AircraftTrajectory {
        let trajectory = this.trajectories.get(aircraft.icao);
        if (!trajectory) {
            trajectory = { positions: [], timestamps: [], lastUpdate: now,  };
            this.trajectories.set(aircraft.icao, trajectory);
        }
        return trajectory;
    }

    private updateTrajectory(trajectory: AircraftTrajectory, position: Position, now: number): void {
        trajectory.positions.push(position);
        trajectory.timestamps.push(now);
        trajectory.lastUpdate = now;
    }

    private cleanupOldPoints(trajectory: AircraftTrajectory, now: number): void {
        const maxAge = now - AircraftAnalyzer.MAX_TRACE_AGE_MS;
        while (trajectory.timestamps.length && trajectory.timestamps[0] < maxAge) {
            trajectory.positions.shift();
            trajectory.timestamps.shift();
        }
    }

    private setMonitoringStatus(aircraft: Aircraft, inArea: boolean, inAltitudeRange: boolean, inSpeedRange: boolean): void {
        // First check if over land, as this is the highest priority constraint
        const overSea = this.isOverSea(aircraft.position);
        if (!overSea) {
            aircraft.is_monitored = false;
            aircraft.not_monitored_reason = 'Aircraft is over land or too close to coast.';
            return;
        }

        // Then check if in monitoring area
        if (!inArea) {
            aircraft.is_monitored = false;
            aircraft.not_monitored_reason = 'Aircraft is outside the Sicily Channel monitoring area.';
            return;
        }

        // Check speed constraints
        if (!inSpeedRange) {
            aircraft.is_monitored = false;
            const speed = aircraft.speed;
            if (speed < AircraftAnalyzer.SPEED_RANGE.min) {
                aircraft.not_monitored_reason = `Aircraft speed (${speed.toFixed(1)} knots) is too slow (minimum: ${AircraftAnalyzer.SPEED_RANGE.min} knots).`;
            } else {
                aircraft.not_monitored_reason = `Aircraft speed (${speed.toFixed(1)} knots) is too fast (maximum: ${AircraftAnalyzer.SPEED_RANGE.max} knots).`;
            }
            return;
        }

        // Check altitude constraints
        if (!inAltitudeRange) {
            aircraft.is_monitored = false;
            const altitude = aircraft.altitude;
            if (altitude < AircraftAnalyzer.ALTITUDE_RANGE.min) {
                aircraft.not_monitored_reason = `Aircraft altitude (${altitude.toFixed(1)} feet) is too low (minimum: ${AircraftAnalyzer.ALTITUDE_RANGE.min} feet).`;
            } else {
                aircraft.not_monitored_reason = `Aircraft altitude (${altitude.toFixed(1)} feet) is too high (maximum: ${AircraftAnalyzer.ALTITUDE_RANGE.max} feet).`;
            }
            return;
        }

        // If all checks pass, the aircraft is monitored
        aircraft.is_monitored = true;
        aircraft.not_monitored_reason = null;
    }

    private handleOutOfRange(aircraft: Aircraft, trajectory: AircraftTrajectory, now: number): boolean {
        if (!aircraft.is_monitored) {
            if (!trajectory.outOfRangeSince) trajectory.outOfRangeSince = now;
            if (
                trajectory.outOfRangeSince !== undefined &&
                now - trajectory.outOfRangeSince > AircraftAnalyzer.MAX_OUTOFRANGE_MS
            ) {
                aircraft.is_loitering = false;
                return false;
            }
        } else {
            trajectory.outOfRangeSince = undefined;
        }
        return true;
    }

    private doLineSegmentsIntersect(p1: Position, p2: Position, p3: Position, p4: Position): boolean {
        const x1 = p1.longitude, y1 = p1.latitude;
        const x2 = p2.longitude, y2 = p2.latitude;
        const x3 = p3.longitude, y3 = p3.latitude;
        const x4 = p4.longitude, y4 = p4.latitude;

        const denom = (y4 - y3) * (x2 - x1) - (x4 - x3) * (y2 - y1);
        if (Math.abs(denom) < 1e-10) return false;

        const ua = ((x4 - x3) * (y1 - y3) - (y4 - y3) * (x1 - x3)) / denom;
        const ub = ((x2 - x1) * (y1 - y3) - (y2 - y1) * (x1 - x3)) / denom;

        return ua >= 0 && ua <= 1 && ub >= 0 && ub <= 1;
    }

    private detectLoitering(trajectory: AircraftTrajectory, aircraft: Aircraft): boolean {
        const positions = trajectory.positions;

        if (positions.length < 4) {
            aircraft.is_loitering = false;
            return false;
        }

        for (let i = 0; i < positions.length - 3; i++) {
            for (let j = i + 2; j < positions.length - 1; j++) {
                if (!aircraft.is_monitored) continue;

                const intersects = this.doLineSegmentsIntersect(
                    positions[i],
                    positions[i + 1],
                    positions[j],
                    positions[j + 1]
                );

                if (intersects) {
                    aircraft.is_loitering = true;
                    return true;
                }
            }
        }

        aircraft.is_loitering = false;
        return false;
    }

    public analyzeAircraft(aircraft: Aircraft): boolean {
        const now = this.getCurrentTimestamp(aircraft);
        const trajectory = this.getOrCreateTrajectory(aircraft, now);
        this.updateTrajectory(trajectory, aircraft.position, now);
        this.cleanupOldPoints(trajectory, now);

        const inArea = this.isInSicilyChannel(aircraft.position);
        const inAltitudeRange = this.isInTargetAltitude(aircraft.altitude);
        const inSpeedRange = this.isInTargetSpeed(aircraft.speed);
        this.setMonitoringStatus(aircraft, inArea, inAltitudeRange, inSpeedRange);

        if (!this.handleOutOfRange(aircraft, trajectory, now)) {
            return false;
        }

        return this.detectLoitering(trajectory, aircraft);
    }

    public cleanupOldAircraft(): void {
        const threshold = Date.now() - AircraftAnalyzer.CLEANUP_THRESHOLD_MS;
        for (const [icao, trajectory] of this.trajectories) {
            if (trajectory.lastUpdate < threshold) {
                this.trajectories.delete(icao);
            }
        }
    }
}
