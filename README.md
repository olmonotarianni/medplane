# MedPlane - Aircraft Monitoring System

## Project Overview
MedPlane is a real-time aircraft monitoring and analysis system focused on the central Mediterranean, especially the Sicily Channel. It is designed to detect, track, and analyze aircraft that may be involved in search and rescue, surveillance, or maritime patrol operations—particularly those exhibiting loitering behavior that could indicate interest in migrant boats.

## Key Features
- **Real-time aircraft tracking:** Continuously scans and displays aircraft positions and tracks on an interactive map.
- **Loitering detection:** Identifies aircraft whose flight path intersects itself, indicating potential search or surveillance patterns.
- **Telegram notifications:** Sends instant notifications to a Telegram group when loitering aircraft are detected.
- **Behavioral analysis:** Flags aircraft based on:
  - Altitude (5,000–25,000 ft)
  - Speed (100–300 knots)
  - Location (Sicily Channel bounding box: 33°N-37°N, 10°E-16°E)
  - Sea position (minimum 5km from coast)
  - Persistence (removed after 15 minutes of inactivity)
  - Out-of-range handling (status reset after 30 seconds outside monitoring parameters)
- **Human-readable monitoring status:** The backend provides clear explanations for why an aircraft is or isn't monitored, including specific threshold violations.
- **Modern web UI:** Visualizes aircraft and tracks with color-coded icons and popups.
- **Event-driven architecture:** Efficient, scalable updates using Node.js and TypeScript.

## Technical Details
- **Backend:** TypeScript/Node.js, Express server
- **Frontend:** Leaflet.js for interactive mapping
- **Data sources:** adsb.fi API (free, real-time aircraft data with 1Hz update rate)
- **Geospatial analysis:** Haversine calculations for distance and loitering detection
- **Docker support:** Easily deployable with the included Dockerfile
- **Coastline data source:** Uses high-quality open coastline data from [simonepri/geo-maps](https://github.com/simonepri/geo-maps)

## Key Libraries & Dependencies
- **Mapping & Geospatial:**
  - `leaflet`: Interactive maps and aircraft visualization
  - `@turf/turf`: Advanced geospatial analysis
  - `@turf/boolean-point-in-polygon`: Coastline intersection detection
  - `@turf/helpers`: GeoJSON utilities

- **Backend Framework:**
  - `express`: Web server and API endpoints
  - `ws`: WebSocket server for real-time updates
  - `node-fetch`: HTTP client for adsb.fi API

- **TypeScript & Development:**
  - `typescript`: Type safety and modern JavaScript features
  - `ts-node-dev`: Development server with hot reload
  - `@types/*`: Type definitions for libraries

- **Data Processing:**
  - `geojson`: GeoJSON type definitions and utilities
  - `date-fns`: Date and time manipulation
  - `zod`: Runtime type validation

## Project Structure
```
src/
├── app.ts                 # Main application class
├── config.ts             # Configuration settings
├── constants.ts          # Shared constants
├── index.ts             # Application entry point
├── providers/           # Data providers (adsb.fi)
│   ├── adsbfi-provider.ts # adsb.fi API provider
│   └── base-provider.ts   # Provider interface
├── test/               # Test utilities
│   ├── coast-distance.ts  # Coastline distance testing
│   └── provider.ts       # Provider testing
└── utils.ts             # Utility functions
```

## Usage

### Quick Start (with Docker)
```sh
docker build -t medplane .
docker run -p 3872:3872 medplane
```
Then open [http://localhost:3872](http://localhost:3872) in your browser.

### Development
1. Install dependencies:
   ```sh
   yarn install
   ```
2. Start the server:
   ```sh
   yarn start
   ```
3. Visit [http://localhost:3872](http://localhost:3872)

### Testing Modes
The application includes several testing modes:

1. Coast Distance Testing:
   ```sh
   yarn start --test-coast-distance
   ```
   Tests the distance calculation from predefined points to the nearest coastline.

2. Provider Testing:
   ```sh
   yarn start --test-airdata-provider
   ```
   Tests the adsb.fi provider by fetching and displaying current aircraft data.

3. Loitering Detection Testing:
   ```sh
   yarn start --test-loitering
   ```
   Tests the loitering detection algorithm using simulated flight paths:
   - Figure-8 pattern (should detect loitering)
   - Circular pattern (should detect loitering)
   - Straight path (should not detect loitering)

4. Telegram Notification Testing:
   ```sh
   yarn start --test-telegram
   ```
   Tests the Telegram notification system by sending a test message.

5. Telegram Update Listener:
   ```sh
   yarn start --test-telegram-updates
   ```
   Starts listening for incoming Telegram updates. Send messages to your bot to see them displayed in the console. Press Ctrl+C to stop.

6. Telegram Bot Info:
   ```sh
   yarn start --test-telegram-bot-info
   ```
   Displays information about your Telegram bot (ID, name, username).

## Configuration

### Environment Variables
Set the following environment variables for Telegram notifications:

- `TELEGRAM_BOT_TOKEN`: Your Telegram bot token (get from @BotFather)
- `TELEGRAM_CHAT_ID`: The chat ID of your Telegram group or channel

Copy `config.example.env` to `.env` and fill in your actual values:
```sh
cp config.example.env .env
# Edit .env with your actual Telegram bot token and chat ID
```

### Monitoring Thresholds
- **Altitude:** 5,000–25,000 feet
- **Speed:** 100–300 knots
- **Loitering detection:**
  - Self-intersecting flight path detection
  - Minimum 4 points in trajectory
  - Maximum trace age: 20 minutes
- **Geographic bounds:** Sicily Channel (33°N-37°N, 10°E-16°E)
- **Coastal distance:** Minimum 5km from coastline
- **Cleanup intervals:**
  - Aircraft data: 15 minutes
  - Out-of-range timeout: 30 seconds

### Server Settings
- Port: 3872 (configurable)
- Update frequency for aircraft data (configurable, respects adsb.fi's 1 request/second rate limit)

## API Endpoints

- `GET /api/aircraft`  
  Returns all tracked aircraft. Each aircraft includes a `not_monitored_reason` field if it is not monitored.

- `GET /api/map`  
  Returns map configuration.

## Purpose

MedPlane is intended for humanitarian and research purposes, to assist in the detection of search and rescue or surveillance operations in the Mediterranean. It can help identify aircraft that may be monitoring or assisting migrant boats, supporting more effective response and coordination.

## Note
This system is designed for humanitarian purposes and should be used in accordance with all relevant laws and regulations. The adsb.fi API is used under their terms of service for non-commercial use.

## TODO
- [x] Add a notification system to notify the user when a aircraft is detected to be loitering (Telegram)
- [ ] Implement rate limiting to ensure compliance with adsb.fi's 1 request/second limit

## Data Sources & Acknowledgments

This project uses:
- Aircraft data from [adsb.fi](https://adsb.fi) (free for non-commercial use)
- Coastline data from [simonepri/geo-maps](https://github.com/simonepri/geo-maps) (MIT/Open Data Commons Public Domain Dedication and License)
