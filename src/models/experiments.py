"""
모델 보완 실험 6종
1) VIF 처리 3트랙: 변수선택 / PCA / Ridge·Lasso·ElasticNet
2) 2단계 모델 (잔차→물가 회귀)
3) TimeSeriesSplit 롤링 검증
4) 군집별 모델 비교
5) MLP 성능 개선
6) 물가 상호작용 재설계
"""
from __future__ import annotations

import numpy as np
import pandas as pd
from sklearn.linear_model import LinearRegression, Ridge, Lasso, ElasticNet
from sklearn.preprocessing import StandardScaler
from sklearn.decomposition import PCA
from sklearn.neural_network import MLPRegressor
from sklearn.metrics import mean_squared_error, mean_absolute_error, r2_score
from typing import Callable


def _prepare(df: pd.DataFrame, cols: list[str], target: str = "target"):
    sub = df[[c for c in cols if c in df.columns] + [target]].dropna()
    X = sub[[c for c in cols if c in df.columns]]
    y = sub[target]
    return X, y


# ---------- 1) VIF 처리 3트랙 ----------

def exp1_vif_tracks(
    train_df: pd.DataFrame,
    test_df: pd.DataFrame,
    base_cols: list[str],
) -> pd.DataFrame:
    """
    Track A: lag1_비중만 (lag4_비중 제거)
    Track B: PCA 2 comp on high-VIF vars
    Track C: Ridge, Lasso, ElasticNet
    """
    rows = []

    # Track A: lag1_비중만
    cols_a = [c for c in base_cols if c != "lag4_비중" and c in train_df.columns]
    if cols_a:
        X_tr, y_tr = _prepare(train_df, cols_a)
        X_te, y_te = _prepare(test_df, cols_a)
        lr = LinearRegression().fit(X_tr, y_tr)
        pred = lr.predict(X_te)
        rows.append({"실험": "VIF_TrackA_lag1만", "RMSE": np.sqrt(mean_squared_error(y_te, pred)), "R2": r2_score(y_te, pred)})

    # Track B: PCA
    high_vif = ["lag1_비중", "lag4_비중", "lag1", "lag4", "물가상승률", "물가_x_lag1비중"]
    pca_cols = [c for c in high_vif if c in base_cols and c in train_df.columns]
    other_cols = [c for c in base_cols if c not in pca_cols]
    if len(pca_cols) >= 2:
        X_tr, y_tr = _prepare(train_df, base_cols)
        X_te, y_te = _prepare(test_df, base_cols)
        pca = PCA(n_components=2, random_state=42)
        idx_pca = [i for i, c in enumerate(base_cols) if c in pca_cols]
        idx_other = [i for i, c in enumerate(base_cols) if c not in pca_cols]
        X_tr_pca = pca.fit_transform(X_tr.iloc[:, idx_pca])
        X_te_pca = pca.transform(X_te.iloc[:, idx_pca])
        X_tr_comb = np.hstack([X_tr_pca, X_tr.iloc[:, idx_other].values])
        X_te_comb = np.hstack([X_te_pca, X_te.iloc[:, idx_other].values])
        lr = LinearRegression().fit(X_tr_comb, y_tr)
        pred = lr.predict(X_te_comb)
        rows.append({"실험": "VIF_TrackB_PCA2", "RMSE": np.sqrt(mean_squared_error(y_te, pred)), "R2": r2_score(y_te, pred)})

    # Track C: Ridge, Lasso, ElasticNet
    X_tr, y_tr = _prepare(train_df, base_cols)
    X_te, y_te = _prepare(test_df, base_cols)
    scaler = StandardScaler()
    X_tr_s = scaler.fit_transform(X_tr)
    X_te_s = scaler.transform(X_te)
    for name, m in [
        ("VIF_TrackC_Ridge", Ridge(alpha=1.0)),
        ("VIF_TrackC_Lasso", Lasso(alpha=0.001)),
        ("VIF_TrackC_ElasticNet", ElasticNet(alpha=0.001, l1_ratio=0.5)),
    ]:
        m.fit(X_tr_s, y_tr)
        pred = m.predict(X_te_s)
        rows.append({"실험": name, "RMSE": np.sqrt(mean_squared_error(y_te, pred)), "R2": r2_score(y_te, pred)})

    return pd.DataFrame(rows)


