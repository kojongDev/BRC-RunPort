/**
 * 홈 화면
 */

import React, {useEffect, useState, useCallback} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Alert,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useFocusEffect} from '@react-navigation/native';
import DatabaseService from '@services/DatabaseService';
import {RunRecord} from '../types/run';
import {useRunningStore} from '@stores/runningStore';
import {formatDistance, formatDuration, formatDate} from '@utils/formatters';
import {logger} from '@utils/logger';

export default function HomeScreen({navigation}: any) {
  const [recentRuns, setRecentRuns] = useState<RunRecord[]>([]);
  const [isDbInitialized, setIsDbInitialized] = useState(false);

  // 러닝 상태 가져오기
  const {status, distance, duration} = useRunningStore();
  const isRunning = status === 'running' || status === 'paused';

  useEffect(() => {
    initDatabase();
  }, []);

  // 화면이 포커스될 때마다 최근 기록 로드 (DB 초기화 완료 후)
  useFocusEffect(
    useCallback(() => {
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
      Alert.alert('오류', '데이터베이스 초기화 실패');
    }
  };

  const loadRecentRuns = async () => {
    try {
      const runs = await DatabaseService.getAllRuns();
      logger.log('[HomeScreen] 로드된 러닝 기록:', runs.length);
      setRecentRuns(runs.slice(0, 3));
    } catch (error) {
      logger.error('러닝 기록 로드 실패:', error);
    }
  };

  const handleStartRun = () => {
    navigation.navigate('Running');
  };

  const renderRunItem = ({item}: {item: RunRecord}) => (
    <View style={styles.runItem}>
      <Text style={styles.runDate}>
        {formatDate(new Date(item.started_at))}
      </Text>
      <View style={styles.runStats}>
        <Text style={styles.runStat}>{formatDistance(item.total_distance)} km</Text>
        <Text style={styles.runStat}>{formatDuration(item.total_duration)}</Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>🏃‍♂️ RunPort</Text>
        <Text style={styles.subtitle}>
          {isRunning ? '러닝 진행 중' : '러닝을 시작하세요'}
        </Text>
      </View>

      {/* 러닝 중일 때 현재 러닝 정보 표시 */}
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

      <TouchableOpacity
        style={[
          styles.startButton,
          isRunning && styles.resumeButton,
        ]}
        onPress={handleStartRun}>
        <Text style={styles.startButtonText}>
          {isRunning ? '러닝으로 돌아가기 →' : '러닝 시작'}
        </Text>
      </TouchableOpacity>

      <View style={styles.recentSection}>
        <Text style={styles.sectionTitle}>최근 러닝 기록</Text>
        {recentRuns.length > 0 ? (
          <FlatList
            data={recentRuns}
            keyExtractor={item => item.id.toString()}
            renderItem={renderRunItem}
          />
        ) : (
          <Text style={styles.emptyText}>러닝 기록이 없습니다</Text>
        )}
      </View>

      <TouchableOpacity
        style={styles.historyButton}
        onPress={() => navigation.navigate('History')}>
        <Text style={styles.historyButtonText}>전체 기록 보기</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  title: {
    fontSize: 48,
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 18,
    color: '#666',
  },
  currentRunCard: {
    backgroundColor: '#FFF3E0',
    marginHorizontal: 24,
    marginBottom: 16,
    padding: 20,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#FF9500',
  },
  currentRunTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#E65100',
    marginBottom: 16,
    textAlign: 'center',
  },
  currentRunStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  currentRunStat: {
    alignItems: 'center',
  },
  currentRunStatLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  currentRunStatValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#E65100',
  },
  startButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 20,
    marginHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
  },
  resumeButton: {
    backgroundColor: '#FF9500',
  },
  startButtonText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '600',
  },
  recentSection: {
    flex: 1,
    marginTop: 32,
    paddingHorizontal: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 16,
  },
  runItem: {
    backgroundColor: '#f5f5f5',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
  },
  runDate: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 8,
  },
  runStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  runStat: {
    fontSize: 14,
    color: '#666',
  },
  emptyText: {
    textAlign: 'center',
    color: '#999',
    marginTop: 24,
  },
  historyButton: {
    padding: 16,
    alignItems: 'center',
  },
  historyButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '500',
  },
});
