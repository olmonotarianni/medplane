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
    // Using coordinates within Sicily Channel monitoring area (lat 33-38, lon 10-18)
    const now = Date.now() / 1000;
    return {
        icao: "LOITER1",
        callsign: "TEST123",
        info: "Test loitering aircraft for event creation",
        is_monitored: true,
        is_loitering: false,
        not_monitored_reason: null,
        track: [
            // First segment: top-left to bottom-right
            { latitude: 36.0, longitude: 12.0, timestamp: now, altitude: 10000, speed: 200, heading: 90, verticalRate: 0, distanceToCoast: 0 },
            { latitude: 35.5, longitude: 12.5, timestamp: now, altitude: 10000, speed: 200, heading: 90, verticalRate: 0, distanceToCoast: 0 },
            { latitude: 35.0, longitude: 13.0, timestamp: now, altitude: 10000, speed: 200, heading: 90, verticalRate: 0, distanceToCoast: 0 },
            // Second segment: top-right to bottom-left
            { latitude: 36.0, longitude: 14.0, timestamp: now, altitude: 10000, speed: 200, heading: 90, verticalRate: 0, distanceToCoast: 0 },
            { latitude: 35.5, longitude: 13.5, timestamp: now, altitude: 10000, speed: 200, heading: 90, verticalRate: 0, distanceToCoast: 0 },
            { latitude: 35.0, longitude: 13.0, timestamp: now, altitude: 10000, speed: 200, heading: 90, verticalRate: 0, distanceToCoast: 0 },
            // Third segment: back to start
            { latitude: 35.0, longitude: 13.0, timestamp: now, altitude: 10000, speed: 200, heading: 90, verticalRate: 0, distanceToCoast: 0 },
            { latitude: 35.5, longitude: 12.5, timestamp: now, altitude: 10000, speed: 200, heading: 90, verticalRate: 0, distanceToCoast: 0 },
            { latitude: 36.0, longitude: 12.0, timestamp: now, altitude: 10000, speed: 200, heading: 90, verticalRate: 0, distanceToCoast: 0 }
        ]
    };
}

// Test the loitering event creation functionality directly
export function testLoiteringEventCreation(): void {
    logger.info('=== TESTING LOITERING EVENT CREATION ===');

    // Clear any existing events
    const loiteringStorage = getLoiteringStorage();
    loiteringStorage.clear();

    // Create a scanner
    const scanner = new AircraftScanner(mockProvider);

    // Create a loitering aircraft and update it through the scanner
    const aircraft = createLoiteringAircraft();
    logger.info('Initial aircraft state:', {
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
    logger.info('After scanner update:', {
        icao: aircraft.icao,
        callsign: aircraft.callsign,
        is_loitering: aircraft.is_loitering
    });

    // Check if a loitering event was created
    const events = loiteringStorage.listEvents();
    logger.info(`Loitering events created: ${events.length}`);

    events.forEach((event: LoiteringEvent) => {
        logger.info('Loitering event details:', {
            id: event.id,
            icao: event.icao,
            callsign: event.callsign,
            firstDetected: new Date(event.firstDetected).toISOString(),
            lastUpdated: new Date(event.lastUpdated).toISOString(),
            intersectionPoints: event.intersectionPoints.length,
            track_length: event.track.length
        });

        // Verify intersection points
        if (!event.intersectionPoints || event.intersectionPoints.length === 0) {
            logger.warn('⚠️  No intersection points recorded in event!');
        } else {
            logger.info(`✅ Event has ${event.intersectionPoints.length} intersection points.`);
        }

    });

    // Test updating existing events
    if (events.length > 0) {
        logger.info('\n=== TESTING EVENT UPDATE ===');

        // Wait a bit to simulate time passing
        setTimeout(() => {
            const updatedAircraft = createLoiteringAircraft();
            scanner.updateAircraft(updatedAircraft);

            // Check if the event was updated
            const updatedEvents = loiteringStorage.listEvents();
            if (updatedEvents.length > 0) {
                const updatedEvent = updatedEvents[0];
                logger.info('Updated event:', {
                    id: updatedEvent.id,
                    icao: updatedEvent.icao,
                    lastUpdated: new Date(updatedEvent.lastUpdated).toISOString()
                });

                // Check if track was updated properly
                const trackDuration = updatedEvent.track.length > 1 ?
                    (updatedEvent.track[0].timestamp - updatedEvent.track[updatedEvent.track.length - 1].timestamp) / 60 : 0;
                logger.info(`Updated track duration: ${trackDuration.toFixed(1)} minutes`);
            }
        }, 1000);
    }

    logger.info('\n=== LOITERING EVENT TEST COMPLETE ===');
}

// Helper function to check if the aircraft track has intersecting segments
function checkIntersections(track: any[]): void {
    if (track.length < 4) {
        logger.info('Track too short to have intersections');
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
    logger.info('Checking for intersecting segments...');
    let foundIntersection = false;

    for (let i = 0; i < segments.length - 2; i++) {
        for (let j = i + 2; j < segments.length; j++) {
            if (areIntersecting(segments[i], segments[j])) {
                logger.info(`✅ Intersection found between segments ${i} and ${j}:`);
                logger.info('Segment 1:', JSON.stringify(segments[i]));
                logger.info('Segment 2:', JSON.stringify(segments[j]));
                foundIntersection = true;
            }
        }
    }

    if (!foundIntersection) {
        logger.warn('⚠️  No intersecting segments found in the track');
    }
}
