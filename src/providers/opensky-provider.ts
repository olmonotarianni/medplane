import { Aircraft } from '../types';
import { ScannerProvider, ScanResult, ScanAircraft } from './base-provider';
import { logger } from '../logger';
import { GeoUtils } from 'utils';

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
        return new OpenSkyProvider({ username, password });
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

        logger.debug('Making OpenSky API request:');
        logger.debug('URL:', url);
        logger.debug('Auth:', this.auth ? 'Using credentials' : 'No credentials');

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
            logger.debug('OpenSky response status:', response.status, response.statusText);

            if (!response.ok) {
                if (response.status === 401) {
                    logger.error('Authentication failed. Please check your OpenSky credentials.');
                    logger.error('Note: OpenSky API requires a registered account.');
                    logger.error('Register at: https://opensky-network.org/apidoc/');
                    // Log the actual auth header being sent (with password obscured)
                    if (this.auth) {
                        const authHeader = `Basic ${Buffer.from(`${this.auth.username}:****`).toString('base64')}`;
                        logger.error('Auth header being sent:', authHeader);
                    }
                }
                throw new Error(`OpenSky API error: ${response.status} ${response.statusText}`);
            }

            const data = await response.json() as OpenSkyResponse;
            logger.debug('OpenSky data received:', {
                time: data.time,
                numStates: data.states?.length || 0
            });

            if (!data.states) {
                return {
                    aircraft: [],
                    timestamp: data.time
                };
            }
            const aircraft: ScanAircraft[] = data.states
                .map((state): ScanAircraft | null => {
                    // OpenSky: [5]=longitude, [6]=latitude
                    if (!state[6] || !state[5]) return null; // Skip if no position
                    return {
                        icao: state[0],
                        callsign: state[1]?.trim() || '',
                        latitude: state[6],
                        longitude: state[5],
                        timestamp: state[4],
                        altitude: state[7],
                        speed: state[9],
                        heading: state[10],
                        verticalRate: state[11],
                        distanceToCoast: GeoUtils.minDistanceToCoastline({ latitude: state[6], longitude: state[5] }) || 0
                    };
                })
                .filter((aircraft): aircraft is ScanAircraft => aircraft !== null)
                .filter(ac =>
                    ac.latitude >= bounds.minLat &&
                    ac.latitude <= bounds.maxLat &&
                    ac.longitude >= bounds.minLon &&
                    ac.longitude <= bounds.maxLon
                );
            return {
                aircraft,
                timestamp: data.time
            };
        } catch (error) {
            logger.error('Failed to fetch aircraft from OpenSky:', error);
            return {
                aircraft: [],
                timestamp: Date.now() / 1000 // fallback to current time in seconds
            };
        }
    }
}
