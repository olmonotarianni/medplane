// Sicily Channel monitoring area bounds
export const SICILY_CHANNEL_BOUNDS = {
    minLat: 33,
    maxLat: 38,
    minLon: 10,
    maxLon: 18
} as const;

// Aircraft monitoring thresholds
export const MONITORING_THRESHOLDS = {
    altitude: {
        min: 5000,  // feet
        max: 25000
    },
    speed: {
        min: 100,   // knots
        max: 300
    },
    coast: {
        minDistance: 5 // km from coast
    },
    loitering: {
        maxRadius: 30,        // km
        minDuration: 5 * 60   // seconds (5 minutes)
    }
} as const;
