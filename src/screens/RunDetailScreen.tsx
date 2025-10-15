/**
 * 러닝 상세 화면 - 저장된 기록 상세보기
 */

import DatabaseService from "@/services/DatabaseService";
import {
	formatCalories,
	formatDateTime,
	formatDistance,
	formatDuration,
	formatPace,
} from "@/utils/formatters";
import CalcService from "@services/CalcService";
import React, { useEffect, useState } from "react";
import {
	Dimensions,
	ScrollView,
	StyleSheet,
	Text,
	TouchableOpacity,
	View,
} from "react-native";
import MapView, { Polyline, PROVIDER_DEFAULT } from "react-native-maps";
import { SafeAreaView } from "react-native-safe-area-context";
import { GPSCoordinate } from "../types/location";
import { RunRecord, SplitRecord } from "../types/run";

const { width, height } = Dimensions.get("window");

interface Props {
	navigation: any;
	route: {
		params: {
			runId: number;
		};
	};
}

export default function RunDetailScreen({ navigation, route }: Props) {
	const { runId } = route.params;

	const [run, setRun] = useState<RunRecord | null>(null);
	const [gpsPoints, setGpsPoints] = useState<GPSCoordinate[]>([]);
	const [splits, setSplits] = useState<SplitRecord[]>([]);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		loadRunDetail();
	}, [runId]);

	const loadRunDetail = async () => {
		try {
			// 러닝 기본 정보
			const runs = await DatabaseService.getAllRuns();
			const runData = runs.find((r) => r.id === runId);

			if (!runData) {
				console.error("[RunDetail] 러닝 기록을 찾을 수 없습니다:", runId);
				return;
			}

			setRun(runData);

			// GPS 포인트
			const points = await DatabaseService.getGPSPoints(runId);
			setGpsPoints(points);

			// 스플릿
			const splitsData = await DatabaseService.getSplits(runId);
			setSplits(splitsData);

			console.log("[RunDetail] 로드 완료:", {
				run: runData,
				points: points.length,
				splits: splitsData.length,
			});
		} catch (error) {
			console.error("[RunDetail] 로드 실패:", error);
		} finally {
			setLoading(false);
		}
	};

	// 경로 세그먼트 생성 (활동별 색상)
	const routeSegments = React.useMemo(() => {
		return CalcService.segmentRouteByActivity(gpsPoints);
	}, [gpsPoints]);

	// 지도 영역 계산
	const mapRegion = React.useMemo(() => {
		if (gpsPoints.length === 0) {
			return {
				latitude: 37.5665,
				longitude: 126.978,
				latitudeDelta: 0.01,
				longitudeDelta: 0.01,
			};
		}

		const lats = gpsPoints.map((p) => p.latitude);
		const lons = gpsPoints.map((p) => p.longitude);

		const minLat = Math.min(...lats);
		const maxLat = Math.max(...lats);
		const minLon = Math.min(...lons);
		const maxLon = Math.max(...lons);

		const centerLat = (minLat + maxLat) / 2;
		const centerLon = (minLon + maxLon) / 2;
		const latDelta = (maxLat - minLat) * 1.5; // 여유 공간
		const lonDelta = (maxLon - minLon) * 1.5;

		return {
			latitude: centerLat,
			longitude: centerLon,
			latitudeDelta: Math.max(latDelta, 0.01),
			longitudeDelta: Math.max(lonDelta, 0.01),
		};
	}, [gpsPoints]);

	if (loading || !run) {
		return (
			<SafeAreaView style={styles.container}>
				<View style={styles.centerContent}>
					<Text style={styles.loadingText}>로딩 중...</Text>
				</View>
			</SafeAreaView>
		);
	}

	return (
		<SafeAreaView style={styles.container}>
			{/* 헤더 */}
			<View style={styles.header}>
				<TouchableOpacity onPress={() => navigation.goBack()}>
					<Text style={styles.backButton}>← 뒤로</Text>
				</TouchableOpacity>
				<Text style={styles.title}>러닝 상세</Text>
				<View style={styles.placeholder} />
			</View>

			<ScrollView style={styles.scrollView}>
				{/* 날짜/시간 */}
				<View style={styles.dateSection}>
					<Text style={styles.dateText}>
						{formatDateTime(new Date(run.started_at))}
					</Text>
				</View>

				{/* 지도 */}
				{gpsPoints.length > 0 && (
					<View style={styles.mapContainer}>
						<MapView
							style={styles.map}
							provider={PROVIDER_DEFAULT}
							region={mapRegion}
							scrollEnabled={true}
							zoomEnabled={true}
						>
							{routeSegments.map((segment, index) => (
								<Polyline
									key={`segment-${index}`}
									coordinates={segment.points.map((point) => ({
										latitude: point.latitude,
										longitude: point.longitude,
									}))}
									strokeColor={getActivityColor(segment.activityType)}
									strokeWidth={4}
								/>
							))}
						</MapView>
					</View>
				)}

				{/* 메인 통계 */}
				<View style={styles.statsSection}>
					<View style={styles.mainStat}>
						<Text style={styles.mainStatLabel}>거리</Text>
						<Text style={styles.mainStatValue}>
							{formatDistance(run.total_distance)}
						</Text>
						<Text style={styles.mainStatUnit}>km</Text>
					</View>

					<View style={styles.statsGrid}>
						<View style={styles.statCard}>
							<Text style={styles.statCardLabel}>시간</Text>
							<Text style={styles.statCardValue}>
								{formatDuration(run.total_duration)}
							</Text>
						</View>

						<View style={styles.statCard}>
							<Text style={styles.statCardLabel}>평균 페이스</Text>
							<Text style={styles.statCardValue}>
								{formatPace(run.avg_pace)}
							</Text>
						</View>

						<View style={styles.statCard}>
							<Text style={styles.statCardLabel}>칼로리</Text>
							<Text style={styles.statCardValue}>
								{formatCalories(run.calories)}
							</Text>
						</View>
					</View>
				</View>

				{/* 스플릿 */}
				{splits.length > 0 && (
					<View style={styles.splitsSection}>
						<Text style={styles.sectionTitle}>구간 기록 (스플릿)</Text>
						{splits.map((split) => (
							<View key={split.id} style={styles.splitItem}>
								<Text style={styles.splitNumber}>{split.split_number}km</Text>
								<Text style={styles.splitPace}>{formatPace(split.pace)}</Text>
								<Text style={styles.splitDuration}>
									{formatDuration(split.duration)}
								</Text>
							</View>
						))}
					</View>
				)}
			</ScrollView>
		</SafeAreaView>
	);
}

