"""
완전한 ML 학습 파이프라인 실행
- 타겟: 다음 분기 디저트 비중 (현재 비중 제외, lag_비중만 사용)
- CPI 변수, TimeSeriesSplit
- LR, DT, RF, XGBoost, MLP 5개 모델 비교
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import pandas as pd

from src.data.load_dessert import load_dessert_data, aggregate_by_year_quarter_dong
from src.data.preprocess import (
    preprocess_ml,
    add_target,
    clip_outliers,
    add_cpi,
    time_split,
    calculate_vif,
)
from src.models.train import train_and_evaluate, print_performance_table, get_feature_importance, get_feature_cols

if __name__ == "__main__":
    # 1. 데이터 로드 & 전처리
    print("1. 데이터 로드 및 전처리...")
    df = load_dessert_data()
    df = aggregate_by_year_quarter_dong(df, drop_age=True)
    df = preprocess_ml(df)

    # 2. 타겟 생성 (다음 분기 디저트 비중 예측)
    print("2. 타겟 생성 (다음 분기 디저트 비중)...")
    df = add_target(df, value_col="디저트_비중", shift=-1)

    # 3. CPI(물가) 변수 추가
    print("3. CPI 변수 추가...")
    df = add_cpi(df)

    # 4. 이상치 클리핑
    print("4. 이상치 클리핑 (IQR)...")
    df = clip_outliers(df, cols=["성장률", "디저트_비중"], iqr_factor=1.5)

    # 5. VIF 확인
    FEATURE_COLS = get_feature_cols(df)
    print("\n5. 다중공선성 (VIF) 확인...")
    df_clean = df[[c for c in FEATURE_COLS if c in df.columns] + ["target"]].dropna()
    vif = calculate_vif(df_clean, FEATURE_COLS)
    print(vif.to_string(index=False))
    high_vif = vif[vif["VIF"] > 10]
    if len(high_vif) > 0:
        print(f"\n  ⚠ VIF>10 변수: {high_vif['feature'].tolist()} (PCA 또는 제거 고려)")

    # 6. 시계열 Train/Test 분리
    print("\n6. 시계열 분리 (Train: ~2023, Test: 2024~)...")
    train_df, test_df = time_split(df, test_year=2024)
    print(f"   Train: {len(train_df):,} / Test: {len(test_df):,}")

    # 7. 학습 & 평가 (LR, DT, RF, XGB, MLP)
    print("\n7. 모델 학습 (LR, DT, RF, XGBoost, MLP)...")
    results = train_and_evaluate(train_df, test_df, feature_cols=FEATURE_COLS)

    # 7. 성능표
    print_performance_table(results)

    # 8. Feature Importance (RF, XGB, DT)
    print("\nFeature Importance:")
    imp = get_feature_importance(results)
    print(imp.to_string(index=False))

    # 9. 결과 저장
    out_dir = Path("outputs")
    out_dir.mkdir(exist_ok=True)
    imp.to_csv(out_dir / "feature_importance.csv", index=False)
    vif.to_csv(out_dir / "vif_results.csv", index=False)

    # 10. k-means 군집 시각화
    print("\n10. k-means 군집 시각화...")
    from src.analysis.visualize import plot_kmeans_clusters
    plot_kmeans_clusters(df, n_clusters=3)

    print(f"\n저장: {out_dir / 'feature_importance.csv'}, {out_dir / 'vif_results.csv'}")
