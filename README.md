# MedPlane - Aircraft Monitoring System

## Project Overview
MedPlane is a real-time aircraft monitoring and analysis system focused on the central Mediterranean, especially the Sicily Channel. It is designed to detect, track, and analyze aircraft that may be involved in search and rescue, surveillance, or maritime patrol operations—particularly those exhibiting loitering behavior that could indicate interest in migrant boats.

## Key Features
- **Real-time aircraft tracking:** Continuously scans and displays aircraft positions and tracks on an interactive map.
- **Loitering detection:** Identifies aircraft whose flight path intersects itself, indicating potential search or surveillance patterns.
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
- **Data sources:** OpenSky Network API (with support for both standard and compressed endpoints)
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
  - `node-fetch`: HTTP client for OpenSky API

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
├── providers/           # Data providers (OpenSky)
├── test/               # Test utilities
│   ├── coast-distance.ts  # Coastline distance testing
│   └── provider.ts       # OpenSky provider testing
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
   yarn dev
   ```
3. Visit [http://localhost:3872](http://localhost:3872)

### Testing Modes
The application includes two testing modes:

1. Coast Distance Testing:
   ```sh
   yarn dev --test-coast-distance
   ```
   Tests the distance calculation from predefined points to the nearest coastline.

2. Provider Testing:
   ```sh
   yarn dev --test-airdata-provider
   ```
   Tests the OpenSky Network provider by fetching and displaying current aircraft data.

## Configuration

You can configure the following parameters in `config.ts`:

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
- Update frequency for aircraft data (configurable)

## API Endpoints

- `GET /api/aircraft`  
  Returns all tracked aircraft. Each aircraft includes a `not_monitored_reason` field if it is not monitored.

- `GET /api/map`  
  Returns map configuration.

## Purpose

MedPlane is intended for humanitarian and research purposes, to assist in the detection of search and rescue or surveillance operations in the Mediterranean. It can help identify aircraft that may be monitoring or assisting migrant boats, supporting more effective response and coordination.

## Note
This system is designed for humanitarian purposes and should be used in accordance with all relevant laws and regulations. 

## TODO
- [ ] Add a notification system to notify the user when a aircraft is detected to be loitering

## Data Sources & Acknowledgments

This project uses coastline data from [simonepri/geo-maps](https://github.com/simonepri/geo-maps) (MIT/Open Data Commons Public Domain Dedication and License).
