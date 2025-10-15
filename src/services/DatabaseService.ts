/**
 * SQLite 데이터베이스 서비스
 */

import { logger } from "@utils/logger";
import SQLite from "react-native-sqlite-storage";
import { GPSCoordinate } from "../types/location";
import { RunRecord, RunSession, SplitRecord } from "../types/run";

SQLite.DEBUG(__DEV__);
SQLite.enablePromise(true);

const DATABASE_NAME = "RunPort.db";

class DatabaseService {
	private db: SQLite.SQLiteDatabase | null = null;

	/**
	 * 데이터베이스 초기화
	 */
	async init(): Promise<void> {
		try {
			this.db = await SQLite.openDatabase({
				name: DATABASE_NAME,
				location: "default",
			});

			await this.createTables();
			logger.log("[DB] 데이터베이스 초기화 완료");
		} catch (error) {
			logger.error("[DB] 초기화 실패:", error);
			throw error;
		}
	}

	/**
	 * 테이블 생성
	 */
	private async createTables(): Promise<void> {
		if (!this.db) {
			throw new Error("Database not initialized");
		}

		// runs 테이블
		await this.db.executeSql(`
      CREATE TABLE IF NOT EXISTS runs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        started_at TEXT NOT NULL,
        ended_at TEXT,
        total_distance REAL,
        total_duration INTEGER,
        moving_duration INTEGER,
        avg_pace REAL,
        calories REAL,
        status TEXT DEFAULT 'completed',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
    `);

		// gps_points 테이블
		await this.db.executeSql(`
      CREATE TABLE IF NOT EXISTS gps_points (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        run_id INTEGER,
        latitude REAL,
        longitude REAL,
        altitude REAL,
        accuracy REAL,
        speed REAL,
        timestamp TEXT,
        FOREIGN KEY (run_id) REFERENCES runs (id)
      );
    `);

		// splits 테이블
		await this.db.executeSql(`
      CREATE TABLE IF NOT EXISTS splits (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        run_id INTEGER,
        split_number INTEGER,
        distance REAL,
        duration INTEGER,
        pace REAL,
        FOREIGN KEY (run_id) REFERENCES runs (id)
      );
    `);

		logger.log("[DB] 테이블 생성 완료");
	}

