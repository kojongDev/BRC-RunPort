/**
 * React Navigation 타입 정의
 */

import {NavigatorScreenParams} from '@react-navigation/native';
import {StackNavigationProp} from '@react-navigation/stack';
import {RouteProp} from '@react-navigation/native';
import {RunSession, GPSCoordinate} from './';

// 직렬화 가능한 RunSession 타입 (navigation 파라미터용)
export interface SerializableRunSession {
  id: string;
  startedAt: string; // ISO 문자열
  endedAt?: string; // ISO 문자열
  status: string;
  totalDistance: number;
  totalDuration: number;
  movingDuration: number;
  avgPace: number;
  calories: number;
  route: GPSCoordinate[];
  splits: any[];
}

// 루트 스택 파라미터
export type RootStackParamList = {
  Home: undefined;
  Running: undefined;
  Result: {
    session: SerializableRunSession;
  };
  History: undefined;
  RunDetail: {
    runId: number;
  };
};

// 스크린별 Props 타입
export type HomeScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Home'>;
export type RunningScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Running'>;
export type ResultScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Result'>;
export type ResultScreenRouteProp = RouteProp<RootStackParamList, 'Result'>;
export type HistoryScreenNavigationProp = StackNavigationProp<RootStackParamList, 'History'>;
export type RunDetailScreenNavigationProp = StackNavigationProp<RootStackParamList, 'RunDetail'>;
export type RunDetailScreenRouteProp = RouteProp<RootStackParamList, 'RunDetail'>;

export type HomeScreenProps = {
  navigation: HomeScreenNavigationProp;
};

export type RunningScreenProps = {
  navigation: RunningScreenNavigationProp;
};

export type ResultScreenProps = {
  navigation: ResultScreenNavigationProp;
  route: ResultScreenRouteProp;
};

export type HistoryScreenProps = {
  navigation: HistoryScreenNavigationProp;
};

export type RunDetailScreenProps = {
  navigation: RunDetailScreenNavigationProp;
  route: RunDetailScreenRouteProp;
};
