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
            {
                "latitude": 36.076309,
                "longitude": 12.595997,
                "timestamp": 1746968463823
            },
            {
                "latitude": 36.064438,
                "longitude": 12.591325,
                "timestamp": 1746968473886
            },
            {
                "latitude": 36.053079,
                "longitude": 12.586884,
                "timestamp": 1746968483866
            },
            {
                "latitude": 36.041953,
                "longitude": 12.582501,
                "timestamp": 1746968493867
            },
            {
                "latitude": 36.030361,
                "longitude": 12.577943,
                "timestamp": 1746968503878
            },
            {
                "latitude": 36.019003,
                "longitude": 12.573502,
                "timestamp": 1746968513857
            },
            {
                "latitude": 36.007736,
                "longitude": 12.569103,
                "timestamp": 1746968523867
            },
            {
                "latitude": 35.996384,
                "longitude": 12.564697,
                "timestamp": 1746968533815
            },
            {
                "latitude": 35.984985,
                "longitude": 12.560234,
                "timestamp": 1746968543865
            },
            {
                "latitude": 35.973288,
                "longitude": 12.555678,
                "timestamp": 1746968553857
            },
            {
                "latitude": 35.962116,
                "longitude": 12.551354,
                "timestamp": 1746968563908
            },
            {
                "latitude": 35.953736,
                "longitude": 12.548081,
                "timestamp": 1746968573866
            },
            {
                "latitude": 35.939346,
                "longitude": 12.542439,
                "timestamp": 1746968583873
            },
            {
                "latitude": 35.928412,
                "longitude": 12.538205,
                "timestamp": 1746968593873
            },
            {
                "latitude": 35.916595,
                "longitude": 12.533569,
                "timestamp": 1746968603870
            },
            {
                "latitude": 35.907044,
                "longitude": 12.529849,
                "timestamp": 1746968613869
            },
            {
                "latitude": 35.895593,
                "longitude": 12.525408,
                "timestamp": 1746968623873
            },
            {
                "latitude": 35.883591,
                "longitude": 12.520752,
                "timestamp": 1746968633838
            },
            {
                "latitude": 35.873853,
                "longitude": 12.516934,
                "timestamp": 1746968643877
            },
            {
                "latitude": 35.862579,
                "longitude": 12.512512,
                "timestamp": 1746968653874
            },
            {
                "latitude": 35.857635,
                "longitude": 12.510624,
                "timestamp": 1746968663862
            },
            {
                "latitude": 35.846054,
                "longitude": 12.506104,
                "timestamp": 1746968673869
            },
            {
                "latitude": 35.827744,
                "longitude": 12.498951,
                "timestamp": 1746968683860
            },
            {
                "latitude": 35.827744,
                "longitude": 12.498951,
                "timestamp": 1746968693875
            },
            {
                "latitude": 35.81003,
                "longitude": 12.491981,
                "timestamp": 1746968703877
            },
            {
                "latitude": 35.81003,
                "longitude": 12.491981,
                "timestamp": 1746968713880
            },
            {
                "latitude": 35.81003,
                "longitude": 12.491981,
                "timestamp": 1746968723864
            },
            {
                "latitude": 35.81003,
                "longitude": 12.491981,
                "timestamp": 1746968733881
            },
            {
                "latitude": 35.81003,
                "longitude": 12.491981,
                "timestamp": 1746968743881
            },
            {
                "latitude": 35.81003,
                "longitude": 12.491981,
                "timestamp": 1746968753872
            },
            {
                "latitude": 35.671555,
                "longitude": 12.375927,
                "timestamp": 1746968853896
            },
            {
                "latitude": 35.671555,
                "longitude": 12.375927,
                "timestamp": 1746968863888
            },
            {
                "latitude": 35.671555,
                "longitude": 12.375927,
                "timestamp": 1746968873884
            },
            {
                "latitude": 35.671555,
                "longitude": 12.375927,
                "timestamp": 1746968883925
            },
            {
                "latitude": 35.671555,
                "longitude": 12.375927,
                "timestamp": 1746968893822
            },
            {
                "latitude": 35.671555,
                "longitude": 12.375927,
                "timestamp": 1746968903904
            },
            {
                "latitude": 35.610947,
                "longitude": 12.322025,
                "timestamp": 1746968913895
            },
            {
                "latitude": 35.610947,
                "longitude": 12.322025,
                "timestamp": 1746968923883
            },
            {
                "latitude": 35.610947,
                "longitude": 12.322025,
                "timestamp": 1746968933883
            },
            {
                "latitude": 35.610947,
                "longitude": 12.322025,
                "timestamp": 1746968943883
            },
            {
                "latitude": 35.610947,
                "longitude": 12.322025,
                "timestamp": 1746968953886
            },
            {
                "latitude": 35.610947,
                "longitude": 12.322025,
                "timestamp": 1746968963936
            },
            {
                "latitude": 35.610947,
                "longitude": 12.322025,
                "timestamp": 1746968973888
            },
            {
                "latitude": 35.502869,
                "longitude": 12.277393,
                "timestamp": 1746969033882
            },
            {
                "latitude": 35.490309,
                "longitude": 12.280611,
                "timestamp": 1746969043891
            },
            {
                "latitude": 35.490309,
                "longitude": 12.280611,
                "timestamp": 1746969053889
            },
            {
                "latitude": 35.490309,
                "longitude": 12.280611,
                "timestamp": 1746969063906
            },
            {
                "latitude": 35.490309,
                "longitude": 12.280611,
                "timestamp": 1746969073912
            },
            {
                "latitude": 35.490309,
                "longitude": 12.280611,
                "timestamp": 1746969083886
            },
            {
                "latitude": 35.490309,
                "longitude": 12.280611,
                "timestamp": 1746969093904
            }
        ]
    }

    // this plane should not be detected as loitering
    const analyzer = new AircraftAnalyzer();
    const result = analyzer.analyzeAircraft(aircraft);
    console.log(`Test special aircraft: ${result ? 'PASSED' : 'FAILED'}`);
    return result;
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

    console.log('\nTesting special aircraft:');
    allTestsPassed = testSpecialAircraft() && allTestsPassed;

    console.log(`\nOverall test result: ${allTestsPassed ? 'PASSED' : 'FAILED'}`);
}
