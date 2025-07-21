import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import { point } from '@turf/helpers';
import coastlineData from '../data/countries-coastline-2km5.geo.json';
import { GeoJSONData, GeoJSONGeometry, Position } from './types';
import { logger } from './logger';

// Type guards
function isPolygonGeometry(geometry: GeoJSONGeometry | null): geometry is GeoJSONGeometry & { type: "Polygon" } {
    return geometry?.type === "Polygon";
}

function isMultiPolygonGeometry(geometry: GeoJSONGeometry | null): geometry is GeoJSONGeometry & { type: "MultiPolygon" } {
    return geometry?.type === "MultiPolygon";
}

// Load and validate coastline data
let coastlineGeojson: GeoJSONData | null = null;
try {
    logger.debug('Loading coastline data...');
    if (!coastlineData) {
        logger.error('Coastline data is null or undefined');
    } else if (!Array.isArray(coastlineData.features)) {
        logger.error('Invalid coastline GeoJSON format - features is not an array');
        logger.info('Coastline data type:', typeof coastlineData);
        logger.info('Coastline data keys:', Object.keys(coastlineData));
    } else {
        // Validate the data structure matches our types
        const validData = coastlineData as unknown as GeoJSONData;
        if (validData.type === "FeatureCollection") {
            coastlineGeojson = validData;
            logger.info(`Successfully loaded coastline data with ${validData.features.length} features`);
        }
    }
} catch (e) {
    logger.error('Could not parse coastline GeoJSON:', e);
}

export class GeoUtils {
    private static readonly EARTH_RADIUS_KM = 6371;

