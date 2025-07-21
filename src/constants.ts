// Server configuration
export const SERVER_PORT = 3872;

// OpenSky Network credentials
export const OPENSKY_USERNAME = '';
export const OPENSKY_PASSWORD = '';

// Test positions for coast distance calculations
export const TEST_POSITIONS = [
    {
        name: "Test Point 0 (Should be sea)",
        position: { latitude: 0, longitude: 0 }
    },
    {
        name: "Test Point 1 (Should be sea)",
        position: { latitude: 36.0652, longitude: 11.4255 }
    },
    {
        name: "Test Point 2 (Should be Malta)",
        position: { latitude: 35.8476, longitude: 14.4958 }
    },
    {
        name: "Test Point 3 (Should be sea)",
        position: { latitude: 37.4600, longitude: 10.1300 }
    }
] as const;
