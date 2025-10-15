/**
 * 러닝 세션 전역 상태 관리 (Zustand)
 */

import {create} from 'zustand';
import {GPSCoordinate} from '../types/location';
import {RunStatus, LiveStats} from '../types/run';
import BackgroundGeoService from '../services/BackgroundGeoService';
import CalcService from '../services/CalcService';
import {calculateTotalDistance} from '../utils/haversine';

// GPS 신호 손실 시 사용자 선택 콜백 타입
export type GPSLossChoiceCallback = (choice: 'continue' | 'pause') => void;

interface RunningState {
  // 상태
  status: RunStatus;
  isAutoPaused: boolean;
  pauseReason: 'manual' | 'gps_loss' | null; // 일시정지 이유
  gpsSignalLost: boolean; // GPS 신호 손실 여부
  gpsLossStartTime: number | null; // GPS 신호 손실 시작 시간

  // 실시간 데이터
  route: GPSCoordinate[];
  distance: number; // km
  duration: number; // seconds
  movingDuration: number; // seconds
  currentPace: number; // min/km
  avgPace: number; // min/km
  calories: number;

  // 시간 관련
  startTime: Date | null;
  pauseTime: Date | null;
  lastGPSUpdateTime: number | null; // 마지막 GPS 업데이트 시간

  // GPS 신호 손실 콜백
  onGPSSignalShortLoss?: () => void; // 짧은 신호 손실 (< 30s)
  onGPSSignalMediumLoss?: (callback: GPSLossChoiceCallback) => void; // 중간 신호 손실 (30s - 3min)
  onGPSSignalLongLoss?: () => void; // 긴 신호 손실 (> 3min)

  // 액션
  start: () => Promise<void>;
  pause: (reason?: 'manual' | 'gps_loss') => Promise<void>;
  resume: () => Promise<void>;
  stop: () => Promise<void>;
  addGPSPoint: (point: GPSCoordinate) => void;
  updateStats: (stats: Partial<LiveStats>) => void;
  setAutoPaused: (isPaused: boolean) => void;
  setGPSLossCallbacks: (callbacks: {
    onShortLoss?: () => void;
    onMediumLoss?: (callback: GPSLossChoiceCallback) => void;
    onLongLoss?: () => void;
  }) => void;
  handleGPSLossChoice: (choice: 'continue' | 'pause') => void;
  reset: () => void;
}

const initialState = {
  status: 'idle' as RunStatus,
  isAutoPaused: false,
  pauseReason: null as 'manual' | 'gps_loss' | null,
  gpsSignalLost: false,
  gpsLossStartTime: null,
  route: [],
  distance: 0,
  duration: 0,
  movingDuration: 0,
  currentPace: 0,
  avgPace: 0,
  calories: 0,
  startTime: null,
  pauseTime: null,
  lastGPSUpdateTime: null,
};

// Duration 업데이트 타이머
let durationInterval: NodeJS.Timeout | null = null;

// 자동 일시정지/재개를 위한 속도 추적
let lowSpeedStartTime: number | null = null; // 저속 시작 시간
let highSpeedStartTime: number | null = null; // 고속 시작 시간

const AUTO_PAUSE_THRESHOLD = 0.5 / 3.6; // 0.5km/h = 0.139 m/s
const AUTO_RESUME_THRESHOLD = 2.0 / 3.6; // 2km/h = 0.556 m/s
const AUTO_PAUSE_DURATION = 3000; // 3초
const AUTO_RESUME_DURATION = 2000; // 2초

// GPS 신호 손실 임계값
const GPS_LOSS_DETECTION_DELAY = 60 * 1000; // 60초 - 신호 손실 감지 시작 (10초 → 60초로 변경)
const GPS_LOSS_SHORT_THRESHOLD = 90 * 1000; // 90초 - 짧은 신호 손실 콜백
const GPS_LOSS_MEDIUM_THRESHOLD = 3 * 60 * 1000; // 3분 - 중간 신호 손실 (사용자 선택)
const GPS_SIGNAL_CHECK_INTERVAL = 10000; // 10초마다 체크 (5초 → 10초로 변경)

// GPS 신호 손실 체크 타이머
let gpsSignalCheckInterval: NodeJS.Timeout | null = null;

// GPS 중간 손실 다이얼로그 표시 플래그 (중복 표시 방지)
let mediumLossDialogShown = false;

