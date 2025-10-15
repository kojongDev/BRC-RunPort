/**
 * Haversine 공식을 사용한 거리 계산
 */

import {GPSCoordinate} from '../types/location';

const EARTH_RADIUS_KM = 6371;

/**
 * 두 GPS 좌표 사이의 거리를 계산 (km)
 */
export function calculateDistance(
  point1: GPSCoordinate,
  point2: GPSCoordinate,
): number {
  const lat1 = toRadians(point1.latitude);
  const lat2 = toRadians(point2.latitude);
  const deltaLat = toRadians(point2.latitude - point1.latitude);
  const deltaLon = toRadians(point2.longitude - point1.longitude);

  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1) *
      Math.cos(lat2) *
      Math.sin(deltaLon / 2) *
      Math.sin(deltaLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_KM * c;
}

/**
 * 도를 라디안으로 변환
 */
function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * GPS 좌표 배열의 총 거리 계산 (km)
 */
export function calculateTotalDistance(points: GPSCoordinate[]): number {
  if (points.length < 2) {
    return 0;
  }

  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += calculateDistance(points[i - 1], points[i]);
  }

  return total;
}

/**
 * 속도 계산 (km/h)
 */
export function calculateSpeed(
  distance: number,
  durationSeconds: number,
): number {
  if (durationSeconds === 0) {
    return 0;
  }

  // km/h = (거리 km) / (시간 hours)
  return (distance / durationSeconds) * 3600;
}