	/**
	 * 새 러닝 세션 저장
	 */
	async saveRun(session: RunSession): Promise<number> {
		if (!this.db) {
			throw new Error("Database not initialized");
		}

		try {
			// runs 테이블에 저장
			const [result] = await this.db.executeSql(
				`INSERT INTO runs (started_at, ended_at, total_distance, total_duration, moving_duration, avg_pace, calories, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
				[
					session.startedAt.toISOString(),
					session.endedAt?.toISOString() || null,
					session.totalDistance,
					session.totalDuration,
					session.movingDuration,
					session.avgPace,
					session.calories,
					session.status,
				]
			);

			const runId = result.insertId!;

			// GPS 포인트 저장
			for (const point of session.route) {
				await this.db.executeSql(
					`INSERT INTO gps_points (run_id, latitude, longitude, altitude, accuracy, speed, timestamp)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
					[
						runId,
						point.latitude,
						point.longitude,
						point.altitude || null,
						point.accuracy,
						point.speed || null,
						new Date(point.timestamp).toISOString(),
					]
				);
			}

			// 스플릿 저장
			for (const split of session.splits) {
				await this.db.executeSql(
					`INSERT INTO splits (run_id, split_number, distance, duration, pace)
           VALUES (?, ?, ?, ?, ?)`,
					[runId, split.splitNumber, split.distance, split.duration, split.pace]
				);
			}

			logger.log("[DB] 러닝 세션 저장 완료:", runId);
			return runId;
		} catch (error) {
			logger.error("[DB] 러닝 저장 실패:", error);
			throw error;
		}
	}

	/**
	 * 모든 러닝 기록 조회
	 */
	async getAllRuns(): Promise<RunRecord[]> {
		if (!this.db) {
			throw new Error("Database not initialized");
		}

		try {
			const [results] = await this.db.executeSql(
				"SELECT * FROM runs ORDER BY started_at DESC"
			);

			const runs: RunRecord[] = [];
			for (let i = 0; i < results.rows.length; i++) {
				runs.push(results.rows.item(i));
			}

			return runs;
		} catch (error) {
			logger.error("[DB] 러닝 목록 조회 실패:", error);
			throw error;
		}
	}

	/**
	 * 진행 중 러닝 생성 (서버 없이 복원용 표시)
	 */
	async createOngoingRun(startedAt: Date): Promise<number> {
		if (!this.db) {
			throw new Error("Database not initialized");
		}

		try {
			const [result] = await this.db.executeSql(
				`INSERT INTO runs (started_at, status) VALUES (?, ?)`,
				[startedAt.toISOString(), "running"]
			);
			const runId = result.insertId!;
			logger.log("[DB] 진행중 러닝 생성:", runId);
			return runId;
		} catch (error) {
			logger.error("[DB] 진행중 러닝 생성 실패:", error);
			throw error;
		}
	}

	/**
	 * 러닝 상태 업데이트 (running/paused/stopped/completed 등)
	 */
	async setRunStatus(runId: number, status: string): Promise<void> {
		if (!this.db) {
			throw new Error("Database not initialized");
		}

		try {
			await this.db.executeSql(`UPDATE runs SET status = ? WHERE id = ?`, [
				status,
				runId,
			]);
			logger.log("[DB] 러닝 상태 업데이트:", runId, status);
		} catch (error) {
			logger.error("[DB] 러닝 상태 업데이트 실패:", error);
			throw error;
		}
	}

	/**
	 * 최근 진행중(또는 일시정지) 러닝 1건 조회
	 */
	async getLatestActiveRun(): Promise<RunRecord | null> {
		if (!this.db) {
			throw new Error("Database not initialized");
		}

		try {
			const [results] = await this.db.executeSql(
				`SELECT * FROM runs 
				 WHERE status IN ('running','paused') AND ended_at IS NULL 
				 ORDER BY datetime(started_at) DESC 
				 LIMIT 1`
			);

			if (results.rows.length === 0) return null;
			console.log("Result", JSON.stringify(results.rows.item(0)));
			return results.rows.item(0) as RunRecord;
		} catch (error) {
			logger.error("[DB] 진행중 러닝 조회 실패:", error);
			throw error;
		}
	}

	/**
	 * 특정 러닝의 GPS 포인트 조회
	 */
	async getGPSPoints(runId: number): Promise<GPSCoordinate[]> {
		if (!this.db) {
			throw new Error("Database not initialized");
		}

		try {
			const [results] = await this.db.executeSql(
				"SELECT * FROM gps_points WHERE run_id = ? ORDER BY timestamp",
				[runId]
			);

			const points: GPSCoordinate[] = [];
			for (let i = 0; i < results.rows.length; i++) {
				const row = results.rows.item(i);
				points.push({
					latitude: row.latitude,
					longitude: row.longitude,
					altitude: row.altitude,
					accuracy: row.accuracy,
					speed: row.speed,
					timestamp: new Date(row.timestamp).getTime(),
					activityType: "unknown", // DB에 저장된 데이터는 활동 정보 없음
					activityConfidence: 0,
					estimatedBySpeed: false,
					isEstimated: false,
				});
			}

			return points;
		} catch (error) {
			logger.error("[DB] GPS 포인트 조회 실패:", error);
			throw error;
		}
	}

	/**
	 * GPS 포인트 1건 저장 (진행중 러닝용)
	 */
	async insertGPSPoint(runId: number, point: GPSCoordinate): Promise<void> {
		if (!this.db) {
			throw new Error("Database not initialized");
		}

		try {
			await this.db.executeSql(
				`INSERT INTO gps_points (run_id, latitude, longitude, altitude, accuracy, speed, timestamp)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
				[
					runId,
					point.latitude,
					point.longitude,
					point.altitude || null,
					point.accuracy,
					point.speed || null,
					new Date(point.timestamp).toISOString(),
				]
			);
		} catch (error) {
			logger.error("[DB] GPS 포인트 저장 실패:", error);
			throw error;
		}
	}

	/**
	 * 러닝 요약 정보 업데이트 (종료 시 요약 저장 포함)
	 */
	async updateRunSummary(
		runId: number,
		summary: Partial<{
			endedAt: Date | null;
			totalDistance: number;
			totalDuration: number;
			movingDuration: number;
			avgPace: number;
			calories: number;
			status: string;
		}>
	): Promise<void> {
		if (!this.db) {
			throw new Error("Database not initialized");
		}

		try {
			const fields: string[] = [];
			const values: any[] = [];

			if (summary.endedAt !== undefined) {
				fields.push("ended_at = ?");
				values.push(summary.endedAt ? summary.endedAt.toISOString() : null);
			}
			if (summary.totalDistance !== undefined) {
				fields.push("total_distance = ?");
				values.push(summary.totalDistance);
			}
			if (summary.totalDuration !== undefined) {
				fields.push("total_duration = ?");
				values.push(summary.totalDuration);
			}
			if (summary.movingDuration !== undefined) {
				fields.push("moving_duration = ?");
				values.push(summary.movingDuration);
			}
			if (summary.avgPace !== undefined) {
				fields.push("avg_pace = ?");
				values.push(summary.avgPace);
			}
			if (summary.calories !== undefined) {
				fields.push("calories = ?");
				values.push(summary.calories);
			}
			if (summary.status !== undefined) {
				fields.push("status = ?");
				values.push(summary.status);
			}

			if (fields.length === 0) return;

			values.push(runId);
			const sql = `UPDATE runs SET ${fields.join(", ")} WHERE id = ?`;
			await this.db.executeSql(sql, values);
			logger.log("[DB] 러닝 요약 업데이트:", runId);
		} catch (error) {
			logger.error("[DB] 러닝 요약 업데이트 실패:", error);
			throw error;
		}
	}

	/**
	 * 특정 러닝의 스플릿 조회
	 */
	async getSplits(runId: number): Promise<SplitRecord[]> {
		if (!this.db) {
			throw new Error("Database not initialized");
		}

		try {
			const [results] = await this.db.executeSql(
				"SELECT * FROM splits WHERE run_id = ? ORDER BY split_number",
				[runId]
			);

			const splits: SplitRecord[] = [];
			for (let i = 0; i < results.rows.length; i++) {
				splits.push(results.rows.item(i));
			}

			return splits;
		} catch (error) {
			logger.error("[DB] 스플릿 조회 실패:", error);
			throw error;
		}
	}

	/**
	 * 러닝 기록 삭제
	 */
	async deleteRun(runId: number): Promise<void> {
		if (!this.db) {
			throw new Error("Database not initialized");
		}

		try {
			await this.db.executeSql("DELETE FROM gps_points WHERE run_id = ?", [
				runId,
			]);
			await this.db.executeSql("DELETE FROM splits WHERE run_id = ?", [runId]);
			await this.db.executeSql("DELETE FROM runs WHERE id = ?", [runId]);

			logger.log("[DB] 러닝 기록 삭제 완료:", runId);
		} catch (error) {
			logger.error("[DB] 러닝 삭제 실패:", error);
			throw error;
		}
	}

	/**
	 * 데이터베이스 닫기
	 */
	async close(): Promise<void> {
		if (this.db) {
			await this.db.close();
			this.db = null;
			logger.log("[DB] 데이터베이스 종료");
		}
	}
}

export default new DatabaseService();
