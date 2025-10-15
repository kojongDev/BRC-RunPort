/**
 * 러닝 화면 - NRC 스타일 (스와이프 가능한 3개 화면)
 *
 * Apple Watch 심박수 연동 가이드:
 * 1. @react-native-community/apple-healthkit 패키지 설치
 * 2. Info.plist에 NSHealthShareUsageDescription 추가
 * 3. HealthKit 권한 요청 및 심박수 데이터 구독
 * 4. 실시간 심박수를 state로 관리하고 "--" 대신 실제 값 표시
 * 5. 예시 코드:
 *    const [heartRate, setHeartRate] = useState<number | null>(null);
 *    AppleHealthKit.getHeartRateSamples({...}, (err, results) => {
 *      if (!err && results.length > 0) {
 *        setHeartRate(Math.round(results[0].value));
 *      }
 *    });
 */

import React, {useEffect, useState, useMemo, useRef} from 'react';
import {View, Text, StyleSheet, TouchableOpacity, Alert, Dimensions, Animated, ScrollView} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import PagerView from 'react-native-pager-view';
import MapView, {Polyline, Marker, PROVIDER_APPLE} from 'react-native-maps';
import {useRunningStore} from '@stores/runningStore';
import {formatDistance, formatDuration, formatPace, formatCalories} from '@utils/formatters';
import CalcService from '@services/CalcService';
import {getActivityColor, getActivityLabel} from '@utils/activityDetector';

const {width, height} = Dimensions.get('window');

// 반응형 디자인: 화면 높이 기반 배율 계산
const getScreenScale = () => {
  if (height < 700) return 0.75;      // 작은 화면 (iPhone SE)
  if (height < 800) return 0.90;      // 중간 화면 (iPhone 13 Mini)
  if (height < 900) return 0.95;      // 일반 화면 (iPhone 13, 14, 15, 16 Pro)
  return 1.00;                        // 큰 화면 (iPhone Pro Max)
};

const scale = getScreenScale();

// 반응형 폰트 크기
const rf = (size: number) => Math.round(size * scale);

// 반응형 여백
const rp = (padding: number) => Math.round(padding * scale);

