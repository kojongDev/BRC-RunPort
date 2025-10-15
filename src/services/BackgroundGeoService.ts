/**
 * 백그라운드 GPS 추적 서비스
 * react-native-background-geolocation 사용
 */

import BackgroundGeolocation, {
	Config,
	Location,
	State,
} from "react-native-background-geolocation";
import { ActivityType, GPSCoordinate } from "../types/location";
import { determineActivity, mapIOSActivity } from "../utils/activityDetector";

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
	async configure(
		onLocationUpdate: (location: GPSCoordinate) => void
	): Promise<void> {
		if (this.isConfigured) {
			return;
		}

		const config: Config = {
			// 🔍 디버그 / 로그 설정
			debug: __DEV__,
			logLevel: __DEV__
				? BackgroundGeolocation.LOG_LEVEL_VERBOSE
				: BackgroundGeolocation.LOG_LEVEL_OFF,

			// 📡 위치 정확도 설정
			desiredAccuracy: BackgroundGeolocation.DESIRED_ACCURACY_NAVIGATION, // 최고 정밀도 (운동/러닝용)
			distanceFilter: 10, // 3m 이동 시마다 이벤트 발생
			stationaryRadius: 10, // 정지 감지 반경 (25 → 10으로 축소)

			// 🏃‍♀️ 활동 인식 설정
			activityType: BackgroundGeolocation.ACTIVITY_TYPE_FITNESS,
			stopTimeout: 10, // 3분간 정지 시 자동 일시정지
			disableMotionActivityUpdates: false, // 움직임 감지 활성화

			// 💡 iOS 백그라운드 실행 관련
			preventSuspend: true, // 백그라운드에서도 GPS 계속 유지
			pausesLocationUpdatesAutomatically: false, // iOS 자동 일시정지 비활성화
			showsBackgroundLocationIndicator: true, // 상태바 GPS 아이콘 표시

			// ⏱ 업데이트 주기 제어
			locationUpdateInterval: 2000, // (Android) 2초마다 업데이트
			fastestLocationUpdateInterval: 1000, // (Android) 최대 1초 간격
			heartbeatInterval: 10, // 앱이 정지상태여도 30초마다 하트비트 콜백

			// ⚡ 배터리 / 프로세스 관리
			stopOnTerminate: false, // 앱 종료 후에도 추적 유지
			startOnBoot: false, // 부팅 시 자동 시작 X
			disableElasticity: true, // 일정 주기 유지 (배터리 절약용 조정 방지)
			elasticityMultiplier: 1, // elasticity를 완전히 끄려면 1로 고정

			// 🚨 위치 품질 필터링
			desiredOdometerAccuracy: 10, // 오도미터(누적거리) 오차 허용범위
			locationAuthorizationRequest: "Always", // 항상 위치 접근 권한 요청
			locationAuthorizationAlert: {
				titleWhenNotEnabled: "GPS가 꺼져 있습니다",
				titleWhenOff: "정확한 위치 추적이 필요합니다",
				instructions:
					"정확한 러닝 경로 기록을 위해 '항상 허용'으로 설정해주세요.",
				cancelButton: "나중에",
				settingsButton: "설정으로 이동",
			},

			// 🔔 백그라운드 알림 (iOS)
			notification: {
				title: "RunPort",
				text: "러닝 중 - 위치를 추적하고 있습니다",
			},

			// 🔄 자동 재시작 방지 (테스트 중)
			autoSync: false, // 서버 연동 시 사용 (지금은 로컬만)
			batchSync: false, // 배치 모드 해제 (실시간 추적이 목적이므로)
		};

		await BackgroundGeolocation.ready(config);

		// 위치 업데이트 리스너
		await BackgroundGeolocation.onLocation(
			(location: Location) => {
				console.log("[BG-GEO] Location:", location);

				const speedMs = location.coords.speed || 0;

				// 하이브리드 활동 감지
				const { activityType, estimatedBySpeed } = determineActivity(
					speedMs,
					this.currentAIActivity,
					this.currentAIConfidence
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
					`[Activity] ${activityType} (${
						estimatedBySpeed ? "속도" : "AI"
					} 기반, ${gpsPoint.activityConfidence}% 신뢰도)`
				);

				onLocationUpdate(gpsPoint);
			},
			(error) => {
				console.error("[BG-GEO] Location error:", error);
			}
		);

		// 모션 변경 리스너 (정지/이동 감지)
		await BackgroundGeolocation.onMotionChange((event) => {
			console.log(
				"[BG-GEO] Motion change:",
				event.isMoving ? "이동 중" : "정지"
			);
		});

		// 활동 인식 리스너 (iOS Core Motion)
		await BackgroundGeolocation.onActivityChange((event: any) => {
			const aiActivity = mapIOSActivity(event.activity);
			const aiConfidence = event.confidence;

			console.log(
				`[BG-GEO] AI Activity: ${event.activity} → ${aiActivity} (${aiConfidence}% 신뢰도)`
			);

			// AI 인식 결과 저장 (다음 GPS 업데이트에서 사용)
			this.currentAIActivity = aiActivity;
			this.currentAIConfidence = aiConfidence;
		});

		// 하트비트 리스너 (정지 상태에서도 주기적으로 최신 위치 샘플 요청)
		await BackgroundGeolocation.onHeartbeat(() => {
			BackgroundGeolocation.getCurrentPosition({
				timeout: 3,
				maximumAge: 1000,
				desiredAccuracy: 10,
				samples: 1,
			})
				.then(() => {
					// getCurrentPosition은 샘플들을 onLocation 리스너로 흘려보냄
				})
				.catch((error) => {
					console.warn("[BG-GEO] Heartbeat getCurrentPosition 실패:", error);
				});
		});

		this.isConfigured = true;
		console.log("[BG-GEO] 초기화 완료");
	}

	/**
	 * GPS 추적 시작
	 */
	async start(): Promise<void> {
		try {
			const state: State = await BackgroundGeolocation.start();
			console.log("[BG-GEO] 추적 시작:", state.enabled);
			// 개발/시뮬 환경에서 즉시 이동 상태로 전환하여 onLocation 스트림 유도
			await BackgroundGeolocation.changePace(true);
		} catch (error) {
			console.error("[BG-GEO] 시작 실패:", error);
			throw error;
		}
	}

	/**
	 * GPS 추적 일시정지
	 */
	async pause(): Promise<void> {
		try {
			await BackgroundGeolocation.stop();
			console.log("[BG-GEO] 추적 일시정지");
		} catch (error) {
			console.error("[BG-GEO] 일시정지 실패:", error);
		}
	}

	/**
	 * GPS 추적 재개
	 */
	async resume(): Promise<void> {
		try {
			await BackgroundGeolocation.start();
			console.log("[BG-GEO] 추적 재개");
			// 재개 시에도 즉시 이동 상태로 전환
			await BackgroundGeolocation.changePace(true);
		} catch (error) {
			console.error("[BG-GEO] 재개 실패:", error);
		}
	}

	/**
	 * GPS 추적 완전 종료
	 */
	async stop(): Promise<void> {
		try {
			await BackgroundGeolocation.stop();
			await BackgroundGeolocation.removeListeners();
			// 다음 시작 시 리스너를 재등록할 수 있도록 구성 상태 리셋
			this.isConfigured = false;
			this.currentAIActivity = null;
			this.currentAIConfidence = 0;
			console.log("[BG-GEO] 추적 종료");
		} catch (error) {
			console.error("[BG-GEO] 종료 실패:", error);
		}
	}

	/**
	 * 현재 위치 즉시 가져오기
	 */
	async getCurrentPosition(): Promise<GPSCoordinate | null> {
		try {
			const location: Location = await BackgroundGeolocation.getCurrentPosition(
				{
					timeout: 3, // ⏱️ 최대 15초 안에 위치를 가져오도록
					maximumAge: 1000, // 🧭 1초 이내 캐시만 허용 (거의 실시간)
					desiredAccuracy: 5, // 🎯 5m 이하의 오차 (고정밀)
					samples: 1, // 🧪 1회만 측정 (실시간 루프에서는 주기적으로 반복)
				}
			);

			const speedMs = location.coords.speed || 0;
			const { activityType, estimatedBySpeed } = determineActivity(
				speedMs,
				this.currentAIActivity,
				this.currentAIConfidence
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
			console.error("[BG-GEO] 현재 위치 가져오기 실패:", error);
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