# ---------- 2) 2단계 모델 (잔차→물가) ----------

def exp2_two_stage(
    train_df: pd.DataFrame,
    test_df: pd.DataFrame,
    lag_cols: list[str],
    infl_cols: list[str],
) -> dict:
    """
    1단계: lag-only로 예측 → 잔차
    2단계: 잔차를 물가/기대인플레로 회귀
    """
    lag_cols = [c for c in lag_cols if c in train_df.columns]
    infl_cols = [c for c in infl_cols if c in train_df.columns]
    if not lag_cols or not infl_cols:
        return {"stage1_R2": np.nan, "stage2_R2": np.nan, "물가_계수": {}}

    common_tr = train_df.dropna(subset=lag_cols + infl_cols + ["target"])
    common_te = test_df.dropna(subset=lag_cols + infl_cols + ["target"])
    if len(common_tr) < 10 or len(common_te) < 5:
        return {"stage1_R2": np.nan, "stage2_R2": np.nan, "물가_계수": {}}

    m1 = LinearRegression().fit(common_tr[lag_cols], common_tr["target"])
    resid_tr = common_tr["target"].values - m1.predict(common_tr[lag_cols])
    resid_te = common_te["target"].values - m1.predict(common_te[lag_cols])

    m2 = LinearRegression().fit(common_tr[infl_cols], resid_tr)
    coef = dict(zip(infl_cols, m2.coef_))
    return {
        "stage1_R2": r2_score(common_te["target"], m1.predict(common_te[lag_cols])),
        "stage2_R2": r2_score(resid_te, m2.predict(common_te[infl_cols])),
        "물가_계수": coef,
    }


# ---------- 3) TimeSeriesSplit 롤링 ----------

def exp3_rolling_cv(
    df: pd.DataFrame,
    base_cols: list[str],
    model_fn: Callable = lambda: LinearRegression(),
) -> pd.DataFrame:
    """
    롤링: 2020~2022→2023, 2020~2023→2024
    """
    years = sorted(df["연도"].unique())
    folds = []
    for i in range(1, len(years)):
        train_years = years[:i]
        test_year = years[i]
        train = df[df["연도"].isin(train_years)]
        test = df[df["연도"] == test_year]
        if len(test) == 0:
            continue
        X_tr, y_tr = _prepare(train, base_cols)
        X_te, y_te = _prepare(test, base_cols)
        if len(X_tr) < 10 or len(X_te) < 1:
            continue
        m = model_fn()
        m.fit(X_tr, y_tr)
        pred = m.predict(X_te)
        folds.append({
            "train_years": f"{min(train_years)}~{max(train_years)}",
            "test_year": test_year,
            "RMSE": np.sqrt(mean_squared_error(y_te, pred)),
            "MAE": mean_absolute_error(y_te, pred),
            "R2": r2_score(y_te, pred),
        })
    out = pd.DataFrame(folds)
    if len(out) > 0:
        m = out[["RMSE", "MAE", "R2"]].mean()
        s = out[["RMSE", "MAE", "R2"]].std()
        out = pd.concat([out, pd.DataFrame([{"train_years": "평균", "test_year": "-", "RMSE": m["RMSE"], "MAE": m["MAE"], "R2": m["R2"]}])], ignore_index=True)
        out = pd.concat([out, pd.DataFrame([{"train_years": "표준편차", "test_year": "-", "RMSE": s["RMSE"], "MAE": s["MAE"], "R2": s["R2"]}])], ignore_index=True)
    return out


# ---------- 4) 군집별 모델 ----------

