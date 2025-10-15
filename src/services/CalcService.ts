/**
 * 러닝 데이터 계산 서비스
 */

import { calculatePace } from "@/utils/formatters";
import { CALORIE_CONFIG, SPLIT_CONFIG } from "@constants/config";
import { calculateTotalDistance } from "@utils/haversine";
import { GPSCoordinate, RouteSegment } from "../types/location";
import { Split } from "../types/run";

class CalcService {
	/**
	 * 활동별 칼로리 계산 (walking, running만 포함)
	 * @param segments 경로 세그먼트 배열
	 * @param weightKg 체중 (kg)
	 */
	calculateCaloriesByActivity(
		segments: RouteSegment[],
		weightKg?: number
	): number {
		const weight = weightKg || CALORIE_CONFIG.DEFAULT_WEIGHT;

		return segments.reduce((total, segment) => {
			// walking과 running만 칼로리 계산에 포함
			if (segment.activityType === "walking") {
				// 걷기: 체중 × 거리 × 0.6
				return total + segment.distance * weight * 0.6;
			} else if (segment.activityType === "running") {
				// 뛰기: 체중 × 거리 × 1.036
				return total + segment.distance * weight * 1.036;
			}
			// vehicle, still, unknown은 칼로리 제외
			return total;
		}, 0);
	}

	/**
	 * 경로를 활동 유형별 세그먼트로 분할
	 */
	segmentRouteByActivity(route: GPSCoordinate[]): RouteSegment[] {
		if (route.length === 0) {
			return [];
		}

		const segments: RouteSegment[] = [];
		let currentActivity = route[0].activityType;
		let currentPoints: GPSCoordinate[] = [route[0]];
		let startIndex = 0;

		for (let i = 1; i < route.length; i++) {
			const point = route[i];

			// 활동 유형이 변경되면 새 세그먼트 시작
			if (point.activityType !== currentActivity) {
				// 이전 세그먼트 저장
				const distance = calculateTotalDistance(currentPoints);
				// 세그먼트의 모든 포인트가 추정값인지 확인
				const isEstimated = currentPoints.every((p) => p.isEstimated);

				segments.push({
					activityType: currentActivity,
					points: currentPoints,
					distance,
					startIndex,
					endIndex: i - 1,
					isEstimated,
				});

				// 새 세그먼트 시작
				currentActivity = point.activityType;
				currentPoints = [point];
				startIndex = i;
			} else {
				currentPoints.push(point);
			}
		}

		// 마지막 세그먼트 저장
		if (currentPoints.length > 0) {
			const distance = calculateTotalDistance(currentPoints);
			// 세그먼트의 모든 포인트가 추정값인지 확인
			const isEstimated = currentPoints.every((p) => p.isEstimated);

			segments.push({
				activityType: currentActivity,
				points: currentPoints,
				distance,
				startIndex,
				endIndex: route.length - 1,
				isEstimated,
			});
		}

		return segments;
	}

	/**
	 * 스플릿 계산 (1km 단위)
	 * @param route GPS 경로
	 * @param timestamps 각 포인트의 타임스탬프 (초)
	 */
	calculateSplits(route: GPSCoordinate[]): Split[] {
		if (route.length < 2) {
			return [];
		}

		const splits: Split[] = [];
		let splitNumber = 1;
		let splitDistance = 0;
		let splitStartIndex = 0;
		let splitStartTime = route[0].timestamp;

		for (let i = 1; i < route.length; i++) {
			const segmentDistance = calculateTotalDistance([route[i - 1], route[i]]);
			splitDistance += segmentDistance;

			// 1km 달성
			if (splitDistance >= SPLIT_CONFIG.DISTANCE) {
				const duration = (route[i].timestamp - splitStartTime) / 1000; // 초
				const pace = calculatePace(SPLIT_CONFIG.DISTANCE, duration);

				splits.push({
					splitNumber,
					distance: SPLIT_CONFIG.DISTANCE,
					duration: Math.round(duration),
					pace,
				});

				splitNumber++;
				splitDistance = 0;
				splitStartIndex = i;
				splitStartTime = route[i].timestamp;
			}
		}

		// 마지막 구간 (1km 미만)
		if (splitDistance > 0 && route.length > splitStartIndex + 1) {
			const duration =
				(route[route.length - 1].timestamp - splitStartTime) / 1000;
			const pace = calculatePace(splitDistance, duration);

			splits.push({
				splitNumber,
				distance: splitDistance,
				duration: Math.round(duration),
				pace,
			});
		}

		return splits;
	}

	/**
	 * 평균 페이스 계산
	 * @param totalDistance 총 거리 (km)
	 * @param movingDuration 이동 시간 (초)
	 */
	calculateAveragePace(totalDistance: number, movingDuration: number): number {
		return calculatePace(totalDistance, movingDuration);
	}

	/**
	 * 현재 페이스 계산 (최근 N개 포인트 기준)
	 * @param recentPoints 최근 GPS 포인트들
	 * @param windowSize 계산할 포인트 개수 (기본: 5개)
	 */
	calculateCurrentPace(
		recentPoints: GPSCoordinate[],
		windowSize: number = 5
	): number {
		if (recentPoints.length < 2) {
			return 0;
		}

		const points =
			recentPoints.length > windowSize
				? recentPoints.slice(-windowSize)
				: recentPoints;

		const distance = calculateTotalDistance(points);
		const duration =
			(points[points.length - 1].timestamp - points[0].timestamp) / 1000;

		return calculatePace(distance, duration);
	}

	/**
	 * 자동 일시정지 판단
	 * @param recentSpeeds 최근 속도 배열 (km/h)
	 * @param threshold 임계값 (km/h)
	 * @param requiredCount 필요한 연속 카운트
	 */
	shouldAutoPause(
		recentSpeeds: number[],
		threshold: number,
		requiredCount: number
	): boolean {
		if (recentSpeeds.length < requiredCount) {
			return false;
		}

		const recent = recentSpeeds.slice(-requiredCount);
		return recent.every((speed) => speed < threshold);
	}

	/**
	 * 자동 재개 판단
	 * @param recentSpeeds 최근 속도 배열 (km/h)
	 * @param threshold 임계값 (km/h)
	 * @param requiredCount 필요한 연속 카운트
	 */
	shouldAutoResume(
		recentSpeeds: number[],
		threshold: number,
		requiredCount: number
	): boolean {
		if (recentSpeeds.length < requiredCount) {
			return false;
		}

		const recent = recentSpeeds.slice(-requiredCount);
		return recent.every((speed) => speed >= threshold);
	}
}

export default new CalcService();
