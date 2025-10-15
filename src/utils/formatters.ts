/**
 * 포맷팅 유틸리티 함수들
 */

/**
 * 거리를 포맷팅 (km, 소수점 2자리)
 * @example formatDistance(5.12345) => "5.12"
 */
export function formatDistance(distanceKm: number): string {
  return distanceKm.toFixed(2);
}

/**
 * 시간을 HH:MM:SS 형식으로 포맷팅
 * @example formatDuration(3665) => "01:01:05"
 */
export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  return [hours, minutes, secs]
    .map(val => (val < 10 ? `0${val}` : `${val}`))
    .join(':');
}

/**
 * 페이스를 분:초/km 형식으로 포맷팅
 * @example formatPace(5.5) => "5:30"
 */
export function formatPace(paceMinPerKm: number): string {
  if (!isFinite(paceMinPerKm) || paceMinPerKm <= 0) {
    return '0:00';
  }

  const minutes = Math.floor(paceMinPerKm);
  const seconds = Math.floor((paceMinPerKm - minutes) * 60);

  return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
}

/**
 * 페이스 계산 (분/km)
 * @param distanceKm 거리 (km)
 * @param durationSeconds 시간 (초)
 */
export function calculatePace(
  distanceKm: number,
  durationSeconds: number,
): number {
  if (distanceKm === 0 || durationSeconds === 0) {
    return 0;
  }

  // 분/km = (시간 분) / (거리 km)
  return durationSeconds / 60 / distanceKm;
}

/**
 * 칼로리 포맷팅 (정수)
 * @example formatCalories(123.45) => "123"
 */
export function formatCalories(calories: number): string {
  return Math.round(calories).toString();
}

/**
 * 날짜를 "YYYY.MM.DD HH:MM" 형식으로 포맷팅
 */
export function formatDateTime(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');

  return `${year}.${month}.${day} ${hours}:${minutes}`;
}

/**
 * 날짜를 "MM월 DD일" 형식으로 포맷팅
 */
export function formatDate(date: Date): string {
  const month = date.getMonth() + 1;
  const day = date.getDate();

  return `${month}월 ${day}일`;
}
