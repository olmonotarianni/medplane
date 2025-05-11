import { Aircraft } from '../types';
import { AircraftAnalyzer } from '../tracking/aircraft-analyzer';

function createTestAircraft(icao: string, timestamp: number): Aircraft {
    return {
        icao,
        callsign: `TEST${icao}`,
        position: { latitude: 35, longitude: 12 },
        altitude: 10000,
        speed: 200,
        heading: 90,
        verticalRate: 0,
        track: [],
        lastUpdate: timestamp,
        is_monitored: true,
        is_loitering: false,
        not_monitored_reason: null
    };
}

function generateFigureEightPath(): { lat: number, lon: number }[] {
    const points: { lat: number, lon: number }[] = [];
    const centerLat = 35;
    const centerLon = 12;
    const size = 0.05; // Size of the figure-8 in degrees (about 5km)

    // Generate points for a figure-8 pattern with more points
    for (let t = 0; t <= 4 * Math.PI; t += Math.PI / 32) { // Two complete figure-8s
        const lat = centerLat + size * Math.sin(t);
        const lon = centerLon + size * Math.sin(2 * t);
        points.push({ lat, lon });
    }

    return points;
}

function generateCircularPath(): { lat: number, lon: number }[] {
    const points: { lat: number, lon: number }[] = [];
    const centerLat = 35;
    const centerLon = 12;
    const radius = 0.05; // Size of the circle in degrees (about 5km)

    // Generate points for multiple circles
    for (let t = 0; t <= 4 * Math.PI; t += Math.PI / 32) { // Two complete circles
        const lat = centerLat + radius * Math.cos(t);
        const lon = centerLon + radius * Math.sin(t);
        points.push({ lat, lon });
    }

    return points;
}

function generateStraightPath(): { lat: number, lon: number }[] {
    const points: { lat: number, lon: number }[] = [];
    const startLat = 34.5;
    const startLon = 11.5;

    // Generate points for a straight line with more separation
    for (let i = 0; i < 20; i++) {
        points.push({
            lat: startLat + i * 0.1,  // 0.1 degrees is about 10km
            lon: startLon + i * 0.05  // Keep longitude change smaller
        });
    }

    return points;
}

function testPath(analyzer: AircraftAnalyzer, points: { lat: number, lon: number }[], expectedLoitering: boolean): boolean {
    const aircraft = createTestAircraft('TEST1', Date.now() / 1000);
    let loiteringDetected = false;
    const baseTime = Date.now() / 1000;

    console.log(`Testing path with ${points.length} points:`);

    // Feed points into the analyzer
    points.forEach((point, index) => {
        const position = { latitude: point.lat, longitude: point.lon };
        aircraft.position = position;
        aircraft.track.push(position);
        aircraft.lastUpdate = baseTime + (index * 30); // 30 seconds between points

        if (index % 5 === 0) { // Log every 5th point
            console.log(`  Point ${index}: lat=${point.lat.toFixed(4)}, lon=${point.lon.toFixed(4)}`);
        }

        if (analyzer.analyzeAircraft(aircraft)) {
            console.log(`  -> Loitering detected at point ${index}`);
            loiteringDetected = true;
        }
    });

    const result = loiteringDetected === expectedLoitering;
    console.log(`\nTest ${result ? 'PASSED' : 'FAILED'}: ${expectedLoitering ? 'Should' : 'Should not'} detect loitering`);
    console.log(`  Expected: ${expectedLoitering}, Got: ${loiteringDetected}\n`);
    return result;
}

export function runLoiteringTests(): void {
    console.log('Running loitering detection tests...\n');
    const analyzer = new AircraftAnalyzer();
    let allTestsPassed = true;

    console.log('Testing figure-8 pattern:');
    allTestsPassed = testPath(analyzer, generateFigureEightPath(), true) && allTestsPassed;

    console.log('\nTesting circular pattern:');
    allTestsPassed = testPath(analyzer, generateCircularPath(), true) && allTestsPassed;

    console.log('\nTesting straight path:');
    allTestsPassed = testPath(analyzer, generateStraightPath(), false) && allTestsPassed;

    console.log(`\nOverall test result: ${allTestsPassed ? 'PASSED' : 'FAILED'}`);
}
