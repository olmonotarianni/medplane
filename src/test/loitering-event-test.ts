import { AircraftScanner } from '../scanner';
import { ScannerProvider } from '../providers/base-provider';
import { getLoiteringStorage } from '../storage/loitering-storage';
import { Aircraft, LoiteringEvent } from '../types';
import { areIntersecting, Segment } from '../utils';
import { logger } from '../logger';

// Mock provider for testing
const mockProvider: ScannerProvider = {
    scan: async () => ({ aircraft: [], timestamp: Date.now() })
};

// Create a loitering aircraft with intersecting path
function createLoiteringAircraft(): Aircraft {
    // Create a simple track that forms an "X" pattern
    // Using obvious coordinates for easy debugging
    const now = Date.now() / 1000;
    return {
        icao: "LOITER1",
        callsign: "TEST123",
        is_monitored: true,
        is_loitering: false,
        not_monitored_reason: null,
        track: [
            // First segment: top-left to bottom-right
            { latitude: 42.0, longitude: 13.0, timestamp: now, altitude: 10000, speed: 200, heading: 90, verticalRate: 0 },
            { latitude: 41.5, longitude: 13.5, timestamp: now, altitude: 10000, speed: 200, heading: 90, verticalRate: 0 },
            { latitude: 41.0, longitude: 14.0, timestamp: now, altitude: 10000, speed: 200, heading: 90, verticalRate: 0 },
            // Second segment: top-right to bottom-left
            { latitude: 42.0, longitude: 15.0, timestamp: now, altitude: 10000, speed: 200, heading: 90, verticalRate: 0 },
            { latitude: 41.5, longitude: 14.5, timestamp: now, altitude: 10000, speed: 200, heading: 90, verticalRate: 0 },
            { latitude: 41.0, longitude: 14.0, timestamp: now, altitude: 10000, speed: 200, heading: 90, verticalRate: 0 },
            // Third segment: back to start
            { latitude: 41.0, longitude: 14.0, timestamp: now, altitude: 10000, speed: 200, heading: 90, verticalRate: 0 },
            { latitude: 41.5, longitude: 13.5, timestamp: now, altitude: 10000, speed: 200, heading: 90, verticalRate: 0 },
            { latitude: 42.0, longitude: 13.0, timestamp: now, altitude: 10000, speed: 200, heading: 90, verticalRate: 0 }
        ]
    };
}

// Test the loitering event creation functionality directly
export function testLoiteringEventCreation(): void {
    logger.debug('Testing loitering event creation...');

    // Clear any existing events
    const loiteringStorage = getLoiteringStorage();
    loiteringStorage.clear();

    // Create a scanner
    const scanner = new AircraftScanner(mockProvider);

    // Create a loitering aircraft and update it through the scanner
    const aircraft = createLoiteringAircraft();
    logger.debug('Initial aircraft state:', {
        icao: aircraft.icao,
        callsign: aircraft.callsign,
        is_loitering: aircraft.is_loitering,
        track_length: aircraft.track.length
    });

    // Diagnostic - check if the track segments intersect
    checkIntersections(aircraft.track);

    // Process the aircraft through the scanner
    scanner.updateAircraft(aircraft);

    // Check if the aircraft is now detected as loitering
    logger.debug('After scanner update:', {
        icao: aircraft.icao,
        callsign: aircraft.callsign,
        is_loitering: aircraft.is_loitering
    });

    // Check if a loitering event was created
    const events = loiteringStorage.listEvents();
    logger.debug(`Loitering events created: ${events.length}`);

    events.forEach((event: LoiteringEvent) => {
        logger.debug('Loitering event:', {
            id: event.id,
            icao: event.icao,
            callsign: event.callsign,
            firstDetected: new Date(event.firstDetected).toISOString(),
            lastUpdated: new Date(event.lastUpdated).toISOString(),
            detectionCount: event.detectionCount,
            intersectionPoints: event.intersectionPoints.length,
            track_length: event.track.length
        });
    });

    // Create a new aircraft with the same ICAO to test updating existing events
    if (events.length > 0) {
        logger.debug('\nTesting event update...');
        const updatedAircraft = createLoiteringAircraft();
        scanner.updateAircraft(updatedAircraft);

        // Check if the event was updated
        const updatedEvents = loiteringStorage.listEvents();
        if (updatedEvents.length > 0) {
            const updatedEvent = updatedEvents[0];
            logger.debug('Updated event:', {
                id: updatedEvent.id,
                icao: updatedEvent.icao,
                detectionCount: updatedEvent.detectionCount
            });
        }
    }

    logger.debug('\nLoitering event test complete.');
}

// Helper function to check if the aircraft track has intersecting segments
function checkIntersections(track: any[]): void {
    if (track.length < 4) {
        logger.debug('Track too short to have intersections');
        return;
    }

    // Convert track points to segments
    const segments: Segment[] = [];
    for (let i = 0; i < track.length - 1; i++) {
        segments.push({
            start: track[i],
            end: track[i + 1]
        });
    }

    // Check all non-adjacent segment pairs for intersections
    logger.debug('Checking for intersecting segments...');
    let foundIntersection = false;

    for (let i = 0; i < segments.length - 2; i++) {
        for (let j = i + 2; j < segments.length; j++) {
            if (areIntersecting(segments[i], segments[j])) {
                logger.debug(`Intersection found between segments ${i} and ${j}:`);
                logger.debug('Segment 1:', JSON.stringify(segments[i]));
                logger.debug('Segment 2:', JSON.stringify(segments[j]));
                foundIntersection = true;
            }
        }
    }

    if (!foundIntersection) {
        logger.debug('No intersecting segments found in the track');
    }
}
