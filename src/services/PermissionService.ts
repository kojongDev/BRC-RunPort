import { Platform } from "react-native";
import BackgroundGeolocation from "react-native-background-geolocation";

/**
 * 앱 시작 시 필요한 권한들을 선요청하는 유틸리티.
 * - iOS: 위치(Always/WhenInUse), 모션 권한(플러그인이 내부적으로 요청)
 * - Android: 현재 범위에서는 RNBG가 자체 처리. (확장 시 추가)
 */
export async function requestStartupPermissions(): Promise<void> {
	if (Platform.OS === "ios") {
		// RN Background Geolocation이 제공하는 권한 요청 API 사용
		// locationAuthorizationRequest는 플러그인 configure 시점에 반영되므로, 우선 권한만 선요청
		try {
			// 권한만 선요청 (configure는 Running 시작 시 올바른 콜백과 함께 실행)
			await BackgroundGeolocation.requestPermission();
		} catch (e) {
			// 사용자가 거부한 경우 등 — 조용히 진행 (화면 내 가이드로 재요청 유도 가능)
		}

		// iOS 14+ 정밀 위치(Temporary Full Accuracy) 요청
		// Info.plist에 NSLocationTemporaryUsageDescriptionDictionary 내 "FitnessTracking" 키가 있어야 함
		try {
			await BackgroundGeolocation.requestTemporaryFullAccuracy(
				"FitnessTracking"
			);
		} catch {}
	} else {
		// Android는 RNBG가 최초 start 시점에 권한 라쇼날/요청을 핸들한다. 별도 선요청은 생략.
	}
}
