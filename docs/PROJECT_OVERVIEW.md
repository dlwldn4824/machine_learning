# 인플레이션 환경에서 디저트 소비 선호도 분석 프로젝트 — 종합 개요

이 문서는 프로젝트의 문제 정의부터 데이터 수집, 전처리, 모델 학습, 검증, 해석까지 전체 흐름을 줄글로 정리한 것이다. 무엇을 검증하기 위해 어떤 코드를 실행했고 결과가 어떻게 나왔는지 한 문서에 담았다.

---

## 1. 이 프로젝트가 다루는 문제

인플레이션이 오를 때 사람들의 디저트(카페·제과점) 소비가 어떻게 변하는가를 분석하는 것이 핵심이다. 단순히 “물가가 오르면 디저트를 덜 먹는가?”를 묻는 것을 넘어, **디저트 소비 비중의 변화를 예측하는 머신러닝 모델**을 만들고, 그 과정에서 **물가·인플레이션 변수가 얼마나 예측에 기여하는지**를 검증한다.

데이터는 서울시 상권분석 서비스의 2020~2024년(5개년) 행정동 단위 추정매출이다. 카페와 제과점 매출을 합쳐 “디저트”로 정의하고, 전체 상권 매출 대비 비중을 0~1로 계산했다. 이 비중이 “디저트 선호도”의 대리지표다. 물가 데이터는 소비자물가지수(CPI), 월별 등락률, 기대인플레이션율을 엑셀 또는 예시 CSV에서 읽어와 분기 단위로 변환 후 병합했다.

---

## 2. 데이터 로딩과 기본 전처리

데이터는 `src/data/load_dessert.py`의 `load_dessert_data()`로 로드한다. 여러 연도·행정동의 상권 매출을 합치고, `aggregate_by_year_quarter_dong()`으로 행정동×연도×분기 단위로 집계한다. 여기서 카페·제과점 매출만 합산해 디저트 비중을 만들고, 나머지 전처리는 `src/data/preprocess.py`의 `preprocess_ml()`에서 수행한다.

전처리 흐름은 다음과 같다. 먼저 `add_dessert_ratio()`로 디저트 비중을 정의한다. 전체 매출 대비 카페·제과점 매출 비율이다. 다음으로 `add_log_transform()`으로 매출에 log(x+1)을 적용해 분산을 완화한다. `add_lag_features()`와 `add_lag_ratio()`로 전분기(lag1), 전년 동분기(lag4) 매출·비중을 만들고, `add_growth_rate()`로 전분기 대비 성장률을 계산한다. 계절성을 반영하기 위해 `add_seasonality()`로 분기를 월로 환산한 뒤 sin/cos 인코딩(month_sin, month_cos)을 넣는다. 이 흐름은 `scripts/run_preprocess.py`로 실행할 수 있다.

---

## 3. 물가 변수 병합과 상관 분석

물가는 `src/data/preprocess.py`의 `add_cpi()`로 병합한다. KOSIS 기반 소비자물가지수, 월별 등락률, 기대인플레이션 엑셀이 있으면 `load_inflation.py`의 `build_macro_quarterly()`로 분기 테이블을 만들고, 없으면 예시 분기별 물가상승률 CSV를 사용한다. `물가상승률`(CPI_qoq 또는 그에 상응하는 값)과 `expected_inflation`이 주요 변수다.

`scripts/run_inflation_viz.py`로 물가 시계열을 시각화하고, `scripts/analyze_dessert_cpi_correlation.py`로 디저트 매출·비중과 물가 변수 간 상관을 계산한다. 결과를 보면 디저트 매출은 CPI, CPI_yoy, 기대인플레이션과 0.75~0.82 수준의 양의 상관을 보인다. 디저트 비중은 CPI_yoy와 0.66 정도 상관이 있다. 이는 “물가 상승 구간에 디저트 매출·비중이 함께 움직인다”는 동행성을 보여주지만, 인과 관계나 예측력은 별도로 검증해야 한다.

---

## 4. 타겟 정의와 ML 파이프라인 (기본)

기본 ML 파이프라인은 `scripts/run_ml_pipeline.py`로 실행한다. 타겟은 `add_target(df, value_col="디저트_비중", shift=-1)`로 정의한다. 즉 **다음 분기 디저트 비중**을 예측한다. 현재 비중은 예측 시점에 알 수 없으므로 피처에서 제외하고, lag1_비중·lag4_비중 등 과거 비중만 사용한다.

