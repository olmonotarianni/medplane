import { MONITORING_THRESHOLDS, SICILY_CHANNEL_BOUNDS } from '../config';
import { Aircraft, Position } from '../types';
import { GeoUtils } from '../utils';

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

    /**
     * Detects loitering behavior in an aircraft's trajectory.
     * @param aircraft - The aircraft to analyze.
     * @returns True if the aircraft is loitering, false otherwise.
     */
    private detectLoitering(aircraft: Aircraft): boolean {
        interface Segment {
            start: Position;
            end: Position;
        }

        function areIntersecting(segment1: Segment, segment2: Segment): boolean {
            const x1 = segment1.start.longitude, y1 = segment1.start.latitude;
            const x2 = segment1.end.longitude, y2 = segment1.end.latitude;
            const x3 = segment2.start.longitude, y3 = segment2.start.latitude;
            const x4 = segment2.end.longitude, y4 = segment2.end.latitude;

            // Calculate the denominator
            const denom = (y4 - y3) * (x2 - x1) - (x4 - x3) * (y2 - y1);

            // If lines are parallel
            if (Math.abs(denom) < 1e-12) return false;

            // Calculate intersection parameters
            const ua = ((x4 - x3) * (y1 - y3) - (y4 - y3) * (x1 - x3)) / denom;
            const ub = ((x2 - x1) * (y1 - y3) - (y2 - y1) * (x1 - x3)) / denom;

            // Check if intersection occurs within both line segments
            return (ua >= 0 && ua <= 1) && (ub >= 0 && ub <= 1);
        }

        // Create segments from track points
        const segments: Segment[] = [];
        for (let i = 1; i < aircraft.track.length; i++) {
            segments.push({
                start: aircraft.track[i - 1],
                end: aircraft.track[i]
            });
        }

        // Need at least 4 points (3 segments) to have an intersection
        if (segments.length < 3) {
            aircraft.is_loitering = false;
            return false;
        }

        // Check if any non-adjacent segments intersect
        for (let i = 0; i < segments.length - 2; i++) {
            for (let j = i + 2; j < segments.length; j++) {
                if (areIntersecting(segments[i], segments[j])) {
                    aircraft.loitering_debug = {
                        reason: 'Intersecting segments',
                        segments: [segments[i], segments[j]]
                    };
                    aircraft.is_loitering = true;
                    return true;
                }
            }
        }

        aircraft.is_loitering = false;
        return false;
    }

    /**
     * Analyzes an aircraft and updates its monitoring status and loitering detection.
     * @param aircraft - The aircraft to analyze.
     * @returns True if the aircraft is loitering, false otherwise.
     */
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

        return this.detectLoitering(aircraft);
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
