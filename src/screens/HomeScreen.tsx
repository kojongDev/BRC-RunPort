/**
 * 홈 화면
 */

import DatabaseService from "@/services/DatabaseService";
import { useFocusEffect } from "@react-navigation/native";
import { formatDate, formatDistance, formatDuration } from "@utils/formatters";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
	Alert,
	Image,
	StatusBar,
	StyleSheet,
	Text,
	TouchableOpacity,
	View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRunningStore } from "../stores/runningStore";
import { RunRecord } from "../types/run";
const logo = require("../assets/images/logo.png");

export default function HomeScreen({ navigation }: any) {
	const [recentRuns, setRecentRuns] = useState<RunRecord[]>([]);
	const [isDbInitialized, setIsDbInitialized] = useState(false);
	const startedNewRunRef = useRef(false);

	// 러닝 상태 가져오기
	const { status, distance, duration, reset } = useRunningStore();
	const [hasActiveRun, setHasActiveRun] = useState(false);
	const isRunning = hasActiveRun || status === "running" || status === "paused";

	useEffect(() => {
		initDatabase();
	}, []);

	// 화면이 포커스될 때마다 최근 기록 로드 (DB 초기화 완료 후)
	useFocusEffect(
		useCallback(() => {
			// 화면이 다시 포커스되면 새 세션 시작 플래그 리셋
			startedNewRunRef.current = false;
			if (isDbInitialized) {
				loadRecentRuns();
			}
		}, [isDbInitialized])
	);

	const initDatabase = async () => {
		try {
			await DatabaseService.init();
			setIsDbInitialized(true);
			// DB 초기화 완료 후 첫 로드
			loadRecentRuns();
		} catch (error) {
			Alert.alert("오류", "데이터베이스 초기화 실패");
		}
	};

	const loadRecentRuns = async () => {
		try {
			const runs = await DatabaseService.getAllRuns();
			console.log("[HomeScreen] 로드된 러닝 기록:", runs.length);
			setRecentRuns(runs.slice(0, 3));
			//// 진행중 러닝 감지
			//let active = await DatabaseService.getLatestActiveRun();
			//// 종료 직후 DB 반영 레이스 대비: 짧은 지연 후 1회 재조회
			//if (
			//	active &&
			//	active.ended_at == null &&
			//	(active.status === "running" || active.status === "paused")
			//) {
			//	await new Promise((r) => setTimeout(r, 300));
			//	active = await DatabaseService.getLatestActiveRun();
			//}
			//setHasActiveRun(!!active);
			//// 사용자가 새 세션을 막 시작한 경우 복원을 건너뜀 (뒤늦은 덮어쓰기 방지)
			//if (active && !startedNewRunRef.current) {
			//	const points = await DatabaseService.getGPSPoints(active.id);
			//	restoreFromActiveRun(active as any, points);
			//}
		} catch (error) {
			console.error("러닝 기록 로드 실패:", error);
		}
	};

	const handleStartRun = () => {
		// 새 세션 시작 플래그 설정: 백그라운드 복원이 뒤늦게 상태를 덮지 않도록
		startedNewRunRef.current = true;
		if (!(status === "running" || status === "paused")) {
			reset();
		}
		navigation.navigate("Running");
	};

	const renderRunItem = ({ item }: { item: RunRecord }) => (
		<View style={styles.runItem}>
			<View
				style={{
					flexDirection: "row",
					justifyContent: "space-between",
					alignItems: "flex-start",
					marginBottom: 6,
				}}
			>
				<Text style={[styles.runDate, { flex: 1 }]}>
					{formatDate(new Date(item.started_at))}
				</Text>
				<Text style={{ color: "#00c75a", fontWeight: "bold", fontSize: 13 }}>
					{item.status === "completed"
						? "완료"
						: item.status === "paused"
						? "일시정지"
						: item.status === "stopped"
						? "중단"
						: "기타"}
				</Text>
			</View>
			<View style={styles.runStats}>
				<View style={styles.runStatItem}>
					<Text style={styles.runStatLabel}>거리</Text>
					<Text style={styles.runStat}>
						{formatDistance(item.total_distance)} km
					</Text>
				</View>
				<View style={styles.runStatItem}>
					<Text style={styles.runStatLabel}>시간</Text>
					<Text style={styles.runStat}>
						{formatDuration(item.total_duration)}
					</Text>
				</View>
				<View style={styles.runStatItem}>
					<Text style={styles.runStatLabel}>이동시간</Text>
					<Text style={styles.runStat}>
						{formatDuration(item.moving_duration)}
					</Text>
				</View>
			</View>
			<View style={styles.runStats}>
				<View style={styles.runStatItem}>
					<Text style={styles.runStatLabel}>평균페이스</Text>
					<Text style={styles.runStat}>
						{item.avg_pace ? `${item.avg_pace.toFixed(1)} min/km` : "-"}
					</Text>
				</View>
				<View style={styles.runStatItem}>
					<Text style={styles.runStatLabel}>칼로리</Text>
					<Text style={styles.runStat}>
						{item.calories ? `${Math.round(item.calories)} kcal` : "-"}
					</Text>
				</View>
				<View style={styles.runStatItem}>
					<Text style={styles.runStatLabel}>기록일</Text>
					<Text style={styles.runStat}>
						{item.created_at ? formatDate(new Date(item.created_at)) : "-"}
					</Text>
				</View>
			</View>
		</View>
	);

	return (
		<SafeAreaView style={styles.container}>
			<StatusBar backgroundColor="#1A1A23" barStyle="light-content" />
			<View style={styles.header}>
				<Image source={logo} style={styles.logo} />
				<Text style={styles.subtitle}>Butfit Running Club</Text>
			</View>

			{isRunning && (
				<View style={styles.currentRunCard}>
					<Text style={styles.currentRunTitle}>🏃 진행 중인 러닝</Text>
					<View style={styles.currentRunStats}>
						<View style={styles.currentRunStat}>
							<Text style={styles.currentRunStatLabel}>거리</Text>
							<Text style={styles.currentRunStatValue}>
								{formatDistance(distance)} km
							</Text>
						</View>
						<View style={styles.currentRunStat}>
							<Text style={styles.currentRunStatLabel}>시간</Text>
							<Text style={styles.currentRunStatValue}>
								{formatDuration(duration)}
							</Text>
						</View>
					</View>
				</View>
			)}

			<View style={styles.recentSection}>
				<Text style={styles.sectionTitle}>최근 기록</Text>
				{recentRuns.length > 0 ? (
					renderRunItem({ item: recentRuns[0] })
				) : (
					<Text style={styles.emptyText}>등록된 기록이 없어요 🤔</Text>
				)}
			</View>

			<TouchableOpacity
				style={[styles.startButton, isRunning && styles.resumeButton]}
				onPress={handleStartRun}
			>
				<Text style={styles.startButtonText}>
					{isRunning ? "RESUME" : "START"}
				</Text>
			</TouchableOpacity>
			<TouchableOpacity
				style={styles.historyButton}
				onPress={() => navigation.navigate("History")}
			>
				<Text style={styles.historyButtonText}>전체 기록</Text>
			</TouchableOpacity>
		</SafeAreaView>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: "#1A1A23",
	},
	logo: {
		width: 150,
		height: 150,
		backgroundColor: "#1A1A23f",
	},
	header: {
		alignItems: "center",
		paddingVertical: 32,
	},
	title: {
		fontSize: 48,
		fontWeight: "700",
		marginBottom: 8,
	},
	subtitle: {
		fontSize: 18,
		color: "#00FF47",
		fontWeight: "900",
		marginTop: -30,
	},
	currentRunCard: {
		backgroundColor: "#EFFBEB",
		marginHorizontal: 24,
		marginBottom: 16,
		padding: 20,
		borderRadius: 12,
		borderWidth: 2,
		borderColor: "#00FF47",
	},
	currentRunTitle: {
		fontSize: 18,
		fontWeight: "700",
		color: "#09090E",
		marginBottom: 16,
		textAlign: "center",
	},
	currentRunStats: {
		flexDirection: "row",
		justifyContent: "space-around",
	},
	currentRunStat: {
		alignItems: "center",
	},
	currentRunStatLabel: {
		fontSize: 14,
		color: "#666",
		marginBottom: 4,
	},
	currentRunStatValue: {
		fontSize: 24,
		fontWeight: "700",
		color: "#09090E",
	},
	startButton: {
		backgroundColor: "#00FF47",
		paddingVertical: 20,
		marginHorizontal: 24,
		borderRadius: 5,
		alignItems: "center",
	},
	resumeButton: {
		backgroundColor: "#00FF47",
	},
	startButtonText: {
		color: "#09090E",
		fontSize: 20,
		fontWeight: "700",
	},
	recentSection: {
		flex: 1,
		marginTop: 32,
		paddingHorizontal: 24,
	},
	sectionTitle: {
		fontSize: 20,
		fontWeight: "600",
		marginBottom: 16,
		color: "#fff",
	},
	runItem: {
		backgroundColor: "#f5f5f5",
		padding: 16,
		borderRadius: 8,
		marginBottom: 12,
	},
	runDate: {
		fontSize: 16,
		fontWeight: "900",
		marginBottom: 8,
	},
	runStats: {
		flexDirection: "row",
		justifyContent: "space-between",
		marginBottom: 7,
	},
	runStatItem: {
		flex: 1,
		alignItems: "center",
		gap: 3,
	},
	runStatLabel: {
		fontSize: 10,
		color: "#888",
		fontWeight: "700",
	},
	runStat: {
		fontSize: 15,
		color: "#666",
		fontWeight: "800",
	},
	emptyText: {
		textAlign: "center",
		color: "#999",
		marginTop: 24,
	},
	historyButton: {
		padding: 16,
		alignItems: "center",
		color: "#fff",
	},
	historyButtonText: {
		color: "#fff",
		fontSize: 16,
		fontWeight: "500",
	},
});
