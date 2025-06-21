import { Aircraft, Position } from '../types';
import { ScannerProvider, ScanResult, ScanAircraft } from './base-provider';
import { logger } from '../logger';

// Internal types for adsb.fi API response
interface AdsbFiAircraft {
    hex: string;
    flight?: string;
    lat?: number;
    lon?: number;
    alt_baro?: number | 'ground';
    gs?: number;
    track?: number;
    baro_rate?: number;
    squawk?: string;
    emergency?: string;
    category?: string;
    nav_qnh?: number;
    nav_altitude_mcp?: number;
    seen?: number;
    rssi?: number;
    type?: string;
    r?: string;  // registration
    t?: string;  // aircraft type
    desc?: string;
}

interface AdsbFiResponse {
    now: number;
    aircraft: AdsbFiAircraft[];
    resultCount: number;
    ptime: number;
}

export class AdsbFiProvider implements ScannerProvider {
    private static readonly API_URL = 'https://opendata.adsb.fi/api/v2';
    private static readonly MAX_DISTANCE_NM = 250; // Maximum allowed distance in nautical miles
    private static readonly MIN_REQUEST_INTERVAL_MS = 1000; // Minimum 1 second between requests

    private lastRequestTime: number = 0;

    async scan(bounds: {
        minLat: number;
        maxLat: number;
        minLon: number;
        maxLon: number;
    }): Promise<ScanResult> {
        // Enforce rate limiting
        const now = Date.now();
        const timeSinceLastRequest = now - this.lastRequestTime;
        if (timeSinceLastRequest < AdsbFiProvider.MIN_REQUEST_INTERVAL_MS) {
            const waitTime = AdsbFiProvider.MIN_REQUEST_INTERVAL_MS - timeSinceLastRequest;
            logger.debug(`Rate limiting: waiting ${waitTime}ms before next request`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
        }
        this.lastRequestTime = Date.now();

        // Calculate center point of the bounding box
        const centerLat = (bounds.minLat + bounds.maxLat) / 2;
        const centerLon = (bounds.minLon + bounds.maxLon) / 2;

        // Calculate distance in nautical miles (approximate)
        const latDiff = bounds.maxLat - bounds.minLat;
        const lonDiff = bounds.maxLon - bounds.minLon;
        const distanceNM = Math.sqrt(latDiff * latDiff + lonDiff * lonDiff) * 60; // 1 degree ≈ 60 nautical miles

        // Ensure we don't exceed the API's maximum distance
        const requestDistanceNM = Math.min(distanceNM, AdsbFiProvider.MAX_DISTANCE_NM);

        logger.debug('Making adsb.fi API request:');
        logger.debug(`Center: ${centerLat}, ${centerLon}, Distance: ${requestDistanceNM} NM`);

        try {
            const url = `${AdsbFiProvider.API_URL}/lat/${centerLat}/lon/${centerLon}/dist/${requestDistanceNM}`;
            const response = await fetch(url);

            if (!response.ok) {
                throw new Error(`adsb.fi API error: ${response.status} ${response.statusText}`);
            }

            const data = await response.json() as AdsbFiResponse;

            // Use the 'now' field from the API response as the timestamp
            const snapshotTimestamp = Math.floor(data.now);

            // Convert adsb.fi aircraft format to ScanAircraft (snapshot, no history)
            const aircraft: ScanAircraft[] = data.aircraft
                .filter(a => a.lat !== undefined && a.lon !== undefined)
                .map(a => {
                    const seenPos = typeof a.seen === 'number' ? a.seen : undefined;
                    const positionTimestamp = seenPos !== undefined ? snapshotTimestamp - seenPos : snapshotTimestamp;
                    return {
                        icao: a.hex,
                        callsign: a.flight?.trim() || '',
                        latitude: a.lat!,
                        longitude: a.lon!,
                        timestamp: positionTimestamp,
                        altitude: typeof a.alt_baro === 'number' ? a.alt_baro : 0,
                        speed: a.gs || 0,
                        heading: a.track || 0,
                        verticalRate: a.baro_rate || 0
                    };
                })
                .filter(ac =>
                    ac.latitude >= bounds.minLat &&
                    ac.latitude <= bounds.maxLat &&
                    ac.longitude >= bounds.minLon &&
                    ac.longitude <= bounds.maxLon
                );

            return {
                timestamp: snapshotTimestamp,
                aircraft
            };
        } catch (error) {
            logger.error('Error fetching data from adsb.fi:', error);
            throw error;
        }
    }

    static fromEnv(): AdsbFiProvider {
        return new AdsbFiProvider();
    }
}
