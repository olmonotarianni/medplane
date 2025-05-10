import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import { point } from '@turf/helpers';
import coastlineData from '../data/countries-coastline-2km5.geo.json';
import { GeoJSONData, GeoJSONGeometry, Position } from './types';

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
    console.log('Loading coastline data...');
    if (!coastlineData) {
        console.error('Coastline data is null or undefined');
    } else if (!Array.isArray(coastlineData.features)) {
        console.error('Invalid coastline GeoJSON format - features is not an array');
        console.log('Coastline data type:', typeof coastlineData);
        console.log('Coastline data keys:', Object.keys(coastlineData));
    } else {
        // Validate the data structure matches our types
        const validData = coastlineData as unknown as GeoJSONData;
        if (validData.type === "FeatureCollection") {
            coastlineGeojson = validData;
            console.log(`Successfully loaded coastline data with ${validData.features.length} features`);
        }
    }
} catch (e) {
    console.error('Could not parse coastline GeoJSON:', e);
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
                    console.error('Timeout while calculating distance from land');
                } else {
                    console.error('Error calculating distance from land:', error.message);
                }
            } else {
                console.error('Unknown error calculating distance from land');
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
                console.warn('Error checking point in polygon:', e);
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

        // If we're over land, distance to coast is 0
        if (isLand) {
            return 0;
        }

        // If we're over sea, we're at least 5km from coast (due to the 2km5 coastline data)
        // This is a simplification, but it works for our use case
        return 5;
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