export const useRunningStore = create<RunningState>((set, get) => ({
  ...initialState,

  start: async () => {
    // BackgroundGeolocation 초기화 및 시작
    await BackgroundGeoService.configure((location) => {
      // GPS 포인트가 업데이트될 때마다 호출
      const state = get();
      if (state.status === 'running') {
        get().addGPSPoint(location);
      }
    });

    await BackgroundGeoService.start();

    set({
      status: 'running',
      startTime: new Date(),
      route: [],
      distance: 0,
      duration: 0,
      movingDuration: 0,
      currentPace: 0,
      avgPace: 0,
      calories: 0,
      isAutoPaused: false,
      gpsSignalLost: false,
      gpsLossStartTime: null,
      lastGPSUpdateTime: Date.now(),
    });

    // Duration 업데이트 타이머 시작
    durationInterval = setInterval(() => {
      const state = get();
      // 자동 일시정지 중에는 duration 업데이트 안함
      if (state.status === 'running' && !state.isAutoPaused && state.startTime) {
        const now = new Date().getTime();
        const start = state.startTime.getTime();
        const newDuration = Math.floor((now - start) / 1000);

        set({duration: newDuration});
      }
    }, 1000);

    // GPS 신호 손실 체크 타이머 시작
    gpsSignalCheckInterval = setInterval(() => {
      const state = get();
      const now = Date.now();

      // running 상태이고 마지막 GPS 업데이트가 있는 경우에만 체크
      if (state.status === 'running' && state.lastGPSUpdateTime) {
        const timeSinceLastUpdate = now - state.lastGPSUpdateTime;

        // GPS 신호 손실이 시작되지 않은 경우
        if (!state.gpsSignalLost && timeSinceLastUpdate > GPS_LOSS_DETECTION_DELAY) {
          console.warn('[GPS] 신호 손실 감지:', (timeSinceLastUpdate / 1000).toFixed(0), '초');
          set({
            gpsSignalLost: true,
            gpsLossStartTime: state.lastGPSUpdateTime,
          });
        }

        // GPS 신호 손실이 진행 중인 경우
        if (state.gpsSignalLost && state.gpsLossStartTime) {
          const lossDuration = now - state.gpsLossStartTime;

          // 짧은 신호 손실 (60초 ~ 90초) - 알림만 표시
          if (lossDuration > GPS_LOSS_DETECTION_DELAY &&
              lossDuration <= GPS_LOSS_SHORT_THRESHOLD) {
            if (state.onGPSSignalShortLoss) {
              state.onGPSSignalShortLoss();
            }
          }

          // 중간 신호 손실 (90초 ~ 3분) - 다이얼로그 1회만 표시
          if (lossDuration > GPS_LOSS_SHORT_THRESHOLD &&
              lossDuration <= GPS_LOSS_MEDIUM_THRESHOLD &&
              !mediumLossDialogShown) {
            // 중간 신호 손실 콜백 (사용자 선택 필요)
            mediumLossDialogShown = true;
            if (state.onGPSSignalMediumLoss) {
              state.onGPSSignalMediumLoss((choice) => {
                get().handleGPSLossChoice(choice);
              });
            }
          }

          // 긴 신호 손실 (3분 이상) - 자동 일시정지
          if (lossDuration > GPS_LOSS_MEDIUM_THRESHOLD) {
            console.warn('[GPS] 신호 장시간 손실 - 자동 일시정지');
            if (state.onGPSSignalLongLoss) {
              state.onGPSSignalLongLoss();
            }
            get().pause('gps_loss');
          }
        }
      }
    }, GPS_SIGNAL_CHECK_INTERVAL);
  },

  pause: async (reason: 'manual' | 'gps_loss' = 'manual') => {
    await BackgroundGeoService.pause();

    set({
      status: 'paused',
      pauseTime: new Date(),
      pauseReason: reason,
    });

    // 타이머 정지
    if (durationInterval) {
      clearInterval(durationInterval);
      durationInterval = null;
    }

    // GPS 신호 체크 타이머 정지
    if (gpsSignalCheckInterval) {
      clearInterval(gpsSignalCheckInterval);
      gpsSignalCheckInterval = null;
    }
  },

  resume: async () => {
    const {pauseTime} = get();
    if (pauseTime) {
      await BackgroundGeoService.resume();

      set({
        status: 'running',
        pauseTime: null,
        pauseReason: null, // 일시정지 이유 초기화
        lastGPSUpdateTime: Date.now(), // GPS 업데이트 시간 초기화
      });

      // 타이머 재시작
      durationInterval = setInterval(() => {
        const state = get();
        // 자동 일시정지 중에는 duration 업데이트 안함
        if (state.status === 'running' && !state.isAutoPaused && state.startTime) {
          const now = new Date().getTime();
          const start = state.startTime.getTime();
          const newDuration = Math.floor((now - start) / 1000);

          set({duration: newDuration});
        }
      }, 1000);

      // GPS 신호 체크 타이머 재시작
      gpsSignalCheckInterval = setInterval(() => {
        const state = get();
        const now = Date.now();

        if (state.status === 'running' && state.lastGPSUpdateTime) {
          const timeSinceLastUpdate = now - state.lastGPSUpdateTime;

          // GPS 신호 손실이 시작되지 않은 경우
          if (!state.gpsSignalLost && timeSinceLastUpdate > GPS_LOSS_DETECTION_DELAY) {
            console.warn('[GPS] 신호 손실 감지:', (timeSinceLastUpdate / 1000).toFixed(0), '초');
            set({
              gpsSignalLost: true,
              gpsLossStartTime: state.lastGPSUpdateTime,
            });
          }

          // GPS 신호 손실이 진행 중인 경우
          if (state.gpsSignalLost && state.gpsLossStartTime) {
            const lossDuration = now - state.gpsLossStartTime;

            // 짧은 신호 손실 (60초 ~ 90초) - 알림만 표시
            if (lossDuration > GPS_LOSS_DETECTION_DELAY &&
                lossDuration <= GPS_LOSS_SHORT_THRESHOLD) {
              if (state.onGPSSignalShortLoss) {
                state.onGPSSignalShortLoss();
              }
            }

            // 중간 신호 손실 (90초 ~ 3분) - 다이얼로그 1회만 표시
            if (lossDuration > GPS_LOSS_SHORT_THRESHOLD &&
                lossDuration <= GPS_LOSS_MEDIUM_THRESHOLD &&
                !mediumLossDialogShown) {
              mediumLossDialogShown = true;
              if (state.onGPSSignalMediumLoss) {
                state.onGPSSignalMediumLoss((choice) => {
                  get().handleGPSLossChoice(choice);
                });
              }
            }

            // 긴 신호 손실 (3분 이상) - 자동 일시정지
            if (lossDuration > GPS_LOSS_MEDIUM_THRESHOLD) {
              console.warn('[GPS] 신호 장시간 손실 - 자동 일시정지');
              if (state.onGPSSignalLongLoss) {
                state.onGPSSignalLongLoss();
              }
              get().pause('gps_loss');
            }
          }
        }
      }, GPS_SIGNAL_CHECK_INTERVAL);
    }
  },

  stop: async () => {
    await BackgroundGeoService.stop();

    set({
      status: 'stopped',
    });

    // 타이머 정지
    if (durationInterval) {
      clearInterval(durationInterval);
      durationInterval = null;
    }

    // GPS 신호 체크 타이머 정지
    if (gpsSignalCheckInterval) {
      clearInterval(gpsSignalCheckInterval);
      gpsSignalCheckInterval = null;
    }
  },

  addGPSPoint: (point: GPSCoordinate) => {
    const state = get();
    const now = Date.now();

    // GPS 신호 복구 처리
    let updatedPoint = {...point};
    if (state.gpsSignalLost) {
      console.log('[GPS] 신호 복구됨');
      // GPS 신호 손실에서 복구된 첫 포인트에 마커 표시
      updatedPoint.gpsSignalLost = true;

      // GPS 신호 복구
      set({
        gpsSignalLost: false,
        gpsLossStartTime: null,
      });

      // 다이얼로그 플래그 리셋
      mediumLossDialogShown = false;

      // GPS 손실로 인한 일시정지였다면 자동 재개
      if (state.status === 'paused' && state.pauseReason === 'gps_loss') {
        console.log('[GPS] 신호 복구 - 자동 재개');
        // 비동기로 resume 호출 (현재 함수 실행을 방해하지 않도록)
        setTimeout(() => {
          get().resume();
        }, 100);
      }
    }

    // GPS 업데이트 시간 갱신
    set({lastGPSUpdateTime: now});

    // 속도 기반 자동 일시정지/재개 로직
    const speed = point.speed || 0; // m/s

    // 자동 일시정지 체크 (running 상태이고, 자동 일시정지되지 않은 경우)
    if (state.status === 'running' && !state.isAutoPaused) {
      if (speed < AUTO_PAUSE_THRESHOLD) {
        // 저속 지속 시간 체크
        if (lowSpeedStartTime === null) {
          lowSpeedStartTime = now;
        } else if (now - lowSpeedStartTime >= AUTO_PAUSE_DURATION) {
          // 3초 이상 저속 → 자동 일시정지
          console.log('[Auto-Pause] 속도가 낮아 자동 일시정지:', speed.toFixed(2), 'm/s');
          set({isAutoPaused: true});
          lowSpeedStartTime = null;
        }
      } else {
        // 속도가 올라가면 타이머 리셋
        lowSpeedStartTime = null;
      }
    }

    // 자동 재개 체크 (자동 일시정지된 경우)
    if (state.isAutoPaused) {
      if (speed >= AUTO_RESUME_THRESHOLD) {
        // 고속 지속 시간 체크
        if (highSpeedStartTime === null) {
          highSpeedStartTime = now;
        } else if (now - highSpeedStartTime >= AUTO_RESUME_DURATION) {
          // 2초 이상 고속 → 자동 재개
          console.log('[Auto-Resume] 속도가 올라가 자동 재개:', speed.toFixed(2), 'm/s');
          set({isAutoPaused: false});
          highSpeedStartTime = null;
        }
      } else {
        // 속도가 내려가면 타이머 리셋
        highSpeedStartTime = null;
      }

      // 자동 일시정지 중에는 GPS 포인트를 추가하지 않음
      return;
    }

    const newRoute = [...state.route, updatedPoint];

    // 거리 계산
    const distance = calculateTotalDistance(newRoute);

    // 활동별 세그먼트 분할
    const segments = CalcService.segmentRouteByActivity(newRoute);

    // 칼로리 계산 (walking, running만 포함)
    const calories = CalcService.calculateCaloriesByActivity(segments);

    // 현재 페이스 계산 (최근 5개 포인트)
    const currentPace = newRoute.length >= 2
      ? CalcService.calculateCurrentPace(newRoute, 5)
      : 0;

    // 평균 페이스 계산
    const avgPace = state.duration > 0
      ? CalcService.calculateAveragePace(distance, state.duration)
      : 0;

    set({
      route: newRoute,
      distance,
      calories,
      currentPace,
      avgPace,
      movingDuration: state.duration, // 간단히 duration과 동일하게 설정
    });
  },

  updateStats: (stats: Partial<LiveStats>) => {
    set(state => ({
      ...state,
      ...stats,
    }));
  },

  setAutoPaused: (isPaused: boolean) => {
    set({
      isAutoPaused: isPaused,
    });
  },

  setGPSLossCallbacks: (callbacks) => {
    set({
      onGPSSignalShortLoss: callbacks.onShortLoss,
      onGPSSignalMediumLoss: callbacks.onMediumLoss,
      onGPSSignalLongLoss: callbacks.onLongLoss,
    });
  },

  handleGPSLossChoice: (choice) => {
    console.log('[GPS] 사용자 선택:', choice);

    // 다이얼로그 플래그 리셋 (사용자가 선택했으므로)
    mediumLossDialogShown = false;

    if (choice === 'pause') {
      // 일시정지 선택
      get().pause('gps_loss');
    }
    // 'continue' 선택 시에는 계속 진행 (아무 작업 안함)
  },

  reset: () => {
    // 타이머 정리
    if (durationInterval) {
      clearInterval(durationInterval);
      durationInterval = null;
    }

    // GPS 신호 체크 타이머 정리
    if (gpsSignalCheckInterval) {
      clearInterval(gpsSignalCheckInterval);
      gpsSignalCheckInterval = null;
    }

    // 자동 일시정지/재개 타이머 초기화
    lowSpeedStartTime = null;
    highSpeedStartTime = null;

    // GPS 다이얼로그 플래그 초기화
    mediumLossDialogShown = false;

    set(initialState);
  },
}));
