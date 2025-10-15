/**
 * 결과 화면
 */

import CalcService from "@/services/CalcService";
import DatabaseService from "@/services/DatabaseService";
import {
	formatAvgPace,
	formatCalories,
	formatDistance,
	formatDuration,
	formatPace,
} from "@/utils/formatters";
import { getActivityColor, getActivityLabel } from "@utils/activityDetector";
import React, { useMemo } from "react";
import {
	Alert,
	ScrollView,
	StatusBar,
	StyleSheet,
	Text,
	TouchableOpacity,
	View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function ResultScreen({ route, navigation }: any) {
	const { session } = route.params;

	// 활동별 세그먼트 계산
	const activityStats = useMemo(() => {
		if (!session.route || session.route.length === 0) {
			return [];
		}

		const segments = CalcService.segmentRouteByActivity(session.route);

		// 활동별 집계
		const stats = segments.reduce((acc: any, segment) => {
			const existing = acc.find(
				(s: any) => s.activityType === segment.activityType
			);
			if (existing) {
				existing.distance += segment.distance;
			} else {
				acc.push({
					activityType: segment.activityType,
					distance: segment.distance,
				});
			}
			return acc;
		}, []);

		// 거리 내림차순 정렬
		return stats.sort((a: any, b: any) => b.distance - a.distance);
	}, [session.route]);

	// GPS 추정 구간 통계
	const estimatedStats = useMemo(() => {
		if (!session.route || session.route.length === 0) {
			return {
				hasEstimated: false,
				estimatedDistance: 0,
				totalDistance: 0,
				estimatedPercentage: 0,
			};
		}

		const segments = CalcService.segmentRouteByActivity(session.route);

		const estimatedDistance = segments
			.filter((seg) => seg.isEstimated)
			.reduce((sum, seg) => sum + seg.distance, 0);

		const totalDistance = segments.reduce((sum, seg) => sum + seg.distance, 0);

		return {
			hasEstimated: estimatedDistance > 0,
			estimatedDistance,
			totalDistance,
			estimatedPercentage:
				totalDistance > 0 ? (estimatedDistance / totalDistance) * 100 : 0,
		};
	}, [session.route]);

	const handleSave = async () => {
		// 네비게이션으로 전달된 ISO 문자열을 Date 객체로 변환하여 저장
		const payload = {
			...session,
			startedAt: session.startedAt ? new Date(session.startedAt) : new Date(),
			endedAt: session.endedAt ? new Date(session.endedAt) : undefined,
		};
		try {
			await DatabaseService.saveRun(payload);
			Alert.alert("성공", "러닝 기록이 저장되었습니다", [
				{ text: "확인", onPress: () => navigation.navigate("Home") },
			]);
		} catch (error) {
			Alert.alert("오류", "저장에 실패했습니다");
		}
	};

	const handleDiscard = () => {
		Alert.alert("삭제 확인", "이 러닝 기록을 삭제하시겠습니까?", [
			{ text: "취소", style: "cancel" },
			{
				text: "삭제",
				style: "destructive",
				onPress: () => navigation.navigate("Home"),
			},
		]);
	};

	return (
		<SafeAreaView style={styles.container}>
			<StatusBar backgroundColor="#1A1A23" barStyle="light-content" />
			<ScrollView style={styles.scrollView}>
				<View style={styles.header}>
					<Text style={styles.title}>🎉 러닝 완료!</Text>
					<Text style={styles.subtitle}>수고하셨습니다</Text>
				</View>

				<View style={styles.statsContainer}>
					<View style={styles.mainStat}>
						<Text style={styles.mainStatLabel}>총 거리</Text>
						<Text style={styles.mainStatValue}>
							{formatDistance(session.totalDistance)} km
						</Text>
					</View>

					<View style={styles.secondaryStats}>
						<View style={styles.stat}>
							<Text style={styles.statLabel}>총 시간</Text>
							<Text style={styles.statValue}>
								{formatDuration(session.totalDuration)}
							</Text>
						</View>

						<View style={styles.stat}>
							<Text style={styles.statLabel}>평균 페이스</Text>
							<Text style={styles.statValue}>
								{formatAvgPace(session.avgPace)}
							</Text>
						</View>

						<View style={styles.stat}>
							<Text style={styles.statLabel}>칼로리</Text>
							<Text style={styles.statValue}>
								{formatCalories(session.calories)} kcal
							</Text>
						</View>
					</View>

					{activityStats.length > 0 && (
						<View style={styles.activitySection}>
							<Text style={styles.sectionTitle}>활동별 기록</Text>
							{activityStats.map((stat: any, index: number) => (
								<View key={index} style={styles.activityItem}>
									<View style={styles.activityInfo}>
										<View
											style={[
												styles.activityDot,
												{
													backgroundColor: getActivityColor(stat.activityType),
												},
											]}
										/>
										<Text style={styles.activityName}>
											{getActivityLabel(stat.activityType)}
										</Text>
									</View>
									<Text style={styles.activityDistance}>
										{formatDistance(stat.distance)} km
									</Text>
								</View>
							))}
							<View style={styles.activityNote}>
								<Text style={styles.activityNoteText}>
									ℹ️ 칼로리는 걷기와 뛰기만 포함됩니다
								</Text>
							</View>
						</View>
					)}

					{estimatedStats.hasEstimated && (
						<View style={styles.estimatedSection}>
							<Text style={styles.sectionTitle}>GPS 신호 손실 구간</Text>
							<View style={styles.estimatedWarning}>
								<Text style={styles.estimatedWarningIcon}>⚠️</Text>
								<View style={styles.estimatedWarningContent}>
									<Text style={styles.estimatedWarningTitle}>
										GPS 신호 손실이 감지되었습니다
									</Text>
									<Text style={styles.estimatedWarningText}>
										일부 구간이 추정값으로 기록되었습니다
									</Text>
								</View>
							</View>
							<View style={styles.estimatedStats}>
								<View style={styles.estimatedStatItem}>
									<Text style={styles.estimatedStatLabel}>추정 거리</Text>
									<Text style={styles.estimatedStatValue}>
										{formatDistance(estimatedStats.estimatedDistance)} km
									</Text>
								</View>
								<View style={styles.estimatedStatItem}>
									<Text style={styles.estimatedStatLabel}>전체 대비</Text>
									<Text style={styles.estimatedStatValue}>
										{estimatedStats.estimatedPercentage.toFixed(1)}%
									</Text>
								</View>
							</View>
							<View style={styles.estimatedNote}>
								<Text style={styles.estimatedNoteText}>
									📍 지도의 점선 구간이 GPS 신호 손실로 인한 추정 경로입니다
								</Text>
							</View>
						</View>
					)}

					{session.splits.length > 0 && (
						<View style={styles.splitsSection}>
							<Text style={styles.sectionTitle}>구간 기록</Text>
							{session.splits.map((split: any) => (
								<View key={split.splitNumber} style={styles.splitItem}>
									<Text style={styles.splitNumber}>{split.splitNumber}km</Text>
									<Text style={styles.splitPace}>{formatPace(split.pace)}</Text>
								</View>
							))}
						</View>
					)}
				</View>
			</ScrollView>

			<View style={styles.actions}>
				<TouchableOpacity style={styles.saveButton} onPress={handleSave}>
					<Text style={styles.saveButtonText}>저장</Text>
				</TouchableOpacity>

				<TouchableOpacity style={styles.discardButton} onPress={handleDiscard}>
					<Text style={styles.discardButtonText}>삭제</Text>
				</TouchableOpacity>
			</View>
		</SafeAreaView>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: "#1A1A23",
	},
	scrollView: {
		flex: 1,
	},
	header: {
		alignItems: "center",
		paddingVertical: 32,
	},
	title: {
		fontSize: 32,
		fontWeight: "700",
		marginBottom: 8,
		color: "#fff",
	},
	subtitle: {
		fontSize: 16,
		color: "#ccc",
	},
	statsContainer: {
		paddingHorizontal: 24,
	},
	mainStat: {
		backgroundColor: "#00FF47",
		padding: 32,
		borderRadius: 16,
		alignItems: "center",
		marginBottom: 24,
	},
	mainStatLabel: {
		color: "#09090E",
		fontSize: 16,
		marginBottom: 8,
	},
	mainStatValue: {
		color: "#09090E",
		fontSize: 48,
		fontWeight: "700",
	},
	secondaryStats: {
		flexDirection: "row",
		flexWrap: "wrap",
		justifyContent: "space-between",
		marginBottom: 24,
	},
	stat: {
		width: "48%",
		backgroundColor: "#2A2A33",
		padding: 20,
		borderRadius: 12,
		marginBottom: 12,
	},
	statLabel: {
		fontSize: 14,
		color: "#aaa",
		marginBottom: 8,
	},
	statValue: {
		fontSize: 24,
		fontWeight: "600",
		color: "#fff",
	},
	activitySection: {
		marginTop: 16,
		marginBottom: 16,
	},
	activityItem: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		paddingVertical: 12,
		paddingHorizontal: 16,
		backgroundColor: "#2A2A33",
		borderRadius: 8,
		marginBottom: 8,
	},
	activityInfo: {
		flexDirection: "row",
		alignItems: "center",
		gap: 10,
	},
	activityDot: {
		width: 12,
		height: 12,
		borderRadius: 6,
	},
	activityName: {
		fontSize: 16,
		fontWeight: "500",
		color: "#fff",
	},
	activityDistance: {
		fontSize: 16,
		fontWeight: "600",
		color: "#00FF47",
	},
	activityNote: {
		marginTop: 8,
		paddingVertical: 8,
		paddingHorizontal: 12,
		backgroundColor: "#23232E",
		borderRadius: 8,
	},
	activityNoteText: {
		fontSize: 13,
		color: "#ccc",
	},
	estimatedSection: {
		marginTop: 16,
		marginBottom: 16,
	},
	estimatedWarning: {
		flexDirection: "row",
		backgroundColor: "#23232E",
		padding: 16,
		borderRadius: 12,
		marginBottom: 16,
		alignItems: "center",
		gap: 12,
	},
	estimatedWarningIcon: {
		fontSize: 24,
	},
	estimatedWarningContent: {
		flex: 1,
	},
	estimatedWarningTitle: {
		fontSize: 15,
		fontWeight: "600",
		color: "#FFCC00",
		marginBottom: 4,
	},
	estimatedWarningText: {
		fontSize: 13,
		color: "#ccc",
	},
	estimatedStats: {
		flexDirection: "row",
		justifyContent: "space-between",
		marginBottom: 12,
		gap: 12,
	},
	estimatedStatItem: {
		flex: 1,
		backgroundColor: "#2A2A33",
		padding: 16,
		borderRadius: 8,
		alignItems: "center",
	},
	estimatedStatLabel: {
		fontSize: 13,
		color: "#aaa",
		marginBottom: 6,
	},
	estimatedStatValue: {
		fontSize: 20,
		fontWeight: "600",
		color: "#00FF47",
	},
	estimatedNote: {
		padding: 12,
		backgroundColor: "#23232E",
		borderRadius: 8,
	},
	estimatedNoteText: {
		fontSize: 12,
		color: "#ccc",
		lineHeight: 18,
	},
	splitsSection: {
		marginTop: 16,
	},
	sectionTitle: {
		fontSize: 20,
		fontWeight: "600",
		marginBottom: 16,
		color: "#fff",
	},
	splitItem: {
		flexDirection: "row",
		justifyContent: "space-between",
		paddingVertical: 12,
		borderBottomWidth: 1,
		borderBottomColor: "#2A2A33",
	},
	splitNumber: {
		fontSize: 16,
		fontWeight: "500",
		color: "#fff",
	},
	splitPace: {
		fontSize: 16,
		color: "#ccc",
	},
	actions: {
		flexDirection: "row",
		paddingHorizontal: 24,
		paddingVertical: 16,
		gap: 12,
		borderTopWidth: 1,
		borderTopColor: "#2A2A33",
	},
	saveButton: {
		flex: 1,
		backgroundColor: "#00FF47",
		paddingVertical: 18,
		borderRadius: 12,
		alignItems: "center",
	},
	saveButtonText: {
		color: "#09090E",
		fontSize: 18,
		fontWeight: "600",
	},
	discardButton: {
		flex: 1,
		backgroundColor: "#1A1A23",
		paddingVertical: 18,
		borderRadius: 12,
		alignItems: "center",
		borderWidth: 1,
		borderColor: "#2A2A33",
	},
	discardButtonText: {
		color: "#ccc",
		fontSize: 18,
		fontWeight: "600",
	},
});
