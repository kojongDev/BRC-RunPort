/**
 * 활동 유형 감지 유틸리티
 * 속도 기반 + Activity Recognition 하이브리드
 */

import {ActivityType} from '../types/location';

// 속도 임계값 (m/s)
const SPEED_THRESHOLDS = {
  STILL: 0.4, // 1.4 km/h
  WALKING_MAX: 1.67, // 6 km/h
  RUNNING_MAX: 3.33, // 12 km/h
};

// Activity Recognition 신뢰도 임계값
const CONFIDENCE_THRESHOLDS = {
  LOW: 50,
  MEDIUM: 70,
  HIGH: 85,
};

/**
 * 속도 기반으로 활동 유형 추정 (1단계: 빠른 피드백)
 */
export function estimateActivityBySpeed(speedMs: number): ActivityType {
  if (speedMs < SPEED_THRESHOLDS.STILL) {
    return 'still';
  } else if (speedMs < SPEED_THRESHOLDS.WALKING_MAX) {
    return 'walking';
  } else if (speedMs < SPEED_THRESHOLDS.RUNNING_MAX) {
    return 'running';
  } else {
    return 'vehicle';
  }
}

/**
 * iOS Activity Recognition 결과를 우리 타입으로 매핑
 */
export function mapIOSActivity(iosActivity: string): ActivityType {
  const activityMap: Record<string, ActivityType> = {
    'still': 'still',
    'on_foot': 'walking',
    'walking': 'walking',
    'running': 'running',
    'on_bicycle': 'vehicle',
    'in_vehicle': 'vehicle',
    'automotive': 'vehicle',
    'unknown': 'unknown',
  };

  return activityMap[iosActivity.toLowerCase()] || 'unknown';
}

/**
 * 하이브리드 활동 감지 (2단계: AI 보정)
 * 속도 추정과 Activity Recognition을 결합
 */
export function determineActivity(
  speedMs: number,
  aiActivity: ActivityType | null,
  aiConfidence: number,
): {
  activityType: ActivityType;
  estimatedBySpeed: boolean;
} {
  // AI 인식이 없거나 신뢰도가 매우 낮으면 속도 기반 사용
  if (!aiActivity || aiConfidence < CONFIDENCE_THRESHOLDS.LOW) {
    return {
      activityType: estimateActivityBySpeed(speedMs),
      estimatedBySpeed: true,
    };
  }

  // AI 신뢰도가 높으면 AI 결과 사용
  if (aiConfidence >= CONFIDENCE_THRESHOLDS.HIGH) {
    return {
      activityType: aiActivity,
      estimatedBySpeed: false,
    };
  }

  // 중간 신뢰도: 속도와 교차 검증
  const speedEstimate = estimateActivityBySpeed(speedMs);

  // 속도와 AI가 일치하면 AI 사용
  if (speedEstimate === aiActivity) {
    return {
      activityType: aiActivity,
      estimatedBySpeed: false,
    };
  }

  // 불일치 시: 명확한 케이스는 속도 우선
  // 예: 속도가 15km/h인데 AI가 walking이라고 하면 vehicle 사용
  if (speedMs > SPEED_THRESHOLDS.RUNNING_MAX) {
    return {
      activityType: 'vehicle',
      estimatedBySpeed: true,
    };
  }

  // 애매한 케이스는 AI 사용 (신뢰도 50-85%)
  return {
    activityType: aiActivity,
    estimatedBySpeed: false,
  };
}

/**
 * 활동 유형을 색상으로 변환
 */
export function getActivityColor(activityType: ActivityType): string {
  const colorMap: Record<ActivityType, string> = {
    walking: '#34C759', // 초록색
    running: '#007AFF', // 파란색
    vehicle: '#8E8E93', // 회색
    still: '#8E8E93', // 회색
    unknown: '#8E8E93', // 회색
  };

  return colorMap[activityType];
}

/**
 * 활동 유형을 한글로 변환
 */
export function getActivityLabel(activityType: ActivityType): string {
  const labelMap: Record<ActivityType, string> = {
    walking: '걷기',
    running: '뛰기',
    vehicle: '이동',
    still: '정지',
    unknown: '알 수 없음',
  };

  return labelMap[activityType];
}
