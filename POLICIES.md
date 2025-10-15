# RunPort 정책 문서 (Policies Document)

> 본 문서는 RunPort 앱의 모든 정책, 알고리즘, 임계값, 비즈니스 로직을 정의합니다.
>
> **최종 업데이트**: 2025년 (구현 완료 기준)

---

## 목차

1. [활동 감지 정책 (Activity Detection)](#1-활동-감지-정책)
2. [자동 일시정지/재개 정책](#2-자동-일시정지재개-정책)
3. [GPS 신호 손실 처리 정책](#3-gps-신호-손실-처리-정책)
4. [칼로리 계산 정책](#4-칼로리-계산-정책)
5. [페이스 계산 정책](#5-페이스-계산-정책)
6. [경로 시각화 정책](#6-경로-시각화-정책)
7. [GPS 추적 설정](#7-gps-추적-설정)
8. [데이터 저장 정책](#8-데이터-저장-정책)
9. [UI/UX 정책](#9-uiux-정책)
10. [NRC 스타일 디자인 시스템](#10-nrc-스타일-디자인-시스템)
11. [인터랙션 정책](#11-인터랙션-정책)
12. [실시간 피드백 시스템](#12-실시간-피드백-시스템)
13. [성능 최적화 정책](#13-성능-최적화-정책)
14. [오류 처리 정책](#14-오류-처리-정책)
15. [화면별 정책](#15-화면별-정책)
16. [개발 도구 및 유틸리티](#16-개발-도구-및-유틸리티)

---

## 1. 활동 감지 정책 (Activity Detection)

### 1.1 활동 유형 분류

**정의 위치**: `src/types/location.ts:6`

```typescript
type ActivityType = 'walking' | 'running' | 'vehicle' | 'still' | 'unknown';
```

| 활동 유형 | 설명 | 용도 |
|----------|------|------|
| `walking` | 걷기 | 칼로리 계산 포함, 초록색 경로 |
| `running` | 뛰기 | 칼로리 계산 포함, 파란색 경로 |
| `vehicle` | 이동수단 (차량/지하철/비행기) | 칼로리 제외, 회색 경로 |
| `still` | 정지 | 칼로리 제외, 회색 경로 |
| `unknown` | 알 수 없음 | 칼로리 제외, 회색 경로 |

### 1.2 하이브리드 활동 감지 알고리즘

**구현 위치**: `src/utils/activityDetector.ts`

#### 1.2.1 속도 기반 추정 (1차 판단)

**임계값 정의**:
```typescript
SPEED_THRESHOLDS = {
  STILL: 0.4 m/s       // 1.44 km/h - 정지
  WALKING_MAX: 1.67 m/s // 6.0 km/h - 걷기 최대
  RUNNING_MAX: 3.33 m/s // 12.0 km/h - 뛰기 최대
}
```

**분류 로직**:
```
속도 < 0.4 m/s        → 정지 (still)
0.4 ~ 1.67 m/s       → 걷기 (walking)
1.67 ~ 3.33 m/s      → 뛰기 (running)
속도 > 3.33 m/s      → 이동수단 (vehicle)
```

**적용 시점**:
- GPS 포인트 수신 즉시 (실시간 피드백)
- AI 인식이 없거나 신뢰도가 50% 미만일 때

#### 1.2.2 AI 활동 인식 (2차 보정)

**신뢰도 임계값**:
```typescript
CONFIDENCE_THRESHOLDS = {
  LOW: 50%      // 낮음 - 속도 기반 사용
  MEDIUM: 70%   // 중간 - 조건부 사용
  HIGH: 85%     // 높음 - AI 우선 사용
}
```

**AI 우선 사용 조건**:
- 신뢰도 ≥ 85%: AI 활동 유형 무조건 사용
- 신뢰도 70-85%: AI와 속도 기반이 일치하면 AI 사용
- 신뢰도 50-70%: 속도 기반 우선, AI는 참고만
- 신뢰도 < 50%: 속도 기반만 사용

**iOS Activity Recognition 매핑**:
```typescript
// src/utils/activityDetector.ts:70
iOS Activity Type → RunPort Activity Type
'walking'         → 'walking'
'running'         → 'running'
'cycling'         → 'vehicle'
'automotive'      → 'vehicle'
'stationary'      → 'still'
기타              → 'unknown'
```

#### 1.2.3 하이브리드 결정 로직

**우선순위**:
1. **AI 신뢰도 ≥ 85%**: AI 결과 사용 (속도 무시)
2. **AI 신뢰도 70-85%**:
   - AI와 속도 일치 → AI 사용
   - AI와 속도 불일치 → 속도 사용
3. **AI 신뢰도 50-70%**: 속도 기반 사용 (AI 무시)
4. **AI 신뢰도 < 50% 또는 없음**: 속도 기반 사용

**예외 규칙**:
- 속도가 이동수단 범위(> 3.33 m/s)인데 AI가 걷기/뛰기 → **AI 우선** (버스/지하철 내 움직임)
- AI가 vehicle인데 속도가 느림 → **속도 우선** (정차 중)

### 1.3 활동별 색상 매핑

**구현 위치**: `src/utils/activityDetector.ts:95`

```typescript
COLOR_MAP = {
  walking: '#34C759'  // 초록색 (Apple 시스템 Green)
  running: '#007AFF'  // 파란색 (Apple 시스템 Blue)
  vehicle: '#8E8E93'  // 회색 (Apple 시스템 Gray)
  still:   '#8E8E93'  // 회색
  unknown: '#8E8E93'  // 회색
}
```

### 1.4 활동별 라벨

**구현 위치**: `src/utils/activityDetector.ts:106`

```typescript
LABEL_MAP = {
  walking: '걷기'
  running: '뛰기'
  vehicle: '이동수단'
  still:   '정지'
  unknown: '알 수 없음'
}
```

---

## 2. 자동 일시정지/재개 정책

### 2.1 자동 일시정지 (Auto-Pause)

**구현 위치**: `src/stores/runningStore.ts:82-85`

#### 임계값 설정

```typescript
AUTO_PAUSE_THRESHOLD = 0.5 km/h = 0.139 m/s
AUTO_PAUSE_DURATION = 3000 ms (3초)
```

#### 동작 조건

**활성화 조건**:
1. 러닝 상태가 `running`이어야 함
2. 이미 자동 일시정지 상태가 아니어야 함
3. 사용자가 수동 일시정지하지 않은 상태

**트리거 로직**:
```
IF 속도 < 0.139 m/s:
  타이머 시작
  IF 3초 동안 지속:
    자동 일시정지 활성화
    duration 업데이트 중지
    GPS 포인트 추가 중지
ELSE:
  타이머 리셋
```

**효과**:
- `isAutoPaused: true` 설정
- Duration 카운트 중지
- GPS 포인트 수집 중지 (route에 추가 안함)
- UI에 "잠시 멈춤 (자동)" 표시

**사용 사례**:
- 신호등 대기
- 잠시 쉬는 경우
- 물 마시기

### 2.2 자동 재개 (Auto-Resume)

**구현 위치**: `src/stores/runningStore.ts:82-85`

#### 임계값 설정

```typescript
AUTO_RESUME_THRESHOLD = 2.0 km/h = 0.556 m/s
AUTO_RESUME_DURATION = 2000 ms (2초)
```

#### 동작 조건

**활성화 조건**:
1. 현재 자동 일시정지 상태(`isAutoPaused: true`)
2. 러닝 상태가 `running` 유지

**트리거 로직**:
```
IF 자동 일시정지 중 AND 속도 ≥ 0.556 m/s:
  타이머 시작
  IF 2초 동안 지속:
    자동 일시정지 해제
    duration 업데이트 재개
    GPS 포인트 수집 재개
ELSE:
  타이머 리셋
```

**효과**:
- `isAutoPaused: false` 설정
- Duration 카운트 재개
- GPS 포인트 수집 재개
- UI에 "러닝 중" 표시

### 2.3 수동 일시정지와의 차이점

| 항목 | 자동 일시정지 | 수동 일시정지 |
|------|-------------|-------------|
| 트리거 | 저속 3초 지속 | 사용자 버튼 클릭 |
| GPS 추적 | 계속 실행 (BackgroundGeo 유지) | 완전 중지 |
| 재개 조건 | 자동 (고속 2초) | 사용자 버튼 클릭 |
| 상태 | `status: 'running', isAutoPaused: true` | `status: 'paused'` |
| UI 표시 | "잠시 멈춤 (자동)" | "일시정지" |

---

## 3. GPS 신호 손실 처리 정책

### 3.1 GPS 신호 품질 판단

**구현 위치**: `src/services/BackgroundGeoService.ts:15`

#### 정확도 임계값

```typescript
GPS_ACCURACY_THRESHOLD = 50 meters
```

**판단 기준**:
- `accuracy > 50m`: GPS 신호 불량 (경고 로그 출력)
- `accuracy ≤ 50m`: GPS 신호 정상

**적용**:
- 실시간 로그로 사용자에게 피드백
- 현재는 경고만, 추후 확장 가능

### 3.2 GPS 신호 손실 감지

**구현 위치**: `src/stores/runningStore.ts:90-93`

#### 시간 기반 임계값

```typescript
GPS_LOSS_DETECTION_DELAY = 60000 ms (60초)    // 신호 손실 감지 시작 (10초 → 60초로 변경)
GPS_LOSS_SHORT_THRESHOLD = 90000 ms (90초)     // 짧은 신호 손실 콜백
GPS_LOSS_MEDIUM_THRESHOLD = 180000 ms (3분)    // 중간 신호 손실 (사용자 선택)
GPS_SIGNAL_CHECK_INTERVAL = 10000 ms (10초마다 체크)  // (5초 → 10초로 변경)
```

**변경 이유**:
- **60초 지연**: distanceFilter가 5m로 설정되어 있어, 사용자가 느리게 걷거나 신호등에서 대기할 때 실제로는 GPS가 정상인데 신호 손실로 오판하는 경우 방지
- **10초 체크 간격**: 더 느긋한 체크로 배터리 절약 및 불필요한 경고 감소

#### 손실 감지 로직

**초기 감지 (60초)**:
```
IF 마지막 GPS 업데이트 이후 60초 경과:
  gpsSignalLost = true
  gpsLossStartTime = 마지막 GPS 시간
  → UI: 경고 배너 표시 준비
```

### 3.3 손실 단계별 처리

#### 3.3.1 짧은 신호 손실 (60초 ~ 90초)

**정책**:
- **자동 처리**: 사용자 개입 없음
- **시각적 표시**: 경고 배너 ("⚠️ GPS 신호 손실")
- **경로 표시**: 점선으로 추정 경로 표시 준비
- **용도**: 짧은 터널, 건물 사이

**구현**:
```typescript
// src/screens/RunningScreen.tsx:60-63
onShortLoss: () => {
  console.log('[UI] 짧은 GPS 신호 손실 감지');
  // 점선으로 표시만 (자동 처리)
}
```

#### 3.3.2 중간 신호 손실 (90초 ~ 3분)

**정책**:
- **자동 처리**: 사용자 개입 없음 (다이얼로그 제거됨)
- **시각적 표시**: 경로는 점선으로 표시 (추정 구간)
- **무응답 시**: 3분 경과 시 자동으로 일시정지 (긴 신호 손실 정책으로 전환)
- **용도**: 긴 터널, 지하 주차장

**구현**:
```typescript
// src/screens/RunningScreen.tsx:120-131
// 중간 신호 손실 콜백 제거 (자동 처리)
React.useEffect(() => {
  setGPSLossCallbacks({
    onShortLoss: () => {
      console.log('[UI] 짧은 GPS 신호 손실 감지');
      // 점선으로 표시만 (자동 처리)
    },
    onLongLoss: () => {
      console.log('[UI] 긴 GPS 신호 손실 - 자동 일시정지');
      // 자동 일시정지만 수행 (다이얼로그 없음)
    },
  });
}, [setGPSLossCallbacks]);
```

**변경 이력**:
- 2025-10-14: 사용자 선택 다이얼로그 제거, 자동 처리로 변경
- 이유: UX 간소화, 불필요한 사용자 개입 제거

#### 3.3.3 긴 신호 손실 (3분 이상)

**정책**:
- **자동 일시정지**: 사용자 개입 없이 자동으로 일시정지
- **헤더 안내**: "GPS 신호 손실로 일시정지" 메시지 표시
- **배터리 절약**: 불필요한 GPS 추적 방지
- **용도**: 지하철 탑승, 실내 이동

**구현**:
```typescript
// src/screens/RunningScreen.tsx:126-130
onLongLoss: () => {
  console.log('[UI] 긴 GPS 신호 손실 - 자동 일시정지');
  // pause() 자동 호출됨 (runningStore에서)
  // 별도 Alert 없이 헤더에 상태 표시
}

// src/screens/RunningScreen.tsx:473-480
// 헤더 상태 메시지
<Text style={styles.status}>
  {isAutoPaused
    ? '잠시 멈춤 (자동)'
    : status === 'paused' && pauseReason === 'gps_loss'
      ? 'GPS 신호 손실로 일시정지'
      : status === 'running'
        ? '러닝 중'
        : '일시정지'}
</Text>
```

### 3.4 GPS 신호 복구 처리

**구현 위치**: `src/stores/runningStore.ts:307-326`

#### 복구 감지 로직

```
IF gpsSignalLost == true AND 새로운 GPS 포인트 수신:
  gpsSignalLost = false
  gpsLossStartTime = null
  해당 포인트에 gpsSignalLost: true 마킹
  → 지도에 ⚠️ 마커 표시

  IF status == 'paused' AND pauseReason == 'gps_loss':
    자동으로 resume() 호출
    → GPS 신호 복구로 자동 재개
```

**마커 표시**:
- **색상**: 빨간색 원 (#FF3B30)
- **아이콘**: ⚠️
- **위치**: GPS 신호가 복구된 첫 번째 지점
- **용도**: 사용자에게 신호 손실 구간 명확히 표시

#### 일시정지 이유 구분

**구현 위치**: `src/stores/runningStore.ts:19`

```typescript
pauseReason: 'manual' | 'gps_loss' | null
```

**분류**:
| 이유 | 트리거 | 재개 방식 |
|------|--------|----------|
| `manual` | 사용자가 일시정지 버튼 클릭 | 수동 (사용자가 재개 버튼 클릭) |
| `gps_loss` | GPS 신호 3분 이상 손실 | **자동** (GPS 신호 복구 시) |
| `null` | 러닝 중 (일시정지 아님) | - |

**자동 재개 로직**:
```typescript
// GPS 신호 복구 시 (addGPSPoint)
if (state.gpsSignalLost) {
  // 신호 복구 처리
  set({
    gpsSignalLost: false,
    gpsLossStartTime: null,
  });

  // GPS 손실로 인한 일시정지였다면 자동 재개
  if (state.status === 'paused' && state.pauseReason === 'gps_loss') {
    console.log('[GPS] 신호 복구 - 자동 재개');
    get().resume();
  }
}
```

**사용자 경험 개선**:
- GPS 손실로 자동 일시정지 → 신호 복구 시 자동으로 러닝 재개
- 수동 일시정지 → 사용자가 직접 재개 버튼을 눌러야 함
- 터널이나 건물 진입/탈출 시 자연스러운 UX 제공

### 3.5 추정 경로 표시

**구현 위치**: `src/screens/RunningScreen.tsx:193`

#### 점선 패턴

```typescript
lineDashPattern = [10, 5]  // 10px 실선, 5px 공백
```

**적용 조건**:
- `segment.isEstimated === true`인 세그먼트에만 점선 적용
- 정상 신호 구간은 실선 유지

**시각적 구분**:
```
실선 (────────): 정상 GPS 신호
점선 (- - - - -): GPS 신호 손실 추정 구간
```

---

## 4. 칼로리 계산 정책

### 4.1 활동별 칼로리 계수

**구현 위치**: `src/services/CalcService.ts:34-43`

#### 계수 정의

```typescript
CALORIE_COEFFICIENTS = {
  walking: 0.6    // 걷기: 체중(kg) × 거리(km) × 0.6
  running: 1.036  // 뛰기: 체중(kg) × 거리(km) × 1.036
  vehicle: 0      // 이동수단: 칼로리 제외
  still: 0        // 정지: 칼로리 제외
  unknown: 0      // 알 수 없음: 칼로리 제외
}
```

**근거**:
- **걷기 (0.6)**: 평균 성인 보행 칼로리 소모율 (MET 3.5 기준 근사값)
- **뛰기 (1.036)**: 평균 러닝 칼로리 소모율 (MET 7.0 기준 근사값)
- **제외 항목**: 실제 신체 활동이 아닌 이동은 칼로리 계산에서 제외

### 4.2 기본 체중 설정

**구현 위치**: `src/constants/config.ts` (추정)

```typescript
DEFAULT_WEIGHT = 70 kg
```

**적용**:
- 사용자가 체중을 입력하지 않은 경우 기본값 사용
- 추후 사용자 프로필 기능으로 개인화 가능

### 4.3 칼로리 계산 공식

**전체 칼로리**:
```
총 칼로리 = Σ (활동별 거리 × 체중 × 계수)
         = (걷기 거리 × 체중 × 0.6) + (뛰기 거리 × 체중 × 1.036)
```

**예시**:
```
체중 70kg, 걷기 2km, 뛰기 3km
= (2 × 70 × 0.6) + (3 × 70 × 1.036)
= 84 + 217.56
= 301.56 kcal
```

### 4.4 추정 구간 칼로리 처리

**정책**: GPS 신호 손실 구간도 동일하게 계산
- 이유: 사용자는 실제로 움직였으므로 칼로리 소모 발생
- 표시: 결과 화면에서 추정 구간임을 별도 표시

---

## 4.5 거리 계산 알고리즘

**구현 위치**: `src/utils/haversine.ts`

#### Haversine 공식

**사용 이유**: GPS 좌표 간 정확한 거리 계산
- 지구를 구(sphere)로 가정
- 위도/경도 변화를 고려한 실제 거리 계산

**지구 반지름**:
```typescript
EARTH_RADIUS_KM = 6371 km
```

**계산 공식**:
```
a = sin²(Δlat/2) + cos(lat1) × cos(lat2) × sin²(Δlon/2)
c = 2 × atan2(√a, √(1-a))
거리(km) = 지구 반지름 × c
```

**정확도**:
- ±0.3% 오차 (단거리 측정에 충분)
- 실제 지구는 타원체이지만 러닝 거리 측정에는 구 가정으로 충분

#### 총 거리 계산

```typescript
총 거리 = Σ calculateDistance(point[i-1], point[i])
```

**로직**:
```
GPS 경로 배열을 순회:
  FOR i = 1 to length-1:
    거리 += haversine(point[i-1], point[i])
```

#### 속도 계산

```typescript
속도 (km/h) = (거리 km / 시간 초) × 3600
```

---

## 5. 페이스 계산 정책

### 5.1 평균 페이스 (Average Pace)

**구현 위치**: `src/services/CalcService.ts:163`

#### 계산 공식

```typescript
평균 페이스 (min/km) = 총 이동 시간(초) / 총 거리(km) / 60

// 또는
평균 페이스 = movingDuration / totalDistance / 60
```

**사용 시간**:
- `movingDuration`: 실제 이동한 시간 (자동 일시정지 시간 제외)
- 현재 구현에서는 `duration`과 동일하게 설정됨

**예시**:
```
총 거리: 5km
총 시간: 1800초 (30분)
평균 페이스 = 1800 / 5 / 60 = 6분/km
```

### 5.2 현재 페이스 (Current Pace)

**구현 위치**: `src/services/CalcService.ts:175`

#### 계산 방식

**윈도우 기반 평균**:
```typescript
CURRENT_PACE_WINDOW = 5개 포인트 (기본값)
```

**계산 로직**:
```
최근 5개 GPS 포인트 선택
해당 구간의 거리 계산
해당 구간의 시간 계산 (마지막 - 첫 번째 타임스탬프)
현재 페이스 = 시간(초) / 거리(km) / 60
```

**장점**:
- 실시간 페이스 변화 반영
- 급격한 변화는 평균화되어 안정적

**예시**:
```
최근 5개 포인트:
- 거리: 0.1km
- 시간: 36초
현재 페이스 = 36 / 0.1 / 60 = 6분/km
```

### 5.3 페이스 표시 형식

**구현 위치**: `src/utils/formatters.ts`

```typescript
formatPace(pace: number): string
// 6.25 min/km → "6'15"" (6분 15초)
// 0 → "--'--""
```

### 5.4 스플릿 계산 정책

**구현 위치**: `src/constants/config.ts:45`, `src/services/CalcService.ts:104`

#### 스플릿 거리

```typescript
SPLIT_CONFIG.DISTANCE = 1.0 km
```

**의미**: 1km마다 구간(스플릿) 생성

#### 스플릿 계산 로직

**계산 방식**:
```
GPS 경로를 순회하면서:
  IF 누적 거리 ≥ 1km:
    스플릿 저장 (번호, 거리, 시간, 페이스)
    카운터 리셋
    다음 스플릿 시작

마지막 구간 (1km 미만):
  IF 남은 거리 > 0:
    스플릿 저장 (부분 거리)
```

**스플릿 구조**:
```typescript
interface Split {
  splitNumber: number;    // 1, 2, 3...
  distance: number;       // 1.0 km (마지막은 0.xx km 가능)
  duration: number;       // 초
  pace: number;          // min/km
}
```

**표시 예시**:
```
1km: 6'15"
2km: 5'58"
3km: 6'02"
0.5km: 6'10" (마지막 구간)
```

---

## 6. 경로 시각화 정책

### 6.1 경로 세그먼트 분할

**구현 위치**: `src/services/CalcService.ts:50`

#### 세그먼트 생성 규칙

**분할 조건**:
```
IF 연속된 포인트의 activityType이 다름:
  새로운 세그먼트 생성
ELSE:
  현재 세그먼트에 포인트 추가
```

**세그먼트 구조**:
```typescript
interface RouteSegment {
  activityType: ActivityType;    // 활동 유형
  points: GPSCoordinate[];        // GPS 포인트 배열
  distance: number;               // 세그먼트 거리 (km)
  startIndex: number;             // 시작 인덱스
  endIndex: number;               // 종료 인덱스
  isEstimated: boolean;           // GPS 신호 손실 구간 여부
}
```

**isEstimated 판단**:
```typescript
// 세그먼트의 모든 포인트가 추정값인지 확인
isEstimated = segment.points.every(p => p.isEstimated)
```

### 6.2 다색상 경로 표시

**구현 위치**: `src/screens/RunningScreen.tsx:184`

#### 렌더링 방식

**Polyline 생성**:
```typescript
{routeSegments.map((segment, index) => (
  <Polyline
    key={`segment-${index}`}
    coordinates={segment.points}
    strokeColor={getActivityColor(segment.activityType)}
    strokeWidth={4}
    lineDashPattern={segment.isEstimated ? [10, 5] : undefined}
  />
))}
```

**색상 적용**:
- 걷기: 초록색 (#34C759)
- 뛰기: 파란색 (#007AFF)
- 이동수단: 회색 (#8E8E93)
- 정지: 회색 (#8E8E93)
- 알 수 없음: 회색 (#8E8E93)

**선 스타일**:
- 정상 신호: 실선 (strokeWidth: 4)
- 신호 손실: 점선 (lineDashPattern: [10, 5])

### 6.3 GPS 손실 마커

**구현 위치**: `src/screens/RunningScreen.tsx:198`

#### 마커 표시 조건

```typescript
마커 표시 대상 = route.filter(point => point.gpsSignalLost === true)
```

**마커 스타일**:
```
- 크기: 32x32 픽셀
- 배경: 빨간색 원 (#FF3B30)
- 테두리: 흰색 2px
- 아이콘: ⚠️ (경고 이모지)
```

**배치 위치**: GPS 신호가 복구된 첫 번째 지점

### 6.4 지도 설정

**구현 위치**: `src/constants/config.ts:51-63`

#### 지도 영역 델타

```typescript
MAP_CONFIG.INITIAL_DELTA = {
  latitudeDelta: 0.01,
  longitudeDelta: 0.01
}
```

**의미**:
- 지도 초기 확대/축소 레벨 설정
- `0.01` = 약 1km 반경 표시
- 사용자 위치 중심으로 적절한 범위

#### 경로 선 두께

```typescript
MAP_CONFIG.ROUTE_STROKE_WIDTH = 4
```

**적용**:
- Polyline의 `strokeWidth` 속성
- 모든 활동 유형에 동일하게 적용
- 시인성과 지도 가독성의 균형

#### 기본 경로 색상

```typescript
MAP_CONFIG.ROUTE_STROKE_COLOR = '#007AFF'
```

**참고**: 실제로는 활동별 색상 사용
- 설정 파일의 기본값
- 활동 감지 전 임시 색상으로 사용 가능

---

## 7. GPS 추적 설정

### 7.1 GPS 샘플링 및 정확도

**구현 위치**: `src/constants/config.ts:6-18`

#### GPS 샘플링 간격

```typescript
GPS_CONFIG.SAMPLING_INTERVAL = 1000 ms (1초)
```

**의미**: GPS 포인트를 1초마다 수집
- 실제 수집은 `distanceFilter`와 함께 작동
- 배터리와 정확도의 균형

#### GPS 정확도 임계값

```typescript
GPS_CONFIG.ACCURACY_THRESHOLD = 20 meters
```

**용도**: 이상치 필터링 (현재 사용 안함, 추후 구현 예정)
- `accuracy > 20m`인 포인트는 제외 가능
- 현재는 BackgroundGeoService에서 50m 기준 사용

#### 최대 속도 임계값

```typescript
GPS_CONFIG.MAX_SPEED = 30 km/h (8.33 m/s)
```

**용도**: 이상치 제거
- GPS 오류로 인한 비정상적으로 빠른 속도 필터링
- 30km/h 초과 속도는 오류로 간주 가능
- 현재 미구현, 추후 적용 예정

#### 거리 계산 정밀도

```typescript
GPS_CONFIG.DISTANCE_PRECISION = 2
```

**의미**: 거리는 소수점 2자리까지 표시 (0.00 km)

### 7.2 BackgroundGeolocation 설정

**구현 위치**: `src/services/BackgroundGeoService.ts:29`

#### 정확도 설정

```typescript
desiredAccuracy: DESIRED_ACCURACY_HIGH
```

**iOS 매핑**:
- `DESIRED_ACCURACY_HIGH`: `kCLLocationAccuracyBest` (최고 정확도, ±3m)

#### 거리 필터

```typescript
distanceFilter: 5 meters
```

**의미**: 5m 이동할 때마다 GPS 업데이트 수신

**선택 이유**:
- 너무 작으면: 배터리 소모 증가, 불필요한 포인트 증가
- 너무 크면: 경로 정확도 감소
- 5m: 러닝 추적과 GPS 신호 손실 감지에 최적화된 값 (10m → 5m 개선)

#### 정지 반경

```typescript
stationaryRadius: 25 meters
```

**의미**: 25m 반경 내에서 움직임이 없으면 정지 상태로 판단

### 7.2 활동 유형 설정

```typescript
activityType: ACTIVITY_TYPE_FITNESS
```

**iOS 매핑**: `CLActivityTypeFitness`
- GPS 정확도 우선
- 배터리 소모 허용
- 러닝/워킹에 최적화

### 7.3 백그라운드 실행 설정 (중요!)

```typescript
// iOS 백그라운드 위치 추적 필수 설정
preventSuspend: true                        // 백그라운드 일시정지 방지
pausesLocationUpdatesAutomatically: false   // iOS 자동 일시정지 비활성화
showsBackgroundLocationIndicator: true      // 상태바 GPS 아이콘 표시
allowsBackgroundLocationUpdates: true       // 백그라운드 위치 업데이트 허용
heartbeatInterval: 60 seconds               // 1분마다 heartbeat
```

**preventSuspend**:
- 앱이 백그라운드에서도 계속 실행
- iOS 배터리 최적화 무시

**pausesLocationUpdatesAutomatically** (신규):
- iOS가 자동으로 위치 업데이트를 일시정지하는 것을 방지
- **false로 설정하지 않으면 백그라운드에서 GPS 아이콘이 사라짐**

**showsBackgroundLocationIndicator** (신규):
- iOS 11+ 백그라운드 위치 추적 시 상태바에 GPS 아이콘 표시
- 사용자에게 백그라운드 추적 중임을 명확히 알림

**allowsBackgroundLocationUpdates** (신규):
- Info.plist의 `UIBackgroundModes`에 `location` 추가 시 필수
- 백그라운드 위치 업데이트를 명시적으로 허용

**heartbeatInterval**:
- 1분마다 heartbeat 이벤트 발생
- 백그라운드에서도 정기적으로 위치 업데이트
- iOS의 백그라운드 제약을 우회하는 핵심 기능

### 7.4 정지 타임아웃

```typescript
stopTimeout: 5 minutes
```

**의미**: 5분간 움직임이 없으면 자동으로 정지 상태로 전환
- 자동 일시정지와는 별개
- BackgroundGeolocation 내부 동작

---

## 8. 데이터 저장 정책

### 8.1 SQLite 데이터베이스 구조

**구현 위치**: `src/services/DatabaseService.ts`

#### 테이블 구조

**runs 테이블**:
```sql
CREATE TABLE runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  started_at TEXT NOT NULL,
  ended_at TEXT,
  total_distance REAL,
  total_duration INTEGER,      -- 총 시간 (초)
  moving_duration INTEGER,      -- 이동 시간 (초)
  avg_pace REAL,                -- 평균 페이스 (min/km)
  calories REAL,                -- 칼로리 (kcal)
  status TEXT DEFAULT 'completed',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

**gps_points 테이블**:
```sql
CREATE TABLE gps_points (
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
```

**splits 테이블**:
```sql
CREATE TABLE splits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id INTEGER,
  split_number INTEGER,         -- 구간 번호 (1, 2, 3...)
  distance REAL,                -- 구간 거리 (1km)
  duration INTEGER,             -- 구간 시간 (초)
  pace REAL,                    -- 구간 페이스 (min/km)
  FOREIGN KEY (run_id) REFERENCES runs (id)
);
```

### 8.2 데이터 저장 정책

**저장 시점**: 사용자가 "저장" 버튼 클릭 시

**저장 제외 정보**:
- `activityType`: GPS 포인트별 활동 유형 (현재 미저장)
- `isEstimated`: 추정 구간 여부 (현재 미저장)

**이유**:
- 초기 버전에서는 기본 정보만 저장
- 추후 확장 시 테이블 스키마 업데이트 필요

### 8.3 데이터 조회 정책

**조회 시 기본값**:
```typescript
// src/services/DatabaseService.ts:208-211
activityType: 'unknown'
activityConfidence: 0
estimatedBySpeed: false
isEstimated: false
```

**의미**: DB에 저장되지 않은 필드는 기본값으로 설정

---

## 9. UI/UX 정책

### 9.1 상태 표시 우선순위

**러닝 화면 헤더**:
```
1. GPS 신호 손실 (빨간색 경고 배너)
2. 자동 일시정지 (주황색 배지) - "잠시 멈춤 (자동)"
3. GPS 손실 일시정지 (흰색 텍스트) - "GPS 신호 손실로 일시정지"
4. 러닝 상태 (흰색 텍스트) - "러닝 중" / "일시정지"
5. 활동 유형 (색상 배지)
```

**구현 위치**: `src/screens/RunningScreen.tsx:473-480`

### 9.2 색상 시스템 (Apple Human Interface Guidelines 준수)

**시스템 색상**:
```
- Blue (#007AFF): 주요 액션, 뛰기
- Green (#34C759): 긍정 액션, 걷기, 재개
- Orange (#FF9500): 경고, GPS 손실
- Red (#FF3B30): 위험, 종료, 신호 손실
- Gray (#8E8E93): 비활성, 이동수단
```

### 9.3 다이얼로그 우선순위

```
1. 러닝 종료 확인 → 파괴적 액션 확인
2. GPS 추적 시작 실패 → 권한 확인 안내
```

**제거된 다이얼로그**:
- GPS 신호 손실 다이얼로그 (자동 처리로 변경, 헤더에 상태만 표시)

### 9.4 데이터 포맷팅 정책

**구현 위치**: `src/utils/formatters.ts`

#### 거리 표시

```typescript
formatDistance(5.12345) => "5.12"
```

**규칙**:
- 소수점 2자리로 고정 (0.00)
- 단위 "km" 별도 표시
- 최소값: 0.00 km

#### 시간 표시

```typescript
formatDuration(3665) => "01:01:05"
```

**규칙**:
- HH:MM:SS 형식
- 항상 2자리 표시 (00:00:00)
- 1시간 미만도 시간 표시 (00:45:30)

#### 페이스 표시

```typescript
formatPace(5.5) => "5:30"
formatPace(0) => "0:00"
formatPace(Infinity) => "0:00"
```

**규칙**:
- M:SS 형식 (분:초)
- 초는 항상 2자리 (6:05)
- 무한대나 0은 "0:00" 표시
- 단위 "/km" 별도 표시

#### 칼로리 표시

```typescript
formatCalories(123.45) => "123"
```

**규칙**:
- 정수로 반올림
- 단위 "kcal" 별도 표시
- 최소값: 0 kcal

#### 날짜/시간 표시

**상세 시간**:
```typescript
formatDateTime(date) => "2025.10.14 14:30"
```

**간단한 날짜**:
```typescript
formatDate(date) => "10월 14일"
```

**규칙**:
- 연도.월.일 형식 (점으로 구분)
- 24시간 형식
- 한글 "월", "일" 사용

---

## 10. NRC 스타일 디자인 시스템

### 10.1 개요

**목표**: Nike Run Club (NRC) 앱의 디자인 언어를 차용하여 강렬하고 현대적인 UI 구현

**핵심 원칙**:
- **극단적인 타이포그래피**: 96-120px 대형 숫자로 시각적 임팩트
- **다크 모드 + 네온 악센트**: 검은 배경에 형광 색상으로 강렬한 대비
- **멀티 스크린 내비게이션**: 스와이프로 다양한 정보 접근
- **실시간 피드백**: 킬로미터 달성, 페이스 변화 등 즉각적 반응

### 10.2 스와이프 화면 구조

**구현 위치**: `src/screens/RunningScreen.tsx:374-379`

#### 3개 페이지 구성

```typescript
<PagerView
  initialPage={1}  // 중앙 페이지(통계)에서 시작
  onPageSelected={(e) => setCurrentPage(e.nativeEvent.position)}
>
  {renderMapPage()}      // 페이지 0: 지도 중심
  {renderStatsPage()}    // 페이지 1: 통계 중심 (기본)
  {renderPaceGraphPage()} // 페이지 2: 페이스 그래프
</PagerView>
```

#### 페이지별 구성

**페이지 0 - 지도 중심**:
```
┌────────────────────────┐
│  [거리 64px + 오버레이]  │
│  ┌──────────────────┐   │
│  │  시간  │  페이스   │   │
│  └──────────────────┘   │
│                          │
│    [전체 화면 지도]       │
│    - 다색상 경로          │
│    - GPS 손실 마커        │
│    - 실시간 위치          │
└────────────────────────┘
```

**페이지 1 - 통계 중심** (기본 페이지):
```
┌────────────────────────┐
│    [거리 96px 대형]      │
│      킬로미터            │
│                          │
│  ┌────[페이스 게이지]─┐ │
│  │  빠름 ←→ 느림        │
│  └────────────────────┘ │
│                          │
│  ┌──┐  ┌──┐  ┌──┐  ┌──┐ │
│  │시간│  │평균│  │칼로리│  │심박수│ │
│  └──┘  └──┘  └──┘  └──┘ │
│                          │
│  [활동 유형 인디케이터]   │
└────────────────────────┘
```

**페이지 2 - 페이스 그래프**:
```
┌────────────────────────┐
│    페이스 변화           │
│                          │
│  ┌────────────────────┐ │
│  │     ▄ ▆ █           │ │
│  │   █ █ █ ▆ ▄         │ │
│  │ ▄ █ █ █ █ █ ▆       │ │
│  └────────────────────┘ │
│                          │
│  평균: 6'15"  현재: 6'02" │
└────────────────────────┘
```

#### 페이지 인디케이터

```typescript
// 상단 중앙에 표시
[●]  [○]  [○]  // 페이지 0 활성
[○]  [●]  [○]  // 페이지 1 활성
[○]  [○]  [●]  // 페이지 2 활성
```

**스타일**:
- 비활성: 회색 원 6x6px
- 활성: 흰색 타원 20x6px
- 간격: 8px

### 10.3 타이포그래피 정책

**구현 위치**: `src/screens/RunningScreen.tsx:573-577` (메인 숫자)

#### 숫자 크기 계층

| 레벨 | 크기 | fontWeight | letterSpacing | 용도 |
|------|------|------------|---------------|------|
| **Hero** | 96px | 800 | -4 | 메인 거리 (통계 페이지) |
| **Large** | 64px | 800 | -3 | 지도 오버레이 거리 |
| **Kilometer** | 56px | 800 | -3 | 킬로미터 배너 숫자 |
| **Medium** | 36px | 800 | -1.5 | 보조 통계 카드 값 |
| **Small** | 22-32px | 700-800 | -0.5 ~ -1 | 기타 숫자 |

#### 레이블 스타일

**대문자 레이블** (UPPERCASE):
```typescript
{
  fontSize: 13-22,
  fontWeight: 500-600,
  letterSpacing: 0.8-1.5,
  textTransform: 'uppercase'
}
```

**예시**:
- "킬로미터" → "KILOMETER" (22px, 600, spacing 1.5)
- "시간" → "TIME" (13px, 500, spacing 0.8)

#### 버튼/액션 텍스트

```typescript
{
  fontSize: 16-18,
  fontWeight: 700,
  letterSpacing: 0.3-0.5
}
```

### 10.4 색상 시스템 (NRC 네온 팔레트)

**구현 위치**: `src/screens/RunningScreen.tsx` (스타일 전역)

#### 핵심 색상

| 색상명 | HEX | RGB | 용도 |
|--------|-----|-----|------|
| **네온 그린** | #80FF00 | rgb(128, 255, 0) | 활성 상태, 재개 버튼, 빠른 페이스 |
| **네온 시안** | #00E0FF | rgb(0, 224, 255) | 그래프, 적정 페이스, 데이터 시각화 |
| **네온 옐로우** | #FFCC00 | rgb(255, 204, 0) | 일시정지, 경고, 느린 페이스 |
| **다크 배경** | #000000 | rgb(0, 0, 0) | 메인 배경 |
| **카드 배경** | #1a1a1a | rgb(26, 26, 26) | 통계 카드, 컨테이너 |

#### 색상 적용 규칙

**재개 버튼** (네온 그린):
```typescript
resumeButton: {
  backgroundColor: '#80FF00',
}
neonButtonText: {
  color: '#000',  // 네온 배경에는 검은 텍스트
}
```

**일시정지 버튼** (네온 옐로우):
```typescript
pauseButton: {
  backgroundColor: '#FFCC00',
}
```

**페이스 그래프** (네온 시안):
```typescript
graphBar: {
  backgroundColor: '#00E0FF',
}
```

**페이스 게이지 색상 로직**:
```typescript
gaugeColor = '#00E0FF';  // 기본: 적정 (시안)
if (gaugePosition < -0.3) {
  gaugeColor = '#80FF00';  // 빠름 (그린)
} else if (gaugePosition > 0.3) {
  gaugeColor = '#FFCC00';  // 느림 (옐로우)
}
```

#### 대비 규칙

**네온 배경 위 텍스트**:
- 배경: #80FF00 / #FFCC00 → 텍스트: #000 (검은색)
- 배경: #00E0FF → 텍스트: #000 또는 #fff (맥락에 따라)

**다크 배경 위 텍스트**:
- 배경: #000 / #1a1a1a → 텍스트: #fff (흰색)
- 보조 텍스트: #999 (회색)

### 10.5 페이스 게이지 UI

**구현 위치**: `src/screens/RunningScreen.tsx:277-304`

#### 게이지 구조

```
┌────────────────────────────┐
│          페이스             │
├────────────────────────────┤
│  ━━━━━━━━┃━━━━━━━━         │
│    빠름   ↑   느림           │
│         6'15"               │
└────────────────────────────┘
```

#### 계산 로직

**게이지 위치 계산**:
```typescript
targetPace = avgPace || 6.0;  // 목표 페이스
paceDiff = currentPace - targetPace;  // 차이 (분/km)
maxDiff = 2.0;  // 최대 차이 범위

// -1(왼쪽 끝) ~ 1(오른쪽 끝) 범위로 정규화
gaugePosition = Math.max(-1, Math.min(1, paceDiff / maxDiff));
```

**색상 결정**:
```typescript
if (gaugePosition < -0.3):  빠름 (#80FF00 그린)
elif (gaugePosition > 0.3): 느림 (#FFCC00 옐로우)
else:                       적정 (#00E0FF 시안)
```

#### 시각적 요소

**배경 트랙**:
```typescript
{
  height: 8,
  backgroundColor: '#333',
  borderRadius: 4
}
```

**중앙 목표선**:
```typescript
{
  width: 2,
  height: 16,
  backgroundColor: '#fff',
  left: '50%'
}
```

**인디케이터**:
```typescript
{
  width: 20,
  height: 20,
  borderRadius: 10,
  borderWidth: 3,
  borderColor: '#000',
  backgroundColor: gaugeColor,  // 동적 색상
  left: `${(gaugePosition + 1) * 50}%`  // -1~1 → 0~100%
}
```

---

## 11. 인터랙션 정책

### 11.1 빠른 일시정지 (더블탭)

**구현 위치**: `src/screens/RunningScreen.tsx:201-212`

#### 감지 로직

**임계값**:
```typescript
DOUBLE_TAP_DELAY = 300 ms
```

**알고리즘**:
```typescript
const handleDoubleTap = () => {
  const now = Date.now();
  const timeSinceLastTap = now - lastTapRef.current;

  if (timeSinceLastTap < 300 && timeSinceLastTap > 0) {
    // 더블탭 감지!
    handlePauseResume();
    lastTapRef.current = 0;  // 리셋
  } else {
    lastTapRef.current = now;
  }
};
```

**동작**:
```
첫 번째 탭:
  → lastTapRef에 시간 저장
  → 대기

두 번째 탭 (300ms 이내):
  → handlePauseResume() 호출
  → running → paused 또는 paused → running

두 번째 탭 (300ms 초과):
  → 첫 번째 탭으로 간주
  → lastTapRef 업데이트
```

#### 적용 범위

**더블탭 활성화된 영역**:
- ✅ 페이지 0 (지도)
- ✅ 페이지 1 (통계)
- ✅ 페이지 2 (그래프)

**더블탭 비활성화된 영역**:
- ❌ 하단 버튼 영역 (일시정지/종료)
- ❌ GPS 신호 손실 다이얼로그

#### 제스처 충돌 방지

**PagerView와의 호환성**:
```typescript
<View onTouchEnd={handleDoubleTap}>
  // 내용
</View>
```

- `onTouchEnd` 사용으로 스와이프 제스처와 충돌 없음
- 스와이프 동작은 PagerView가 우선 처리
- 정지 상태 탭만 더블탭 감지

### 11.2 스와이프 내비게이션

**패키지**: `react-native-pager-view`

#### 제스처 처리

**스와이프 방향**:
```
←─── 왼쪽 스와이프: 이전 페이지 (map ← stats ← graph)
───→ 오른쪽 스와이프: 다음 페이지 (map → stats → graph)
```

**전환 애니메이션**:
- 네이티브 애니메이션 (60fps)
- 스프링 물리 효과
- iOS 표준 전환 느낌

#### 초기 페이지

```typescript
<PagerView initialPage={1}>
```

**이유**: 통계 페이지(중앙)를 기본으로 표시
- 가장 중요한 정보 우선
- 양쪽으로 스와이프 가능

### 11.3 러닝 화면 뒤로 가기 방지 정책

**구현 위치**: `App.tsx:38-40`, `src/screens/RunningScreen.tsx`

#### 문제 상황

**문제**: 러닝 중 스와이프 제스처나 뒤로가기 버튼으로 화면을 벗어나면 러닝 상태가 보존되지만 사용자가 혼란스러워함
- 홈 화면에서 "러닝 시작" 버튼이 보임 (개선 전)
- 실수로 화면을 나가서 러닝을 잃어버렸다고 착각

#### 다층 보호 전략

**1단계: 제스처 비활성화 (iOS 스와이프 뒤로가기)**:
```typescript
// App.tsx
<Stack.Screen
  name="Running"
  component={RunningScreen}
  options={{
    gestureEnabled: false,  // 스와이프 제스처 비활성화
  }}
/>
```

**효과**:
- iOS의 화면 가장자리 스와이프 제스처 차단
- 실수로 화면을 나가는 것 방지

**2단계: beforeRemove 이벤트 인터셉터 (Android 뒤로가기 버튼)**:
```typescript
// src/screens/RunningScreen.tsx
React.useEffect(() => {
  const unsubscribe = navigation.addListener('beforeRemove', (e: any) => {
    if (status === 'running' || status === 'paused') {
      e.preventDefault();  // 네비게이션 차단

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
```

**보호 범위**:
- Android 하드웨어 뒤로가기 버튼
- 프로그래밍 방식 네비게이션 (`navigation.goBack()`, `navigation.navigate()`)
- 시스템 제스처

**동작 흐름**:
```
1. 사용자가 뒤로가기 시도
   ↓
2. beforeRemove 이벤트 발생
   ↓
3. 러닝 중/일시정지 상태 확인
   ↓
4. e.preventDefault()로 네비게이션 차단
   ↓
5. 확인 다이얼로그 표시
   ↓
6a. [계속하기] → 아무 동작 없음
6b. [종료] → stop() 호출 → 네비게이션 진행
```

**예외 처리**:
- 러닝이 완료된 상태(`status: 'completed'`)에서는 자유롭게 나갈 수 있음
- 종료 버튼을 눌러 명시적으로 종료한 경우에만 화면 전환 허용

#### 사용자 경험 개선

**명확한 의도 확인**:
- 실수로 러닝을 종료하는 것 방지
- 사용자에게 명확한 선택권 제공
- "저장됩니다" 문구로 데이터 손실 우려 해소

**다이얼로그 스타일**:
```typescript
{
  text: '종료',
  style: 'destructive',  // 빨간색 경고 스타일
}
```

---

## 12. 실시간 피드백 시스템

### 12.1 킬로미터 알림 배너

**구현 위치**: `src/screens/RunningScreen.tsx:117-163`

#### 트리거 조건

```typescript
const currentKm = Math.floor(distance);
if (currentKm > lastKilometer && currentKm > 0) {
  // 킬로미터 달성!
}
```

**감지 시점**: 거리가 1.0km, 2.0km, 3.0km 등에 도달할 때

#### 배너 구조

```
┌──────────────────────────┐
│          3               │  56px, fontWeight 800
│       KM 완주!            │  20px, fontWeight 700
│        6'15"             │  18px, 페이스
├──────────────────────────┤
│    ↑ 빠름 15초            │  스플릿 비교 (있을 경우)
└──────────────────────────┘
```

**스타일**:
```typescript
{
  position: 'absolute',
  top: 0,
  backgroundColor: '#80FF00',  // 네온 그린
  color: '#000',               // 검은 텍스트
  borderRadius: 16,
  padding: 20-24,
  shadowColor: '#000',
  shadowOpacity: 0.3,
  elevation: 8
}
```

#### 애니메이션 시퀀스

**시간 흐름**:
```
0ms:   배너 위치 -100 (화면 밖)
       ↓
400ms: 슬라이드 인 (translateY: 20)
       [배너 표시 중]
2500ms: 대기
       ↓
2900ms: 슬라이드 아웃 (translateY: -100)
3300ms: 배너 제거
```

**코드**:
```typescript
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
```

### 12.2 스플릿 비교 시스템

**구현 위치**: `src/screens/RunningScreen.tsx:126-133`

#### 비교 로직

**데이터 저장**:
```typescript
const [splitPaces, setSplitPaces] = useState<number[]>([]);

// 매 킬로미터마다 페이스 저장
setSplitPaces(prev => [...prev, recentPace]);
```

**비교 계산**:
```typescript
if (splitPaces.length > 0) {
  const previousPace = splitPaces[splitPaces.length - 1];
  const diff = Math.abs(recentPace - previousPace);  // 분 단위
  const faster = recentPace < previousPace;  // 페이스가 작을수록 빠름
}
```

#### 표시 형식

**빠름** (이전보다 페이스가 낮음):
```
┌──────────────┐
│ ↑ 빠름 15초   │  색상: #006600 (진한 그린)
└──────────────┘
```

**느림** (이전보다 페이스가 높음):
```
┌──────────────┐
│ ↓ 느림 20초   │  색상: #CC9900 (진한 옐로우)
└──────────────┘
```

**예시**:
```
1km: 6'30" (첫 구간, 비교 없음)
2km: 6'15" → ↑ 빠름 15초
3km: 6'35" → ↓ 느림 20초
4km: 6'10" → ↑ 빠름 25초
```

#### 초 단위 변환

```typescript
diff * 60  // 분 → 초 변환
// 예: 0.25분 → 15초
```

### 12.3 페이스 히스토리 그래프

**구현 위치**: `src/screens/RunningScreen.tsx:65-80`

#### 데이터 수집

**윈도우 방식**:
```typescript
const paceHistory = useMemo(() => {
  const history: {time: number; pace: number}[] = [];
  const windowSize = 5;  // 5개 포인트 윈도우

  for (let i = windowSize; i < route.length; i += 5) {
    const window = route.slice(i - windowSize, i);
    const pace = CalcService.calculateCurrentPace(window, windowSize);
    const time = (window[window.length - 1].timestamp - route[0].timestamp) / 1000;

    history.push({time, pace});
  }

  return history;
}, [route]);
```

**샘플링 간격**: 5개 포인트마다 (약 50m마다)

#### 시각화

**바 그래프 스타일**:
```typescript
{
  width: 4,  // 매우 얇은 바
  backgroundColor: '#00E0FF',  // 네온 시안
  borderRadius: 2,
  height: 동적 (페이스에 따라)
}
```

**높이 계산**:
```typescript
const maxPace = Math.max(...paceHistory.map(p => p.pace), avgPace * 1.2);
const minPace = Math.min(...paceHistory.map(p => p.pace), avgPace * 0.8);

// 0-1 범위로 정규화
const heightPercent = 1 - ((point.pace - minPace) / (maxPace - minPace));
```

**결과**:
- 빠른 페이스(작은 값): 높은 바
- 느린 페이스(큰 값): 낮은 바

### 12.4 Apple Watch 심박수 (준비 단계)

**구현 위치**: `src/screens/RunningScreen.tsx:394-401`

#### UI 구조

```
┌──────────────┐
│   심박수      │  레이블
│  ❤️ -- BPM   │  하트 + 플레이스홀더 + 단위
└──────────────┘
```

**스타일**:
```typescript
heartRateContainer: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 8
}
heartIcon: {
  fontSize: 24
}
statCardValue: {
  fontSize: 36
}
heartRateUnit: {
  color: '#999',
  fontSize: 16
}
```

#### 향후 연동 가이드

**주석 문서** (`src/screens/RunningScreen.tsx:4-15`):
```
1. @react-native-community/apple-healthkit 패키지 설치
2. Info.plist에 NSHealthShareUsageDescription 추가
3. HealthKit 권한 요청 및 심박수 데이터 구독
4. 실시간 심박수를 state로 관리하고 "--" 대신 실제 값 표시
5. 예시 코드:
   const [heartRate, setHeartRate] = useState<number | null>(null);
   AppleHealthKit.getHeartRateSamples({...}, (err, results) => {
     if (!err && results.length > 0) {
       setHeartRate(Math.round(results[0].value));
     }
   });
```

**현재 상태**: UI만 구현, 데이터 연동 대기

---

## 13. 성능 최적화 정책

### 13.1 메모이제이션 정책

**적용 대상**:
```typescript
// src/screens/RunningScreen.tsx:51-80
routeSegments: useMemo(() => ..., [route])
currentActivity: useMemo(() => ..., [route])
gpsLossMarkers: useMemo(() => ..., [route])
paceHistory: useMemo(() => ..., [route])
```

**목적**: 불필요한 재계산 방지, 렌더링 최적화

**효과**:
- `route` 변경 시에만 재계산
- 매 렌더링마다 복잡한 계산 방지
- UI 응답성 향상

### 13.2 타이머 관리 정책

**생성되는 타이머**:
```typescript
1. durationInterval: 1초마다 duration 업데이트
2. gpsSignalCheckInterval: 5초마다 GPS 신호 체크
3. lowSpeedStartTime: 자동 일시정지 판단
4. highSpeedStartTime: 자동 재개 판단
5. bannerSlideAnim: 킬로미터 배너 애니메이션
6. countdownTimer: GPS 손실 카운트다운 (1초마다)
```

**정리 시점**:
- 일시정지/종료 시 모든 타이머 정리
- 컴포넌트 언마운트 시 cleanup
- 메모리 누수 방지

### 13.3 애니메이션 최적화

**Native Driver 사용**:
```typescript
Animated.timing(bannerSlideAnim, {
  useNativeDriver: true,  // ✅ GPU 가속
})
```

**이점**:
- JS 스레드와 분리된 네이티브 애니메이션
- 60fps 부드러운 전환
- JS 블로킹 없음

### 13.4 렌더링 최적화

**PagerView 최적화**:
```typescript
<PagerView
  offscreenPageLimit={1}  // 양옆 1페이지만 미리 렌더링
>
```

**조건부 렌더링**:
```typescript
{kilometerBanner && <Animated.View />}
{showGPSLossDialog && <Dialog />}
```

---

## 14. 오류 처리 정책

### 14.1 GPS 추적 시작 실패

```typescript
// src/screens/RunningScreen.tsx:82-88
Alert.alert(
  '오류',
  'GPS 추적을 시작할 수 없습니다. 위치 권한을 확인해주세요.',
  [{text: '확인', onPress: () => navigation.goBack()}]
);
```

**원인**:
- 위치 권한 거부
- GPS 하드웨어 오류
- BackgroundGeolocation 설정 실패

### 11.2 데이터 저장 실패

```typescript
// src/screens/ResultScreen.tsx:48-50
Alert.alert('오류', '저장에 실패했습니다');
```

**원인**:
- 데이터베이스 연결 실패
- 저장 공간 부족
- 데이터 유효성 검증 실패

---

## 15. 화면별 정책

### 15.1 앱 시작 화면 (LaunchScreen)

**구현 위치**: `ios/RunPort/LaunchScreen.storyboard`

#### 브랜딩 정책

**표시 문구**:
```
Made by DX개발팀
```

**스타일**:
```xml
<label>
  fontSize: 36px
  fontWeight: bold
  textAlignment: center
  color: default system color
</label>
```

**하단 표시**:
```
Powered by React Native
```

**목적**:
- 팀 브랜딩 명확화
- 개발 조직 정체성 표시
- 사용자에게 제작자 정보 전달

### 15.2 홈 화면 (HomeScreen)

**구현 위치**: `src/screens/HomeScreen.tsx`

#### 최근 러닝 기록 표시 정책

**데이터베이스 초기화 및 로드 전략**:
```typescript
// 경쟁 상태(race condition) 방지
const [isDbInitialized, setIsDbInitialized] = useState(false);

useEffect(() => {
  const initialize = async () => {
    await initDatabase();
    setIsDbInitialized(true);
  };
  initialize();
}, []);

// DB 초기화 완료 후에만 데이터 로드
useFocusEffect(
  useCallback(() => {
    if (isDbInitialized) {
      loadRecentRuns();
    }
  }, [isDbInitialized])
);
```

**경쟁 상태 해결**:
- **문제**: 데이터베이스 초기화가 완료되기 전에 `loadRecentRuns()`가 호출되면 "Database not initialized" 오류 발생
- **해결**: `isDbInitialized` 상태 플래그로 초기화 완료 여부 추적
- **순서**: 1) DB 초기화 → 2) 플래그 설정 → 3) 데이터 로드
- **효과**: 앱 시작 시 스플래시 화면에서 멈추는 현상 방지

**표시 규칙**:
- **최대 3개**: 최신 기록 3개만 표시
- **정렬**: `started_at` 기준 내림차순 (최신순)
- **자동 새로고침**: 화면 포커스 시마다 데이터베이스에서 재로드
- **빈 상태**: 기록이 없을 경우 "러닝 기록이 없습니다" 메시지 표시

**표시 정보**:
```
┌───────────────────────┐
│ 10월 14일              │  날짜
│ 5.12 km    01:01:05   │  거리, 시간
└───────────────────────┘
```

**새로고침 트리거**:
- 앱 초기 실행 시
- ResultScreen에서 저장 후 Home으로 돌아올 때
- History 화면에서 뒤로가기로 돌아올 때
- 다른 탭에서 Home 탭으로 전환할 때

**구현 배경**:
- 문제: `useEffect`는 컴포넌트 마운트 시에만 실행되어, 러닝 저장 후 Home 화면으로 돌아와도 최근 기록이 업데이트되지 않음
- 해결: `useFocusEffect` 훅 사용으로 화면 포커스 시마다 데이터 재로드
- 효과: 사용자가 러닝을 완료하고 저장한 직후 즉시 최근 기록에 반영됨

#### 러닝 중 상태 표시 정책

**구현 위치**: `src/screens/HomeScreen.tsx:27-28, 90-108, 110-119`

**상태 감지**:
```typescript
const {status, distance, duration} = useRunningStore();
const isRunning = status === 'running' || status === 'paused';
```

**UI 구성**:

**1. 제목 부제 동적 변경**:
```typescript
<Text style={styles.subtitle}>
  {isRunning ? '러닝 진행 중' : '러닝을 시작하세요'}
</Text>
```

**2. 진행 중인 러닝 카드** (러닝 중일 때만 표시):
```
┌────────────────────────┐
│  🏃 진행 중인 러닝       │  주황색 배경 (#FFF3E0)
├────────────────────────┤  주황색 테두리 (#FF9500)
│   거리        시간      │
│  5.12 km   01:01:05    │  오렌지 강조 색상
└────────────────────────┘
```

**카드 스타일**:
```typescript
currentRunCard: {
  backgroundColor: '#FFF3E0',  // 연한 주황색
  borderColor: '#FF9500',      // 주황색 테두리
  borderWidth: 2,
  borderRadius: 12,
  padding: 20
}
currentRunStatValue: {
  fontSize: 24,
  fontWeight: '700',
  color: '#E65100'  // 진한 오렌지
}
```

**3. 버튼 동적 변경**:
```typescript
<TouchableOpacity
  style={[
    styles.startButton,
    isRunning && styles.resumeButton  // 주황색 배경
  ]}>
  <Text>
    {isRunning ? '러닝으로 돌아가기 →' : '러닝 시작'}
  </Text>
</TouchableOpacity>
```

**버튼 색상**:
- 일반 상태: 파란색 (#007AFF)
- 러닝 중: 주황색 (#FF9500)

**사용자 경험 개선**:
- 홈 화면에서 러닝 진행 상태를 즉시 확인 가능
- 실수로 홈으로 돌아온 경우 쉽게 러닝 화면으로 복귀 가능
- 현재 거리와 시간을 한눈에 확인
- 시각적으로 러닝 중임을 명확히 표시 (주황색 강조)

### 15.3 전체 기록 화면 (HistoryScreen)

**구현 위치**: `src/screens/HistoryScreen.tsx`

#### 기록 목록 표시 정책

**표시 정보**:
```
┌────────────────────────────┐
│ 2025.10.14 14:30  completed│  날짜/시간, 상태
├────────────────────────────┤
│ 거리     시간      페이스    │
│ 5.12 km  01:01:05  6:05    │
└────────────────────────────┘
```

**인터랙션**:
- **터치 동작**: 기록 터치 시 상세보기 화면(RunDetailScreen)으로 이동
- **네비게이션**: `navigation.navigate('RunDetail', {runId: item.id})`

**정렬**: `started_at` 기준 내림차순 (최신순)

**빈 상태**:
```
┌────────────────────────┐
│  러닝 기록이 없습니다   │
│  [러닝 시작하기 버튼]   │
└────────────────────────┘
```

### 15.4 러닝 상세보기 화면 (RunDetailScreen)

**구현 위치**: `src/screens/RunDetailScreen.tsx`

#### 화면 구성

**1. 헤더**:
- 뒤로가기 버튼
- "러닝 상세" 타이틀

**2. 날짜/시간 섹션**:
```typescript
formatDateTime(started_at) => "2025.10.14 14:30"
```

**3. 지도 섹션**:

**지도 크기**: 300px 높이, 화면 너비

**경로 표시**:
- 활동별 다색상 Polyline
  - 뛰기: 파란색 (#007AFF)
  - 걷기: 초록색 (#34C759)
  - 기타: 회색 (#8E8E93)
- 선 두께: 4px
- GPS 신호 손실 구간: 점선 미표시 (저장 시 activityType 정보 없음)

**자동 지도 영역 계산**:
```typescript
// GPS 포인트의 최소/최대 위도/경도로 자동 계산
centerLat = (minLat + maxLat) / 2
centerLon = (minLon + maxLon) / 2
latDelta = (maxLat - minLat) * 1.5  // 1.5배 여유 공간
lonDelta = (maxLon - minLon) * 1.5
```

**지도 인터랙션**:
- ✅ 확대/축소 가능 (`zoomEnabled: true`)
- ✅ 스크롤 가능 (`scrollEnabled: true`)
- 사용자가 원하는 대로 경로를 자세히 탐색 가능

**4. 메인 통계 섹션**:

**대형 거리 표시**:
```
┌──────────────┐
│   거리       │  레이블
│   5.12       │  64px, bold
│   km         │  단위
└──────────────┘
```

**보조 통계 그리드**:
```
┌────────┬────────┬────────┐
│ 시간    │ 평균페이스│ 칼로리 │
│01:01:05│  6:05   │  450   │
└────────┴────────┴────────┘
```

**5. 스플릿 섹션** (있을 경우):

**표시 형식**:
```
구간 기록 (스플릿)

┌────────────────────────┐
│ 1km   6'15"   00:06:15 │
│ 2km   5'58"   00:05:58 │
│ 3km   6'02"   00:06:02 │
└────────────────────────┘
```

**구성**:
- 왼쪽: 구간 번호 (1km, 2km...)
- 중앙: 구간 페이스 (강조 표시, 파란색)
- 오른쪽: 구간 시간

#### 데이터 로드 정책

**로드 순서**:
1. 러닝 기본 정보 (`DatabaseService.getAllRuns()`)
2. GPS 포인트 (`DatabaseService.getGPSPoints(runId)`)
3. 스플릿 정보 (`DatabaseService.getSplits(runId)`)

**에러 처리**:
- 기록을 찾을 수 없을 경우: 콘솔 에러 로그
- 로딩 중: "로딩 중..." 표시

**성능 최적화**:
- `useMemo`로 경로 세그먼트 메모이제이션
- `useMemo`로 지도 영역 계산 메모이제이션
- GPS 포인트 변경 시에만 재계산

#### 활동 색상 매핑

**함수**: `getActivityColor(activityType)`

```typescript
running  → '#007AFF' (파란색)
walking  → '#34C759' (초록색)
기타     → '#8E8E93' (회색)
```

**참고**: 활동 정보는 현재 데이터베이스에 저장되지 않으므로, 저장된 기록은 'unknown'으로 표시됨

#### 네비게이션 연동

**진입 경로**:
```
HistoryScreen → (기록 터치) → RunDetailScreen
```

**파라미터**:
```typescript
route.params.runId: number  // 러닝 기록 ID
```

**네비게이션 타입**:
```typescript
// src/types/navigation.ts
RootStackParamList = {
  ...
  RunDetail: {
    runId: number;
  };
}
```

---

## 16. 개발 도구 및 유틸리티

### 16.1 Logger 유틸리티

**구현 위치**: `src/utils/logger.ts`

#### 정책

**목적**: 프로덕션 환경에서 불필요한 로그 출력 방지 및 성능 최적화

**로그 레벨별 출력 정책**:

| 로그 레벨 | 개발 환경 | 프로덕션 환경 | 용도 |
|----------|----------|-------------|------|
| `logger.log()` | ✅ 출력 | ❌ 무시 | 일반 정보 로그 |
| `logger.warn()` | ✅ 출력 | ❌ 무시 | 경고 로그 |
| `logger.debug()` | ✅ 출력 | ❌ 무시 | 디버깅 로그 |
| `logger.error()` | ✅ 출력 | ✅ 출력 | 에러 로그 (항상 출력) |

**구현**:
```typescript
/**
 * 로깅 유틸리티
 * 개발 환경에서만 로그를 출력하고, 프로덕션에서는 에러만 출력
 */

const isDevelopment = __DEV__;

export const logger = {
  /**
   * 일반 로그 (개발 환경에서만 출력)
   */
  log: (...args: any[]) => {
    if (isDevelopment) {
      console.log(...args);
    }
  },

  /**
   * 경고 로그 (개발 환경에서만 출력)
   */
  warn: (...args: any[]) => {
    if (isDevelopment) {
      console.warn(...args);
    }
  },

  /**
   * 에러 로그 (항상 출력)
   */
  error: (...args: any[]) => {
    console.error(...args);
  },

  /**
   * 디버그 로그 (개발 환경에서만 출력)
   */
  debug: (...args: any[]) => {
    if (isDevelopment) {
      console.debug(...args);
    }
  },
};
```

#### 사용 예시

**DatabaseService에서의 사용**:
```typescript
import {logger} from '@utils/logger';

logger.log('[DB] 데이터베이스 초기화 완료');
logger.error('[DB] 초기화 실패:', error);
```

**HomeScreen에서의 사용**:
```typescript
import {logger} from '@utils/logger';

logger.log('[HomeScreen] 로드된 러닝 기록:', runs.length);
logger.error('러닝 기록 로드 실패:', error);
```

#### 마이그레이션 가이드

**기존 코드**:
```typescript
console.log('[DB] 초기화 완료');    // 프로덕션에서도 출력됨
console.warn('경고 메시지');         // 프로덕션에서도 출력됨
console.error('에러 발생');          // 프로덕션에서도 출력됨
```

**개선된 코드**:
```typescript
logger.log('[DB] 초기화 완료');     // 개발 환경에서만 출력
logger.warn('경고 메시지');          // 개발 환경에서만 출력
logger.error('에러 발생');           // 항상 출력 (에러 추적용)
```

#### 성능 이점

**프로덕션 빌드**:
- 일반 로그 제거로 JavaScript 스레드 부담 감소
- 콘솔 출력 오버헤드 제거
- 앱 반응성 향상

**디버그 빌드**:
- 개발자 경험 유지
- 상세한 로그로 문제 추적 용이

### 16.2 네비게이션 파라미터 직렬화 정책

**구현 위치**: `src/types/navigation.ts`, `src/screens/RunningScreen.tsx`

#### 문제 상황

**React Navigation의 제약**:
- 네비게이션 파라미터는 JSON 직렬화 가능해야 함
- Date 객체, 함수, 클래스 인스턴스 등은 전달 불가
- 직렬화 불가능한 값 전달 시 경고 발생:
  ```
  WARN Non-serializable values were found in the navigation state
  ```

#### 해결 방안

**Date 객체 → ISO 문자열 변환**:

**타입 정의** (`src/types/navigation.ts`):
```typescript
// 직렬화 가능한 RunSession 타입 (navigation 파라미터용)
export interface SerializableRunSession {
  id: string;
  startedAt: string;      // Date → ISO 문자열
  endedAt?: string;       // Date → ISO 문자열
  status: string;
  totalDistance: number;
  totalDuration: number;
  movingDuration: number;
  avgPace: number;
  calories: number;
  route: GPSCoordinate[];
  splits: any[];
}

export type RootStackParamList = {
  Home: undefined;
  Running: undefined;
  Result: {
    session: SerializableRunSession;  // 직렬화 가능한 타입
  };
  // ...
};
```

**변환 로직** (`src/screens/RunningScreen.tsx`):
```typescript
const handleStop = () => {
  Alert.alert('러닝 종료', '러닝을 종료하시겠습니까?', [
    {
      text: '종료',
      onPress: () => {
        stop();
        const now = new Date();

        navigation.navigate('Result', {
          session: {
            id: Date.now().toString(),
            startedAt: now.toISOString(),  // Date → ISO 문자열
            endedAt: now.toISOString(),    // Date → ISO 문자열
            // ...
          },
        });
      },
    },
  ]);
};
```

**복원 로직** (ResultScreen에서):
```typescript
const {session} = route.params;

// ISO 문자열 → Date 객체로 변환
const startedAt = new Date(session.startedAt);
const endedAt = new Date(session.endedAt);
```

#### 직렬화 가능 타입 가이드

**✅ 직렬화 가능**:
- 기본 타입: `string`, `number`, `boolean`, `null`, `undefined`
- 배열: `number[]`, `string[]`
- 객체: `{key: value}` (단순 구조)

**❌ 직렬화 불가능**:
- `Date` 객체 → ISO 문자열 사용 (`date.toISOString()`)
- 함수 → 전달 불가 (콜백은 useCallback 등으로 대체)
- 클래스 인스턴스 → 일반 객체로 변환
- `Map`, `Set` → 배열이나 객체로 변환

#### 추가 고려 사항

**타입 안전성**:
```typescript
// TypeScript가 컴파일 타임에 타입 체크
navigation.navigate('Result', {
  session: {...}  // SerializableRunSession 타입 준수 필요
});
```

**런타임 검증**:
- React Navigation이 런타임에 직렬화 가능 여부 확인
- 경고 발생 시 즉시 수정 필요

---

## 부록: 설정 값 요약표

### A. 속도 임계값

| 항목 | 값 | 단위 | 용도 |
|------|-----|------|------|
| 정지 | 0.4 | m/s | 활동 감지 |
| 걷기 최대 | 1.67 | m/s | 활동 감지 |
| 뛰기 최대 | 3.33 | m/s | 활동 감지 |
| 자동 일시정지 | 0.139 | m/s | 자동 일시정지 |
| 자동 재개 | 0.556 | m/s | 자동 재개 |

### B. 시간 임계값

| 항목 | 값 | 단위 | 용도 |
|------|-----|------|------|
| 자동 일시정지 지속 시간 | 3 | 초 | 자동 일시정지 |
| 자동 재개 지속 시간 | 2 | 초 | 자동 재개 |
| GPS 신호 손실 감지 시작 | 60 | 초 | GPS 손실 초기 감지 (10초 → 60초) |
| GPS 신호 짧은 손실 | 90 | 초 | 자동 처리 (30초 → 90초) |
| GPS 신호 중간 손실 | 180 | 초 | 사용자 선택 |
| GPS 신호 체크 간격 | 10 | 초 | 주기적 체크 (5초 → 10초) |

### C. 거리 임계값

| 항목 | 값 | 단위 | 용도 |
|------|-----|------|------|
| 거리 필터 | 3 | m | GPS 업데이트 (10m → 5m → 3m) |
| 정지 반경 | 25 | m | 정지 판단 |
| GPS 정확도 임계값 (설정) | 20 | m | 이상치 필터링 (미구현) |
| GPS 정확도 임계값 (실제) | 50 | m | 신호 품질 경고 |
| 스플릿 거리 | 1.0 | km | 구간 기록 |
| 거리 표시 정밀도 | 0.01 | km | 소수점 2자리 |

### D. 신뢰도 임계값

| 항목 | 값 | 단위 | 용도 |
|------|-----|------|------|
| AI 낮은 신뢰도 | 50 | % | 속도 기반 사용 |
| AI 중간 신뢰도 | 70 | % | 조건부 AI 사용 |
| AI 높은 신뢰도 | 85 | % | AI 우선 사용 |

### E. 칼로리 계수

| 활동 | 계수 | 공식 |
|------|------|------|
| 걷기 | 0.6 | 체중(kg) × 거리(km) × 0.6 |
| 뛰기 | 1.036 | 체중(kg) × 거리(km) × 1.036 |
| 이동수단 | 0 | 제외 |
| 정지 | 0 | 제외 |
| 알 수 없음 | 0 | 제외 |

**기본 체중**: 70 kg (사용자 미설정 시)

### F. 지도 설정

| 항목 | 값 | 설명 |
|------|-----|------|
| 초기 위도 델타 | 0.01 | 지도 확대 레벨 |
| 초기 경도 델타 | 0.01 | 지도 확대 레벨 |
| 경로 선 두께 | 4 | 픽셀 |
| 기본 경로 색상 | #007AFF | 파란색 (Apple Blue) |

### G. GPS 설정

| 항목 | 값 | 설명 |
|------|-----|------|
| 샘플링 간격 | 1000 ms | GPS 포인트 수집 간격 |
| 최대 속도 | 30 km/h | 이상치 제거 임계값 |
| 정확도 우선순위 | HIGH | kCLLocationAccuracyBest |

### H. 거리 계산 상수

| 항목 | 값 | 설명 |
|------|-----|------|
| 지구 반지름 | 6371 km | Haversine 공식 사용 |

### I. 포맷팅 정책

| 데이터 | 형식 | 예시 |
|--------|------|------|
| 거리 | 0.00 | 5.12 km |
| 시간 | HH:MM:SS | 01:01:05 |
| 페이스 | M:SS | 6:05 /km |
| 칼로리 | 정수 | 123 kcal |
| 날짜/시간 | YYYY.MM.DD HH:MM | 2025.10.14 14:30 |
| 날짜 | M월 D일 | 10월 14일 |

---

## 문서 변경 이력

| 버전 | 날짜 | 변경 내용 | 작성자 |
|------|------|----------|--------|
| 1.5 | 2025-10-14 | 앱 안정성 개선 및 개발 도구 추가 | DX개발팀 |
|     |      | - **HomeScreen 경쟁 상태(race condition) 해결**: 데이터베이스 초기화 완료 전 데이터 로드로 인한 스플래시 화면 멈춤 현상 수정 | - |
|     |      | - **HomeScreen 러닝 중 상태 표시**: 진행 중인 러닝 카드, 동적 버튼, 부제 변경으로 UX 개선 | - |
|     |      | - **러닝 화면 뒤로 가기 방지**: gestureEnabled: false 및 beforeRemove 이벤트로 실수로 화면 나가기 방지 | - |
|     |      | - **네비게이션 파라미터 직렬화**: Date 객체를 ISO 문자열로 변환하여 직렬화 경고 해결 | - |
|     |      | - **Logger 유틸리티 추가**: 프로덕션 환경에서 불필요한 로그 제거로 성능 최적화 (16장) | - |
|     |      | - **개발 도구 및 유틸리티 섹션 신설**: Logger, 네비게이션 직렬화 정책 문서화 (16장) | - |
| 1.4 | 2025-10-14 | 화면별 정책 추가 및 UX 개선 | - |
|     |      | - LaunchScreen 브랜딩 정책 추가 ("Made by DX개발팀") | - |
|     |      | - HomeScreen 최근 기록 자동 새로고침 정책 (useFocusEffect 활용) | - |
|     |      | - RunDetailScreen 상세보기 화면 정책 추가 | - |
|     |      | - 지도 자동 영역 계산 알고리즘 정책화 | - |
|     |      | - 화면별 정책 섹션 신설 (15장) | - |
| 1.3 | 2025-10-14 | GPS 신호 손실 UX 개선 및 다이얼로그 제거 | - |
|     |      | - distanceFilter: 5m → 3m (더욱 정밀한 GPS 업데이트) | - |
|     |      | - GPS 신호 손실 다이얼로그 완전 제거 (자동 처리로 변경) | - |
|     |      | - 헤더에 GPS 손실 일시정지 안내 문구 추가 ("GPS 신호 손실로 일시정지") | - |
|     |      | - 중간 신호 손실 정책: 사용자 선택 → 자동 처리 | - |
| 1.2 | 2025-10-14 | 백그라운드 GPS 추적 개선 및 GPS 신호 손실 임계값 조정 | - |
|     |      | - distanceFilter: 10m → 5m (더 정밀한 GPS 업데이트) | - |
|     |      | - 백그라운드 필수 설정 3개 추가 (pausesLocationUpdatesAutomatically, showsBackgroundLocationIndicator, allowsBackgroundLocationUpdates) | - |
|     |      | - GPS 신호 손실 감지: 10초 → 60초 (오탐 방지) | - |
|     |      | - 짧은 신호 손실: 30초 → 90초 | - |
|     |      | - 신호 체크 간격: 5초 → 10초 (배터리 절약) | - |
| 1.1 | 2025-10-14 | GPS 자동 재개 정책 추가 (pauseReason 구분, 자동 재개 로직) | - |
| 1.0 | 2025-10-14 | 초기 문서 작성 (모든 정책 정리) | - |

---

## 참고 문서

### 핵심 서비스
- `src/types/location.ts` - 타입 정의
- `src/utils/activityDetector.ts` - 활동 감지 알고리즘
- `src/services/BackgroundGeoService.ts` - GPS 추적 설정
- `src/services/CalcService.ts` - 계산 로직
- `src/services/DatabaseService.ts` - 데이터베이스 CRUD
- `src/stores/runningStore.ts` - 상태 관리 및 정책

### 화면 컴포넌트
- `src/screens/HomeScreen.tsx` - 홈 화면 정책
- `src/screens/RunningScreen.tsx` - 러닝 화면 UI 정책
- `src/screens/ResultScreen.tsx` - 결과 표시 정책
- `src/screens/HistoryScreen.tsx` - 전체 기록 화면 정책
- `src/screens/RunDetailScreen.tsx` - 상세보기 화면 정책

### 네이티브 설정
- `ios/RunPort/LaunchScreen.storyboard` - 앱 시작 화면
- `ios/RunPort/Info.plist` - iOS 권한 및 백그라운드 모드

---

*본 문서는 RunPort 앱의 모든 정책을 정의하며, 코드 변경 시 반드시 업데이트해야 합니다.*
