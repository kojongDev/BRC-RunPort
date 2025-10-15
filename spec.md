# Claude Code 프롬프트: RunPort iOS 프로토타입 앱 개발

## 프로젝트 요구사항

RunPort라는 러닝 트래킹 iOS 앱의 프로토타입을 React Native로 개발해주세요. 서버 없이 로컬에서만 동작하는 앱으로, 핵심 GPS 트래킹 기능과 UI를 구현합니다.

## 기술 스택
- React Native (최신 버전)
- Expo (빠른 프로토타이핑용)
- SQLite (로컬 데이터 저장)
- React Navigation (화면 전환)
- React Native Maps (지도 표시)
- expo-location (GPS 트래킹)
- expo-task-manager (백그라운드 작업)
- AsyncStorage (간단한 설정 저장)

## 핵심 기능 요구사항

### 1. GPS 트래킹 엔진
- 1초 간격 GPS 위치 수집
- 칼만 필터를 이용한 GPS 노이즈 제거 (간단한 이동평균 필터로도 가능)
- Haversine 공식을 사용한 거리 계산
- GPS 정확도가 20m 이하인 포인트만 사용
- 속도가 30km/h를 초과하는 이상치 제거

### 2. 자동 일시정지/재개
- 속도 0.5km/h 미만 + 3초 유지 시 자동 일시정지
- 속도 2km/h 이상 + 2초 유지 시 자동 재개
- 일시정지 시간은 총 운동시간에서 제외

### 3. 실시간 데이터 표시
- 현재 거리 (km, 소수점 2자리)
- 경과 시간 (HH:MM:SS)
- 현재 페이스 (분:초/km)
- 평균 페이스 (분:초/km)
- 칼로리 (간단한 공식: 몸무게 × 거리 × 1.036)

## 화면 구성

### 1. 메인 화면 (HomeScreen)
- "러닝 시작" 버튼
- 최근 러닝 기록 3개 표시 (날짜, 거리, 시간)
- 전체 통계 요약 (총 거리, 총 횟수)

### 2. 러닝 화면 (RunningScreen)
```
상단: 지도 (현재 위치, 이동 경로)
중단: 실시간 데이터
  - 거리: 0.00 km
  - 시간: 00:00:00
  - 페이스: 0:00 /km
  - 칼로리: 0 kcal
하단: 컨트롤 버튼
  - 일시정지/재개 버튼
  - 종료 버튼 (스와이프 또는 길게 누르기로 확인)
```

### 3. 결과 화면 (ResultScreen)
- 지도에 전체 경로 표시
- 통계 정보:
  - 총 거리
  - 총 시간
  - 평균 페이스
  - 칼로리
  - 1km 구간별 스플릿 타임
- "저장" 버튼
- "삭제" 버튼

### 4. 히스토리 화면 (HistoryScreen)
- 저장된 러닝 목록 (FlatList)
- 각 항목: 날짜, 거리, 시간, 평균 페이스
- 항목 클릭 시 상세 보기

## 데이터베이스 스키마

### runs 테이블
```sql
CREATE TABLE runs (
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
```

### gps_points 테이블
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

### splits 테이블
```sql
CREATE TABLE splits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id INTEGER,
  split_number INTEGER,
  distance REAL,
  duration INTEGER,
  pace REAL,
  FOREIGN KEY (run_id) REFERENCES runs (id)
);
```

## 주요 컴포넌트 구조

```
src/
├── screens/
│   ├── HomeScreen.js
│   ├── RunningScreen.js
│   ├── ResultScreen.js
│   └── HistoryScreen.js
├── components/
│   ├── Map/
│   │   ├── RunningMap.js
│   │   └── RouteMap.js
│   ├── Stats/
│   │   ├── LiveStats.js
│   │   └── SummaryStats.js
│   └── UI/
│       ├── StartButton.js
│       ├── PauseButton.js
│       └── StopButton.js
├── services/
│   ├── LocationService.js (GPS 트래킹 로직)
│   ├── DatabaseService.js (SQLite 작업)
│   └── CalcService.js (거리, 페이스 계산)
├── utils/
│   ├── gpsFilter.js (칼만 필터, 이상치 제거)
│   ├── haversine.js (거리 계산)
│   └── formatters.js (시간, 거리 포맷팅)
└── constants/
    └── config.js (설정값: 샘플링 주기, 임계값 등)
```

## 구현 우선순위

### Phase 1: 기본 기능
1. 프로젝트 설정 및 의존성 설치
2. 화면 네비게이션 구조 설정
3. GPS 권한 요청 및 위치 추적 시작/종료
4. 거리 계산 및 실시간 표시
5. SQLite 데이터베이스 설정

### Phase 2: 핵심 기능
1. 지도에 현재 위치 및 경로 표시
2. 자동 일시정지/재개 구현
3. 러닝 데이터 저장 및 불러오기
4. 히스토리 화면 구현

### Phase 3: 개선 사항
1. GPS 필터링 (칼만 필터 또는 이동평균)
2. 1km 스플릿 계산
3. 백그라운드 위치 추적
4. UI 개선 및 애니메이션

## 주의사항

1. **iOS 시뮬레이터 제한**: 시뮬레이터에서는 GPS 테스트가 제한적이므로, 미리 정의된 경로를 시뮬레이션하는 개발 모드를 추가하세요.

2. **백그라운드 위치 추적**: iOS에서 백그라운드 위치 추적을 위해 Info.plist에 적절한 권한 설정이 필요합니다.

3. **배터리 최적화**: 화면이 꺼진 상태에서도 추적이 필요한 경우 expo-task-manager를 사용하되, 배터리 소모를 고려해 샘플링 주기를 조정하세요.

4. **데이터 압축**: GPS 포인트가 많아질 경우를 대비해, 3시간 이상의 데이터는 압축하거나 샘플링을 줄이는 로직을 추가하세요.

## 테스트 시나리오

1. **시뮬레이터 테스트**
   - Xcode의 Location Simulation 기능 사용
   - "City Run", "City Bicycle Ride" 등 프리셋 활용

2. **주요 테스트 케이스**
   - 러닝 시작 → 1분 달리기 → 정지 → 자동 일시정지 확인
   - 러닝 중 앱 백그라운드 전환 → 포그라운드 복귀 → 데이터 연속성 확인
   - GPS 신호 약한 상황 시뮬레이션 (정확도 > 20m)

## 예상 결과물

- iOS에서 실행 가능한 React Native 앱
- 실제 러닝 시 GPS 트래킹이 가능하며 거리 오차 5% 이내
- 자동 일시정지가 정확하게 작동
- 러닝 기록이 로컬 DB에 저장되고 히스토리에서 조회 가능
- 지도에 이동 경로가 정확하게 표시

## 추가 개선 아이디어 (선택사항)

1. 다크모드 지원
2. 음성 피드백 (1km마다 거리 알림)
3. 러닝 목표 설정 기능
4. 주간/월간 통계 차트
5. GPX 파일로 경로 내보내기

---

이 프롬프트를 Claude Code에 입력하면 RunPort iOS 프로토타입 앱을 단계별로 개발할 수 있습니다. 각 단계별로 코드를 생성하고 테스트하며 진행하시면 됩니다.