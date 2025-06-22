import { AircraftAnalyzer } from '../aircraft-analyzer';
import { Aircraft, ExtendedPosition, Position } from '../types';
import { logger } from '../logger';


function generateAircraft(points: Position[]): Aircraft {
    let timestamp = Date.now() / 1000;
    return {
        icao: 'TEST123',
        callsign: 'TEST',
        is_monitored: true,
        is_loitering: false,
        not_monitored_reason: null,
        track: points.map((pt): ExtendedPosition => {
            const position: ExtendedPosition = {
                latitude: pt.latitude,
                longitude: pt.longitude,
                timestamp: timestamp++,
                altitude: 10000,
                speed: 250,
                heading: 0,
                verticalRate: 0
            }
            return position;
        })
    };
}

function generateAircraftWithCustomParams(points: Position[], altitude: number, speed: number): Aircraft {
    let timestamp = Date.now() / 1000;
    return {
        icao: 'TEST123',
        callsign: 'TEST',
        is_monitored: true,
        is_loitering: false,
        not_monitored_reason: null,
        track: points.map((pt): ExtendedPosition => {
            const position: ExtendedPosition = {
                latitude: pt.latitude,
                longitude: pt.longitude,
                timestamp: timestamp++,
                altitude: altitude,
                speed: speed,
                heading: 0,
                verticalRate: 0
            }
            return position;
        })
    };
}


function runLoiteringTest(aircraft: Aircraft, expectedLoitering: boolean, testName: string = 'Test') {
    const isLoitering = AircraftAnalyzer.hasIntersectingTrack(aircraft);
    const result = isLoitering === expectedLoitering ? 'PASSED' : 'FAILED';
    logger.info(`${testName}: ${result} (Expected: ${expectedLoitering}, Got: ${isLoitering})`);
    return isLoitering === expectedLoitering;
}

export function runLoiteringTests() {
    logger.info('Running loitering detection tests...');

    // Test case 1: Loitering (intersecting X shape) - WITHIN monitoring area and requirements
    const loiteringPath = [
        { latitude: 35.0, longitude: 12.0 }, // newest
        { latitude: 35.5, longitude: 12.5 },
        { latitude: 35.0, longitude: 12.5 },
        { latitude: 35.5, longitude: 12.0 }, // oldest
    ];
    const loiteringAircraft = generateAircraft(loiteringPath);
    runLoiteringTest(loiteringAircraft, true, 'Loitering aircraft (within monitoring area)');

    // Test case 2: Not loitering (no intersecting segments) - WITHIN monitoring area
    const straightPath = [
        { latitude: 35.0, longitude: 12.0 }, // newest
        { latitude: 35.0, longitude: 12.1 },
        { latitude: 35.0, longitude: 12.2 },
        { latitude: 35.0, longitude: 12.3 }, // oldest
    ];
    const nonLoiteringAircraft = generateAircraft(straightPath);
    runLoiteringTest(nonLoiteringAircraft, false, 'Non-loitering aircraft (straight path)');

    // Test case 3: Intersection but OUTSIDE monitoring area - should NOT be detected as loitering
    const outsideAreaPath = [
        { latitude: 40.0, longitude: 20.0 }, // newest - outside Sicily Channel
        { latitude: 40.5, longitude: 20.5 },
        { latitude: 40.0, longitude: 20.5 },
        { latitude: 40.5, longitude: 20.0 }, // oldest - outside Sicily Channel
    ];
    const outsideAreaAircraft = generateAircraft(outsideAreaPath);
    runLoiteringTest(outsideAreaAircraft, false, 'Intersecting aircraft (outside monitoring area)');

    // Test case 4: Intersection but TOO SLOW - should NOT be detected as loitering
    const slowIntersectingPath = [
        { latitude: 35.0, longitude: 12.0 }, // newest
        { latitude: 35.5, longitude: 12.5 },
        { latitude: 35.0, longitude: 12.5 },
        { latitude: 35.5, longitude: 12.0 }, // oldest
    ];
    const slowAircraft = generateAircraftWithCustomParams(slowIntersectingPath, 10000, 50); // 50 knots = too slow
    runLoiteringTest(slowAircraft, false, 'Intersecting aircraft (too slow)');

    // Test case 5: Intersection but TOO HIGH - should NOT be detected as loitering
    const highIntersectingPath = [
        { latitude: 35.0, longitude: 12.0 }, // newest
        { latitude: 35.5, longitude: 12.5 },
        { latitude: 35.0, longitude: 12.5 },
        { latitude: 35.5, longitude: 12.0 }, // oldest
    ];
    const highAircraft = generateAircraftWithCustomParams(highIntersectingPath, 30000, 250); // 30000 feet = too high
    runLoiteringTest(highAircraft, false, 'Intersecting aircraft (too high)');

    logger.info('Loitering detection tests completed.');
}

