// Sicily Channel monitoring area bounds
export const SICILY_CHANNEL_BOUNDS = {
    minLat: 32.2429767,
    maxLat: 36.5500941,
    minLon: 10.0583451,
    maxLon: 16.9922709
} as const;

// Central Mediterranean monitoring area bounds
export const CENTRAL_MED_POLYGON = [
  [34.09, 10.014],
  [33.606, 10.457],
  [33.914, 10.772],
  [33.855, 11.077],
  [33.298, 11.264],
  [32.806, 12.595],
  [32.954, 13.326],
  [32.417, 15.238],
  [31.623, 15.523],
  [31.35, 15.849],
  [31.172, 17.09],
  [30.791, 18.233],
  [30.313, 18.979],
  [30.515, 19.76],
  [31.095, 20.156],
  [31.916, 19.747],
  [32.642, 20.609],
  [32.976, 21.7],
  [35.838, 19.775],
  [35.828, 14.549],
  [35.487, 12.606],
  [35.609, 11.046],
  [35.106, 11.126]
] as const;

// for fast initial filtering and API calls
export const CENTRAL_MED_BOUNDS = {
  minLat: 30.313,
  maxLat: 35.838,
  minLon: 10.014,
  maxLon: 21.7
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
