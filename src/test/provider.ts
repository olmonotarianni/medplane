import { AdsbFiProvider } from '../providers/adsbfi-provider';
import { SICILY_CHANNEL_BOUNDS } from '../config';

export async function runProviderTest(): Promise<void> {
    console.log('Running in test mode - fetching aircraft data...');

    try {
        const provider = AdsbFiProvider.fromEnv();
        console.log('\nInitiating API call...');

        const result = await provider.scan(SICILY_CHANNEL_BOUNDS);
        console.log('\nAPI call completed successfully.');
        console.log('\nAircraft Data:');
        console.log('Timestamp:', new Date(result.timestamp * 1000).toISOString());
        console.log('Number of aircraft:', result.aircraft.length);

        // Print details of first 3 aircraft
        result.aircraft.slice(0, 3).forEach((aircraft, index) => {
            console.log(`\nAircraft ${index + 1}:`);
            console.log('ICAO:', aircraft.icao);
            console.log('Callsign:', aircraft.callsign);
            console.log('Position:', { latitude: aircraft.latitude, longitude: aircraft.longitude });
            console.log('Altitude:', aircraft.altitude);
            console.log('Speed:', aircraft.speed);
            console.log('Heading:', aircraft.heading);
            console.log('Vertical Rate:', aircraft.verticalRate);
        });
    } catch (error) {
        console.error('\nTest failed:', error);
        throw error;
    }
}
