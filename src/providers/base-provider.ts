import { Aircraft } from '../types';

export interface ScanResult {
    aircraft: Aircraft[];
    timestamp: number;
}

export interface ScannerProvider {
    /**
     * Scan for aircraft in the given area
     * @param bounds The geographical bounds to scan
     * @returns Promise with the scan results
     */
    scan(bounds: {
        minLat: number;
        maxLat: number;
        minLon: number;
        maxLon: number;
    }): Promise<ScanResult>;
}
