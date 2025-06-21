import { TEST_POSITIONS } from '../constants';
import { GeoUtils } from '../utils';
import { logger } from '../logger';

export function runCoastDistanceTests(): void {
    logger.debug('Testing distance from coast calculation...\n');

    TEST_POSITIONS.forEach(test => {
        const distance = GeoUtils.minDistanceToCoastline(test.position);
        logger.debug(`${test.name}:`);
        logger.debug(`Position: ${test.position.latitude}, ${test.position.longitude}`);
        logger.debug(`Distance from coast: ${distance !== null ? distance.toFixed(2) + ' km' : 'Could not calculate'}`);
        logger.debug(`Is over sea (>5km from coast): ${distance !== null && distance >= 5 ? 'YES' : 'NO'}`);
        logger.debug('---\n');
    });
}
