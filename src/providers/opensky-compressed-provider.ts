import { decompress } from '@mongodb-js/zstd';
import fetch from 'node-fetch';
import { Aircraft } from '../types';
import { ScannerProvider, ScanResult } from './base-provider';

interface OpenSkyState {
    icao24: string;
    callsign?: string;
    origin_country?: string;
    time_position?: number;
    last_contact?: number;
    longitude?: number;
    latitude?: number;
    baro_altitude?: number;
    on_ground?: boolean;
    velocity?: number;
    true_track?: number;
    vertical_rate?: number;
    sensors?: number[];
    geo_altitude?: number;
    squawk?: string;
    spi?: boolean;
    position_source?: number;
}

export class OpenSkyCompressedProvider implements ScannerProvider {
    private readonly baseUrl = 'https://map.opensky-network.org/re-api/';
    private readonly sessionId: string;

    constructor(sessionId: string) {
        this.sessionId = sessionId;
    }

    async scan(bounds: { minLat: number; maxLat: number; minLon: number; maxLon: number }): Promise<ScanResult> {
        try {
            const url = `${this.baseUrl}?binCraft&zstd&box=${bounds.minLat},${bounds.maxLat},${bounds.minLon},${bounds.maxLon}`;
            console.log('Fetching from URL:', url);

            const response = await fetch(url, {
                headers: {
                    'accept': '*/*',
                    'accept-language': 'en-US,en;q=0.9',
                    'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36',
                    'Cookie': `osky_sid=${this.sessionId}`
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            // Get the compressed data as a Buffer
            const compressedBuffer = Buffer.from(await response.arrayBuffer());

            // Decompress the data
            const decompressedBuffer = await decompress(compressedBuffer);

            // Parse the binary data
            const dataView = new DataView(decompressedBuffer.buffer);
            let offset = 0;

            // Read timestamp (8 bytes)
            const timestamp = Number(dataView.getBigInt64(offset, true));
            offset += 8;

            // Read number of states (4 bytes)
            const numStates = dataView.getInt32(offset, true);
            offset += 4;

            const aircraft: Aircraft[] = [];

            // Read each state
            for (let i = 0; i < numStates; i++) {
                // Read ICAO24 (6 bytes string)
                const icao24 = decompressedBuffer.slice(offset, offset + 6).toString('utf-8').trim();
                offset += 6;

                // Read callsign (8 bytes string)
                const callsign = decompressedBuffer.slice(offset, offset + 8).toString('utf-8').trim();
                offset += 8;

                // Read position data (8 bytes each for lat, lon, alt)
                const latitude = dataView.getFloat64(offset, true);
                offset += 8;
                const longitude = dataView.getFloat64(offset, true);
                offset += 8;
                const altitude = dataView.getFloat64(offset, true);
                offset += 8;

                // Read velocity (8 bytes)
                const velocity = dataView.getFloat64(offset, true);
                offset += 8;

                // Read heading (8 bytes)
                const heading = dataView.getFloat64(offset, true);
                offset += 8;

                // Read vertical rate (8 bytes)
                const verticalRate = dataView.getFloat64(offset, true);
                offset += 8;

                // Read last update (8 bytes)
                const lastUpdate = Number(dataView.getBigInt64(offset, true));
                offset += 8;

                // Skip other fields we don't use (position source, etc)
                offset += 4;

                // Only add aircraft with valid positions
                if (latitude !== 0 || longitude !== 0) {
                    aircraft.push({
                        icao: icao24,
                        callsign: callsign || null,
                        position: {
                            latitude,
                            longitude
                        },
                        altitude,
                        speed: velocity * 1.943844, // Convert m/s to knots
                        heading,
                        verticalRate: verticalRate * 196.85, // Convert m/s to ft/min
                        lastUpdate,
                        is_loitering: false,
                        is_monitored: false,
                        not_monitored_reason: null,
                        track: []
                    });
                }
            }

            return {
                aircraft,
                timestamp
            };
        } catch (error) {
            if (error instanceof Error) {
                throw new Error(`Failed to fetch aircraft data: ${error.message}`);
            }
            throw error;
        }
    }
}
