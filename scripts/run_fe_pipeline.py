"""
변화량 타겟 + 물가 충격 + 패널 고정효과 파이프라인
- Baseline: lag-only (shock 없음)
- Full: lag + shock + 행정동 FE + 시간 FE
- Rolling TimeSeriesSplit 평가
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import numpy as np
import pandas as pd
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_squared_error, mean_absolute_error, r2_score

from src.data.load_dessert import load_dessert_data, aggregate_by_year_quarter_dong
from src.data.preprocess import (
    preprocess_ml,
    add_cpi,
    add_delta_targets,
    add_inflation_shocks,
    clip_outliers,
    time_split,
)
from src.models.fe_model import fit_fe_model, predict_fe_model, fe_summary_table


def _prepare(df: pd.DataFrame, cols: list[str], target: str):
    sub = df[[c for c in cols if c in df.columns] + [target]].dropna()
    X = sub[[c for c in cols if c in df.columns]]
    y = sub[target]
    return X, y


def eval_model(y_true, y_pred):
    return {
        "RMSE": np.sqrt(mean_squared_error(y_true, y_pred)),
        "MAE": mean_absolute_error(y_true, y_pred),
        "R2": r2_score(y_true, y_pred),
    }


def run_rolling_cv(df: pd.DataFrame, target: str, baseline_cols: list[str], full_cols: list[str]):
    """Rolling: 2020~2021→2022, 2020~2022→2023, 2020~2023→2024"""
    years = sorted(df["연도"].unique())
    results = {"Baseline": [], "Full_LR": []}

    for i in range(1, len(years)):
        train_years = years[:i]
        test_year = years[i]
        train = df[df["연도"].isin(train_years)]
        test = df[df["연도"] == test_year]
        if len(test) < 5:
            continue

        # Baseline: lag-only OLS
        X_tr, y_tr = _prepare(train, baseline_cols, target)
        X_te, y_te = _prepare(test, baseline_cols, target)
        if len(X_tr) < 10 or len(X_te) < 1:
            continue
        m = LinearRegression().fit(X_tr, y_tr)
        pred = m.predict(X_te)
        results["Baseline"].append(eval_model(y_te, pred))

        # Full: LR with shock (no FE for rolling - FE needs train dong/t)
        full_avail = [c for c in full_cols if c in train.columns and c in test.columns]
        X_tr2, y_tr2 = _prepare(train, full_avail, target)
        X_te2, y_te2 = _prepare(test, full_avail, target)
        if len(X_tr2) < 10 or len(X_te2) < 1:
            continue
        m2 = LinearRegression().fit(X_tr2, y_tr2)
        pred2 = m2.predict(X_te2)
        results["Full_LR"].append(eval_model(y_te2, pred2))

    out = []
    for name, vals in results.items():
        if vals:
            out.append({
                "모델": name,
                "RMSE_mean": np.mean([v["RMSE"] for v in vals]),
                "RMSE_std": np.std([v["RMSE"] for v in vals]),
                "R2_mean": np.mean([v["R2"] for v in vals]),
                "R2_std": np.std([v["R2"] for v in vals]),
            })
    return pd.DataFrame(out)


if __name__ == "__main__":
    print("1. 데이터 로드 및 전처리...")
    df = load_dessert_data()
    df = aggregate_by_year_quarter_dong(df, drop_age=True)
    df = preprocess_ml(df)
    df = add_cpi(df)
    df = clip_outliers(df, cols=["성장률", "디저트_비중"], iqr_factor=1.5)

    # 2. 변화량 타겟 + 물가 충격
    print("2. 변화량 타겟 + 물가 충격 변수...")
    df = add_delta_targets(df)
    df = add_inflation_shocks(df)

    # CPI_qoq 없으면 물가상승률로 fallback (add_inflation_shocks 내부 처리)

    train_df, test_df = time_split(df, test_year=2024)

    target = "target_delta_ratio"
    baseline_cols = ["lag4_비중", "성장률", "month_sin", "month_cos"]
    full_cols = baseline_cols + [
        "infl_shock_ma", "infl_shock_ma_lag1",
        "exp_shock_ma", "exp_shock_ma_lag1",
    ]
    full_cols = [c for c in full_cols if c in df.columns]

    # 3. Baseline vs Full (OLS, 2024 holdout)
    print("\n3. Baseline vs Full (2024 holdout)...")
    X_tr_b, y_tr_b = _prepare(train_df, baseline_cols, target)
    X_te_b, y_te_b = _prepare(test_df, baseline_cols, target)
    X_tr_f, y_tr_f = _prepare(train_df, full_cols, target)
    X_te_f, y_te_f = _prepare(test_df, full_cols, target)

    m_baseline = LinearRegression().fit(X_tr_b, y_tr_b)
    m_full = LinearRegression().fit(X_tr_f, y_tr_f)

    perf_b = eval_model(y_te_b, m_baseline.predict(X_te_b))
    perf_f = eval_model(y_te_f, m_full.predict(X_te_f))

    print("  Baseline (lag-only):", perf_b)
    print("  Full (lag+shock):   ", perf_f)

    # 4. FE 모델 (행정동 고정효과)
    print("\n4. FE 모델 (행정동 FE)...")
    shock_cols = [c for c in ["infl_shock_ma", "infl_shock_ma_lag1", "exp_shock_ma", "exp_shock_ma_lag1"] if c in df.columns]
    fe_model = fit_fe_model(train_df, target=target, shock_cols=shock_cols)
    if fe_model is not None:
        print(f"  FE R² (train): {fe_model.rsquared:.4f}")
        tbl = fe_summary_table(fe_model)
        print(tbl.to_string(index=False))

        # test 예측 (FE는 train 동/시간에 종속 → test는 제한적)
        pred_fe = np.asarray(predict_fe_model(fe_model, test_df, train_df))
        y_te_all = np.asarray(test_df[target].values, dtype=float)
        valid = np.isfinite(pred_fe) & np.isfinite(y_te_all)
        if valid.sum() > 10:
            perf_fe = eval_model(y_te_all[valid], pred_fe[valid])
            print("  FE (test, 예측가능 행만):", perf_fe)

    # 5. Rolling CV
    print("\n5. Rolling TimeSeriesSplit (Baseline vs Full)...")
    rolling = run_rolling_cv(df, target, baseline_cols, full_cols)
    print(rolling.to_string(index=False))

    # 6. 결과 저장
    out_dir = Path("outputs/fe_pipeline")
    out_dir.mkdir(parents=True, exist_ok=True)
    save_rows = [
        {"모델": "Baseline", **perf_b},
        {"모델": "Full_OLS", **perf_f},
    ]
    if fe_model is not None:
        pred_fe = np.asarray(predict_fe_model(fe_model, test_df, train_df))
        y_te_all = np.asarray(test_df[target].values, dtype=float)
        valid = np.isfinite(pred_fe) & np.isfinite(y_te_all)
        if valid.sum() > 10:
            save_rows.append({"모델": "Full_FE", **eval_model(y_te_all[valid], pred_fe[valid])})
    pd.DataFrame(save_rows).to_csv(out_dir / "baseline_vs_full.csv", index=False)
    if fe_model is not None and len(tbl) > 0:
        tbl.to_csv(out_dir / "fe_coefficients.csv", index=False)
    rolling.to_csv(out_dir / "rolling_cv.csv", index=False)
    print(f"\n저장: {out_dir}/")
