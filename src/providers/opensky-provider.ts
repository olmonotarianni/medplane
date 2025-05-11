import { Aircraft } from '../types';
import { AdsbFiProvider } from './adsbfi-provider';
import { ScannerProvider, ScanResult } from './base-provider';

// OpenSky Network API aircraft state
type AircraftState = [
    string,     // icao24
    string,     // callsign
    string,     // origin_country
    number,     // time_position
    number,     // last_contact
    number,     // longitude
    number,     // latitude
    number,     // baro_altitude
    boolean,    // on_ground
    number,     // velocity
    number,     // true_track
    number,     // vertical_rate
    number[],   // sensors
    number,     // geo_altitude
    string,     // squawk
    boolean,    // spi
    number      // position_source
];

interface OpenSkyResponse {
    time: number;
    states: AircraftState[];
}

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

    private constructor(auth?: OpenSkyAuth) {
        this.auth = auth;
    }

    static fromEnv(): OpenSkyProvider {
        const username = process.env.OPENSKY_USERNAME;
        const password = process.env.OPENSKY_PASSWORD;
        if (!username || !password) {
            throw new Error('OPENSKY_USERNAME and OPENSKY_PASSWORD must be set');
        }
        return new AdsbFiProvider();
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
        const url = `${OpenSkyProvider.API_URL}?lamin=${bounds.minLat}&lomin=${bounds.minLon}&lamax=${bounds.maxLat}&lomax=${bounds.maxLon}`;

        console.log('Making OpenSky API request:');
        console.log('URL:', url);
        console.log('Auth:', this.auth ? 'Using credentials' : 'No credentials');

        try {
            // Match curl's basic auth approach
            const options: RequestInit = {
                method: 'GET',
                headers: {
                    'User-Agent': 'MedPlane/1.0'
                }
            };

            if (this.auth) {
                options.headers = {
                    ...options.headers,
                    'Authorization': `Basic ${Buffer.from(`${this.auth.username}:${this.auth.password}`).toString('base64')}`
                };
            }

            const response = await fetch(url, options);
            console.log('OpenSky response status:', response.status, response.statusText);

            if (!response.ok) {
                if (response.status === 401) {
                    console.error('Authentication failed. Please check your OpenSky credentials.');
                    console.error('Note: OpenSky API requires a registered account.');
                    console.error('Register at: https://opensky-network.org/apidoc/');
                    // Log the actual auth header being sent (with password obscured)
                    if (this.auth) {
                        const authHeader = `Basic ${Buffer.from(`${this.auth.username}:****`).toString('base64')}`;
                        console.error('Auth header being sent:', authHeader);
                    }
                }
                throw new Error(`OpenSky API error: ${response.status} ${response.statusText}`);
            }

            const data = await response.json() as OpenSkyResponse;
            console.log('OpenSky data received:', {
                time: data.time,
                numStates: data.states?.length || 0
            });

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