// 활동별 색상 (활동 감지기와 동일)
function getActivityColor(activityType: string): string {
	switch (activityType) {
		case "running":
			return "#007AFF"; // 파란색
		case "walking":
			return "#34C759"; // 초록색
		default:
			return "#8E8E93"; // 회색
	}
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: "#1A1A23",
	},
	header: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		paddingHorizontal: 16,
		paddingVertical: 12,
		borderBottomWidth: 1,
		borderBottomColor: "#2A2A33",
	},
	backButton: {
		fontSize: 16,
		color: "#fff",
		width: 60,
	},
	title: {
		fontSize: 18,
		fontWeight: "600",
		color: "#fff",
	},
	placeholder: {
		width: 60,
	},
	scrollView: {
		flex: 1,
	},
	centerContent: {
		flex: 1,
		justifyContent: "center",
		alignItems: "center",
	},
	loadingText: {
		fontSize: 16,
		color: "#ccc",
	},
	dateSection: {
		padding: 16,
		borderBottomWidth: 1,
		borderBottomColor: "#2A2A33",
	},
	dateText: {
		fontSize: 16,
		fontWeight: "600",
		textAlign: "center",
		color: "#fff",
	},
	mapContainer: {
		height: 300,
		marginHorizontal: 16,
		marginVertical: 16,
		borderRadius: 12,
		overflow: "hidden",
		borderWidth: 1,
		borderColor: "#2A2A33",
	},
	map: {
		width: "100%",
		height: "100%",
	},
	statsSection: {
		paddingHorizontal: 16,
		paddingVertical: 24,
	},
	mainStat: {
		alignItems: "center",
		marginBottom: 32,
	},
	mainStatLabel: {
		fontSize: 14,
		color: "#aaa",
		marginBottom: 8,
		textTransform: "uppercase",
		letterSpacing: 1,
	},
	mainStatValue: {
		fontSize: 64,
		fontWeight: "800",
		color: "#fff",
	},
	mainStatUnit: {
		fontSize: 18,
		color: "#ccc",
		marginTop: 4,
	},
	statsGrid: {
		flexDirection: "row",
		gap: 12,
	},
	statCard: {
		flex: 1,
		backgroundColor: "#2A2A33",
		padding: 16,
		borderRadius: 12,
		alignItems: "center",
	},
	statCardLabel: {
		fontSize: 12,
		color: "#aaa",
		marginBottom: 8,
		textTransform: "uppercase",
	},
	statCardValue: {
		fontSize: 18,
		fontWeight: "700",
		color: "#fff",
	},
	splitsSection: {
		paddingHorizontal: 16,
		paddingVertical: 24,
		borderTopWidth: 1,
		borderTopColor: "#2A2A33",
	},
	sectionTitle: {
		fontSize: 18,
		fontWeight: "600",
		marginBottom: 16,
		color: "#fff",
	},
	splitItem: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		paddingVertical: 12,
		paddingHorizontal: 16,
		backgroundColor: "#2A2A33",
		borderRadius: 8,
		marginBottom: 8,
	},
	splitNumber: {
		fontSize: 16,
		fontWeight: "600",
		color: "#fff",
		width: 60,
	},
	splitPace: {
		fontSize: 18,
		fontWeight: "700",
		color: "#00FF47",
		flex: 1,
		textAlign: "center",
	},
	splitDuration: {
		fontSize: 14,
		color: "#ccc",
		width: 80,
		textAlign: "right",
	},
});
