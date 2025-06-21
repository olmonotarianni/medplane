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


function runLoiteringTest(aircraft: Aircraft, expectedLoitering: boolean) {
    const isLoitering = AircraftAnalyzer.hasIntersectingTrack(aircraft);
    logger.debug(`Test path: ${isLoitering === expectedLoitering ? 'PASSED' : 'FAILED'}`);
    return isLoitering === expectedLoitering;
}

export function runLoiteringTests() {
    // Test case: Loitering (intersecting X shape)
    const loiteringPath = [
        { latitude: 0, longitude: 0 }, // newest
        { latitude: 1, longitude: 1 },
        { latitude: 0, longitude: 1 },
        { latitude: 1, longitude: 0 }, // oldest
    ];
    const loiteringAircraft = generateAircraft(loiteringPath);
    runLoiteringTest(loiteringAircraft, true);

    // Test case: Not loitering (no intersecting segments)
    const straightPath = [
        { latitude: 0, longitude: 3 }, // newest
        { latitude: 0, longitude: 2 },
        { latitude: 0, longitude: 1 },
        { latitude: 0, longitude: 0 }, // oldest
    ];
    const nonLoiteringAircraft = generateAircraft(straightPath);
    runLoiteringTest(nonLoiteringAircraft, false);

    // Test case: Not loitering (simple curve, no intersection)
    const curvePath = [
        { latitude: 3, longitude: 3 }, // newest
        { latitude: 2, longitude: 2 },
        { latitude: 1, longitude: 1 },
        { latitude: 0, longitude: 0 }, // oldest
    ];
    const curveAircraft = generateAircraft(curvePath);
    runLoiteringTest(curveAircraft, false);

    // Test case: Loitering (figure-eight path, guaranteed intersection)
    const figureEightPath = [
        { latitude: 0, longitude: 0 }, // newest
        { latitude: 2, longitude: 2 },
        { latitude: 0, longitude: 2 },
        { latitude: 2, longitude: 0 }, // oldest
    ];
    const figureEightAircraft = generateAircraft(figureEightPath);
    runLoiteringTest(figureEightAircraft, true);
}

