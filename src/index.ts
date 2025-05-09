import { AircraftScanner } from './scanner';
import { ScanConfig, MonitoringPoint, Position } from './types';
import { WebServer } from './server';
import { MapVisualizer } from './map-visualizer';
import { OpenSkyProvider } from './providers/opensky-provider';

// Server configuration
export const SERVER_PORT = 3872;

// OpenSky Network credentials
export const OPENSKY_USERNAME = '';
export const OPENSKY_PASSWORD = '';

// Define the center point for the Sicily Channel
const SICILY_CHANNEL_CENTER: Position = {
    latitude: 35.0,
    longitude: 13.0
};

// Define monitoring points in the Sicily Channel
const MONITORING_POINTS: MonitoringPoint[] = [
    {
        position: { latitude: 35.5, longitude: 12.5 },
        radiusKm: 250,
        name: "North Point",
        minHeadingChange: 30,
        minTimeWindow: 300000
    },
    {
        position: { latitude: 34.5, longitude: 13.5 },
        radiusKm: 250,
        name: "South Point",
        minHeadingChange: 30,
        minTimeWindow: 300000
    }
];

// Configure the scanner
const config: ScanConfig = {
    centerPoint: SICILY_CHANNEL_CENTER,
    scanRadius: 400,
    updateIntervalMs: 60000
};

// Initialize components
// const provider = new OpenSkyCompressedProvider('5f127ae0-2670-4a7d-9b0d-bef49426cef5');
const provider = new OpenSkyProvider();

// Check if we're in test mode
if (process.argv.includes('--test-airdata-provider')) {
    console.log('Running in test mode - fetching aircraft data...');

    // Calculate bounds based on center point and radius
    const bounds = {
        minLat: SICILY_CHANNEL_CENTER.latitude - (config.scanRadius / 111.32), // Convert km to degrees
        maxLat: SICILY_CHANNEL_CENTER.latitude + (config.scanRadius / 111.32),
        minLon: SICILY_CHANNEL_CENTER.longitude - (config.scanRadius / (111.32 * Math.cos(SICILY_CHANNEL_CENTER.latitude * Math.PI / 180))),
        maxLon: SICILY_CHANNEL_CENTER.longitude + (config.scanRadius / (111.32 * Math.cos(SICILY_CHANNEL_CENTER.latitude * Math.PI / 180)))
    };

    // Fetch and display aircraft data
    provider.scan(bounds)
        .then(result => {
            console.log('\nAircraft Data:');
            console.log('Timestamp:', new Date(result.timestamp * 1000).toISOString());
            console.log('Number of aircraft:', result.aircraft.length);
            console.log('\nAircraft Details:');
            result.aircraft.forEach(aircraft => {
                console.log('\n---');
                console.log('ICAO:', aircraft.icao);
                console.log('Callsign:', aircraft.callsign || 'unknown');
                console.log('Position:', aircraft.position.latitude.toFixed(4), aircraft.position.longitude.toFixed(4));
                console.log('Altitude:', aircraft.altitude, 'ft');
                console.log('Speed:', aircraft.speed, 'kts');
                console.log('Heading:', aircraft.heading, '°');
                console.log('Vertical Rate:', aircraft.verticalRate, 'ft/min');
                console.log('Last Update:', new Date(aircraft.lastUpdate * 1000).toISOString());
            });
        })
        .catch(error => {
            console.error('Error fetching aircraft data:', error);
        });
} else {
    // Normal operation
    const scanner = new AircraftScanner(config, MONITORING_POINTS, provider);
    const mapVisualizer = new MapVisualizer();
    const server = new WebServer();

    // Set up server components
    server.setScanner(scanner);
    server.setMapVisualizer(mapVisualizer);

    console.log('Starting AircraftScanner...');
    scanner.start();
    console.log('AircraftScanner started.');

    // Start the server
    server.start(SERVER_PORT);

    // Log interesting aircraft detections
    scanner.on('interestingAircraft', (aircraft) => {
        console.log('Interesting aircraft detected:');
        console.log(`ICAO: ${aircraft.icao}`);
        console.log(`Callsign: ${aircraft.callsign || 'unknown'}`);
        console.log(`Position: ${aircraft.position.latitude}, ${aircraft.position.longitude}`);
        console.log(`Altitude: ${aircraft.altitude}ft, Speed: ${aircraft.speed}kts`);
        console.log('---');
    });
}
