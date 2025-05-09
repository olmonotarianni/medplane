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
    private readonly SICILY_CHANNEL_BOUNDS = {
        minLat: 33,
        maxLat: 37,
        minLon: 10,
        maxLon: 16
    };

    private readonly ALTITUDE_RANGE = {
        min: 5000,  // feet
        max: 25000  // feet
    };

    private readonly SPEED_RANGE = {
        min: 100,   // knots
        max: 300    // knots
    };

    private readonly LOITERING_THRESHOLD = 5 * 60 * 1000; // 5 minutes in milliseconds
    private readonly MAX_RADIUS_KM = 30; // maximum radius for loitering
    private readonly MAX_OUTOFRANGE_MS = 30 * 1000; // 30 seconds tolerance
    private readonly CLEANUP_THRESHOLD = 15 * 60 * 1000; // 15 minutes

    private trajectories: Map<string, AircraftTrajectory> = new Map();

    private isInSicilyChannel(position: Position): boolean {
        return position.latitude >= this.SICILY_CHANNEL_BOUNDS.minLat &&
               position.latitude <= this.SICILY_CHANNEL_BOUNDS.maxLat &&
               position.longitude >= this.SICILY_CHANNEL_BOUNDS.minLon &&
               position.longitude <= this.SICILY_CHANNEL_BOUNDS.maxLon;
    }

    private isInTargetAltitude(altitude: number): boolean {
        return altitude >= this.ALTITUDE_RANGE.min && altitude <= this.ALTITUDE_RANGE.max;
    }

    private isInTargetSpeed(speed: number): boolean {
        return speed >= this.SPEED_RANGE.min && speed <= this.SPEED_RANGE.max;
    }

    private calculateDistance(a: Position, b: Position): number {
        return GeoUtils.calculateDistance(a, b);
    }

    // Calcola il raggio massimo dal centroide
    private maxRadius(positions: Position[]): number {
        if (positions.length < 2) return 0;
        const lat = positions.reduce((sum, p) => sum + p.latitude, 0) / positions.length;
        const lon = positions.reduce((sum, p) => sum + p.longitude, 0) / positions.length;
        const centroid = { latitude: lat, longitude: lon };
        return Math.max(...positions.map(p => this.calculateDistance(p, centroid)));
    }

    public analyzeAircraft(aircraft: Aircraft): boolean {
        // Use real timestamp if available
        const now = (aircraft as any).timestamp || aircraft.lastUpdate || Date.now();

        let trajectory = this.trajectories.get(aircraft.icao);
        if (!trajectory) {
            trajectory = { positions: [], timestamps: [], lastUpdate: now, isInteresting: false };
            this.trajectories.set(aircraft.icao, trajectory);
        }

        // Aggiorna la traiettoria
        trajectory.positions.push(aircraft.position);
        trajectory.timestamps.push(now);
        trajectory.lastUpdate = now;

        // Cleanup old points (>10 min)
        const tenMinutesAgo = now - (10 * 60 * 1000);
        while (trajectory.timestamps.length && trajectory.timestamps[0] < tenMinutesAgo) {
            trajectory.positions.shift();
            trajectory.timestamps.shift();
        }

        // Check if aircraft meets monitoring criteria
        const inArea = this.isInSicilyChannel(aircraft.position);
        const inAltitudeRange = this.isInTargetAltitude(aircraft.altitude);
        const inSpeedRange = this.isInTargetSpeed(aircraft.speed);

        // Set is_monitored flag based on all criteria
        aircraft.is_monitored = inArea && inAltitudeRange && inSpeedRange;

        // Add not_monitored_reason for UI
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

        if (!aircraft.is_monitored) {
            if (!trajectory.outOfRangeSince) trajectory.outOfRangeSince = now;
            if (
                trajectory.outOfRangeSince !== undefined &&
                now - trajectory.outOfRangeSince > this.MAX_OUTOFRANGE_MS
            ) {
                trajectory.isInteresting = false;
                aircraft.is_loitering = false;
                return false;
            }
        } else {
            trajectory.outOfRangeSince = undefined;
        }

        // Loitering detection: at least 5 min, max radius < threshold
        const timeElapsed = trajectory.timestamps[trajectory.timestamps.length - 1] - trajectory.timestamps[0];
        if (timeElapsed >= this.LOITERING_THRESHOLD) {
            const radius = this.maxRadius(trajectory.positions);
            if (radius < this.MAX_RADIUS_KM) {
                trajectory.isInteresting = true;
                aircraft.is_loitering = true;
                return true;
            }
        }

        trajectory.isInteresting = false;
        aircraft.is_loitering = false;
        return false;
    }

    public getInterestingAircraft(): string[] {
        // Retrieval O(1)
        return Array.from(this.trajectories.entries())
            .filter(([_, traj]) => traj.isInteresting)
            .map(([icao]) => icao);
    }

    public cleanupOldAircraft(): void {
        const threshold = Date.now() - this.CLEANUP_THRESHOLD;
        for (const [icao, trajectory] of this.trajectories) {
            if (trajectory.lastUpdate < threshold) {
                this.trajectories.delete(icao);
            }
        }
    }
}
