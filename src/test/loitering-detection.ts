import { Aircraft } from '../types';
import { AircraftAnalyzer } from '../tracking/aircraft-analyzer';
import { areIntersecting, Segment } from '../utils';

function testIntersection() {
    const tests: { name: string, s1: Segment, s2: Segment, expected: boolean }[] = [
        {
            name: "Simple intersection",
            s1: { start: { latitude: 0, longitude: 0 }, end: { latitude: 1, longitude: 1 } },
            s2: { start: { latitude: 0, longitude: 1 }, end: { latitude: 1, longitude: 0 } },
            expected: true
        },
        {
            name: "No intersection - parallel",
            s1: { start: { latitude: 0, longitude: 0 }, end: { latitude: 1, longitude: 1 } },
            s2: { start: { latitude: 0, longitude: 1 }, end: { latitude: 1, longitude: 2 } },
            expected: false
        },
        {
            name: "No intersection - disjoint",
            s1: { start: { latitude: 0, longitude: 0 }, end: { latitude: 1, longitude: 1 } },
            s2: { start: { latitude: 2, longitude: 2 }, end: { latitude: 3, longitude: 3 } },
            expected: false
        },
        {
            name: "No intersection - shared endpoint",
            s1: { start: { latitude: 0, longitude: 0 }, end: { latitude: 1, longitude: 1 } },
            s2: { start: { latitude: 1, longitude: 1 }, end: { latitude: 2, longitude: 0 } },
            expected: false
        },
        {
            name: "Intersection - overlapping colinear",
            s1: { start: { latitude: 0, longitude: 0 }, end: { latitude: 2, longitude: 2 } },
            s2: { start: { latitude: 1, longitude: 1 }, end: { latitude: 3, longitude: 3 } },
            expected: true
        },
        {
            name: "No intersection - endpoint touching middle",
            s1: { start: { latitude: 0, longitude: 0 }, end: { latitude: 2, longitude: 0 } },
            s2: { start: { latitude: 1, longitude: 0 }, end: { latitude: 1, longitude: 1 } },
            expected: false
        }
    ];

    let allPassed = true;
    console.log('\nTesting intersection detection:');
    for (const test of tests) {
        const result = areIntersecting(test.s1, test.s2);
        const passed = result === test.expected;
        allPassed = allPassed && passed;
        console.log(`  ${test.name}: ${passed ? 'PASSED' : 'FAILED'}`);
        if (!passed) {
            console.log(`    Expected: ${test.expected}, Got: ${result}`);
        }
    }
    console.log(`\nIntersection tests: ${allPassed ? 'PASSED' : 'FAILED'}\n`);
    return allPassed;
}

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

    // Generate points for a figure-8 pattern, ensuring we hit the intersection points
    // We'll generate points more densely around the center where the path crosses itself
    for (let t = 0; t <= 4 * Math.PI; t += Math.PI / 64) { // Doubled the sampling rate
        const lat = centerLat + size * Math.sin(t);
        const lon = centerLon + size * Math.sin(2 * t);
        points.push({ lat, lon });

        // Add extra points near the crossing point
        if (Math.abs(t - Math.PI) < 0.1 || Math.abs(t - 2 * Math.PI) < 0.1) {
            // Add points just before and after the crossing
            const delta = 0.01;
            const lat1 = centerLat + size * Math.sin(t - delta);
            const lon1 = centerLon + size * Math.sin(2 * (t - delta));
            const lat2 = centerLat + size * Math.sin(t + delta);
            const lon2 = centerLon + size * Math.sin(2 * (t + delta));
            points.push({ lat: lat1, lon: lon1 });
            points.push({ lat: lat2, lon: lon2 });
        }
    }

    return points;
}

