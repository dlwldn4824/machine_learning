"""
모델 보완 실험 6종 실행
1) VIF 3트랙  2) 2단계 모델  3) 롤링 CV  4) 군집별 모델  5) MLP 개선  6) 상호작용 재설계
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import pandas as pd

from src.data.load_dessert import load_dessert_data, aggregate_by_year_quarter_dong
from src.data.preprocess import preprocess_ml, add_target, add_cpi, clip_outliers, time_split
from src.models.train import get_feature_cols
from src.models.experiments import (
    exp1_vif_tracks,
    exp2_two_stage,
    exp3_rolling_cv,
    exp4_cluster_models,
    exp5_mlp_improved,
    exp6_interaction_redesign,
)

if __name__ == "__main__":
    # 데이터 로드 및 전처리
    print("데이터 로드 및 전처리...")
    df = load_dessert_data()
    df = aggregate_by_year_quarter_dong(df, drop_age=True)
    df = preprocess_ml(df)
    df = add_target(df, value_col="디저트_비중", shift=-1)
    df = add_cpi(df)
    df = clip_outliers(df, cols=["성장률", "디저트_비중"], iqr_factor=1.5)

    base_cols = get_feature_cols(df)
    train_df, test_df = time_split(df, test_year=2024)

    out_dir = Path("outputs/experiments")
    out_dir.mkdir(parents=True, exist_ok=True)

    # 1) VIF 3트랙
    print("\n[1] VIF 처리 3트랙 (변수선택/PCA/Ridge·Lasso·ElasticNet)")
    e1 = exp1_vif_tracks(train_df, test_df, base_cols)
    print(e1.to_string(index=False))
    e1.to_csv(out_dir / "exp1_vif_tracks.csv", index=False)

    # 2) 2단계 모델
    print("\n[2] 2단계 모델 (lag 잔차 → 물가 회귀)")
    lag_cols = [c for c in base_cols if "lag" in c or c in ["log_당월_매출_금액", "성장률", "month_sin", "month_cos"]]
    infl_cols = [c for c in ["물가상승률", "expected_inflation"] if c in df.columns]
    e2 = exp2_two_stage(train_df, test_df, lag_cols, infl_cols)
    for k, v in e2.items():
        print(f"  {k}: {v}")
    flat = {k: str(v) if isinstance(v, dict) else v for k, v in e2.items()}
    pd.DataFrame([flat]).to_csv(out_dir / "exp2_two_stage.csv", index=False)

    # 3) 롤링 CV
    print("\n[3] TimeSeriesSplit 롤링 검증 (2020~2022→2023, 2020~2023→2024)")
    from sklearn.linear_model import LinearRegression
    e3 = exp3_rolling_cv(df, base_cols, model_fn=lambda: LinearRegression())
    print(e3.to_string(index=False))
    e3.to_csv(out_dir / "exp3_rolling_cv.csv", index=False)

    # 4) 군집별 모델
    print("\n[4] 군집별 모델 (물가 계수 비교)")
    e4 = exp4_cluster_models(df, base_cols, n_clusters=3)
    print(e4.to_string(index=False))
    e4.to_csv(out_dir / "exp4_cluster_models.csv", index=False)

    # 5) MLP 개선
    print("\n[5] MLP 성능 개선 (EarlyStopping, L2)")
    e5 = exp5_mlp_improved(train_df, test_df, base_cols)
    for k, v in e5.items():
        print(f"  {k}: {v}")
    pd.DataFrame([e5]).to_csv(out_dir / "exp5_mlp_improved.csv", index=False)

    # 6) 상호작용 재설계
    print("\n[6] 물가 상호작용 재설계")
    e6 = exp6_interaction_redesign(train_df, test_df, base_cols)
    print(e6.to_string(index=False))
    e6.to_csv(out_dir / "exp6_interaction_redesign.csv", index=False)

    print(f"\n결과 저장: {out_dir}/")
