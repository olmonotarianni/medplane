import { Position } from './types';

export class GeoUtils {
    private static readonly EARTH_RADIUS_KM = 6371;

    static calculateDistance(point1: Position, point2: Position): number {
        const dLat = (point2.latitude - point1.latitude) * Math.PI / 180;
        const dLon = (point2.longitude - point1.longitude) * Math.PI / 180;
        const a =
            Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(point1.latitude * Math.PI / 180) * Math.cos(point2.latitude * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
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

    private static toRad(degrees: number): number {
        return degrees * (Math.PI/180);
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