function generateCircularPath(): { lat: number, lon: number }[] {
    const points: { lat: number, lon: number }[] = [];
    const centerLat = 35;
    const centerLon = 12;
    const radius = 0.05; // Size of the circle in degrees (about 5km)

    // Generate points for multiple circles, ensuring we detect the loop
    // We'll add extra points near the start/end to ensure we detect the loop closure
    for (let t = 0; t <= 4 * Math.PI; t += Math.PI / 64) { // Doubled the sampling rate
        const lat = centerLat + radius * Math.cos(t);
        const lon = centerLon + radius * Math.sin(t);
        points.push({ lat, lon });

        // Add extra points near the loop closure points
        if (Math.abs(t - 2 * Math.PI) < 0.1 || Math.abs(t - 4 * Math.PI) < 0.1) {
            // Add points just before and after the loop closure
            const delta = 0.01;
            const lat1 = centerLat + radius * Math.cos(t - delta);
            const lon1 = centerLon + radius * Math.sin(t - delta);
            const lat2 = centerLat + radius * Math.cos(t + delta);
            const lon2 = centerLon + radius * Math.sin(t + delta);
            points.push({ lat: lat1, lon: lon1 });
            points.push({ lat: lat2, lon: lon2 });
        }
    }

    // Add the exact starting point again at the end to ensure loop closure
    points.push({
        lat: centerLat + radius * Math.cos(0),
        lon: centerLon + radius * Math.sin(0)
    });

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

function testSpecialAircraft() {
    const aircraft: Aircraft = {
        "icao": "45b103",
        "callsign": "DTR85M",
        "position": {
            "latitude": 35.490309,
            "longitude": 12.280611
        },
        "altitude": 5525,
        "speed": 220.8,
        "heading": 167.98,
        "verticalRate": -704,
        "lastUpdate": 1746969093.904,
        "is_loitering": false,
        "is_monitored": true,
        "not_monitored_reason": null,
        "track": [
            { "latitude": 36.076309, "longitude": 12.595997 },
            { "latitude": 36.064438, "longitude": 12.591325 },
            { "latitude": 36.053079, "longitude": 12.586884 },
            { "latitude": 36.041953, "longitude": 12.582501 },
            { "latitude": 36.030361, "longitude": 12.577943 },
            { "latitude": 36.019003, "longitude": 12.573502 },
            { "latitude": 36.007736, "longitude": 12.569103 },
            { "latitude": 35.996384, "longitude": 12.564697 },
            { "latitude": 35.984985, "longitude": 12.560234 },
            { "latitude": 35.973288, "longitude": 12.555678 },
            { "latitude": 35.962116, "longitude": 12.551354 },
            { "latitude": 35.953736, "longitude": 12.548081 },
            { "latitude": 35.939346, "longitude": 12.542439 },
            { "latitude": 35.928412, "longitude": 12.538205 },
            { "latitude": 35.916595, "longitude": 12.533569 },
            { "latitude": 35.907044, "longitude": 12.529849 },
            { "latitude": 35.895593, "longitude": 12.525408 },
            { "latitude": 35.883591, "longitude": 12.520752 },
            { "latitude": 35.873853, "longitude": 12.516934 },
            { "latitude": 35.862579, "longitude": 12.512512 },
            { "latitude": 35.857635, "longitude": 12.510624 },
            { "latitude": 35.846054, "longitude": 12.506104 },
            { "latitude": 35.827744, "longitude": 12.498951 },
            { "latitude": 35.827744, "longitude": 12.498951 },
            { "latitude": 35.81003, "longitude": 12.491981 },
            { "latitude": 35.81003, "longitude": 12.491981 },
            { "latitude": 35.81003, "longitude": 12.491981 },
            { "latitude": 35.81003, "longitude": 12.491981 },
            { "latitude": 35.81003, "longitude": 12.491981 },
            { "latitude": 35.81003, "longitude": 12.491981 },
            { "latitude": 35.671555, "longitude": 12.375927 },
            { "latitude": 35.671555, "longitude": 12.375927 },
            { "latitude": 35.671555, "longitude": 12.375927 },
            { "latitude": 35.671555, "longitude": 12.375927 },
            { "latitude": 35.671555, "longitude": 12.375927 },
            { "latitude": 35.671555, "longitude": 12.375927 },
            { "latitude": 35.610947, "longitude": 12.322025 },
            { "latitude": 35.610947, "longitude": 12.322025 },
            { "latitude": 35.610947, "longitude": 12.322025 },
            { "latitude": 35.610947, "longitude": 12.322025 },
            { "latitude": 35.610947, "longitude": 12.322025 },
            { "latitude": 35.610947, "longitude": 12.322025 },
            { "latitude": 35.610947, "longitude": 12.322025 },
            { "latitude": 35.502869, "longitude": 12.277393 },
            { "latitude": 35.490309, "longitude": 12.280611 },
            { "latitude": 35.490309, "longitude": 12.280611 },
            { "latitude": 35.490309, "longitude": 12.280611 },
            { "latitude": 35.490309, "longitude": 12.280611 },
            { "latitude": 35.490309, "longitude": 12.280611 },
            { "latitude": 35.490309, "longitude": 12.280611 }
        ]
    }

    const analyzer = new AircraftAnalyzer();
    const result = analyzer.analyzeAircraft(aircraft);
    if (result) {
        console.log('Test special aircraft: FAILED');
        console.log('  loitering_debug:', JSON.stringify(aircraft.loitering_debug, null, 2));
    } else {
        console.log('Test special aircraft: PASSED');
    }
    return !result;
}

function testPath(analyzer: AircraftAnalyzer, points: { lat: number, lon: number }[], expectedLoitering: boolean): boolean {
    const aircraft = createTestAircraft('TEST1', Date.now() / 1000);
    let loiteringDetected = false;
    const baseTime = Date.now() / 1000;

    // Feed points into the analyzer
    points.forEach((point, index) => {
        const position = { latitude: point.lat, longitude: point.lon };
        aircraft.position = position;
        aircraft.track.push(position);
        aircraft.lastUpdate = baseTime + (index * 30); // 30 seconds between points

        if (analyzer.analyzeAircraft(aircraft)) {
            loiteringDetected = true;
        }
    });

    const result = loiteringDetected === expectedLoitering;
    if (!result && aircraft.loitering_debug) {
        console.log('  loitering_debug:', JSON.stringify(aircraft.loitering_debug, null, 2));
    }
    return result;
}

function testNonLoiteringStraightAircraft() {
    // Use a straight path that should not be detected as loitering
    const straightPoints = generateStraightPath();
    const aircraft: Aircraft = {
        icao: "STRAIGHT1",
        callsign: "STRAIGHT1",
        position: { latitude: straightPoints[straightPoints.length - 1].lat, longitude: straightPoints[straightPoints.length - 1].lon },
        altitude: 10000,
        speed: 200,
        heading: 90,
        verticalRate: 0,
        lastUpdate: Date.now() / 1000,
        is_monitored: true,
        is_loitering: false,
        not_monitored_reason: null,
        track: straightPoints.map(pt => ({ latitude: pt.lat, longitude: pt.lon }))
    };
    const analyzer = new AircraftAnalyzer();
    const result = analyzer.analyzeAircraft(aircraft);
    console.log(`Test non-loitering straight aircraft: ${!result ? 'PASSED' : 'FAILED'}`);
    return !result;
}

export function runLoiteringTests(): void {
    console.log('Running loitering detection tests...\n');
    let allTestsPassed = true;

    console.log('Testing intersection utility:');
    allTestsPassed = testIntersection() && allTestsPassed;

    const analyzer = new AircraftAnalyzer();

    console.log('Testing figure-8 pattern:');
    const fig8Passed = testPath(analyzer, generateFigureEightPath(), true);
    console.log(`Test figure-8 pattern: ${fig8Passed ? 'PASSED' : 'FAILED'}`);
    allTestsPassed = fig8Passed && allTestsPassed;

    console.log('\nTesting circular pattern:');
    const circPassed = testPath(analyzer, generateCircularPath(), true);
    console.log(`Test circular pattern: ${circPassed ? 'PASSED' : 'FAILED'}`);
    allTestsPassed = circPassed && allTestsPassed;

    console.log('\nTesting straight path:');
    const straightPassed = testPath(analyzer, generateStraightPath(), false);
    console.log(`Test straight path: ${straightPassed ? 'PASSED' : 'FAILED'}`);
    allTestsPassed = straightPassed && allTestsPassed;

    console.log('\nTesting special aircraft:');
    allTestsPassed = testSpecialAircraft() && allTestsPassed;

    console.log('\nTesting non-loitering straight aircraft:');
    allTestsPassed = testNonLoiteringStraightAircraft() && allTestsPassed;

    console.log(`\nOverall test result: ${allTestsPassed ? 'PASSED' : 'FAILED'}`);
}
