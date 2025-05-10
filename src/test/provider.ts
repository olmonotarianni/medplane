import { SICILY_CHANNEL_BOUNDS } from '../config';
import { OpenSkyProvider } from '../providers/opensky-provider';

export async function runProviderTest(): Promise<void> {
    console.log('Running in test mode - fetching aircraft data...');
    const provider = new OpenSkyProvider();

    try {
        const result = await provider.scan(SICILY_CHANNEL_BOUNDS);
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
    } catch (error) {
        console.error('Error fetching aircraft data:', error);
    }
}
