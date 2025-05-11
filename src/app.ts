import { SERVER_PORT } from './constants';
import { AdsbFiProvider } from './providers/adsbfi-provider';
import { AircraftScanner } from './scanner';
import { WebServer } from './server';

export class App {
    private readonly scanner: AircraftScanner;
    private readonly server: WebServer;

    constructor() {
        const provider = new AdsbFiProvider();
        this.scanner = new AircraftScanner(provider);
        this.server = new WebServer();

        // Set up server components
        this.server.setScanner(this.scanner);

        // Set up aircraft detection logging
        this.setupAircraftLogging();
    }

    private setupAircraftLogging(): void {
        this.scanner.on('interestingAircraft', (aircraft) => {
            console.log('Interesting aircraft detected:');
            console.log(`ICAO: ${aircraft.icao}`);
            console.log(`Callsign: ${aircraft.callsign || 'unknown'}`);
            console.log(`Position: ${aircraft.position.latitude}, ${aircraft.position.longitude}`);
            console.log(`Altitude: ${aircraft.altitude}ft, Speed: ${aircraft.speed}kts`);
            console.log('---');
        });
    }

    public start(): void {
        console.log('Starting AircraftScanner...');
        this.scanner.start();
        console.log('AircraftScanner started.');

        // Start the server
        this.server.start(SERVER_PORT);
    }
}
