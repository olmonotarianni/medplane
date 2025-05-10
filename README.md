# MedPlane - Aircraft Monitoring System

## Project Overview
MedPlane is a real-time aircraft monitoring and analysis system focused on the central Mediterranean, especially the Sicily Channel. It is designed to detect, track, and analyze aircraft that may be involved in search and rescue, surveillance, or maritime patrol operations—particularly those exhibiting loitering behavior that could indicate interest in migrant boats.

## Key Features
- **Real-time aircraft tracking:** Continuously scans and displays aircraft positions and tracks on an interactive map.
- **Loitering detection:** Identifies aircraft that remain within a small area (30km radius) for 5+ minutes.
- **Behavioral analysis:** Flags aircraft based on altitude (5,000–25,000 ft), speed (100–300 knots), and geographic area.
- **Monitoring points:** Configurable zones of interest with customizable radius and behavioral thresholds.
- **Human-readable monitoring status:** The backend provides clear explanations for why an aircraft is or isn't monitored.
- **Modern web UI:** Visualizes aircraft, tracks, and monitoring zones with color-coded icons and popups.
- **Event-driven architecture:** Efficient, scalable updates using Node.js and TypeScript.

## Technical Details
- **Backend:** TypeScript/Node.js, Express server
- **Frontend:** Leaflet.js for interactive mapping
- **Data sources:** OpenSky Network API (with support for both standard and compressed endpoints)
- **Geospatial analysis:** Haversine calculations for distance and loitering detection
- **Docker support:** Easily deployable with the included Dockerfile

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

## Configuration

You can configure:
- **Monitoring points:** Location, radius, and behavioral thresholds (see `src/index.ts`)
- **Scan interval and area:** Center point, scan radius, and update interval
- **Aircraft behavior parameters:** Altitude, speed, and loitering thresholds

## API Endpoints

- `GET /api/aircraft`  
  Returns all tracked aircraft and monitoring points. Each aircraft includes a `not_monitored_reason` field if it is not monitored.

- `GET /api/map`  
  Returns map configuration and monitoring points.

## Purpose

MedPlane is intended for humanitarian and research purposes, to assist in the detection of search and rescue or surveillance operations in the Mediterranean. It can help identify aircraft that may be monitoring or assisting migrant boats, supporting more effective response and coordination.

## Note
This system is designed for humanitarian purposes and should be used in accordance with all relevant laws and regulations. 

## TODO
- [ ] Add a notification system to notify the user when a aircraft is detected to be loitering