/**
 * RunPort 앱 설정 상수
 */

// GPS 트래킹 설정
export const GPS_CONFIG = {
  // GPS 샘플링 간격 (밀리초)
  SAMPLING_INTERVAL: 1000, // 1초

  // GPS 정확도 임계값 (미터)
  ACCURACY_THRESHOLD: 20,

  // 최대 속도 임계값 (km/h) - 이상치 제거용
  MAX_SPEED: 30,

  // 거리 계산 정밀도
  DISTANCE_PRECISION: 2, // 소수점 2자리
};

// 자동 일시정지/재개 설정
export const AUTO_PAUSE_CONFIG = {
  // 일시정지 속도 임계값 (km/h)
  PAUSE_SPEED_THRESHOLD: 0.5,

  // 일시정지 유지 시간 (초)
  PAUSE_DURATION: 3,

  // 재개 속도 임계값 (km/h)
  RESUME_SPEED_THRESHOLD: 2.0,

  // 재개 유지 시간 (초)
  RESUME_DURATION: 2,
};

// 칼로리 계산 상수
export const CALORIE_CONFIG = {
  // 칼로리 계산 계수
  COEFFICIENT: 1.036,

  // 기본 몸무게 (kg) - 사용자 설정이 없을 경우
  DEFAULT_WEIGHT: 70,
};

// 스플릿 설정
export const SPLIT_CONFIG = {
  // 스플릿 거리 (km)
  DISTANCE: 1.0,
};

// 지도 설정
export const MAP_CONFIG = {
  // 초기 지도 영역 델타
  INITIAL_DELTA: {
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  },

  // 경로 선 두께
  ROUTE_STROKE_WIDTH: 4,

  // 경로 선 색상
  ROUTE_STROKE_COLOR: '#007AFF',
};

// 앱 정보
export const APP_INFO = {
  NAME: 'RunPort',
  VERSION: '0.1.0',
  DESCRIPTION: '러닝 트래킹 앱',
};
