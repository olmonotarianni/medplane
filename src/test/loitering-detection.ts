import { Aircraft } from '../types';
import { AircraftAnalyzer } from '../tracking/aircraft-analyzer';
import { areIntersecting, Segment } from '../utils';
import { AircraftScanner } from '../scanner';
import { getLoiteringStorage } from '../storage/loitering-storage';
import { ScannerProvider, ScanResult } from '../providers/base-provider';

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

function testSpecialAircraft2() {
    const aircraft: Aircraft = {
        "icao": "48c1a5",
        "callsign": "RYR6321",
        "position": {
            "latitude": 37.490891,
            "longitude": 15.247913
        },
        "altitude": 5875,
        "speed": 253,
        "heading": 81.13,
        "verticalRate": 2176,
        "lastUpdate": 1747151725.981,
        "is_loitering": true,
        "is_monitored": true,
        "not_monitored_reason": null,
        "track": [
            {
                "latitude": 37.454773,
                "longitude": 14.924401,
                "timestamp": 1747148024668
            },
            {
                "latitude": 37.455605,
                "longitude": 14.93448,
                "timestamp": 1747148034685
            },
            {
                "latitude": 37.456329,
                "longitude": 14.942283,
                "timestamp": 1747148044673
            },
            {
                "latitude": 37.457141,
                "longitude": 14.951975,
                "timestamp": 1747148054685
            },
            {
                "latitude": 37.458072,
                "longitude": 14.962364,
                "timestamp": 1747148064645
            },
            {
                "latitude": 37.458724,
                "longitude": 14.970126,
                "timestamp": 1747148074678
            },
            {
                "latitude": 37.459488,
                "longitude": 14.978807,
                "timestamp": 1747148084688
            },
            {
                "latitude": 37.460129,
                "longitude": 14.986462,
                "timestamp": 1747148094678
            },
            {
                "latitude": 37.460861,
                "longitude": 14.995111,
                "timestamp": 1747148104682
            },
            {
                "latitude": 37.461319,
                "longitude": 15.000136,
                "timestamp": 1747148114691
            },
            {
                "latitude": 37.462262,
                "longitude": 15.011325,
                "timestamp": 1747148124725
            },
            {
                "latitude": 37.462448,
                "longitude": 15.013773,
                "timestamp": 1747148134664
            },
            {
                "latitude": 37.463425,
                "longitude": 15.025356,
                "timestamp": 1747148144658
            },
            {
                "latitude": 37.463425,
                "longitude": 15.025356,
                "timestamp": 1747148154708
            },
            {
                "latitude": 37.463425,
                "longitude": 15.025356,
                "timestamp": 1747148164668
            },
            {
                "latitude": 37.463425,
                "longitude": 15.025356,
                "timestamp": 1747148174661
            },
            {
                "latitude": 37.466125,
                "longitude": 15.057581,
                "timestamp": 1747148184670
            },
            {
                "latitude": 37.466125,
                "longitude": 15.057581,
                "timestamp": 1747148194689
            },
            {
                "latitude": 37.466125,
                "longitude": 15.057581,
                "timestamp": 1747148204673
            },
            {
                "latitude": 37.466125,
                "longitude": 15.057581,
                "timestamp": 1747148214740
            },
            {
                "latitude": 37.466125,
                "longitude": 15.057581,
                "timestamp": 1747148224684
            },
            {
                "latitude": 37.466125,
                "longitude": 15.057581,
                "timestamp": 1747148234769
            },
            {
                "latitude": 37.469244,
                "longitude": 15.075302,
                "timestamp": 1747148294723
            },
            {
                "latitude": 37.469244,
                "longitude": 15.075302,
                "timestamp": 1747148304748
            },
            {
                "latitude": 37.469244,
                "longitude": 15.075302,
                "timestamp": 1747148314785
            },
            {
                "latitude": 37.469244,
                "longitude": 15.075302,
                "timestamp": 1747148324750
            },
            {
                "latitude": 37.469244,
                "longitude": 15.075302,
                "timestamp": 1747148334779
            },
            {
                "latitude": 37.469244,
                "longitude": 15.075302,
                "timestamp": 1747148344754
            },
            {
                "latitude": 37.468781,
                "longitude": 15.069765,
                "timestamp": 1747148354766
            },
            {
                "latitude": 37.4687,
                "longitude": 15.068859,
                "timestamp": 1747148364740
            },
            {
                "latitude": 37.4687,
                "longitude": 15.068859,
                "timestamp": 1747148374769
            },
            {
                "latitude": 37.4687,
                "longitude": 15.068859,
                "timestamp": 1747148384788
            },
            {
                "latitude": 37.4687,
                "longitude": 15.068859,
                "timestamp": 1747148394799
            },
            {
                "latitude": 37.4687,
                "longitude": 15.068859,
                "timestamp": 1747148404820
            },
            {
                "latitude": 37.4687,
                "longitude": 15.068859,
                "timestamp": 1747148414812
            },
            {
                "latitude": 37.467773,
                "longitude": 15.077099,
                "timestamp": 1747151585943
            },
            {
                "latitude": 37.469009,
                "longitude": 15.090189,
                "timestamp": 1747151595936
            },
            {
                "latitude": 37.470245,
                "longitude": 15.099831,
                "timestamp": 1747151605942
            },
            {
                "latitude": 37.471665,
                "longitude": 15.109306,
                "timestamp": 1747151615969
            },
            {
                "latitude": 37.473221,
                "longitude": 15.119233,
                "timestamp": 1747151625893
            },
            {
                "latitude": 37.474869,
                "longitude": 15.131037,
                "timestamp": 1747151635947
            },
            {
                "latitude": 37.476471,
                "longitude": 15.142959,
                "timestamp": 1747151645968
            },
            {
                "latitude": 37.478089,
                "longitude": 15.154923,
                "timestamp": 1747151655970
            },
            {
                "latitude": 37.479858,
                "longitude": 15.167522,
                "timestamp": 1747151665934
            },
            {
                "latitude": 37.481598,
                "longitude": 15.180184,
                "timestamp": 1747151675974
            },
            {
                "latitude": 37.483443,
                "longitude": 15.193136,
                "timestamp": 1747151685955
            },
            {
                "latitude": 37.485306,
                "longitude": 15.206714,
                "timestamp": 1747151695932
            },
            {
                "latitude": 37.487167,
                "longitude": 15.220005,
                "timestamp": 1747151705975
            },
            {
                "latitude": 37.489059,
                "longitude": 15.233537,
                "timestamp": 1747151715976
            },
            {
                "latitude": 37.490891,
                "longitude": 15.247913,
                "timestamp": 1747151725981
            }
        ],
        "loitering_debug": {
            "reason": "Path crosses itself",
            "segments": [
                {
                    "start": {
                        "latitude": 37.466125,
                        "longitude": 15.057581,
                        "timestamp": 1747148234769
                    },
                    "end": {
                        "latitude": 37.469244,
                        "longitude": 15.075302,
                        "timestamp": 1747148294723
                    }
                },
                {
                    "start": {
                        "latitude": 37.4687,
                        "longitude": 15.068859,
                        "timestamp": 1747148414812
                    },
                    "end": {
                        "latitude": 37.467773,
                        "longitude": 15.077099,
                        "timestamp": 1747151585943
                    }
                }
            ]
        }
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

function testAltitudeTracking() {
    // Create an aircraft with a simple straight path but varying altitude
    const straightPoints = generateStraightPath().slice(0, 5); // Just use first 5 points
    const aircraft: Aircraft = {
        icao: "ALT001",
        callsign: "ALT001",
        position: { latitude: straightPoints[0].lat, longitude: straightPoints[0].lon },
        altitude: 10000,
        speed: 250,
        heading: 90,
        verticalRate: 500,
        lastUpdate: Date.now() / 1000,
        is_monitored: true,
        is_loitering: false,
        not_monitored_reason: null,
        track: []
    };

    const analyzer = new AircraftAnalyzer();

    console.log('Testing altitude tracking in aircraft path:');

    // Add each point to the track with changing altitude and speed
    straightPoints.forEach((point, i) => {
        // Update aircraft properties with new values
        aircraft.position = { latitude: point.lat, longitude: point.lon };
        aircraft.altitude = 10000 + (i * 500); // Climbing by 500ft each point
        aircraft.speed = 250 - (i * 10);       // Slowing down by 10kts each point
        aircraft.heading = 90 + (i * 2);       // Turning slightly right
        aircraft.verticalRate = 500 + (i * 100); // Increasing climb rate

        // Analyze the aircraft (this will add the point to the track with all attitude data)
        analyzer.analyzeAircraft(aircraft);

        // Print the latest track point with full attitude data
        if (aircraft.track.length > 0) {
            const latest = aircraft.track[aircraft.track.length-1];
            console.log(`Point ${i}: lat=${latest.latitude.toFixed(4)}, lon=${latest.longitude.toFixed(4)}, ` +
                         `alt=${latest.altitude}ft, speed=${latest.speed}kts, heading=${latest.heading}°, vrate=${latest.verticalRate}ft/min`);
        }
    });

    console.log(`Aircraft track contains ${aircraft.track.length} points with full attitude data`);
    return true;
}

// Create a class to test loitering events
class TestEventTracker {
    private scanner: AircraftScanner;
    private storage = getLoiteringStorage();

    constructor() {
        // Create a mock provider that implements the ScannerProvider interface
        const mockProvider: ScannerProvider = {
            scan: async () => ({
                aircraft: [],
                timestamp: Date.now()
            })
        };
        this.scanner = new AircraftScanner(mockProvider);
    }

    // Track an aircraft and see if it creates a loitering event
    trackAircraft(aircraft: Aircraft): boolean {
        // Update the aircraft through the scanner to trigger event creation if needed
        this.scanner.updateAircraft(aircraft);
        return !aircraft.is_loitering;
    }

    // Get the list of events
    getEvents() {
        return this.storage.listEvents();
    }
}

// Modify the runLoiteringTests function to use the TestEventTracker
export function runLoiteringTests(): void {
    console.log('Running loitering detection tests...\n');
    let allTestsPassed = true;

    console.log('Testing intersection utility:');
    allTestsPassed = testIntersection() && allTestsPassed;

    const analyzer = new AircraftAnalyzer();
    // Create a test event tracker for the loitering events
    const eventTracker = new TestEventTracker();

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
    // Use the test event tracker to check the special aircraft
    const specialAircraft = createSpecialAircraftForTest();
    const specialPassed = eventTracker.trackAircraft(specialAircraft);
    console.log(`Test special aircraft: ${specialPassed ? 'PASSED' : 'FAILED'}`);
    if (!specialPassed && specialAircraft.loitering_debug) {
        console.log('  loitering_debug:', JSON.stringify(specialAircraft.loitering_debug, null, 2));
    }
    allTestsPassed = specialPassed && allTestsPassed;

    console.log('\nTesting special aircraft 2:');
    // Use the test event tracker to check the second special aircraft
    const specialAircraft2 = createSpecialAircraft2ForTest();
    const special2Passed = eventTracker.trackAircraft(specialAircraft2);
    console.log(`Test special aircraft: ${special2Passed ? 'PASSED' : 'FAILED'}`);
    if (!special2Passed && specialAircraft2.loitering_debug) {
        console.log('  loitering_debug:', JSON.stringify(specialAircraft2.loitering_debug, null, 2));
    }
    allTestsPassed = special2Passed && allTestsPassed;

    console.log('\nTesting non-loitering straight aircraft:');
    // Use the test event tracker to check the non-loitering straight aircraft
    const straightAircraft = createNonLoiteringStraightAircraft();
    const nonLoiteringPassed = eventTracker.trackAircraft(straightAircraft);
    console.log(`Test non-loitering straight aircraft: ${nonLoiteringPassed ? 'PASSED' : 'FAILED'}`);
    allTestsPassed = nonLoiteringPassed && allTestsPassed;

    console.log('\nTesting altitude tracking:');
    allTestsPassed = testAltitudeTracking() && allTestsPassed;

    // Check and display any created loitering events
    const events = eventTracker.getEvents();
    console.log(`\nLoitering events created: ${events.length}`);
    events.forEach(event => {
        console.log(`- ${event.id}: ICAO ${event.icao}, Callsign ${event.callsign || 'Unknown'}, Detections: ${event.detectionCount}`);
    });

    console.log(`\nOverall test result: ${allTestsPassed ? 'PASSED' : 'FAILED'}`);
}

// Helper functions to create test aircraft instances
function createSpecialAircraftForTest(): Aircraft {
    return {
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
    };
}

function createSpecialAircraft2ForTest(): Aircraft {
    return {
        "icao": "48c1a5",
        "callsign": "RYR6321",
        "position": {
            "latitude": 37.490891,
            "longitude": 15.247913
        },
        "altitude": 5875,
        "speed": 253,
        "heading": 81.13,
        "verticalRate": 2176,
        "lastUpdate": 1747151725.981,
        "is_loitering": false,
        "is_monitored": true,
        "not_monitored_reason": null,
        "track": [
            { "latitude": 37.454773, "longitude": 14.924401, "timestamp": 1747148024668 },
            { "latitude": 37.455605, "longitude": 14.93448, "timestamp": 1747148034685 },
            { "latitude": 37.456329, "longitude": 14.942283, "timestamp": 1747148044673 },
            { "latitude": 37.457141, "longitude": 14.951975, "timestamp": 1747148054685 },
            { "latitude": 37.458072, "longitude": 14.962364, "timestamp": 1747148064645 },
            { "latitude": 37.458724, "longitude": 14.970126, "timestamp": 1747148074678 },
            { "latitude": 37.459488, "longitude": 14.978807, "timestamp": 1747148084688 },
            { "latitude": 37.460129, "longitude": 14.986462, "timestamp": 1747148094678 },
            { "latitude": 37.460861, "longitude": 14.995111, "timestamp": 1747148104682 },
            { "latitude": 37.461319, "longitude": 15.000136, "timestamp": 1747148114691 },
            { "latitude": 37.462262, "longitude": 15.011325, "timestamp": 1747148124725 },
            { "latitude": 37.462448, "longitude": 15.013773, "timestamp": 1747148134664 },
            { "latitude": 37.463425, "longitude": 15.025356, "timestamp": 1747148144658 },
            { "latitude": 37.463425, "longitude": 15.025356, "timestamp": 1747148154708 },
            { "latitude": 37.463425, "longitude": 15.025356, "timestamp": 1747148164668 },
            { "latitude": 37.463425, "longitude": 15.025356, "timestamp": 1747148174661 },
            { "latitude": 37.466125, "longitude": 15.057581, "timestamp": 1747148184670 },
            { "latitude": 37.466125, "longitude": 15.057581, "timestamp": 1747148194689 },
            { "latitude": 37.466125, "longitude": 15.057581, "timestamp": 1747148204673 },
            { "latitude": 37.466125, "longitude": 15.057581, "timestamp": 1747148214740 },
            { "latitude": 37.466125, "longitude": 15.057581, "timestamp": 1747148224684 },
            { "latitude": 37.466125, "longitude": 15.057581, "timestamp": 1747148234769 },
            { "latitude": 37.469244, "longitude": 15.075302, "timestamp": 1747148294723 },
            { "latitude": 37.469244, "longitude": 15.075302, "timestamp": 1747148304748 },
            { "latitude": 37.469244, "longitude": 15.075302, "timestamp": 1747148314785 },
            { "latitude": 37.469244, "longitude": 15.075302, "timestamp": 1747148324750 },
            { "latitude": 37.469244, "longitude": 15.075302, "timestamp": 1747148334779 },
            { "latitude": 37.469244, "longitude": 15.075302, "timestamp": 1747148344754 },
            { "latitude": 37.468781, "longitude": 15.069765, "timestamp": 1747148354766 },
            { "latitude": 37.4687, "longitude": 15.068859, "timestamp": 1747148364740 },
            { "latitude": 37.4687, "longitude": 15.068859, "timestamp": 1747148374769 },
            { "latitude": 37.4687, "longitude": 15.068859, "timestamp": 1747148384788 },
            { "latitude": 37.4687, "longitude": 15.068859, "timestamp": 1747148394799 },
            { "latitude": 37.4687, "longitude": 15.068859, "timestamp": 1747148404820 },
            { "latitude": 37.4687, "longitude": 15.068859, "timestamp": 1747148414812 },
            { "latitude": 37.467773, "longitude": 15.077099, "timestamp": 1747151585943 },
            { "latitude": 37.469009, "longitude": 15.090189, "timestamp": 1747151595936 },
            { "latitude": 37.470245, "longitude": 15.099831, "timestamp": 1747151605942 },
            { "latitude": 37.471665, "longitude": 15.109306, "timestamp": 1747151615969 },
            { "latitude": 37.473221, "longitude": 15.119233, "timestamp": 1747151625893 },
            { "latitude": 37.474869, "longitude": 15.131037, "timestamp": 1747151635947 },
            { "latitude": 37.476471, "longitude": 15.142959, "timestamp": 1747151645968 },
            { "latitude": 37.478089, "longitude": 15.154923, "timestamp": 1747151655970 },
            { "latitude": 37.479858, "longitude": 15.167522, "timestamp": 1747151665934 },
            { "latitude": 37.481598, "longitude": 15.180184, "timestamp": 1747151675974 },
            { "latitude": 37.483443, "longitude": 15.193136, "timestamp": 1747151685955 },
            { "latitude": 37.485306, "longitude": 15.206714, "timestamp": 1747151695932 },
            { "latitude": 37.487167, "longitude": 15.220005, "timestamp": 1747151705975 },
            { "latitude": 37.489059, "longitude": 15.233537, "timestamp": 1747151715976 },
            { "latitude": 37.490891, "longitude": 15.247913, "timestamp": 1747151725981 }
        ]
    };
}

function createNonLoiteringStraightAircraft(): Aircraft {
    const straightPoints = generateStraightPath();
    return {
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
}
