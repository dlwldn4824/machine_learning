"""
ML 학습 파이프라인: LR, DT, RF, XGB, MLP 비교
타겟: 다음 분기 디저트 비중 (현재 비중 제외, lag_비중만 사용)
"""
import pandas as pd
import numpy as np
from pathlib import Path
from sklearn.linear_model import LinearRegression
from sklearn.tree import DecisionTreeRegressor
from sklearn.ensemble import RandomForestRegressor
from sklearn.neural_network import MLPRegressor
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import TimeSeriesSplit
from sklearn.metrics import mean_squared_error, mean_absolute_error, r2_score

# 타겟 유출 방지: 현재 디저트_비중 제외, lag_비중만 사용
FEATURE_COLS_BASE = [
    "log_당월_매출_금액",
    "lag1",
    "lag4",
    "lag1_비중",
    "lag4_비중",
    "성장률",
    "month_sin",
    "month_cos",
]
FEATURE_COLS_EXTRA = [
    "물가상승률",
    "물가_x_lag1비중",
    "expected_inflation",  # 기대인플레이션율 (엑셀 전처리 시)
]  # CPI 있을 때 추가


def get_feature_cols(df: pd.DataFrame) -> list[str]:
    """사용 가능한 피처만 반환"""
    base = [c for c in FEATURE_COLS_BASE if c in df.columns]
    extra = [c for c in FEATURE_COLS_EXTRA if c in df.columns]
    return base + extra


def prepare_xy(
    df: pd.DataFrame,
    target_col: str = "target",
    feature_cols: list[str] | None = None,
    scale: bool = False,
):
    """X, y 준비 (결측 제거)"""
    if feature_cols is None:
        feature_cols = get_feature_cols(df)
    cols = [c for c in feature_cols if c in df.columns]
    sub = df[cols + [target_col]].dropna()

    X = sub[cols]
    y = sub[target_col]

    if scale:
        scaler = StandardScaler()
        X = pd.DataFrame(scaler.fit_transform(X), columns=cols, index=X.index)
        return X, y, scaler
    return X, y, None


def train_and_evaluate(
    train_df: pd.DataFrame,
    test_df: pd.DataFrame,
    feature_cols: list[str] | None = None,
) -> dict:
    """LinearRegression, DecisionTree, RandomForest, XGBoost, MLP 학습 및 평가"""
    feature_cols = feature_cols or get_feature_cols(train_df)

    X_train, y_train, _ = prepare_xy(train_df, feature_cols=feature_cols)
    X_test, y_test, _ = prepare_xy(test_df, feature_cols=feature_cols)

    # NN용 스케일링
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)

    results = {}

    # 1. Linear Regression (해석용)
    lr = LinearRegression()
    lr.fit(X_train, y_train)
    y_pred = lr.predict(X_test)
    results["LinearRegression"] = _eval(y_test, y_pred, lr)

    # 2. Decision Tree (불순도 설명)
    dt = DecisionTreeRegressor(max_depth=10, random_state=42)
    dt.fit(X_train, y_train)
    results["DecisionTree"] = _eval(y_test, dt.predict(X_test), dt)

    # 3. Random Forest (Bagging)
    rf = RandomForestRegressor(n_estimators=100, max_depth=10, random_state=42)
    rf.fit(X_train, y_train)
    results["RandomForest"] = _eval(y_test, rf.predict(X_test), rf)

    # 4. XGBoost (Boosting)
    try:
        import xgboost as xgb
        xgb_m = xgb.XGBRegressor(n_estimators=100, max_depth=6, random_state=42)
        xgb_m.fit(X_train, y_train)
        results["XGBoost"] = _eval(y_test, xgb_m.predict(X_test), xgb_m)
    except Exception as e:
        print(f"  (XGBoost 스킵: {e})")
        results["XGBoost"] = None

    # 5. MLP (Shallow NN, 스케일링 필요)
    mlp = MLPRegressor(hidden_layer_sizes=(64, 32), activation="relu", max_iter=500, random_state=42)
    mlp.fit(X_train_scaled, y_train)
    results["MLP"] = _eval(y_test, mlp.predict(X_test_scaled), mlp)

    results["y_test"] = y_test
    results["feature_cols"] = feature_cols
    return results


def _eval(y_true, y_pred, model) -> dict:
    return {
        "RMSE": np.sqrt(mean_squared_error(y_true, y_pred)),
        "MAE": mean_absolute_error(y_true, y_pred),
        "R2": r2_score(y_true, y_pred),
        "model": model,
        "y_pred": y_pred,
    }


def time_series_cv(
    df: pd.DataFrame,
    feature_cols: list[str],
    model_fn,
    n_splits: int = 2,
) -> pd.DataFrame:
    """TimeSeriesSplit 기반 교차검증"""
    tscv = TimeSeriesSplit(n_splits=n_splits)
    df = df.sort_values(["연도", "분기"]).dropna(subset=feature_cols + ["target"])
    years = sorted(df["연도"].unique())
    folds = []
    for i in range(1, min(n_splits + 1, len(years))):
        train_years = years[:i]
        test_year = years[i] if i < len(years) else years[-1]
        train = df[df["연도"].isin(train_years)]
        test = df[df["연도"] == test_year]
        if len(test) == 0:
            continue
        X_train, y_train, _ = prepare_xy(train, feature_cols=feature_cols)
        X_test, y_test, _ = prepare_xy(test, feature_cols=feature_cols)
        model = model_fn()
        model.fit(X_train, y_train)
        pred = model.predict(X_test)
        folds.append({"test_year": test_year, "RMSE": np.sqrt(mean_squared_error(y_test, pred)), "R2": r2_score(y_test, pred)})
    return pd.DataFrame(folds)


def print_performance_table(results: dict) -> None:
    """성능표 출력"""
    print("\n" + "=" * 55)
    print("모델 성능 비교 (타겟: 다음 분기 디저트 비중)")
    print("=" * 55)
    rows = []
    for name, v in results.items():
        if name in ("y_test", "feature_cols") or v is None:
            continue
        rows.append([name, f"{v['RMSE']:.4f}", f"{v['MAE']:.4f}", f"{v['R2']:.4f}"])
    print(pd.DataFrame(rows, columns=["모델", "RMSE", "MAE", "R2"]).to_string(index=False))
    print("=" * 55)


def get_feature_importance(results: dict) -> pd.DataFrame:
    """Feature importance (RF, XGB, DT)"""
    cols = results["feature_cols"]
    imp = []

    for name, key in [("RF", "RandomForest"), ("XGB", "XGBoost"), ("DT", "DecisionTree")]:
        if key not in results or results[key] is None:
            continue
        m = results[key]["model"]
        if hasattr(m, "feature_importances_"):
            imp.append(pd.DataFrame({"feature": cols, name: m.feature_importances_}))

    if not imp:
        return pd.DataFrame()
    out = imp[0]
    for d in imp[1:]:
        out = out.merge(d, on="feature")
    return out
