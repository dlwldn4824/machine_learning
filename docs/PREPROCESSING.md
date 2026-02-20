# 전처리 및 ML 파이프라인 상세 문서

인플레이션 환경 디저트 소비 분석 프로젝트의 전처리 단계와 ML 파이프라인을 정리한 문서입니다.

---

## 1. 프로젝트 개요

| 항목 | 내용 |
|------|------|
| **데이터** | 서울시 상권분석 서비스 (추정매출-행정동) 5개년 (2020~2024) |
| **분석 대상** | 카페·제과점 (디저트) |
| **단위** | 행정동 × 연도 × 분기 |
| **목표** | 인플레이션 환경에서 디저트 소비 선호도 변화 분석 및 ML 예측 |

---

## 2. 데이터 소스 및 구조

### 2.1 원본 데이터

- **경로**: `data/raw/`
- **파일**: `서울시_상권분석서비스(추정매출-행정동)_YYYY년.csv`
- **인코딩**: CP949
- **분기 코드**: `기준_년분기_코드` (예: 20211 = 2021년 1분기)

### 2.2 주요 컬럼 (원본)

| 컬럼 | 설명 |
|------|------|
| 기준_년분기_코드 | YYYYQ 형식 |
| 행정동_코드 | 행정동 식별자 |
| 행정동_코드_명 | 행정동 이름 |
| 서비스_업종_코드_명 | 업종 (제과점, 커피-음료 등) |
| 당월_매출_금액 | 당월 매출 |
| 당월_매출_건수 | 당월 거래 건수 |
| 주중/주말_매출_금액 | 요일별 매출 |
| 남성/여성_매출_금액 | 성별 매출 |

---

## 3. 1단계: 데이터 로딩 및 필터링

### 3.1 디저트 업종 필터링 (`load_dessert.py`)

- **대상 업종**: `제과점`, `커피-음료` (서울시 상권 데이터 표준 분류)
- **함수**: `load_dessert_data()` → raw 로드 후 `filter_dessert()`
- **결과**: 15,922행 (5개년 전체 디저트 데이터)

### 3.2 연령대 컬럼 제거

- 12개 연령대 관련 컬럼 삭제 (분석 목적 외, 차원 축소)

---

## 4. 2단계: 집계 (년도·분기 × 행정동)

### 4.1 `aggregate_by_year_quarter_dong()`

- **집계 기준**: `연도`, `분기`, `행정동_코드`, `행정동_코드_명`
- **집계 방식**: `mean()` (카페·제과점 평균)
- **결과**: 8,366행, 420개 행정동

---

## 5. 3단계: ML 전처리 파이프라인 (`preprocess.py`)

### 5.1 비율화: 디저트 비중

```
디저트_비중 = (카페+제과점 매출 합계) / 전체 상권 매출
```

- **의미**: 선호도 지표, 행정동 규모 보정
- **범위**: 0 ~ 1 (clip 적용)

### 5.2 로그 변환

```
log_당월_매출_금액 = log(당월_매출_금액 + 1)
```

- **목적**: 분산 안정화, right-skew 완화
- **효과**: 선형회귀·트리 모델 안정성 향상

### 5.3 Lag 변수

| 변수 | 설명 |
|------|------|
| lag1 | 전분기 매출 |
| lag4 | 전년 동분기 매출 (계절성) |

- **생성**: 행정동별 시계열 정렬 후 `shift()`

### 5.4 성장률

```
성장률 = (이번분기 - 전분기) / 전분기
```

- **목적**: 트렌드 반영, 물가 상승률 비교
- **결측·무한대**: 0으로 대체

### 5.5 계절성 변수

- **분기→월**: 1→3, 2→6, 3→9, 4→12
- **인코딩**:
  - `month_sin = sin(2π × 월 / 12)`
  - `month_cos = cos(2π × 월 / 12)`

### 5.6 CPI·인플레이션·기대인플레이션 병합 (`load_inflation.py` + `add_cpi()`)

**목표**: 월별 전국 거시변수 3종 → 분기별 테이블로 변환 후 `(연도, 분기)` 기준 left merge

