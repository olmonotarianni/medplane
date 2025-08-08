// Sicily Channel monitoring area bounds
export const SICILY_CHANNEL_BOUNDS = {
    minLat: 32.2429767,
    maxLat: 36.5500941,
    minLon: 10.0583451,
    maxLon: 16.9922709
} as const;

// Aircraft monitoring thresholds
export const MONITORING_THRESHOLDS = {
    // Altitude in feet
    altitude: {
        min: 100,
        max: 25000
    },
    // Speed in knots
    speed: {
        min: 50,
        max: 300
    },
    // Minimum distance from coast in km
    coast: {
        minDistance: 8
    }
} as const;