`add_cpi()`로 물가·기대인플레이션·물가×lag1비중 상호작용을 추가하고, `clip_outliers()`로 성장률·디저트_비중에 IQR 클리핑을 적용한다. VIF는 `calculate_vif()`로 계산한다. lag1_비중, lag4_비중, lag1, lag4, 물가상승률, 물가_x_lag1비중 등에서 VIF가 10을 넘어 다중공선성이 존재함이 확인된다. 이후 `time_split(test_year=2024)`로 2024년을 테스트, 나머지를 훈련으로 나눈다.

`src/models/train.py`의 `train_and_evaluate()`로 Linear Regression, Decision Tree, Random Forest, XGBoost, MLP를 학습·평가한다. 2024 holdout 기준 결과는 Linear Regression이 RMSE 0.0198, R² 0.8578로 가장 좋다. Random Forest·Decision Tree는 R² 0.78 정도, MLP는 0.66으로 상대적으로 낮다. Feature importance를 보면 lag1_비중이 RF 기준 82.4%, DT 기준 91.6%로 압도적이다. 물가 관련 변수(물가상승률, 물가_x_lag1비중) 기여도는 1% 미만이다. 즉, **관성이 너무 커서 물가 변수의 역할이 상대적으로 약해 보인다**는 것이 이 단계의 결론이다.

---

## 5. 모델 보완 실험 6종

이 문제를 다루기 위해 `scripts/run_experiments.py`로 6가지 보완 실험을 수행한다. 코드는 `src/models/experiments.py`에 있다.

**실험 1: VIF 처리 3트랙**  
다중공선성을 줄이기 위해 (A) lag4_비중 제거(lag1_비중만 유지), (B) 고VIF 변수들에 PCA 2개 컴포넌트 적용, (C) Ridge·Lasso·ElasticNet 정규화를 적용했다. 결과, Ridge(RMSE 0.0187, R² 0.872)가 기본 LR과 비슷한 성능을 유지하면서 공선성을 완화했다. PCA는 RMSE 0.0499, R² 0.095로 예측력이 크게 떨어졌다.

**실험 2: 2단계 모델(부분회귀)**  
1단계에서 lag-only 모델로 예측하고 잔차를 만들고, 2단계에서 그 잔차를 물가·기대인플레이션으로 회귀했다. 1단계 R²는 0.858이지만, 2단계 R²는 -0.004로 사실상 0에 가깝다. 즉 **관성을 제거한 뒤에도 물가가 잔차를 설명하지 못한다**는 것을 정량적으로 보여준다.

**실험 3: TimeSeriesSplit 롤링 검증**  
2020~2021→2022, 2020~2022→2023, 2020~2023→2024 세 개 fold로 롤링 평가했다. RMSE 평균 0.0143±0.0051, R² 평균 0.896±0.043으로, 단일 2024 holdout에 의존하지 않고 일반화 가능성을 확인했다.

**실험 4: 군집별 모델**  
행정동을 k-means로 3개 군집(고소비 안정형, 저소비 변동형, 성장형 등)으로 나누고, 군집별로 Full 모델을 학습해 물가상승률 계수를 비교했다. 군집 2(규모가 작은 그룹)에서 물가 계수가 -0.45로 가장 크고, 군집 0·1은 -0.18, -0.10 수준이다. 즉 **세그먼트에 따라 물가 민감도가 다르다**는 인사이트를 얻었다.

**실험 5: MLP 개선**  
EarlyStopping, L2 정규화, validation 분할을 넣어 MLP를 튜닝했다. R²가 0.66에서 0.80 수준으로 개선되었지만, 분기 20개 수준의 작은 데이터에서는 딥러닝이 본질적으로 불리하다는 점을 보고서에서 언급할 수 있다.

**실험 6: 물가 상호작용 재설계**  
물가_x_lag1비중 대신 물가_x_성장률, 물가_x_비중변화 등을 시도했다. RMSE·R² 모두 거의 동일하여, 상호작용 설계를 바꿔도 물가 효과가 약하다는 점은 그대로 유지된다.

---

## 6. 변화량 타겟·물가 충격·행정동 FE 파이프라인

관성에 가려진 물가 효과를 더 잘 보이게 하기 위해 타겟과 변수를 바꾼 파이프라인이 `scripts/run_fe_pipeline.py`다. 여기서는 **다음 분기 비중 변화량(target_delta_ratio)**을 예측한다. `add_delta_targets(df, forecast=True)`로 ratio_{t+1} - ratio_t를 타겟으로 둔다. `add_inflation_shocks()`로 물가 “충격” 변수를 만든다. infl_shock_ma는 현재 물가상승률에서 최근 4분기 평균을 뺀 “서프라이즈”다. infl_shock_ma_lag1, exp_shock_ma, exp_shock_ma_lag1도 같은 방식으로 정의한다.

