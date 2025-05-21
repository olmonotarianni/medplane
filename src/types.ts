// Common types used across the application
export interface Position {
    latitude: number;
    longitude: number;
    timestamp?: number;
}

// Extended position with attitude data
export interface ExtendedPosition extends Position {
    altitude?: number;
    speed?: number;
    heading?: number;
    verticalRate?: number;
}

export interface Aircraft {
    icao: string;
    callsign: string | null;
    position: Position;
    altitude: number;
    speed: number;
    heading: number;
    verticalRate: number;
    lastUpdate: number;
    is_loitering: boolean;
    loitering_debug?: {
        reason: string;
        segments?: { start: Position; end: Position; }[];
        position?: Position;
    };
    is_monitored: boolean;
    not_monitored_reason: string | null;
    track: ExtendedPosition[];
}

// Loitering events for post-mortem analysis
export interface LoiteringEvent {
    id: string;         // Unique ID for the event
    icao: string;       // Aircraft ICAO
    callsign: string | null;
    firstDetected: number;  // Timestamp of first detection
    lastUpdated: number;    // Timestamp of last update
    detectionCount: number; // Number of times detected loitering
    intersectionPoints: Array<{
        segments?: { start: Position, end: Position }[];
        timestamp: number;
    }>;
    // Aircraft state at time of detection
    aircraftState: {
        altitude: number;
        speed: number;
        heading: number;
        verticalRate: number;
        position: Position;
    };
    // Complete track at time of detection
    track: ExtendedPosition[];
}

// Storage interface for loitering events
export interface LoiteringStorage {
    getEvent(id: string): LoiteringEvent | null;
    getEventByIcao(icao: string): LoiteringEvent | null;
    saveEvent(event: LoiteringEvent): void;
    listEvents(): LoiteringEvent[];
    deleteEvent(id: string): boolean;
}

// GeoJSON types
export type Coordinate = [number, number];  // [longitude, latitude]
export type LineStringCoordinates = Coordinate[];
export type MultiLineStringCoordinates = LineStringCoordinates[];
export type PolygonCoordinates = LineStringCoordinates[];  // First array is outer ring, rest are holes
export type MultiPolygonCoordinates = PolygonCoordinates[];

export interface GeoJSONGeometryBase<T extends string, C> {
    type: T;
    coordinates: C;
}

export type GeoJSONGeometry =
    | GeoJSONGeometryBase<"LineString", LineStringCoordinates>
    | GeoJSONGeometryBase<"MultiLineString", MultiLineStringCoordinates>
    | GeoJSONGeometryBase<"Polygon", PolygonCoordinates>
    | GeoJSONGeometryBase<"MultiPolygon", MultiPolygonCoordinates>;

export interface GeoJSONFeature {
    type: "Feature";
    geometry: GeoJSONGeometry | null;  // Allow null geometry for features that might not have geometry
    properties: Record<string, any>;  // Made required since our data always has properties
}

export interface GeoJSONData {
    type: "FeatureCollection";
    features: GeoJSONFeature[];
}

// Monitoring area configuration
export interface MonitoringArea {
    minLat: number;
    maxLat: number;
    minLon: number;
    maxLon: number;
}

export interface MonitoringThresholds {
    altitude: {
        min: number;
        max: number;
    };
    speed: {
        min: number;
        max: number;
    };
    coast: {
        minDistance: number;
    };
    loitering: {
        maxRadius: number;
        minDuration: number;
    };
}
