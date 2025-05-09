import { createCanvas, CanvasRenderingContext2D } from 'canvas';
import { Position, MonitoringPoint } from './types';
import * as fs from 'fs';
import * as path from 'path';

export class MapVisualizer {
    private readonly width = 1200;
    private readonly height = 800;
    public readonly mapBounds = {
        minLon: 10,  // Western Sicily Channel
        maxLon: 16,  // Eastern Sicily Channel
        minLat: 33,  // Southern boundary
        maxLat: 39   // Northern boundary
    };

    private latLonToPixel(lat: number, lon: number): { x: number; y: number } {
        const x = ((lon - this.mapBounds.minLon) / (this.mapBounds.maxLon - this.mapBounds.minLon)) * this.width;
        // Reverse Y coordinate because canvas 0,0 is top-left
        const y = this.height - ((lat - this.mapBounds.minLat) / (this.mapBounds.maxLat - this.mapBounds.minLat)) * this.height;
        return { x, y };
    }

    private drawCircle(ctx: CanvasRenderingContext2D, center: Position, radiusKm: number, color: string) {
        const centerPixel = this.latLonToPixel(center.latitude, center.longitude);

        // Convert radius from km to pixels (approximate)
        const latDiff = radiusKm / 111; // 1 degree ≈ 111km
        const topLat = center.latitude + latDiff;
        const topPixel = this.latLonToPixel(topLat, center.longitude);
        const radiusPixels = Math.abs(centerPixel.y - topPixel.y);

        ctx.beginPath();
        ctx.arc(centerPixel.x, centerPixel.y, radiusPixels, 0, Math.PI * 2);
        ctx.strokeStyle = color;
        ctx.stroke();
    }

    private drawAircraftTriangle(ctx: CanvasRenderingContext2D, x: number, y: number, heading: number, color: string, isMonitored: boolean) {
        const size = 16;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate((heading - 90) * Math.PI / 180); // 0 deg = North
        ctx.beginPath();
        ctx.moveTo(size, 0);
        ctx.lineTo(-size * 0.6, size * 0.5);
        ctx.lineTo(-size * 0.6, -size * 0.5);
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.globalAlpha = isMonitored ? 0.95 : 0.3;
        ctx.fill();
        ctx.globalAlpha = 1.0;
        ctx.restore();
    }

