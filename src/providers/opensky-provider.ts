import { Aircraft, OpenSkyResponse } from '../types';
import { ScannerProvider, ScanResult } from './base-provider';

/**
 * Authentication credentials for the OpenSky Network API.
 * See: https://opensky-network.org/apidoc/
 */
export interface OpenSkyAuth {
    username: string;
    password: string;
}

/**
 * STUB Implementation of OpenSky Network API provider
 *
 * TODO: Implementation Steps:
 * 1. Register for OpenSky Network API access (https://opensky-network.org/apidoc/)
 * 2. Test rate limits - free tier allows 400 requests per day (~4s interval)
 * 3. Handle API-specific error codes (e.g., 429 Too Many Requests)
 * 4. Add request throttling to stay within rate limits
 * 5. Consider implementing response caching
 * 6. Add proper data validation for the API response
 *
 * Note: Currently using compressed provider (opensky-compressed-provider.ts) instead,
 * which uses a different endpoint with better rate limits.
 */
export class OpenSkyProvider implements ScannerProvider {
    private readonly auth?: OpenSkyAuth;
    private static readonly API_URL = 'https://opensky-network.org/api/states/all';

    constructor(auth?: OpenSkyAuth) {
        this.auth = auth;
    }

    /**
     * Scan for aircraft in the given bounds using the OpenSky API.
     * @param bounds Geographic bounds to scan
     */
    async scan(bounds: {
        minLat: number;
        maxLat: number;
        minLon: number;
        maxLon: number;
    }): Promise<ScanResult> {
        const authHeader = this.auth
            ? Buffer.from(`${this.auth.username}:${this.auth.password}`).toString('base64')
            : undefined;
        const url = `${OpenSkyProvider.API_URL}?lamin=${bounds.minLat}&lomin=${bounds.minLon}&lamax=${bounds.maxLat}&lomax=${bounds.maxLon}`;
        try {
            const response = await fetch(url, {
                headers: authHeader ? { 'Authorization': `Basic ${authHeader}` } : undefined
            });
            if (!response.ok) {
                throw new Error(`OpenSky API error: ${response.status} ${response.statusText}`);
            }
            const data = await response.json() as OpenSkyResponse;
            if (!data.states) {
                return {
                    aircraft: [],
                    timestamp: data.time
                };
            }
            const aircraft: Aircraft[] = data.states
                .map((state): Aircraft | null => {
                    // OpenSky: [5]=longitude, [6]=latitude
                    if (!state[6] || !state[5]) return null; // Skip if no position
                    return {
                        icao: state[0],
                        callsign: state[1]?.trim() || null,
                        position: {
                            latitude: state[6],
                            longitude: state[5]
                        },
                        altitude: state[7],
                        speed: state[9],
                        heading: state[10],
                        verticalRate: state[11],
                        lastUpdate: state[4],
                        is_loitering: false,
                        is_monitored: false,
                        not_monitored_reason: null,
                        track: []
                    };
                })
                .filter((aircraft): aircraft is Aircraft => aircraft !== null);
            return {
                aircraft,
                timestamp: data.time
            };
        } catch (error) {
            console.error('Failed to fetch aircraft from OpenSky:', error);
            return {
                aircraft: [],
                timestamp: Date.now() / 1000 // fallback to current time in seconds
            };
        }
    }
}