def exp4_cluster_models(
    df: pd.DataFrame,
    base_cols: list[str],
    n_clusters: int = 3,
) -> pd.DataFrame:
    """
    k-means 군집별로 모델 학습, 물가 계수 비교
    """
    from sklearn.cluster import KMeans
    from src.data.preprocess import create_cluster_features

    cluster_df = create_cluster_features(df)
    feat_cols = ["매출_mean", "매출_std", "성장률_mean", "디저트_비중_mean"]
    X_cl = cluster_df[feat_cols].fillna(0)
    km = KMeans(n_clusters=n_clusters, random_state=42)
    cluster_df["cluster"] = km.fit_predict(StandardScaler().fit_transform(X_cl))

    df_merged = df.merge(cluster_df[["행정동_코드", "cluster"]], on="행정동_코드", how="left")
    rows = []
    for c in range(n_clusters):
        sub = df_merged[df_merged["cluster"] == c].dropna(subset=base_cols + ["target"])
        if len(sub) < 100:
            continue
        train = sub[sub["연도"] < 2024]
        test = sub[sub["연도"] >= 2024]
        if len(test) == 0:
            continue
        X_tr, y_tr = _prepare(train, base_cols)
        X_te, y_te = _prepare(test, base_cols)
        lr = LinearRegression().fit(X_tr, y_tr)
        pred = lr.predict(X_te)
        try:
            coef_idx = base_cols.index("물가상승률")
            물가_계수 = lr.coef_[coef_idx]
        except (ValueError, IndexError):
            물가_계수 = np.nan
        rows.append({
            "cluster": c,
            "n_train": len(train),
            "n_test": len(test),
            "R2": r2_score(y_te, pred),
            "물가_계수": 물가_계수,
        })
    return pd.DataFrame(rows)


# ---------- 5) MLP 개선 ----------

def exp5_mlp_improved(
    train_df: pd.DataFrame,
    test_df: pd.DataFrame,
    base_cols: list[str],
) -> dict:
    """
    EarlyStopping, alpha(L2), 적절한 구조
    """
    X_tr, y_tr = _prepare(train_df, base_cols)
    X_te, y_te = _prepare(test_df, base_cols)
    scaler = StandardScaler()
    X_tr_s = scaler.fit_transform(X_tr)
    X_te_s = scaler.transform(X_te)

    mlp = MLPRegressor(
        hidden_layer_sizes=(64, 32),
        activation="relu",
        solver="adam",
        alpha=0.001,  # L2
        max_iter=1000,
        early_stopping=True,
        validation_fraction=0.1,
        n_iter_no_change=20,
        random_state=42,
    )
    mlp.fit(X_tr_s, y_tr)
    pred = mlp.predict(X_te_s)
    return {
        "RMSE": np.sqrt(mean_squared_error(y_te, pred)),
        "MAE": mean_absolute_error(y_te, pred),
        "R2": r2_score(y_te, pred),
        "n_iter": mlp.n_iter_,
    }


# ---------- 6) 물가 상호작용 재설계 ----------

def add_interaction_variants(df: pd.DataFrame) -> pd.DataFrame:
    """상호작용 재설계: 물가×성장률, 물가×(lag1비중-lag4비중)"""
    df = df.copy()
    if "물가상승률" in df.columns and "성장률" in df.columns:
        df["물가_x_성장률"] = df["물가상승률"].fillna(0) * df["성장률"].fillna(0)
    if "물가상승률" in df.columns and "lag1_비중" in df.columns and "lag4_비중" in df.columns:
        df["물가_x_비중변화"] = df["물가상승률"].fillna(0) * (df["lag1_비중"].fillna(0) - df["lag4_비중"].fillna(0))
    return df


def exp6_interaction_redesign(
    train_df: pd.DataFrame,
    test_df: pd.DataFrame,
    base_cols: list[str],
) -> pd.DataFrame:
    """
    물가_x_lag1비중 대신 물가_x_성장률, 물가_x_비중변화 추가 후 비교
    """
    train_df = add_interaction_variants(train_df)
    test_df = add_interaction_variants(test_df)

    variants = [
        ("기존_물가_x_lag1비중", [c for c in base_cols if c != "물가_x_성장률" and c != "물가_x_비중변화"]),
        ("물가_x_성장률", [c for c in base_cols if c != "물가_x_lag1비중"] + ["물가_x_성장률"]),
        ("물가_x_비중변화", [c for c in base_cols if c != "물가_x_lag1비중"] + ["물가_x_비중변화"]),
    ]
    rows = []
    for name, cols in variants:
        cols = [c for c in cols if c in train_df.columns and c in test_df.columns]
        if not cols:
            continue
        X_tr, y_tr = _prepare(train_df, cols)
        X_te, y_te = _prepare(test_df, cols)
        lr = LinearRegression().fit(X_tr, y_tr)
        pred = lr.predict(X_te)
        rows.append({"상호작용": name, "RMSE": np.sqrt(mean_squared_error(y_te, pred)), "R2": r2_score(y_te, pred)})
    return pd.DataFrame(rows)