export default function RunningScreen({navigation}: any) {
  const {
    status,
    isAutoPaused,
    pauseReason,
    gpsSignalLost,
    distance,
    duration,
    currentPace,
    avgPace,
    calories,
    route,
    start,
    pause,
    resume,
    stop,
    setGPSLossCallbacks,
  } = useRunningStore();

  const pagerRef = useRef<PagerView>(null);
  const [currentPage, setCurrentPage] = useState(0);

  // 뒤로 가기 방지 (Android 백 버튼 및 제스처)
  React.useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e: any) => {
      // 러닝 중이거나 일시정지 상태라면 뒤로 가기 방지
      if (status === 'running' || status === 'paused') {
        e.preventDefault();

        Alert.alert(
          '러닝 종료',
          '러닝을 종료하시겠습니까? 종료하면 현재까지의 기록이 저장됩니다.',
          [
            {text: '계속하기', style: 'cancel'},
            {
              text: '종료',
              style: 'destructive',
              onPress: () => {
                stop();
                navigation.dispatch(e.data.action);
              },
            },
          ],
        );
      }
    });

    return unsubscribe;
  }, [navigation, status, stop]);

  // 킬로미터 알림 배너
  const [lastKilometer, setLastKilometer] = useState(0);
  const [kilometerBanner, setKilometerBanner] = useState<{visible: boolean; km: number; pace: number; splitComparison?: {faster: boolean; diff: number}} | null>(null);
  const bannerSlideAnim = useRef(new Animated.Value(-100)).current;

  // 스플릿 데이터 (각 1km의 페이스)
  const [splitPaces, setSplitPaces] = useState<number[]>([]);

  // 더블탭 감지
  const lastTapRef = useRef(0);
  const DOUBLE_TAP_DELAY = 300; // ms

  const [mapRegion, setMapRegion] = useState({
    latitude: 37.5665,
    longitude: 126.9780,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  });

  // 경로를 활동별 세그먼트로 분할 (메모이제이션)
  const routeSegments = useMemo(() => {
    return CalcService.segmentRouteByActivity(route);
  }, [route]);

  // 현재 활동 유형
  const currentActivity = route.length > 0
    ? route[route.length - 1].activityType
    : 'unknown';

  // GPS 신호 손실 마커 (gpsSignalLost = true인 포인트)
  const gpsLossMarkers = useMemo(() => {
    return route.filter(point => point.gpsSignalLost === true);
  }, [route]);

  // 페이스 히스토리 (그래프용)
  const paceHistory = useMemo(() => {
    const history: {time: number; pace: number}[] = [];
    const windowSize = 5;

    for (let i = windowSize; i < route.length; i += 5) {
      const window = route.slice(i - windowSize, i);
      const pace = CalcService.calculateCurrentPace(window, windowSize);
      history.push({
        time: (window[window.length - 1].timestamp - route[0].timestamp) / 1000,
        pace,
      });
    }

    return history;
  }, [route]);

  // GPS 손실 콜백 설정
  React.useEffect(() => {
    setGPSLossCallbacks({
      onShortLoss: () => {
        console.log('[UI] 짧은 GPS 신호 손실 감지');
      },
      onLongLoss: () => {
        console.log('[UI] 긴 GPS 신호 손실 - 자동 일시정지');
        // 자동 일시정지만 수행 (다이얼로그 없음)
      },
    });
  }, [setGPSLossCallbacks]);

  // 킬로미터 달성 감지
  React.useEffect(() => {
    const currentKm = Math.floor(distance);
    if (currentKm > lastKilometer && currentKm > 0) {
      // 킬로미터 달성!
      setLastKilometer(currentKm);

      // 해당 킬로미터의 페이스 계산 (최근 1km 구간)
      const recentPace = currentPace || avgPace || 0;

      // 스플릿 비교 (이전 킬로미터와 비교)
      let splitComparison: {faster: boolean; diff: number} | undefined;
      if (splitPaces.length > 0) {
        const previousPace = splitPaces[splitPaces.length - 1];
        const diff = Math.abs(recentPace - previousPace); // 분 단위 차이
        const faster = recentPace < previousPace; // 페이스가 작을수록 빠름
        splitComparison = {faster, diff};
      }

      // 스플릿 페이스 저장
      setSplitPaces(prev => [...prev, recentPace]);

      // 배너 표시
      setKilometerBanner({
        visible: true,
        km: currentKm,
        pace: recentPace,
        splitComparison,
      });

      // 슬라이드 인 애니메이션
      Animated.sequence([
        Animated.timing(bannerSlideAnim, {
          toValue: 20,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.delay(2500),
        Animated.timing(bannerSlideAnim, {
          toValue: -100,
          duration: 400,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setKilometerBanner(null);
      });
    }
  }, [distance, lastKilometer, currentPace, avgPace, splitPaces, bannerSlideAnim]);

  React.useEffect(() => {
    if (status === 'idle') {
      start().catch(error => {
        console.error('[RunningScreen] Start failed:', error);
        Alert.alert(
          '오류',
          'GPS 추적을 시작할 수 없습니다. 위치 권한을 확인해주세요.',
          [{text: '확인', onPress: () => navigation.goBack()}]
        );
      });
    }
  }, []);

  // 경로 업데이트 시 지도 중심 이동
  useEffect(() => {
    if (route.length > 0) {
      const lastPoint = route[route.length - 1];
      setMapRegion({
        latitude: lastPoint.latitude,
        longitude: lastPoint.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      });
    }
  }, [route]);

  const handlePauseResume = () => {
    if (status === 'running') {
      pause();
    } else if (status === 'paused') {
      resume();
    }
  };

  const handleDoubleTap = () => {
    const now = Date.now();
    const timeSinceLastTap = now - lastTapRef.current;

    if (timeSinceLastTap < DOUBLE_TAP_DELAY && timeSinceLastTap > 0) {
      // 더블탭 감지!
      handlePauseResume();
      lastTapRef.current = 0; // 리셋
    } else {
      lastTapRef.current = now;
    }
  };

  const handleStop = () => {
    Alert.alert(
      '러닝 종료',
      '러닝을 종료하시겠습니까?',
      [
        {text: '취소', style: 'cancel'},
        {
          text: '종료',
          style: 'destructive',
          onPress: () => {
            stop();
            const now = new Date();
            navigation.navigate('Result', {
              session: {
                id: Date.now().toString(),
                // Date 객체 대신 ISO 문자열로 전달 (직렬화 가능)
                startedAt: now.toISOString(),
                endedAt: now.toISOString(),
                status: 'completed',
                totalDistance: distance,
                totalDuration: duration,
                movingDuration: duration,
                avgPace,
                calories,
                route: route,
                splits: [],
              },
            });
          },
        },
      ],
    );
  };

  // 페이지 1: 지도 중심
  const renderMapPage = () => (
    <View style={styles.page} onTouchEnd={handleDoubleTap}>
      {/* 상단 간단한 통계 오버레이 */}
      <View style={styles.mapOverlay}>
        <View style={styles.mapStats}>
          <Text style={styles.mapStatValue}>{formatDistance(distance)}</Text>
          <Text style={styles.mapStatLabel}>km</Text>
        </View>
        <View style={styles.mapStatsRow}>
          <View style={styles.mapStatSmall}>
            <Text style={styles.mapStatSmallLabel}>시간</Text>
            <Text style={styles.mapStatSmallValue}>{formatDuration(duration)}</Text>
          </View>
          <View style={styles.mapStatSmall}>
            <Text style={styles.mapStatSmallLabel}>페이스</Text>
            <Text style={styles.mapStatSmallValue}>{formatPace(avgPace)}</Text>
          </View>
        </View>
      </View>

      {/* 지도 */}
      <MapView
        style={styles.mapFull}
        provider={PROVIDER_APPLE}
        region={mapRegion}
        showsUserLocation
        followsUserLocation
        showsMyLocationButton={false}
      >
        {routeSegments.map((segment, index) => (
          <Polyline
            key={`segment-${index}`}
            coordinates={segment.points.map(point => ({
              latitude: point.latitude,
              longitude: point.longitude,
            }))}
            strokeColor={getActivityColor(segment.activityType)}
            strokeWidth={4}
            lineDashPattern={segment.isEstimated ? [10, 5] : undefined}
          />
        ))}
        {gpsLossMarkers.map((point, index) => (
          <Marker
            key={`gps-loss-${index}`}
            coordinate={{
              latitude: point.latitude,
              longitude: point.longitude,
            }}
          >
            <View style={styles.gpsLossMarker}>
              <Text style={styles.gpsLossMarkerText}>⚠️</Text>
            </View>
          </Marker>
        ))}
      </MapView>
    </View>
  );

  // 페이지 2: 통계 중심
  const renderStatsPage = () => {
    // 페이스 게이지 계산
    const targetPace = avgPace || 6.0; // 목표 페이스 (평균 페이스 또는 기본값)
    const paceDiff = currentPace - targetPace; // 차이 (양수: 느림, 음수: 빠름)
    const maxDiff = 2.0; // 최대 차이 (분/km)
    const gaugePosition = Math.max(-1, Math.min(1, paceDiff / maxDiff)); // -1 ~ 1 범위

    // 게이지 색상 결정
    let gaugeColor = '#00E0FF'; // 적정 (시안)
    if (gaugePosition < -0.3) {
      gaugeColor = '#80FF00'; // 빠름 (그린)
    } else if (gaugePosition > 0.3) {
      gaugeColor = '#FFCC00'; // 느림 (옐로우)
    }

    return (
      <View style={styles.page} onTouchEnd={handleDoubleTap}>
        <ScrollView
          style={styles.statsPage}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {/* 메인 통계: 거리 */}
          <View style={styles.mainStatContainer}>
            <Text style={styles.mainStatValue}>{formatDistance(distance)}</Text>
            <Text style={styles.mainStatLabel}>킬로미터</Text>
          </View>

          {/* 페이스 게이지 */}
          <View style={styles.paceGaugeContainer}>
            <Text style={styles.paceGaugeTitle}>페이스</Text>
            <View style={styles.paceGaugeTrack}>
              {/* 배경 트랙 */}
              <View style={styles.paceGaugeBackground} />

              {/* 중앙 목표선 */}
              <View style={styles.paceGaugeCenterLine} />

              {/* 현재 페이스 인디케이터 */}
              <View
                style={[
                  styles.paceGaugeIndicator,
                  {
                    left: `${(gaugePosition + 1) * 50}%`,
                    backgroundColor: gaugeColor,
                  },
                ]}
              />
            </View>

            {/* 게이지 레이블 */}
            <View style={styles.paceGaugeLabels}>
              <Text style={styles.paceGaugeLabelLeft}>빠름</Text>
              <Text style={styles.paceGaugeLabelCenter}>{formatPace(currentPace)}</Text>
              <Text style={styles.paceGaugeLabelRight}>느림</Text>
            </View>
          </View>

          {/* 보조 통계 그리드 */}
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <Text style={styles.statCardLabel}>시간</Text>
              <Text style={styles.statCardValue}>{formatDuration(duration)}</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statCardLabel}>평균 페이스</Text>
              <Text style={styles.statCardValue}>{formatPace(avgPace)}</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statCardLabel}>칼로리</Text>
              <Text style={styles.statCardValue}>{formatCalories(calories)}</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statCardLabel}>심박수</Text>
              <View style={styles.heartRateContainer}>
                <Text style={styles.heartIcon}>❤️</Text>
                <Text style={styles.statCardValue}>--</Text>
                <Text style={styles.heartRateUnit}>BPM</Text>
              </View>
            </View>
          </View>

          {/* 활동 유형 표시 */}
          <View style={styles.activityIndicator}>
            <View
              style={[
                styles.activityDot,
                {backgroundColor: getActivityColor(currentActivity)},
              ]}
            />
            <Text style={styles.activityLabel}>{getActivityLabel(currentActivity)}</Text>
          </View>
        </ScrollView>
      </View>
    );
  };

  // 페이지 3: 페이스 그래프
  const renderPaceGraphPage = () => {
    const maxPace = Math.max(...paceHistory.map(p => p.pace), avgPace * 1.2);
    const minPace = Math.min(...paceHistory.map(p => p.pace), avgPace * 0.8);

    return (
      <View style={styles.page} onTouchEnd={handleDoubleTap}>
        <View style={styles.graphPage}>
          <Text style={styles.graphTitle}>페이스 변화</Text>

          {/* 간단한 라인 그래프 */}
          <View style={styles.graphContainer}>
            {paceHistory.length > 0 ? (
              <View style={styles.graphContent}>
                {paceHistory.map((point, index) => {
                  const heightPercent = 1 - ((point.pace - minPace) / (maxPace - minPace));
                  return (
                    <View
                      key={index}
                      style={[
                        styles.graphBar,
                        {
                          height: `${heightPercent * 80}%`,
                          marginBottom: `${(1 - heightPercent) * 80}%`,
                        },
                      ]}
                    />
                  );
                })}
              </View>
            ) : (
              <Text style={styles.graphEmptyText}>페이스 데이터를 수집하는 중...</Text>
            )}
          </View>

          {/* 평균 페이스 표시 */}
          <View style={styles.graphStats}>
            <View style={styles.graphStatItem}>
              <Text style={styles.graphStatLabel}>평균</Text>
              <Text style={styles.graphStatValue}>{formatPace(avgPace)}</Text>
            </View>
            <View style={styles.graphStatItem}>
              <Text style={styles.graphStatLabel}>현재</Text>
              <Text style={styles.graphStatValue}>{formatPace(currentPace)}</Text>
            </View>
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* 상단 헤더 */}
      <View style={styles.header}>
        <Text style={styles.status}>
          {isAutoPaused
            ? '잠시 멈춤 (자동)'
            : status === 'paused' && pauseReason === 'gps_loss'
              ? 'GPS 신호 손실로 일시정지'
              : status === 'running'
                ? '러닝 중'
                : '일시정지'}
        </Text>
        {gpsSignalLost && (
          <View style={styles.gpsWarningBanner}>
            <Text style={styles.gpsWarningText}>⚠️ GPS 신호 손실</Text>
          </View>
        )}
      </View>

      {/* 킬로미터 알림 배너 */}
      {kilometerBanner && (
        <Animated.View
          style={[
            styles.kilometerBanner,
            {
              transform: [{translateY: bannerSlideAnim}],
            },
          ]}
        >
          <Text style={styles.kilometerBannerNumber}>{kilometerBanner.km}</Text>
          <Text style={styles.kilometerBannerLabel}>KM 완주!</Text>
          <Text style={styles.kilometerBannerPace}>{formatPace(kilometerBanner.pace)}</Text>

          {/* 스플릿 비교 */}
          {kilometerBanner.splitComparison && (
            <View style={styles.splitComparisonContainer}>
              <Text style={[
                styles.splitComparisonText,
                kilometerBanner.splitComparison.faster
                  ? styles.splitComparisonFaster
                  : styles.splitComparisonSlower
              ]}>
                {kilometerBanner.splitComparison.faster ? '↑' : '↓'}
                {' '}
                {kilometerBanner.splitComparison.faster ? '빠름' : '느림'}
                {' '}
                {Math.floor(kilometerBanner.splitComparison.diff * 60)}초
              </Text>
            </View>
          )}
        </Animated.View>
      )}

      {/* 페이지 인디케이터 */}
      <View style={styles.pageIndicator}>
        {[0, 1, 2].map((index) => (
          <View
            key={index}
            style={[
              styles.pageIndicatorDot,
              currentPage === index && styles.pageIndicatorDotActive,
            ]}
          />
        ))}
      </View>

      {/* 스와이프 가능한 페이지 */}
      <PagerView
        ref={pagerRef}
        style={styles.pagerView}
        initialPage={1}
        onPageSelected={(e) => setCurrentPage(e.nativeEvent.position)}
      >
        {renderMapPage()}
        {renderStatsPage()}
        {renderPaceGraphPage()}
      </PagerView>

      {/* 하단 컨트롤 버튼 */}
      <View style={styles.controls}>
        <TouchableOpacity
          style={[
            styles.pauseButton,
            status === 'paused' && styles.resumeButton,
          ]}
          onPress={handlePauseResume}>
          <Text style={styles.neonButtonText}>
            {status === 'running' ? '일시정지' : '재개'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.stopButton} onPress={handleStop}>
          <Text style={styles.buttonText}>종료</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: '#000',
    zIndex: 10,
  },
  status: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  gpsWarningBanner: {
    backgroundColor: '#FFCC00',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 8,
    marginTop: 8,
  },
  gpsWarningText: {
    color: '#000',
    fontSize: 13,
    fontWeight: '700',
  },
  kilometerBanner: {
    position: 'absolute',
    top: 0,
    left: 20,
    right: 20,
    backgroundColor: '#80FF00',
    paddingVertical: rp(20),
    paddingHorizontal: rp(24),
    borderRadius: 16,
    alignItems: 'center',
    zIndex: 100,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  kilometerBannerNumber: {
    color: '#000',
    fontSize: rf(56),
    fontWeight: '800',
    letterSpacing: -3,
    marginBottom: rp(4),
  },
  kilometerBannerLabel: {
    color: '#000',
    fontSize: rf(20),
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: rp(8),
  },
  kilometerBannerPace: {
    color: '#000',
    fontSize: rf(18),
    fontWeight: '600',
    opacity: 0.8,
  },
  splitComparisonContainer: {
    marginTop: rp(12),
    paddingTop: rp(12),
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.2)',
  },
  splitComparisonText: {
    fontSize: rf(16),
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  splitComparisonFaster: {
    color: '#006600',
  },
  splitComparisonSlower: {
    color: '#CC9900',
  },
  pageIndicator: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 8,
  },
  pageIndicatorDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#333',
  },
  pageIndicatorDotActive: {
    backgroundColor: '#fff',
    width: 20,
    borderRadius: 3,
  },
  pagerView: {
    flex: 1,
  },
  page: {
    flex: 1,
  },

  // 페이지 1: 지도
  mapOverlay: {
    position: 'absolute',
    top: 20,
    left: 20,
    right: 20,
    zIndex: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 16,
    padding: 20,
  },
  mapStats: {
    alignItems: 'center',
    marginBottom: rp(12),
  },
  mapStatValue: {
    color: '#fff',
    fontSize: rf(64),
    fontWeight: '800',
    letterSpacing: -3,
  },
  mapStatLabel: {
    color: '#999',
    fontSize: rf(18),
    fontWeight: '600',
    marginTop: rp(8),
    letterSpacing: 1,
  },
  mapStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  mapStatSmall: {
    alignItems: 'center',
  },
  mapStatSmallLabel: {
    color: '#999',
    fontSize: rf(13),
    fontWeight: '500',
    letterSpacing: 0.5,
  },
  mapStatSmallValue: {
    color: '#fff',
    fontSize: rf(22),
    fontWeight: '700',
    letterSpacing: -0.5,
    marginTop: rp(6),
  },
  mapFull: {
    width: width,
    height: height,
  },
  gpsLossMarker: {
    width: 32,
    height: 32,
    backgroundColor: '#FF3B30',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  gpsLossMarkerText: {
    fontSize: 16,
  },

  // 페이지 2: 통계
  statsPage: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: rp(40),
    paddingBottom: rp(20),
  },
  mainStatContainer: {
    alignItems: 'center',
    marginTop: rp(24),
    marginBottom: rp(40),
  },
  mainStatValue: {
    color: '#fff',
    fontSize: rf(96),
    fontWeight: '800',
    letterSpacing: -4,
  },
  mainStatLabel: {
    color: '#999',
    fontSize: rf(22),
    fontWeight: '600',
    marginTop: rp(12),
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  paceGaugeContainer: {
    marginBottom: rp(32),
    paddingHorizontal: 8,
  },
  paceGaugeTitle: {
    color: '#999',
    fontSize: rf(15),
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: rp(20),
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  paceGaugeTrack: {
    height: 8,
    position: 'relative',
    marginBottom: 16,
  },
  paceGaugeBackground: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 8,
    backgroundColor: '#333',
    borderRadius: 4,
  },
  paceGaugeCenterLine: {
    position: 'absolute',
    left: '50%',
    top: -4,
    width: 2,
    height: 16,
    backgroundColor: '#fff',
    marginLeft: -1,
  },
  paceGaugeIndicator: {
    position: 'absolute',
    top: -6,
    width: 20,
    height: 20,
    borderRadius: 10,
    marginLeft: -10,
    borderWidth: 3,
    borderColor: '#000',
  },
  paceGaugeLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  paceGaugeLabelLeft: {
    color: '#80FF00',
    fontSize: 13,
    fontWeight: '600',
  },
  paceGaugeLabelCenter: {
    color: '#fff',
    fontSize: rf(20),
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  paceGaugeLabelRight: {
    color: '#FFCC00',
    fontSize: rf(13),
    fontWeight: '600',
  },
  statsGrid: {
    marginBottom: rp(24),
  },
  statCard: {
    width: '100%',
    backgroundColor: '#1a1a1a',
    paddingVertical: rp(16),
    paddingHorizontal: rp(20),
    borderRadius: 16,
    marginBottom: rp(10),
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statCardLabel: {
    color: '#999',
    fontSize: rf(13),
    fontWeight: '500',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  statCardValue: {
    color: '#fff',
    fontSize: rf(32),
    fontWeight: '800',
    letterSpacing: -1.5,
  },
  heartRateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  heartIcon: {
    fontSize: 24,
  },
  heartRateUnit: {
    color: '#999',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 4,
  },
  activityIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  activityDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  activityLabel: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },

  // 페이지 3: 그래프
  graphPage: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: rp(40),
    paddingBottom: rp(40),
  },
  graphTitle: {
    color: '#fff',
    fontSize: rf(28),
    fontWeight: '700',
    letterSpacing: -0.5,
    marginBottom: rp(32),
    textAlign: 'center',
  },
  graphContainer: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: rp(20),
    marginBottom: rp(24),
  },
  graphContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
  },
  graphBar: {
    width: 4,
    backgroundColor: '#00E0FF',
    borderRadius: 2,
  },
  graphEmptyText: {
    color: '#666',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 40,
  },
  graphStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  graphStatItem: {
    alignItems: 'center',
  },
  graphStatLabel: {
    color: '#999',
    fontSize: rf(13),
    fontWeight: '500',
    marginBottom: rp(10),
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  graphStatValue: {
    color: '#fff',
    fontSize: rf(32),
    fontWeight: '800',
    letterSpacing: -1,
  },

  // 하단 컨트롤
  controls: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 32,
    gap: 12,
    backgroundColor: '#000',
    borderTopWidth: 1,
    borderTopColor: '#1a1a1a',
  },
  pauseButton: {
    flex: 1,
    backgroundColor: '#FFCC00',
    paddingVertical: 18,
    borderRadius: 12,
    alignItems: 'center',
  },
  resumeButton: {
    backgroundColor: '#80FF00',
  },
  stopButton: {
    flex: 1,
    backgroundColor: '#FF3B30',
    paddingVertical: 18,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  neonButtonText: {
    color: '#000',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
