import { Aircraft, OpenSkyResponse } from '../types';
import { ScannerProvider, ScanResult } from './base-provider';

export interface OpenSkyAuth {
    username: string;
    password: string;
}

export class OpenSkyProvider implements ScannerProvider {
    private readonly auth?: OpenSkyAuth;

    constructor(auth?: OpenSkyAuth) {
        this.auth = auth;
    }

    async scan(bounds: {
        minLat: number;
        maxLat: number;
        minLon: number;
        maxLon: number;
    }): Promise<ScanResult> {
        const auth = this.auth ? Buffer.from(`${this.auth.username}:${this.auth.password}`).toString('base64') : undefined;
        const response = await fetch(
            `https://opensky-network.org/api/states/all?lamin=${bounds.minLat}&lomin=${bounds.minLon}&lamax=${bounds.maxLat}&lomax=${bounds.maxLon}`,
            {
                headers: auth ? {
                    'Authorization': `Basic ${auth}`
                } : undefined
            }
        );

        const data = await response.json() as OpenSkyResponse;

        if (!data.states) {
            return {
                aircraft: [],
                timestamp: data.time
            };
        }

        const aircraft: Aircraft[] = data.states
            .map((state): Aircraft | null => {
                if (!state[6] || !state[5]) return null; // Skip if no position

                return {
                    icao: state[0],
                    callsign: state[1]?.trim() || undefined,
                    position: {
                        latitude: state[6],
                        longitude: state[5]
                    },
                    altitude: state[7],
                    speed: state[9],
                    heading: state[10],
                    verticalRate: state[11],
                    lastUpdate: state[4]
                };
            })
            .filter((aircraft): aircraft is Aircraft => aircraft !== null);

        return {
            aircraft,
            timestamp: data.time
        };
    }
}
