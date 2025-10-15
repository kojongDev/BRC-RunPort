/**
 * 러닝 관련 타입 정의
 */

import {GPSCoordinate} from './location';

// 러닝 상태
export type RunStatus = 'idle' | 'running' | 'paused' | 'stopped' | 'completed';

// 러닝 세션
export interface RunSession {
  id: string;
  startedAt: Date;
  endedAt?: Date;
  status: RunStatus;
  totalDistance: number; // km
  totalDuration: number; // seconds
  movingDuration: number; // seconds
  avgPace: number; // min/km
  calories: number;
  route: GPSCoordinate[];
  splits: Split[];
}

// 스플릿 (1km 구간 기록)
export interface Split {
  splitNumber: number;
  distance: number; // km
  duration: number; // seconds
  pace: number; // min/km
}

// 실시간 러닝 통계
export interface LiveStats {
  distance: number; // km
  duration: number; // seconds
  currentPace: number; // min/km
  avgPace: number; // min/km
  calories: number;
  isAutoPaused: boolean;
}

// 데이터베이스 러닝 기록
export interface RunRecord {
  id: number;
  started_at: string;
  ended_at: string;
  total_distance: number;
  total_duration: number;
  moving_duration: number;
  avg_pace: number;
  calories: number;
  status: string;
  created_at: string;
}

// 데이터베이스 GPS 포인트
export interface GPSPointRecord {
  id: number;
  run_id: number;
  latitude: number;
  longitude: number;
  altitude?: number;
  accuracy: number;
  speed?: number;
  timestamp: string;
}

// 데이터베이스 스플릿
export interface SplitRecord {
  id: number;
  run_id: number;
  split_number: number;
  distance: number;
  duration: number;
  pace: number;
}
