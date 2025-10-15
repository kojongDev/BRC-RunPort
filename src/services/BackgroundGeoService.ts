/**
 * 백그라운드 GPS 추적 서비스
 * react-native-background-geolocation 사용
 */

import BackgroundGeolocation, {
  Location,
  State,
  Config,
} from 'react-native-background-geolocation';
import {GPSCoordinate, ActivityType} from '../types/location';
import {mapIOSActivity, determineActivity} from '../utils/activityDetector';

// GPS 신호 품질 임계값
const GPS_ACCURACY_THRESHOLD = 50; // accuracy > 50m이면 신호 불량으로 판단

class BackgroundGeoService {
  private isConfigured = false;

  // 최근 Activity Recognition 결과 저장
  private currentAIActivity: ActivityType | null = null;
  private currentAIConfidence: number = 0;

  /**
   * 백그라운드 지오로케이션 초기화
   */
  async configure(onLocationUpdate: (location: GPSCoordinate) => void): Promise<void> {
    if (this.isConfigured) {
      return;
    }

    const config: Config = {
      // 디버그 설정
      debug: __DEV__,
      logLevel: __DEV__ ? BackgroundGeolocation.LOG_LEVEL_VERBOSE : BackgroundGeolocation.LOG_LEVEL_OFF,

      // 위치 추적 설정
      desiredAccuracy: BackgroundGeolocation.DESIRED_ACCURACY_HIGH,
      distanceFilter: 3, // 3m마다 업데이트 (더 정밀한 추적)
      stationaryRadius: 25,

      // 활동 인식 설정 (러닝/걷기 감지)
      activityType: BackgroundGeolocation.ACTIVITY_TYPE_FITNESS,
      stopTimeout: 5, // 5분간 정지 시 자동 일시정지

      // iOS 백그라운드 위치 추적 설정 (중요!)
      preventSuspend: true, // 백그라운드에서도 계속 실행
      pausesLocationUpdatesAutomatically: false, // iOS 자동 일시정지 비활성화
      showsBackgroundLocationIndicator: true, // 상태바 GPS 아이콘 표시
      allowsBackgroundLocationUpdates: true, // 백그라운드 위치 업데이트 허용
      heartbeatInterval: 60, // 1분마다 heartbeat

      // 배터리 최적화
      stopOnTerminate: false,
      startOnBoot: false,

      // 백그라운드 알림 (iOS)
      notification: {
        title: 'RunPort',
        text: '러닝 추적 중...',
      },
    };

    await BackgroundGeolocation.ready(config);

    // 위치 업데이트 리스너
    BackgroundGeolocation.onLocation(
      (location: Location) => {
        console.log('[BG-GEO] Location:', location);

        const speedMs = location.coords.speed || 0;

        // 하이브리드 활동 감지
        const {activityType, estimatedBySpeed} = determineActivity(
          speedMs,
          this.currentAIActivity,
          this.currentAIConfidence,
        );

        // GPS 신호 품질 판단
        const accuracy = location.coords.accuracy;
        const isGPSPoor = accuracy > GPS_ACCURACY_THRESHOLD;

        const gpsPoint: GPSCoordinate = {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          altitude: location.coords.altitude,
          accuracy: location.coords.accuracy,
          speed: location.coords.speed,
          timestamp: new Date(location.timestamp).getTime(),
          activityType,
          activityConfidence: estimatedBySpeed ? 50 : this.currentAIConfidence,
          estimatedBySpeed,
          isEstimated: false, // 초기값 (runningStore에서 신호 손실 감지 시 업데이트)
        };

        if (isGPSPoor) {
          console.warn(`[GPS] 신호 불량: accuracy ${accuracy.toFixed(1)}m`);
        }

        console.log(
          `[Activity] ${activityType} (${estimatedBySpeed ? '속도' : 'AI'} 기반, ${gpsPoint.activityConfidence}% 신뢰도)`,
        );

        onLocationUpdate(gpsPoint);
      },
      (error) => {
        console.error('[BG-GEO] Location error:', error);
      }
    );

    // 모션 변경 리스너 (정지/이동 감지)
    BackgroundGeolocation.onMotionChange((event) => {
      console.log('[BG-GEO] Motion change:', event.isMoving ? '이동 중' : '정지');
    });

    // 활동 인식 리스너 (iOS Core Motion)
    BackgroundGeolocation.onActivityChange((event: any) => {
      const aiActivity = mapIOSActivity(event.activity);
      const aiConfidence = event.confidence;

      console.log(
        `[BG-GEO] AI Activity: ${event.activity} → ${aiActivity} (${aiConfidence}% 신뢰도)`,
      );

      // AI 인식 결과 저장 (다음 GPS 업데이트에서 사용)
      this.currentAIActivity = aiActivity;
      this.currentAIConfidence = aiConfidence;
    });

    this.isConfigured = true;
    console.log('[BG-GEO] 초기화 완료');
  }

  /**
   * GPS 추적 시작
   */
  async start(): Promise<void> {
    try {
      const state: State = await BackgroundGeolocation.start();
      console.log('[BG-GEO] 추적 시작:', state.enabled);
    } catch (error) {
      console.error('[BG-GEO] 시작 실패:', error);
      throw error;
    }
  }

  /**
   * GPS 추적 일시정지
   */
  async pause(): Promise<void> {
    try {
      await BackgroundGeolocation.stop();
      console.log('[BG-GEO] 추적 일시정지');
    } catch (error) {
      console.error('[BG-GEO] 일시정지 실패:', error);
    }
  }

  /**
   * GPS 추적 재개
   */
  async resume(): Promise<void> {
    try {
      await BackgroundGeolocation.start();
      console.log('[BG-GEO] 추적 재개');
    } catch (error) {
      console.error('[BG-GEO] 재개 실패:', error);
    }
  }

  /**
   * GPS 추적 완전 종료
   */
  async stop(): Promise<void> {
    try {
      await BackgroundGeolocation.stop();
      await BackgroundGeolocation.removeListeners();
      console.log('[BG-GEO] 추적 종료');
    } catch (error) {
      console.error('[BG-GEO] 종료 실패:', error);
    }
  }

  /**
   * 현재 위치 즉시 가져오기
   */
  async getCurrentPosition(): Promise<GPSCoordinate | null> {
    try {
      const location: Location = await BackgroundGeolocation.getCurrentPosition({
        timeout: 30,
        maximumAge: 5000,
        desiredAccuracy: 10,
        samples: 1,
      });

      const speedMs = location.coords.speed || 0;
      const {activityType, estimatedBySpeed} = determineActivity(
        speedMs,
        this.currentAIActivity,
        this.currentAIConfidence,
      );

      return {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        altitude: location.coords.altitude,
        accuracy: location.coords.accuracy,
        speed: location.coords.speed,
        timestamp: new Date(location.timestamp).getTime(),
        activityType,
        activityConfidence: estimatedBySpeed ? 50 : this.currentAIConfidence,
        estimatedBySpeed,
        isEstimated: false,
      };
    } catch (error) {
      console.error('[BG-GEO] 현재 위치 가져오기 실패:', error);
      return null;
    }
  }

  /**
   * 추적 상태 확인
   */
  async getState(): Promise<State> {
    return await BackgroundGeolocation.getState();
  }
}

export default new BackgroundGeoService();
