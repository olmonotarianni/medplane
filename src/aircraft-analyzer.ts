import { Aircraft, Position } from './types';
import haversine from 'haversine';
import { GeoUtils } from './utils';

interface AircraftTrajectory {
    positions: Position[];
    timestamps: number[];
    lastUpdate: number;
    isInteresting: boolean;
    outOfRangeSince?: number;
}

export class AircraftAnalyzer {
    // Monitoring area bounds
    private static readonly SICILY_CHANNEL_BOUNDS = {
        minLat: 33,
        maxLat: 37,
        minLon: 10,
        maxLon: 16
    };
    // Altitude and speed ranges
    private static readonly ALTITUDE_RANGE = { min: 5000, max: 25000 }; // feet
    private static readonly SPEED_RANGE = { min: 100, max: 300 }; // knots
    // Loitering and cleanup thresholds
    private static readonly LOITERING_THRESHOLD_MS = 5 * 60 * 1000; // 5 min
    private static readonly MAX_RADIUS_KM = 30;
    private static readonly MAX_OUTOFRANGE_MS = 30 * 1000; // 30 sec
    private static readonly CLEANUP_THRESHOLD_MS = 15 * 60 * 1000; // 15 min

    private trajectories: Map<string, AircraftTrajectory> = new Map();

    private isInSicilyChannel(position: Position): boolean {
        const b = AircraftAnalyzer.SICILY_CHANNEL_BOUNDS;
        return position.latitude >= b.minLat &&
               position.latitude <= b.maxLat &&
               position.longitude >= b.minLon &&
               position.longitude <= b.maxLon;
    }

    private isInTargetAltitude(altitude: number): boolean {
        const r = AircraftAnalyzer.ALTITUDE_RANGE;
        return altitude >= r.min && altitude <= r.max;
    }

    private isInTargetSpeed(speed: number): boolean {
        const r = AircraftAnalyzer.SPEED_RANGE;
        return speed >= r.min && speed <= r.max;
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
            trajectory = { positions: [], timestamps: [], lastUpdate: now, isInteresting: false };
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
        const tenMinutesAgo = now - 10 * 60 * 1000;
        while (trajectory.timestamps.length && trajectory.timestamps[0] < tenMinutesAgo) {
            trajectory.positions.shift();
            trajectory.timestamps.shift();
        }
    }

    private setMonitoringStatus(aircraft: Aircraft, inArea: boolean, inAltitudeRange: boolean, inSpeedRange: boolean): void {
        aircraft.is_monitored = inArea && inAltitudeRange && inSpeedRange;
        if (!aircraft.is_monitored) {
            if (!inArea) {
                aircraft.not_monitored_reason = 'Aircraft is outside the monitoring area.';
            } else if (!inAltitudeRange) {
                aircraft.not_monitored_reason = 'Aircraft altitude is outside the monitored range.';
            } else if (!inSpeedRange) {
                aircraft.not_monitored_reason = 'Aircraft speed is outside the monitored range.';
            } else {
                aircraft.not_monitored_reason = 'Aircraft does not meet monitoring criteria.';
            }
        } else {
            aircraft.not_monitored_reason = undefined;
        }
    }

    private handleOutOfRange(aircraft: Aircraft, trajectory: AircraftTrajectory, now: number): boolean {
        if (!aircraft.is_monitored) {
            if (!trajectory.outOfRangeSince) trajectory.outOfRangeSince = now;
            if (
                trajectory.outOfRangeSince !== undefined &&
                now - trajectory.outOfRangeSince > AircraftAnalyzer.MAX_OUTOFRANGE_MS
            ) {
                trajectory.isInteresting = false;
                aircraft.is_loitering = false;
                return false;
            }
        } else {
            trajectory.outOfRangeSince = undefined;
        }
        return true;
    }

    private detectLoitering(trajectory: AircraftTrajectory, aircraft: Aircraft): boolean {
        const timeElapsed = trajectory.timestamps[trajectory.timestamps.length - 1] - trajectory.timestamps[0];
        if (timeElapsed >= AircraftAnalyzer.LOITERING_THRESHOLD_MS) {
            const radius = this.maxRadius(trajectory.positions);
            if (radius < AircraftAnalyzer.MAX_RADIUS_KM) {
                trajectory.isInteresting = true;
                aircraft.is_loitering = true;
                return true;
            }
        }
        trajectory.isInteresting = false;
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

    public getInterestingAircraft(): string[] {
        // Retrieval O(1)
        return Array.from(this.trajectories.entries())
            .filter(([_, traj]) => traj.isInteresting)
            .map(([icao]) => icao);
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