| 소스 파일 | 내용 | 분기 집계 |
|-----------|------|-----------|
| 소비자물가지수_10년.xlsx | CPI 지수 (전국) | 분기 평균 |
| 월별_소비자물가_등락률_10년.xlsx | 전월비(MoM) % | 분기 평균 |
| 기대인플레이션율_전국_10년.xlsx | 물가인식(지난 1년) % | 분기 평균 |

**전처리 절차**:
1. **와이드→롱 변환**: 엑셀은 월이 컬럼으로 펼쳐진 와이드 포맷. 날짜 파싱(`_parse_yyyymm`) 후 (date, value) 시리즈로 변환
2. **월별→분기**: `resample("QE").mean()` (분기말 기준 분기 평균)
3. **추가 변수**: CPI로부터 `CPI_qoq`(분기 대비), `CPI_yoy`(전년 동분기 대비) 계산
4. **물가상승률 매핑**: `물가상승률 = CPI_qoq` (분기 대비) 또는 `inflation_mom/100` (fallback)
5. **병합 우선순위**: 3개 엑셀 → `data/cpi.csv` → `data/cpi_example.csv` → KOSIS 예시값
6. **경로**: `data/raw/` 또는 `~/Downloads`에서 파일 탐색

---

## 6. 4단계: 타겟 및 평가용 전처리

### 6.1 타겟 생성 (`add_target()`)

- **타겟 정의**: 다음 분기 디저트 비중 (미래값 예측)
- **구현 방식**:
  - `value_col="디저트_비중"`, `shift=-1`
  - 행정동별로 정렬 후 `groupby("행정동_코드")[value_col].shift(-1)` 적용
  - 한 행 아래 값이 타겟으로 들어감 → t 시점 행에서 t+1 시점 비중 예측
- **결측 발생**: 각 행정동의 **마지막 분기** 행은 다음 분기가 없어 `target=NaN`
- **왜 다음 분기인가**: 실무 적용 시 "다음 분기 비중을 미리 예측"하는 것이 가치 있음

### 6.2 이상치 클리핑 (`clip_outliers()`)

- **방법**: IQR (사분위 범위) 방식
  - `Q1 = 25% 분위수`, `Q3 = 75% 분위수`
  - `IQR = Q3 - Q1`
  - 하한 = `Q1 - 1.5×IQR`, 상한 = `Q3 + 1.5×IQR`
  - 해당 구간 밖 값은 하한/상한으로 clip (삭제 아님)
- **대상 변수**: `성장률`, `디저트_비중`
  - 성장률: 극단적 급등락 (예: -90%, +500%)이 회귀를 왜곡
  - 디저트_비중: 0~1 범위이지만 극단값이 모델 학습을 흐림
- **iqr_factor**: 기본 1.5 (통계 표준), 2.0~3.0이면 더 관대하게 유지

### 6.3 다중공선성 (VIF)

- **함수**: `calculate_vif()` (statsmodels `variance_inflation_factor` 사용)
- **의미**: 각 변수가 다른 설명변수로 얼마나 설명되는지. VIF>10이면 다중공선성 의심
- **계산**: `VIF_j = 1 / (1 - R²_j)` (j번째 변수를 나머지 변수로 회귀한 R² 기반)
- **현재 결과**:
  - lag1, lag4: VIF ≈ 30~35 (매출 lag 간 상관 높음)
  - lag1_비중, lag4_비중: VIF ≈ 20~37 (비중 lag 간 상관)
  - 물가상승률, 물가_x_lag1비중: VIF ≈ 21 (상호작용항이 원변수와 상관)
  - month_sin, month_cos, 성장률, log_당월_매출_금액: VIF < 2
- **대응**: PCA, 변수 제거(lag4만 사용 등), 정규화 등으로 추가 실험 가능

### 6.4 시계열 Train/Test 분리 (`time_split()`)

- **기준**: 연도로 분리 (시계열이므로 시간 순서 유지)
  - **Train**: `연도 < 2024` (2020~2023)
  - **Test**: `연도 >= 2024` (2024년)
