/**
 * GPS 노이즈 제거 및 필터링
 */

import {GPSCoordinate} from '../types/location';
import {GPS_CONFIG} from '@constants/config';
import {calculateSpeed} from './haversine';

/**
 * GPS 정확도 체크 (20m 이하만 허용)
 */
export function isAccurate(point: GPSCoordinate): boolean {
  return point.accuracy <= GPS_CONFIG.ACCURACY_THRESHOLD;
}

/**
 * 속도 이상치 체크 (30km/h 초과 제거)
 */
export function isValidSpeed(
  prevPoint: GPSCoordinate,
  currentPoint: GPSCoordinate,
  distance: number,
): boolean {
  const timeDiff = (currentPoint.timestamp - prevPoint.timestamp) / 1000; // 초 단위

  if (timeDiff === 0) {
    return false;
  }

  const speed = calculateSpeed(distance, timeDiff);

  return speed <= GPS_CONFIG.MAX_SPEED;
}

/**
 * 이동 평균 필터 (간단한 GPS 노이즈 제거)
 */
export function applyMovingAverageFilter(
  points: GPSCoordinate[],
  windowSize: number = 3,
): GPSCoordinate[] {
  if (points.length < windowSize) {
    return points;
  }

  const filtered: GPSCoordinate[] = [];

  for (let i = 0; i < points.length; i++) {
    if (i < windowSize - 1) {
      filtered.push(points[i]);
      continue;
    }

    const window = points.slice(i - windowSize + 1, i + 1);

    const avgLat =
      window.reduce((sum, p) => sum + p.latitude, 0) / window.length;
    const avgLon =
      window.reduce((sum, p) => sum + p.longitude, 0) / window.length;

    filtered.push({
      ...points[i],
      latitude: avgLat,
      longitude: avgLon,
    });
  }

  return filtered;
}

/**
 * GPS 포인트 검증 (정확도 + 속도 체크)
 */
export function validateGPSPoint(
  prevPoint: GPSCoordinate | null,
  currentPoint: GPSCoordinate,
  distance: number,
): boolean {
  // 정확도 체크
  if (!isAccurate(currentPoint)) {
    return false;
  }

  // 첫 포인트는 통과
  if (!prevPoint) {
    return true;
  }

  // 속도 이상치 체크
  if (!isValidSpeed(prevPoint, currentPoint, distance)) {
    return false;
  }

  return true;
}
