// Common types used across the application
export interface Position {
    latitude: number;
    longitude: number;
    timestamp?: number;
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
        segments: { start: Position, end: Position }[];
    };
    is_monitored: boolean;
    not_monitored_reason: string | null;
    track: Position[];
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