- **이유**: 미래 데이터로 평가해야 실전 예측력 검증. 랜덤 분할 시 데이터 유출
- **규모**: Train 약 6,686행, Test 약 1,680행 (420행정동 × 4분기)

### 6.5 군집용 피처 (`create_cluster_features()`)

- **단위**: 행정동 (분기별 → 행정동별 집계)
- **집계 변수**:
  - `매출_mean`: 당월_매출_금액 평균
  - `매출_std`: 당월_매출_금액 표준편차 (변동성)
  - `성장률_mean`: 성장률 평균
  - `디저트_비중_mean`: 디저트 비중 평균
- **용도**: k-means 등 군집 분석 → 유사 행정동 그룹핑, 군집별 디저트 비중 추이 시각화

---

## 7. ML 피처 및 모델

### 7.1 타겟 유출 방지 ⚠️

- **타겟**: 다음 분기 디저트 비중
- **문제**: 현재 분기 `디저트_비중`을 피처로 넣으면 → 타겟과 거의 동일 (다음 분기 비중 ≈ 현재 비중 + 작은 변화)
- **결과**: 모델이 "현재 비중을 그대로 복사"하는 방식으로 학습 → 실전 예측력 과대평가
- **해결**: `디저트_비중`은 피처에서 제외, `lag1_비중`(전분기), `lag4_비중`(전년 동분기)만 사용

### 7.2 사용 피처

| 피처 | 설명 | 역할 |
|------|------|------|
| log_당월_매출_금액 | log(매출+1) | 규모 정보, 분산 안정화 |
| lag1, lag4 | 전분기·전년 동분기 매출 | 시계열 자기상관, 매출 추세 |
| lag1_비중, lag4_비중 | 전분기·전년 동분기 디저트 비중 | 타겟과 직접 관련, 자기상관 반영 |
| 성장률 | (이번-전분기)/전분기 | 트렌드, 변화율 |
| month_sin, month_cos | sin(2π×월/12), cos(2π×월/12) | 계절성 (연속형) |
| 물가상승률 | CPI_qoq 또는 inflation_mom/100 | 인플레이션 영향 |
| 물가_x_lag1비중 | 물가상승률 × lag1_비중 | 물가와 과거 비중 상호작용 |
| expected_inflation | 기대인플레이션율 (엑셀 전처리 시) | 소비자 물가 예상치 |

### 7.3 모델 (5개 비교)

| 모델 | 용도 | 비고 |
|------|------|------|
| Linear Regression | 해석, 선형 관계 | 계수 해석 가능 |
| Decision Tree | 불순도(MSE), 해석 | 트리 구조 시각화 |
| Random Forest | Bagging, 앙상블 | Feature Importance 제공 |
| XGBoost | Boosting | Mac: `brew install libomp` 필요 |
| MLP | Shallow NN | StandardScaler 적용 필수 |

- **TimeSeriesSplit**: 시계열 교차검증(5-fold)으로 과적합 검증
- **평가 지표**: RMSE, MAE, R²

### 7.4 Feature Importance (RF)

- **lag1_비중**: ~82% → 전분기 비중이 다음 분기 비중과 강한 자기상관
- **lag4_비중**: ~13% → 전년 동분기 (계절성) 반영
- **나머지**: 물가, 성장률, 계절성 등 각 5% 미만
- **해석**: 디저트 비중은 시계열적으로 "관성"이 큼. 물가는 보조적 역할

---

## 8. 시각화 결과물 (`outputs/figures/`)

시각화 이미지는 `outputs/figures/` 하위 폴더에 저장됩니다.

| 폴더 | 내용 |
|------|------|
| `outputs/figures/basic/` | 기본 시각화 (매출 추이, 상위행정동, 성별) |
| `outputs/figures/preprocess/` | 전처리 결과 (비중, 로그, lag, 성장률, 계절성, 상관) |
| `outputs/figures/inflation/` | 소비자물가 전처리 결과 |
| `outputs/figures/correlation/` | 디저트-물가 상관분석 |
| `outputs/figures/ml/` | k-means 군집 시각화 |

