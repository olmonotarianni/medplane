import { TEST_POSITIONS } from '../constants';
import { GeoUtils } from '../utils';

export function runCoastDistanceTests(): void {
    console.log('Testing distance from coast calculation...\n');

    TEST_POSITIONS.forEach(test => {
        const distance = GeoUtils.minDistanceToCoastline(test.position);
        console.log(`${test.name}:`);
        console.log(`Position: ${test.position.latitude}, ${test.position.longitude}`);
        console.log(`Distance from coast: ${distance !== null ? distance.toFixed(2) + ' km' : 'Could not calculate'}`);
        console.log(`Is over sea (>5km from coast): ${distance !== null && distance >= 5 ? 'YES' : 'NO'}`);
        console.log('---\n');
    });
}
