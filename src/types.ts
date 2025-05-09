// OpenSky Network API aircraft state
export type AircraftState = [
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

export interface OpenSkyResponse {
    time: number;
    states: AircraftState[];
}

export interface Position {
    latitude: number;
    longitude: number;
}

export interface Aircraft {
    icao: string;
    callsign?: string;
    position: Position;
    altitude: number;
    speed: number;
    heading: number;
    verticalRate: number;
    lastUpdate: number;
    is_loitering?: boolean;  // Indicates if the aircraft is exhibiting interesting behavior patterns
    is_monitored?: boolean;  // Indicates if the aircraft is in the Sicily Channel and meets monitoring criteria
    not_monitored_reason?: string; // Human-readable explanation for why not monitored
}

export interface ScanConfig {
    centerPoint: Position;
    scanRadius: number;
    updateIntervalMs: number;
}

export interface MonitoringPoint {
    position: Position;
    radiusKm: number;
    name: string;
    minHeadingChange?: number; // Minimum heading change in degrees to trigger alert
    minTimeWindow?: number;    // Time window in seconds to consider for heading changes
}