### 8.1 기본 시각화 (`outputs/figures/basic/`)

| 파일 | 내용 | 용도 |
|------|------|------|
| monthly_trend.png | 5개년 분기별 총 매출 추이 | 전체 트렌드 파악 |
| top_districts.png | 매출 상위 15개 행정동 | 핵심 지역 식별 |
| gender_ratio.png | 연도별 남·여 매출 금액 비교 | 성별 소비 패턴 |

### 8.2 전처리 결과 시각화 (`outputs/figures/preprocess/`)

| 파일 | 내용 | 확인 포인트 |
|------|------|-------------|
| preprocess_dessert_ratio.png | 디저트_비중 히스토그램/분포 | 0~1 범위, 분포 형태 |
| preprocess_log_transform.png | 원본 매출 vs log(매출+1) 분포 | 우측 꼬리 완화 여부 |
| preprocess_lag1_scatter.png | lag1(전분기 매출) vs 당월 매출 산점도 | 자기상관 확인 |
| preprocess_growth_rate.png | 성장률 분포 | 극단값 존재 여부 |
| preprocess_seasonality.png | 분기별 month_sin, month_cos | 계절 패턴 |
| preprocess_correlation.png | 파생변수 상관행렬 히트맵 | 다중공선성 사전 확인 |

### 8.3 ML 및 군집 결과물 (`outputs/figures/ml/`)

| 파일 | 내용 | 활용 |
|------|------|------|
| feature_importance.csv | RF, XGB, DT 피처 중요도 | 변수 선별, 해석 |
| vif_results.csv | VIF 값 (피처별) | 다중공선성 진단 |
| kmeans_cluster_trend.png | 군집별 디저트 비중 시계열 | 행정동 유형화, 군집 해석 |

### 8.4 소비자물가 전처리 결과물 (`outputs/figures/inflation/`)

| 파일 | 내용 |
|------|------|
| inflation_cpi_trend.png | 분기별 CPI 시계열 |
| inflation_cpi_qoq_yoy.png | CPI_qoq, CPI_yoy 막대그래프 |
| inflation_mom.png | 전월비(MoM) 분기평균 |
| inflation_expected.png | 기대인플레이션율 시계열 |
| inflation_cpi_vs_expected.png | CPI vs 기대인플레이션 2축 |
| inflation_물가상승률.png | 최종 병합용 물가상승률 |
| inflation_cpi_monthly_raw.png | 월별 CPI 원본 (전처리 전) |

→ 상세 설명: **docs/INFLATION_PREPROCESSING.md**

### 8.5 디저트-소비자물가 상관분석 결과물 (`outputs/figures/correlation/`)

| 파일 | 내용 |
|------|------|
| dessert_cpi_correlation_heatmap.png | 디저트 매출·비중 vs CPI 상관행렬 |
| dessert_cpi_scatter.png | CPI vs 총 디저트 매출 산점도 |
| dessert_cpi_timeseries.png | 매출·CPI 시계열 2축 |
| dessert_inflation_growth_scatter.png | 물가 변동 vs 매출 성장률 |
| dessert_cpi_correlation.csv | 상관계수 표 |

---

## 9. 실행 스크립트