Baseline 모델은 lag4_비중, 성장률, month_sin, month_cos만 사용한다. Full 모델은 여기에 infl_shock_ma, infl_shock_ma_lag1, exp_shock_ma, exp_shock_ma_lag1을 더한다. 2024 holdout 기준 Baseline RMSE 0.00496, R² 0.071이고, Full OLS는 RMSE 0.00494, R² 0.079로 소폭 개선된다. RMSE는 0.4% 정도 줄어든다.

`src/models/fe_model.py`의 `fit_fe_model()`로 행정동 고정효과를 넣은 모델을 학습한다. 행정동 더미로 상권별 고유 특성을 통제한 뒤 물가 충격 계수를 추정한다. FE-1(행정동 FE만)에서는 infl_shock_ma 계수가 -0.115, p=0.002로 유의하고, infl_shock_ma_lag1은 0.101, p=0.006로 유의하다. 물가 서프라이즈가 커질수록 비중 변화량이 감소하고, 한 분기 지나면 반등하는 패턴으로 해석할 수 있다. FE-2(행정동+시간 FE)는 행정동·분기 더미가 많아 수치적 불안정이 발생하고, shock 계수는 비유의(p≈0.49, 0.76)로 나온다. 따라서 **해석은 FE-1 기준**으로 하는 것이 타당하다.

롤링 검증에서는 Baseline이 RMSE 0.0054, R² 0.033 정도로 안정적인 반면, Full OLS는 fold에 따라 R²가 -0.26~0.9 수준으로 크게 흔들린다. 변화량 타겟은 분산이 작아 예측이 어렵고, 물가 변수 추가가 일관된 이득을 주지는 않는 것으로 보인다.

---

## 7. 시각화와 산출물

`scripts/run_visualize.py`는 기본 시각화(매출 추이, 상위 행정동, 성별 비율 등)를, `scripts/run_preprocess_viz.py`는 전처리 관련(비중·로그·lag·성장률·계절성·상관행렬) 그래프를, `scripts/run_inflation_viz.py`는 물가 시계열을 생성한다. `outputs/figures/` 아래 basic, preprocess, inflation, correlation, ml 폴더에 정리된다. k-means 군집별 디저트 비중 추이, 디저트–물가 상관 히트맵·산점도·시계열 등이 여기 포함된다.

---

## 8. 실행 순서 요약

전체를 처음부터 돌리려면 아래 순서대로 실행하면 된다.

1. **전처리**  
   `python scripts/run_preprocess.py`  
2. **기본 시각화**  
   `python scripts/run_visualize.py`  
3. **물가 시각화**  
   `python scripts/run_inflation_viz.py`  
4. **디저트–물가 상관 분석**  
   `python scripts/analyze_dessert_cpi_correlation.py`  
5. **기본 ML 파이프라인 (다음 분기 비중 예측)**  
   `python scripts/run_ml_pipeline.py`  
6. **모델 보완 실험 6종**  
   `python scripts/run_experiments.py`  
7. **변화량 타겟·물가 충격·FE 파이프라인**  
   `python scripts/run_fe_pipeline.py`

---

## 9. 종합 결론

디저트 소비 비중은 **전분기·전년 동분기 비중(lag)에 대한 강한 자기상관**을 보인다. 물가·기대인플레이션과는 시계열 동행성이 있으나, 기본 ML 파이프라인에서는 lag가 너무 강해 물가 변수의 기여도가 낮게 나타난다. 2단계 모델로 관성을 제거한 뒤에도 물가가 잔차를 거의 설명하지 못한다.

반면, **타겟을 변화량으로 바꾸고 물가 충격 변수·행정동 FE를 넣은 모델**에서는 infl_shock_ma 계수가 유의하게 추정된다. 물가가 예상보다 크게 오른 구간(서프라이즈)에서는 디저트 비중 변화량이 단기적으로 감소하는 경향이 있다. 군집 분석에서도 물가 민감도가 세그먼트별로 다르게 나타나, 상권 특성에 따른 차별화가 있음을 시사한다.

정리하면, 디저트 소비는 **습관재(habit good)** 성격이 강하고, 거시 물가 수준보다 **지역 특성과 소비 관성**이 더 중요하다. 단기 물가 충격은 행정동 FE를 통제한 모델에서 일부 유의한 효과로 확인되지만, 예측 성능 개선은 제한적이다. 향후 과제로는 개별 물가지수(외식·가공식품 등) 활용, 표본 크기 확대, 코로나 등 특수 시기 통제 등이 있다.
