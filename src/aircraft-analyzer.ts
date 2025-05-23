import { MONITORING_THRESHOLDS, SICILY_CHANNEL_BOUNDS } from './config';
import { Aircraft, Position } from './types';
import { areIntersecting, GeoUtils } from './utils';

export interface AircraftAnalysisResult {
    is_monitored: boolean;
    not_monitored_reason: string | null;
    is_loitering: boolean;
}

/**
 * AircraftAnalyzer is responsible for analyzing a single aircraft's monitoring and loitering status.
 * It uses only the provided aircraft data (such as track and position) and does not mutate any input objects.
 * All methods are pure and return new values or results, making the class stateless and easy to test.
 */
export class AircraftAnalyzer {
    // Altitude and speed ranges
    private static readonly ALTITUDE_RANGE = { min: 1000, max: 25000 }; // feet
    private static readonly SPEED_RANGE = { min: 150, max: 300 }; // knots

    // Minimum distance from coast (km) to be considered over the sea
    private static readonly MIN_DISTANCE_FROM_COAST_KM = MONITORING_THRESHOLDS.coast.minDistance;

    private isInSicilyChannel(position: Position): boolean {
        return position.latitude >= SICILY_CHANNEL_BOUNDS.minLat &&
            position.latitude <= SICILY_CHANNEL_BOUNDS.maxLat &&
            position.longitude >= SICILY_CHANNEL_BOUNDS.minLon &&
            position.longitude <= SICILY_CHANNEL_BOUNDS.maxLon;
    }

    private isInTargetAltitude(altitude: number): boolean {
        return altitude >= AircraftAnalyzer.ALTITUDE_RANGE.min &&
            altitude <= AircraftAnalyzer.ALTITUDE_RANGE.max;
    }

    private isInTargetSpeed(speed: number): boolean {
        return speed >= AircraftAnalyzer.SPEED_RANGE.min &&
            speed <= AircraftAnalyzer.SPEED_RANGE.max;
    }

    private isOverSea(position: Position): boolean {
        // Use GeoUtils.minDistanceToCoastline to determine if over sea
        const distance = GeoUtils.minDistanceToCoastline(position);
        return distance !== null && distance >= AircraftAnalyzer.MIN_DISTANCE_FROM_COAST_KM;
    }
    /**
     * Analyzes an aircraft and returns its monitoring and loitering status.
     * Does not mutate the input aircraft object.
     * @param aircraft - The aircraft to analyze.
     * @returns AircraftAnalysisResult
     */
    public analyzeAircraft(aircraft: Aircraft): AircraftAnalysisResult {

        // Just a simple way to debug the loitering event page
        // uncomment if you want to see all aircraft as loitering
        // if (aircraft.track.length > 2) {
        //     return {
        //         is_monitored: true,
        //         not_monitored_reason: null,
        //         is_loitering: true,
        //     };
        // }


        const latestPosition = aircraft.track[0];
        if (!latestPosition) {
            return {
                is_monitored: false,
                not_monitored_reason: 'No position data available.',
                is_loitering: false,
            };
        }

        // Monitoring status logic
        const inArea = this.isInSicilyChannel(latestPosition);
        const inAltitudeRange = this.isInTargetAltitude(latestPosition.altitude);
        const inSpeedRange = this.isInTargetSpeed(latestPosition.speed);
        const overSea = this.isOverSea(latestPosition);

        if (!overSea) {
            return {
                is_monitored: false,
                not_monitored_reason: 'Aircraft is over land or too close to coast.',
                is_loitering: false,
            };
        }
        if (!inArea) {
            return {
                is_monitored: false,
                not_monitored_reason: 'Aircraft is outside the Sicily Channel monitoring area.',
                is_loitering: false,
            };
        }
        if (!inSpeedRange) {
            const speed = latestPosition.speed;
            return {
                is_monitored: false,
                not_monitored_reason: speed < AircraftAnalyzer.SPEED_RANGE.min
                    ? `Aircraft speed (${speed.toFixed(1)} knots) is too slow (minimum: ${AircraftAnalyzer.SPEED_RANGE.min} knots).`
                    : `Aircraft speed (${speed.toFixed(1)} knots) is too fast (maximum: ${AircraftAnalyzer.SPEED_RANGE.max} knots).`,
                is_loitering: false,
            };
        }
        if (!inAltitudeRange) {
            const altitude = latestPosition.altitude;
            return {
                is_monitored: false,
                not_monitored_reason: altitude < AircraftAnalyzer.ALTITUDE_RANGE.min
                    ? `Aircraft altitude (${altitude.toFixed(1)} feet) is too low (minimum: ${AircraftAnalyzer.ALTITUDE_RANGE.min} feet).`
                    : `Aircraft altitude (${altitude.toFixed(1)} feet) is too high (maximum: ${AircraftAnalyzer.ALTITUDE_RANGE.max} feet).`,
                is_loitering: false,
            };
        }

        // If all checks pass, the aircraft is monitored
        const is_loitering = AircraftAnalyzer.hasIntersectingTrack(aircraft);
        return {
            is_monitored: true,
            not_monitored_reason: null,
            is_loitering,
        };
    }

    static hasIntersectingTrack(aircraft: Aircraft): boolean {
        // Convert track points to segments
        const segments = aircraft.track.slice(1).map((point, i) => ({
            start: aircraft.track[i],
            end: point
        }));

        // Check if any non-adjacent segments intersect
        for (let i = 0; i < segments.length - 2; i++) {
            for (let j = i + 2; j < segments.length; j++) {
                if (areIntersecting(segments[i], segments[j])) {
                    return true;
                }
            }
        }

        return false;
    }
}
