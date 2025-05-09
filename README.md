# MedPlane - Aircraft Monitoring System

## Project Overview
MedPlane is a specialized aircraft monitoring system designed to detect and track aircraft that may be involved in search and rescue operations or surveillance of migrant boats in the Mediterranean Sea. The system focuses on the Sicily Channel area, monitoring aircraft behavior patterns that could indicate potential migrant boat locations.

## Key Features
- Real-time aircraft tracking and monitoring
- Detection of loitering aircraft patterns
- Focus on the Sicily Channel area (33°N-37°N, 10°E-16°E)
- Analysis of aircraft altitude, speed, and flight patterns
- Identification of potentially interesting aircraft based on:
  - Altitude range: 5,000-25,000 feet
  - Speed range: 100-300 knots
  - Loitering behavior: Aircraft staying within a 30km radius for 5+ minutes

## Technical Details
- Built with TypeScript/Node.js
- Real-time aircraft data processing
- Geographic analysis using haversine calculations
- Configurable monitoring points and scan parameters
- Event-driven architecture for real-time updates

## Purpose
The system helps identify aircraft that may be involved in:
- Search and rescue operations
- Surveillance of migrant boats
- Maritime patrol operations

By detecting aircraft that exhibit loitering behavior in specific areas, the system can help identify potential locations where migrant boats might be present, enabling more effective response coordination.

## Usage
[Usage instructions to be added based on deployment requirements]

## Configuration
The system can be configured with:
- Monitoring points and their coverage radius
- Scan intervals
- Geographic boundaries
- Aircraft behavior parameters

## Note
This system is designed for humanitarian purposes to assist in search and rescue operations and should be used in accordance with relevant laws and regulations. 