    async generateMap(centerPoint: Position, scanRadius: number, monitoringPoints: MonitoringPoint[], allAircraft: any[] = [], interestingIcaos: Set<string> = new Set()): Promise<string> {
        const canvas = createCanvas(this.width, this.height);
        const ctx = canvas.getContext('2d');

        // Draw background (light blue for sea)
        ctx.fillStyle = '#e6f3ff';
        ctx.fillRect(0, 0, this.width, this.height);

        // Draw land masses (simplified)
        ctx.fillStyle = '#f5f5dc'; // Light beige for land
        // Sicilia (triangolo con i tre capi principali)
        this.drawLandMass(ctx, [
            { lat: 38.2722, lon: 15.6414 }, // Capo Peloro (NE, Messina)
            { lat: 37.7995, lon: 12.4371 }, // Capo Boeo (NW, Marsala)
            { lat: 36.6531, lon: 15.1506 }, // Capo Passero (SE, Portopalo)
            { lat: 38.2722, lon: 15.6414 }
        ]);
        // Isole Egadi (Favignana, Levanzo, Marettimo)
        this.drawLandMass(ctx, [
            { lat: 37.9333, lon: 12.3333 }, // Favignana
            { lat: 37.9667, lon: 12.3333 }, // Levanzo
            { lat: 37.9667, lon: 12.0500 }, // Marettimo
            { lat: 37.9333, lon: 12.3333 }
        ]);
        // Pantelleria
        this.drawLandMass(ctx, [
            { lat: 36.8333, lon: 11.9500 },
            { lat: 36.8333, lon: 11.9600 },
            { lat: 36.8233, lon: 11.9600 },
            { lat: 36.8233, lon: 11.9500 },
            { lat: 36.8333, lon: 11.9500 }
        ]);
        // Lampedusa
        this.drawLandMass(ctx, [
            { lat: 35.5022, lon: 12.6183 },
            { lat: 35.5122, lon: 12.6283 },
            { lat: 35.5022, lon: 12.6383 },
            { lat: 35.4922, lon: 12.6283 },
            { lat: 35.5022, lon: 12.6183 }
        ]);
        // Linosa
        this.drawLandMass(ctx, [
            { lat: 35.8681, lon: 12.8650 },
            { lat: 35.8781, lon: 12.8750 },
            { lat: 35.8681, lon: 12.8850 },
            { lat: 35.8581, lon: 12.8750 },
            { lat: 35.8681, lon: 12.8650 }
        ]);
        // Malta
        this.drawLandMass(ctx, [
            { lat: 35.8997, lon: 14.5146 },
            { lat: 35.9097, lon: 14.5246 },
            { lat: 35.8997, lon: 14.5346 },
            { lat: 35.8897, lon: 14.5246 },
            { lat: 35.8997, lon: 14.5146 }
        ]);
        // Gozo
        this.drawLandMass(ctx, [
            { lat: 36.0443, lon: 14.2512 },
            { lat: 36.0543, lon: 14.2612 },
            { lat: 36.0443, lon: 14.2712 },
            { lat: 36.0343, lon: 14.2612 },
            { lat: 36.0443, lon: 14.2512 }
        ]);
        // Tunisia (costa semplificata)
        this.drawLandMass(ctx, [
            { lat: 37.0833, lon: 11.0000 }, // Capo Bon
            { lat: 36.8065, lon: 10.1815 }, // Tunisi
            { lat: 35.8256, lon: 10.6084 }, // Sousse
            { lat: 35.7771, lon: 10.8266 }, // Monastir
            { lat: 35.5047, lon: 11.0622 }, // Mahdia
            { lat: 34.7406, lon: 10.7603 }, // Sfax
            { lat: 33.5033, lon: 11.1122 }, // Zarzis
            { lat: 33.5033, lon: 11.0000 }, // chiusura
            { lat: 37.0833, lon: 11.0000 }
        ]);
        // Canale di Sicilia (punto centrale)
        const canaleCenter = { lat: 37.2000, lon: 11.2000 };
        const { x: cx, y: cy } = this.latLonToPixel(canaleCenter.lat, canaleCenter.lon);
        ctx.beginPath();
        ctx.arc(cx, cy, 8, 0, Math.PI * 2);
        ctx.fillStyle = '#00bcd4';
        ctx.fill();
        ctx.font = 'bold 14px Arial';
        ctx.fillStyle = '#00bcd4';
        ctx.fillText('Canale di Sicilia', cx + 10, cy - 10);
        // Stretto di Messina (linea)
        const capoPeloro = { lat: 38.2722, lon: 15.6414 };
        const puntaPezzo = { lat: 38.2500, lon: 15.5830 };
        const p1 = this.latLonToPixel(capoPeloro.lat, capoPeloro.lon);
        const p2 = this.latLonToPixel(puntaPezzo.lat, puntaPezzo.lon);
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.strokeStyle = '#1976d2';
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.font = 'bold 12px Arial';
        ctx.fillStyle = '#1976d2';
        ctx.fillText('Stretto di Messina', (p1.x + p2.x) / 2 + 5, (p1.y + p2.y) / 2 - 10);

        // --- Città e isole principali ---
        const places = [
            { name: 'Palermo', lat: 38.1157, lon: 13.3615 },
            { name: 'Catania', lat: 37.5079, lon: 15.0830 },
            { name: 'Trapani', lat: 38.0176, lon: 12.5364 },
            { name: 'Siracusa', lat: 37.0755, lon: 15.2866 },
            { name: 'Mazara del Vallo', lat: 37.6517, lon: 12.5917 },
            { name: 'Marsala', lat: 37.7995, lon: 12.4371 },
            { name: 'Gela', lat: 37.0731, lon: 14.2441 },
            { name: 'Licata', lat: 37.1042, lon: 13.9461 },
            { name: 'Porto Empedocle', lat: 37.2881, lon: 13.5161 },
            { name: 'Augusta', lat: 37.2333, lon: 15.2167 },
            { name: 'Tunisi', lat: 36.8065, lon: 10.1815 },
            { name: 'Sfax', lat: 34.7406, lon: 10.7603 },
            { name: 'Sousse', lat: 35.8256, lon: 10.6084 },
            { name: 'Monastir', lat: 35.7771, lon: 10.8266 },
            { name: 'Mahdia', lat: 35.5047, lon: 11.0622 },
            { name: 'Zarzis', lat: 33.5033, lon: 11.1122 },
            { name: 'Malta', lat: 35.8989, lon: 14.5146 },
            { name: 'Gozo', lat: 36.0443, lon: 14.2512 },
            { name: 'Lampedusa', lat: 35.5022, lon: 12.6183 },
            { name: 'Pantelleria', lat: 36.8333, lon: 11.9500 },
            { name: 'Linosa', lat: 35.8681, lon: 12.8650 }
        ];
        ctx.font = 'bold 16px Arial';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        places.forEach(place => {
            const { x, y } = this.latLonToPixel(place.lat, place.lon);
            // Draw dot
            ctx.beginPath();
            ctx.arc(x, y, 6, 0, Math.PI * 2);
            ctx.fillStyle = '#222';
            ctx.fill();
            // Draw label
            ctx.fillStyle = '#222';
            ctx.font = 'bold 16px Arial';
            ctx.fillText(place.name, x + 8, y - 2);
        });

        // Draw main scan area
        this.drawCircle(ctx, centerPoint, scanRadius, 'rgba(0, 100, 255, 0.3)');

        // Draw monitoring points
        monitoringPoints.forEach((point, index) => {
            // Draw monitoring circle
            this.drawCircle(ctx, point.position, point.radiusKm, 'rgba(255, 0, 0, 0.5)');

            // Draw point label
            const pixel = this.latLonToPixel(point.position.latitude, point.position.longitude);
            ctx.fillStyle = 'red';
            ctx.beginPath();
            ctx.arc(pixel.x, pixel.y, 5, 0, Math.PI * 2);
            ctx.fill();

            // Add label
            ctx.fillStyle = 'black';
            ctx.font = '14px Arial';
            ctx.fillText(`Point ${index + 1}`, pixel.x + 10, pixel.y);
        });

        // Draw aircraft
        allAircraft.forEach(ac => {
            const { x, y } = this.latLonToPixel(ac.position.latitude, ac.position.longitude);
            const color = interestingIcaos.has(ac.icao) ? '#dc3545' : (ac.is_monitored ? '#007bff' : '#999');
            this.drawAircraftTriangle(ctx, x, y, ac.heading || 0, color, ac.is_monitored);
        });

        // Draw scale bar (100km)
        const scaleBarKm = 100;
        const scaleBarPixels = (scaleBarKm / 111) * (this.height / (this.mapBounds.maxLat - this.mapBounds.minLat));
        ctx.beginPath();
        ctx.moveTo(50, this.height - 50);
        ctx.lineTo(50 + scaleBarPixels, this.height - 50);
        ctx.strokeStyle = 'black';
        ctx.stroke();
        ctx.fillStyle = 'black';
        ctx.font = '12px Arial';
        ctx.fillText(`${scaleBarKm} km`, 50, this.height - 35);

        // Add legend
        ctx.font = '14px Arial';
        ctx.fillStyle = 'rgba(0, 100, 255, 0.3)';
        ctx.fillRect(this.width - 200, 50, 20, 20);
        ctx.fillStyle = 'rgba(255, 0, 0, 0.5)';
        ctx.fillRect(this.width - 200, 80, 20, 20);
        ctx.fillStyle = '#007bff';
        ctx.fillRect(this.width - 200, 110, 20, 20);
        ctx.fillStyle = '#999';
        ctx.fillRect(this.width - 200, 140, 20, 20);
        ctx.fillStyle = '#dc3545';
        ctx.fillRect(this.width - 200, 170, 20, 20);
        ctx.fillStyle = 'black';
        ctx.fillText('Main scan area', this.width - 170, 65);
        ctx.fillText('Monitoring zones', this.width - 170, 95);
        ctx.fillText('Monitored aircraft', this.width - 170, 125);
        ctx.fillText('Unmonitored aircraft', this.width - 170, 155);
        ctx.fillText('Loitering aircraft', this.width - 170, 185);

        // Save the image
        const outputDir = path.join(process.cwd(), 'output');
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir);
        }
        const outputPath = path.join(outputDir, 'mediterranean_monitoring.png');
        const buffer = canvas.toBuffer('image/png');
        fs.writeFileSync(outputPath, buffer);

        return outputPath;
    }

    private drawLandMass(ctx: CanvasRenderingContext2D, points: { lat: number; lon: number }[]) {
        ctx.beginPath();
        points.forEach((point, index) => {
            const pixel = this.latLonToPixel(point.lat, point.lon);
            if (index === 0) {
                ctx.moveTo(pixel.x, pixel.y);
            } else {
                ctx.lineTo(pixel.x, pixel.y);
            }
        });
        ctx.closePath();
        ctx.fill();
    }
}