| 스크립트 | 역할 | 출력 |
|----------|------|------|
| `scripts/preview_dessert.py` | 디저트 필터링 후 데이터 미리보기 | CSV 저장 (선택) |
| `scripts/run_preprocess.py` | preprocess_ml() 실행 | `dessert_ml_ready.csv` |
| `scripts/run_visualize.py` | 기본 시각화 (추이, 상위행정동, 성별) | monthly_trend, top_districts, gender_ratio |
| `scripts/run_preprocess_viz.py` | 전처리 결과 시각화 | preprocess_*.png |
| `scripts/run_ml_pipeline.py` | 전체 파이프라인: 로드→전처리→타겟→CPI→IQR→VIF→학습→군집 | feature_importance.csv, vif_results.csv, kmeans_cluster_trend.png |
| `scripts/run_inflation_viz.py` | CPI·인플레이션 전처리 결과 시각화 | outputs/figures/inflation/*.png |
| `scripts/analyze_dessert_cpi_correlation.py` | dessert vs 소비자물가 상관분석 | outputs/figures/correlation/*.png, outputs/correlation/*.csv |

---

## 10. 데이터 흐름 요약

```
raw CSV (5개년, data/raw/)
    │
    ├─ load_dessert_data()
    │     [필터: 제과점, 커피-음료 / 연령 컬럼 제거]
    │
    ├─ aggregate_by_year_quarter_dong()
    │     [연도·분기·행정동 평균 매출, 8,366행]
    │
    ├─ preprocess_ml()
    │     [디저트_비중, log_당월_매출, lag1/lag4, lag1_비중/lag4_비중, 성장률, month_sin/cos]
    │
    ├─ add_target(shift=-1)
    │     [target = 다음 분기 디저트_비중]
    │
    ├─ add_cpi()
    │     [3개 엑셀 또는 cpi.csv → CPI, inflation_mom, expected_inflation, CPI_qoq/yoy, 물가상승률, 물가_x_lag1비중]
    │
    ├─ clip_outliers(성장률, 디저트_비중)
    │     [IQR 하한·상한으로 clip]
    │
    ├─ time_split(test_year=2024)
    │     [Train: ~2023, Test: 2024~]
    │
    ├─ train_and_evaluate()
    │     [LR, DT, RF, XGB, MLP / TimeSeriesSplit 5-fold]
    │
    └─ plot_kmeans_clusters()
          [행정동 군집화 → 군집별 디저트 비중 추이]
```

---

## 11. 권장 전처리 순서

| 순서 | 단계 | 이유 |
|------|------|------|
| 1 | 비율화 (디저트_비중) | 규모 보정, 선호도 지표 |
| 2 | 로그 변환 | 분산 안정화, 우측 꼬리 완화 |
| 3 | Lag 생성 (lag1, lag4) | 시계열 자기상관 |
| 4 | lag_비중 생성 | 타겟과 직접 관련, 유출 방지 |
| 5 | 계절 변수 (month_sin/cos) | 분기별 패턴 |
| 6 | 타겟 생성 | shift(-1)로 다음 분기 |
| 7 | CPI 병합 | 외부 거시변수 |
| 8 | 이상치 처리 (IQR clip) | 극단값 완화 |
| 9 | VIF 확인 | 다중공선성 진단 |
| 10 | 시계열 분리 | Train/Test 시간순 유지 |

---

## 12. 교수님 질문 대비

| Q | A |
|---|---|
| **왜 디저트 비중이 이렇게 중요하게 나왔나요?** | 현재 분기 비중은 **피처에서 제외**했습니다(데이터 유출 방지). lag1_비중(전분기 비중)이 중요하게 나온 이유는 디저트 비중이 시계열적으로 **높은 자기상관**을 갖기 때문입니다. 즉 "지난 분기 비중"이 "다음 분기 비중"과 매우 밀접합니다. |
| **lag1, lag4 VIF 30이면 문제 아닌가요?** | 네, 다중공선성이 존재합니다. lag1과 lag4가 매출 시계열에서 서로 상관되어 VIF가 높게 나옵니다. PCA로 차원 축소, 또는 lag4만 사용하는 비교 실험을 수행할 수 있습니다. |
| **왜 RF가 잘 나왔나요?** | Random Forest는 비선형 관계와 변수 간 상호작용을 잘 포착합니다. 디저트 비중과 물가·계절성·매출의 관계가 선형이 아닐 수 있어 RF가 LR보다 나을 수 있습니다. |
| **패널 데이터인가요?** | 네, 행정동×연도×분기 단위의 **패널 데이터**입니다. 행정동 고정효과(dummy) 또는 target encoding, mixed effects 모델 적용 가능합니다. |
| **물가 변수는 어떻게 가져왔나요?** | 3개 엑셀(소비자물가지수, 월별 등락률, 기대인플레이션)에서 월별 데이터를 읽어 **분기 평균**으로 집계한 뒤 `(연도, 분기)` 기준으로 병합했습니다. |