    static calculateDistance(point1: Position, point2: Position): number {
        const dLat = (point2.latitude - point1.latitude) * Math.PI / 180;
        const dLon = (point2.longitude - point1.longitude) * Math.PI / 180;
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(point1.latitude * Math.PI / 180) * Math.cos(point2.latitude * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return this.EARTH_RADIUS_KM * c;
    }

    static degreesToCardinal(degrees: number): string {
        const cardinals = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
            'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
        const index = Math.round(degrees / 22.5) % 16;
        return cardinals[index];
    }

    static radiusToLatLonBounds(center: Position, radiusKm: number): {
        minLat: number;
        maxLat: number;
        minLon: number;
        maxLon: number;
    } {
        // At the equator, 1 degree is approximately 111 kilometers
        const latDegrees = radiusKm / 111;
        const lonDegrees = radiusKm / (111 * Math.cos(center.latitude * Math.PI / 180));

        return {
            minLat: center.latitude - latDegrees,
            maxLat: center.latitude + latDegrees,
            minLon: center.longitude - lonDegrees,
            maxLon: center.longitude + lonDegrees
        };
    }

    /**
     * Calculate the distance from a point to the nearest land
     * @param position The position to check
     * @param searchRadiusKm The radius to search for land features (in kilometers)
     * @returns The distance to land in kilometers, or null if no land found within search radius
     */
    static async getDistanceFromLand(position: Position, searchRadiusKm: number = 50): Promise<number | null> {
        try {
            // Convert search radius to degrees (approximate)
            const searchRadiusDeg = searchRadiusKm / 111.32; // 1 degree ≈ 111.32 km at equator

            // Query Overpass API for land features
            const query = `
                [out:json][timeout:25];
                (
                    // Query for land features (coastlines, islands, etc.)
                    way["natural"="coastline"](around:${searchRadiusDeg * 1000},${position.latitude},${position.longitude});
                    way["place"="island"](around:${searchRadiusDeg * 1000},${position.latitude},${position.longitude});
                    way["landuse"="farmland"](around:${searchRadiusDeg * 1000},${position.latitude},${position.longitude});
                    way["landuse"="residential"](around:${searchRadiusDeg * 1000},${position.latitude},${position.longitude});
                );
                out body;
                >;
                out skel qt;
            `;

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

            const response = await fetch('https://overpass-api.de/api/interpreter', {
                method: 'POST',
                body: query,
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();

            if (!data.elements || data.elements.length === 0) {
                return null; // No land features found within search radius
            }

            // Find the closest point among all land features
            let minDistance = Infinity;
            for (const element of data.elements) {
                if (element.type === 'node') {
                    const distance = this.calculateDistance(
                        position,
                        { latitude: element.lat, longitude: element.lon }
                    );
                    minDistance = Math.min(minDistance, distance);
                }
            }

            return minDistance === Infinity ? null : minDistance;
        } catch (error) {
            if (error instanceof Error) {
                if (error.name === 'AbortError') {
                    logger.error('Timeout while calculating distance from land');
                } else {
                    logger.error('Error calculating distance from land:', error.message);
                }
            } else {
                logger.error('Unknown error calculating distance from land');
            }
            return null;
        }
    }

    /**
     * Returns whether a point is over land (inside any coastline polygon)
     * @param position The position to check
     * @returns true if the point is over land, false if over sea
     */
    private static isOverLand(position: Position): boolean {
        if (!coastlineGeojson || !Array.isArray(coastlineGeojson.features)) {
            return false;
        }

        const pt = point([position.longitude, position.latitude]);

        for (const feature of coastlineGeojson.features) {
            if (!feature?.geometry) continue;

            try {
                if (isPolygonGeometry(feature.geometry) || isMultiPolygonGeometry(feature.geometry)) {
                    // Cast to any to bypass type checking since we know the structure is correct
                    // This is safe because we've verified the geometry type with our type guards
                    if (booleanPointInPolygon(pt, feature as any)) {
                        return true;
                    }
                }
            } catch (e) {
                logger.warn('Error checking point in polygon:', e);
                continue;
            }
        }

        return false;
    }

    /**
     * Returns the minimum distance (in km) from the given position to the nearest coastline.
     * Returns null if the coastline data is not loaded or if no valid distance could be computed.
     */
    static minDistanceToCoastline(position: Position): number | null {
        if (!coastlineGeojson || !Array.isArray(coastlineGeojson.features)) {
            return null;
        }

        // First check if we're over land
        const isLand = this.isOverLand(position);
        if (isLand) {
            return 0;
        }

        let minDistance = Infinity;
        for (const feature of coastlineGeojson.features) {
            if (!feature?.geometry) continue;

            if (isPolygonGeometry(feature.geometry)) {
                // Polygon: coordinates is LineStringCoordinates[] (array of rings)
                const rings = feature.geometry.coordinates as import("./types").LineStringCoordinates[];
                for (const ring of rings) {
                    for (const coord of ring) {
                        const [lon, lat] = coord;
                        const dist = this.calculateDistance(position, { latitude: lat, longitude: lon });
                        if (dist < minDistance) {
                            minDistance = dist;
                        }
                    }
                }
            } else if (isMultiPolygonGeometry(feature.geometry)) {
                // MultiPolygon: coordinates is PolygonCoordinates[] (array of polygons)
                const polygons = feature.geometry.coordinates as import("./types").PolygonCoordinates[];
                for (const polygon of polygons) {
                    for (const ring of polygon) {
                        for (const coord of ring) {
                            const [lon, lat] = coord;
                            const dist = this.calculateDistance(position, { latitude: lat, longitude: lon });
                            if (dist < minDistance) {
                                minDistance = dist;
                            }
                        }
                    }
                }
            }
        }
        return minDistance !== Infinity ? minDistance : null;
    }
}

export class FormatUtils {

    static formatSpeed(metersPerSecond: number): string {
        return `${(metersPerSecond * 3.6).toFixed(1)} km/h`;
    }

    static formatAltitude(meters: number | null): string {
        if (meters === null || isNaN(meters)) return "N/A";
        return `${Math.round(meters)} meters`;
    }

    static formatDistance(km: number): string {
        return `${km.toFixed(1)}km`;
    }

    static formatHeading(degrees: number | null): string {
        if (degrees === null || isNaN(degrees)) return "N/A";
        return `${degrees.toFixed(1)}°`;
    }
}


export interface Segment {
    start: Position;
    end: Position;
}
/**
 * Determines whether two geographic segments intersect strictly within their bounds.
 *
 * Criteria:
 * - Excludes intersections that occur at endpoints.
 * - Handles floating-point imprecision with EPSILON.
 * - Rejects degenerate segments (zero-length).
 * - Uses geometric orientation and cross product logic.
 *
 * @param seg1 The first segment
 * @param seg2 The second segment
 * @returns true if the segments intersect, false otherwise
 */

export function areIntersecting(seg1: Segment, seg2: Segment): boolean {
    const EPSILON = 1e-10;

    // Convert to vector-friendly point format
    type Point = { x: number, y: number };
    const A: Point = { x: seg1.start.longitude, y: seg1.start.latitude };
    const B: Point = { x: seg1.end.longitude, y: seg1.end.latitude };
    const C: Point = { x: seg2.start.longitude, y: seg2.start.latitude };
    const D: Point = { x: seg2.end.longitude, y: seg2.end.latitude };

    // Return cross product of (p1 -> p2) × (p1 -> p3)
    function cross(p1: Point, p2: Point, p3: Point): number {
        return (p2.x - p1.x) * (p3.y - p1.y) - (p2.y - p1.y) * (p3.x - p1.x);
    }

    // Check if two points are effectively the same
    function isSame(p1: Point, p2: Point): boolean {
        return Math.abs(p1.x - p2.x) < EPSILON && Math.abs(p1.y - p2.y) < EPSILON;
    }

    // Reject degenerate segments or if they share an endpoint
    if (
        isSame(A, B) || isSame(C, D) ||
        isSame(A, C) || isSame(A, D) || isSame(B, C) || isSame(B, D)
    ) {
        return false;
    }

    const d1 = cross(C, D, A);
    const d2 = cross(C, D, B);
    const d3 = cross(A, B, C);
    const d4 = cross(A, B, D);

    // Proper intersection (segments cross each other)
    return d1 * d2 < -EPSILON && d3 * d4 < -EPSILON;
}
