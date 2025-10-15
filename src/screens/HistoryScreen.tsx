/**
 * 히스토리 화면
 */

import DatabaseService from "@/services/DatabaseService";
import {
	formatAvgPace,
	formatDateTime,
	formatDistance,
	formatDuration,
} from "@utils/formatters";
import React, { useEffect, useState } from "react";
import {
	Alert,
	FlatList,
	StatusBar,
	StyleSheet,
	Text,
	TouchableOpacity,
	View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { RunRecord } from "../types/run";

export default function HistoryScreen({ navigation }: any) {
	const [runs, setRuns] = useState<RunRecord[]>([]);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		loadHistory();
	}, []);

	const loadHistory = async () => {
		try {
			const allRuns = await DatabaseService.getAllRuns();
			setRuns(allRuns);
		} catch (error) {
			console.error("히스토리 로드 실패:", error);
		} finally {
			setLoading(false);
		}
	};

	const confirmDelete = (id: number) => {
		Alert.alert("삭제 확인", "이 러닝 기록을 삭제하시겠습니까?", [
			{ text: "취소", style: "cancel" },
			{
				text: "삭제",
				style: "destructive",
				onPress: async () => {
					try {
						await DatabaseService.deleteRun(id);
						await loadHistory();
					} catch (e) {
						Alert.alert("오류", "삭제에 실패했습니다");
					}
				},
			},
		]);
	};

	const renderRunItem = ({ item }: { item: RunRecord }) => (
		<TouchableOpacity
			style={styles.runItem}
			onPress={() => navigation.navigate("RunDetail", { runId: item.id })}
			onLongPress={() => confirmDelete(item.id)}
		>
			<View style={styles.runHeader}>
				<Text style={styles.runDate}>
					{formatDateTime(new Date(item.started_at))}
				</Text>
				<Text style={styles.runStatus}>{item.status}</Text>
			</View>

			<View style={styles.runStats}>
				<View style={styles.runStat}>
					<Text style={styles.statLabel}>거리</Text>
					<Text style={styles.statValue}>
						{formatDistance(item.total_distance)} km
					</Text>
				</View>

				<View style={styles.runStat}>
					<Text style={styles.statLabel}>시간</Text>
					<Text style={styles.statValue}>
						{formatDuration(item.total_duration)}
					</Text>
				</View>

				<View style={styles.runStat}>
					<Text style={styles.statLabel}>페이스</Text>
					<Text style={styles.statValue}>{formatAvgPace(item.avg_pace)}</Text>
				</View>
			</View>
		</TouchableOpacity>
	);

	if (loading) {
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
			<StatusBar backgroundColor="#1A1A23" barStyle="light-content" />
			<View style={styles.header}>
				<TouchableOpacity onPress={() => navigation.goBack()}>
					<Text style={styles.backButton}>← 뒤로</Text>
				</TouchableOpacity>
				<Text style={styles.title}>러닝 기록</Text>
				<View style={styles.placeholder} />
			</View>

			{runs.length > 0 ? (
				<>
					<View style={styles.summary}>
						<Text style={styles.summaryText}>
							총 {runs.length}개의 러닝 기록
						</Text>
					</View>

					<FlatList
						data={runs}
						keyExtractor={(item) => item.id.toString()}
						renderItem={renderRunItem}
						contentContainerStyle={styles.list}
					/>
				</>
			) : (
				<View style={styles.centerContent}>
					<Text style={styles.emptyText}>러닝 기록이 없습니다</Text>
					<TouchableOpacity
						style={styles.startButton}
						onPress={() => navigation.navigate("Home")}
					>
						<Text style={styles.startButtonText}>러닝 시작하기</Text>
					</TouchableOpacity>
				</View>
			)}
		</SafeAreaView>
	);
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
	summary: {
		padding: 16,
		backgroundColor: "#23232E",
	},
	summaryText: {
		fontSize: 14,
		color: "#ccc",
	},
	list: {
		padding: 16,
	},
	runItem: {
		backgroundColor: "#2A2A33",
		borderRadius: 12,
		padding: 16,
		marginBottom: 12,
		borderWidth: 1,
		borderColor: "#3A3A44",
	},
	runHeader: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		marginBottom: 12,
	},
	runDate: {
		fontSize: 16,
		fontWeight: "600",
		color: "#fff",
	},
	runStatus: {
		fontSize: 12,
		color: "#00FF47",
		textTransform: "uppercase",
	},
	runStats: {
		flexDirection: "row",
		justifyContent: "space-between",
	},
	runStat: {
		flex: 1,
		alignItems: "center",
	},
	statLabel: {
		fontSize: 12,
		color: "#aaa",
		marginBottom: 4,
	},
	statValue: {
		fontSize: 16,
		fontWeight: "600",
		color: "#fff",
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
	emptyText: {
		fontSize: 16,
		color: "#ccc",
		marginBottom: 24,
	},
	startButton: {
		backgroundColor: "#00FF47",
		paddingHorizontal: 24,
		paddingVertical: 12,
		borderRadius: 8,
	},
	startButtonText: {
		color: "#09090E",
		fontSize: 16,
		fontWeight: "600",
	},
});
