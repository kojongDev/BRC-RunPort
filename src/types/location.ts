/**
 * 위치 관련 타입 정의
 */

// 활동 유형
export type ActivityType = 'walking' | 'running' | 'vehicle' | 'still' | 'unknown';

// GPS 좌표
export interface GPSCoordinate {
  latitude: number;
  longitude: number;
  altitude?: number;
  accuracy: number;
  speed?: number;
  timestamp: number;
  // 활동 추적 정보
  activityType: ActivityType;
  activityConfidence: number; // 0-100
  estimatedBySpeed: boolean; // true면 속도 추정, false면 AI 분류
  // GPS 신호 품질
  isEstimated: boolean; // GPS 신호 손실로 인한 추정 포인트 여부
  gpsSignalLost?: boolean; // GPS 신호 손실 시작 지점 (마커 표시용)
}

// 지도 영역
export interface MapRegion {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
}

// 경로 포인트
export interface RoutePoint {
  latitude: number;
  longitude: number;
}

// 경로 세그먼트 (활동 유형별)
export interface RouteSegment {
  activityType: ActivityType;
  points: GPSCoordinate[];
  distance: number; // km
  startIndex: number;
  endIndex: number;
  isEstimated: boolean; // GPS 신호 손실로 인한 추정 구간 여부 (점선 표시)
}
