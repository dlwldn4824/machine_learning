"""
ML용 전처리: 비율화, 로그변환, Lag, 계절성, 성장률
"""
import numpy as np
import pandas as pd
from pathlib import Path


def add_dessert_ratio(
    df: pd.DataFrame,
    raw_data_dir: str | Path = "data/raw",
) -> pd.DataFrame:
    """
    디저트 비중 = (카페+제과점 매출 합계) / 전체 상권 매출
    행정동×분기 단위
    """
    from .load_dessert import load_raw_data, DESSERT_CATEGORIES, INDUSTRY_COL

    raw = load_raw_data(raw_data_dir)
    raw["연도"] = raw["기준_년분기_코드"].astype(str).str[:4].astype(int)
    raw["분기"] = raw["기준_년분기_코드"].astype(str).str[-1].astype(int)

    # 전체 매출 (행정동×연도×분기)
    total = (
        raw.groupby(["행정동_코드", "연도", "분기"])["당월_매출_금액"]
        .sum()
        .reset_index()
        .rename(columns={"당월_매출_금액": "전체_매출"})
    )

    # 디저트 매출 합계
    dessert = (
        raw[raw[INDUSTRY_COL].isin(DESSERT_CATEGORIES)]
        .groupby(["행정동_코드", "연도", "분기"])["당월_매출_금액"]
        .sum()
        .reset_index()
        .rename(columns={"당월_매출_금액": "디저트_매출"})
    )

    ratio_df = total.merge(dessert, on=["행정동_코드", "연도", "분기"])
    ratio_df["디저트_비중"] = (ratio_df["디저트_매출"] / ratio_df["전체_매출"]).fillna(0).clip(0, 1)

    df = df.merge(
        ratio_df[["행정동_코드", "연도", "분기", "디저트_비중"]],
        on=["행정동_코드", "연도", "분기"],
        how="left",
    )
    df["디저트_비중"] = df["디저트_비중"].fillna(0)
    return df


def add_log_transform(df: pd.DataFrame, cols: list[str] | None = None) -> pd.DataFrame:
    """log(x + 1) 변환 - 분산 안정화"""
    df = df.copy()
    if cols is None:
        cols = ["당월_매출_금액"]
    for c in cols:
        if c in df.columns:
            df[f"log_{c}"] = np.log1p(df[c])
    return df


def add_lag_features(
    df: pd.DataFrame,
    value_col: str = "당월_매출_금액",
    lags: tuple[int, ...] = (1, 4),
) -> pd.DataFrame:
    """
    Lag 변수: lag1=전분기, lag4=전년 동분기
    행정동별 시계열 정렬 후 생성
    """
    df = df.copy()
    df = df.sort_values(["행정동_코드", "연도", "분기"]).reset_index(drop=True)

    for lag in lags:
        df[f"lag{lag}"] = df.groupby("행정동_코드")[value_col].shift(lag)

    return df


def add_lag_ratio(df: pd.DataFrame, value_col: str = "디저트_비중", lags: tuple[int, ...] = (1, 4)) -> pd.DataFrame:
    """
    디저트_비중의 Lag (타겟 예측 시 현재 비중 제외, 과거 비중만 사용)
    lag1_비중=전분기, lag4_비중=전년 동분기
    """
    df = df.copy()
    df = df.sort_values(["행정동_코드", "연도", "분기"]).reset_index(drop=True)
    for lag in lags:
        df[f"lag{lag}_비중"] = df.groupby("행정동_코드")[value_col].shift(lag)
    return df


def add_growth_rate(df: pd.DataFrame, value_col: str = "당월_매출_금액") -> pd.DataFrame:
    """전분기 대비 성장률 = (이번 - 지난) / 지난"""
    df = df.copy()
    prev = df.groupby("행정동_코드")[value_col].shift(1)
    df["성장률"] = (df[value_col] - prev) / prev.replace(0, np.nan)
    df["성장률"] = df["성장률"].fillna(0).replace([np.inf, -np.inf], 0)
    return df


def add_seasonality(df: pd.DataFrame) -> pd.DataFrame:
    """분기(1~4) → 월(3,6,9,12)로 환산 후 sin/cos 인코딩"""
    df = df.copy()
    q_to_month = {1: 3, 2: 6, 3: 9, 4: 12}
    df["월"] = df["분기"].map(q_to_month)
    df["month_sin"] = np.sin(2 * np.pi * df["월"] / 12)
    df["month_cos"] = np.cos(2 * np.pi * df["월"] / 12)
    return df


def preprocess_ml(
    df: pd.DataFrame,
    raw_data_dir: str | Path = "data/raw",
    add_ratio: bool = True,
    add_log: bool = True,
    add_lag: bool = True,
    add_growth: bool = True,
    add_season: bool = True,
) -> pd.DataFrame:
    """
    ML 전처리 파이프라인
    - 디저트 비중
    - log(매출+1)
    - lag1, lag4
    - 성장률
    - month_sin, month_cos
    """
    if add_ratio:
        df = add_dessert_ratio(df, raw_data_dir)
    if add_log:
        df = add_log_transform(df)
    if add_lag:
        df = add_lag_features(df, lags=(1, 4))
    if add_ratio:
        df = add_lag_ratio(df, lags=(1, 4))  # lag1_비중, lag4_비중
    if add_growth:
        df = add_growth_rate(df)
    if add_season:
        df = add_seasonality(df)

    return df


def add_target(
    df: pd.DataFrame,
    value_col: str = "디저트_비중",
    shift: int = -1,
) -> pd.DataFrame:
    """
    시계열 타겟 생성: 다음 분기 값 예측
    shift=-1 → 다음 분기 디저트_비중
    """
    df = df.copy()
    df = df.sort_values(["행정동_코드", "연도", "분기"]).reset_index(drop=True)
    df["target"] = df.groupby("행정동_코드")[value_col].shift(shift)
    return df


def add_delta_targets(
    df: pd.DataFrame,
    ratio_col: str = "디저트_비중",
    forecast: bool = True,
) -> pd.DataFrame:
    """
    타겟을 "비중 변화량(Δ)"으로 추가.
    관성이 빠져서 물가 신호가 더 잘 보임.

    forecast=True:  예측용 → 다음 분기 변화 (ratio_{t+1} - ratio_t)
    forecast=False: 설명용 → 당분기 변화 (ratio_t - ratio_{t-1})
    """
    df = df.sort_values(["행정동_코드", "연도", "분기"]).copy()
    prev = df.groupby("행정동_코드")[ratio_col].shift(1)
    next_ = df.groupby("행정동_코드")[ratio_col].shift(-1)

    if forecast:
        # (A) 예측 타겟: 다음 분기 - 이번 분기
        df["target_delta_ratio"] = next_ - df[ratio_col]
    else:
        # (A) 당분기 변화량: 이번 분기 - 전분기
        df["target_delta_ratio"] = df[ratio_col] - prev

    # (B) 변화율(선택): (이번-전분기)/전분기
    df["target_growth_ratio"] = (df[ratio_col] - prev) / prev.replace(0, np.nan)
    df["target_growth_ratio"] = df["target_growth_ratio"].replace([np.inf, -np.inf], np.nan)

    return df


def add_inflation_shocks(
    df: pd.DataFrame,
    col_qoq: str | None = None,
    col_exp: str | None = None,
    window: int = 4,
) -> pd.DataFrame:
    """
    물가 "충격(Shock)" 변수: 예상보다 더 오른 구간(서프라이즈).
    - Shock A (de-mean): 현재 − 최근 1년 평균
    - Shock B (z-score): (현재 − 평균) / 표준편차
    - Shock C (가속): 이번 qoq − 이전 qoq
    """
    df = df.copy()
    col_qoq = col_qoq or ("CPI_qoq" if "CPI_qoq" in df.columns else "물가상승률")
    col_exp = col_exp or "expected_inflation"
    if col_qoq not in df.columns:
        return df

    qcols = ["연도", "분기", col_qoq]
    if col_exp in df.columns:
        qcols.append(col_exp)
    tmp = (
        df.drop_duplicates(["연도", "분기"])[qcols]
        .sort_values(["연도", "분기"])
        .copy()
    )

    tmp["qoq_ma4"] = tmp[col_qoq].rolling(window).mean().shift(1)
    tmp["qoq_std4"] = tmp[col_qoq].rolling(window).std().shift(1)

    tmp["infl_shock_ma"] = tmp[col_qoq] - tmp["qoq_ma4"]
    tmp["infl_shock_z"] = (tmp[col_qoq] - tmp["qoq_ma4"]) / tmp["qoq_std4"].replace(0, np.nan)
    tmp["infl_accel"] = tmp[col_qoq] - tmp[col_qoq].shift(1)

    merge_cols = ["연도", "분기", "infl_shock_ma", "infl_shock_z", "infl_accel"]

    if col_exp in tmp.columns:
        tmp["exp_ma4"] = tmp[col_exp].rolling(window).mean().shift(1)
        tmp["exp_shock_ma"] = tmp[col_exp] - tmp["exp_ma4"]
        merge_cols.append("exp_shock_ma")

    df = df.merge(tmp[merge_cols], on=["연도", "분기"], how="left")

    # 지연효과 (한 분기 늦게 반응)
    for c in ["infl_shock_ma", "infl_shock_z", "infl_accel"]:
        if c in df.columns:
            df[f"{c}_lag1"] = df.groupby("행정동_코드")[c].shift(1)
    if "exp_shock_ma" in df.columns:
        df["exp_shock_ma_lag1"] = df.groupby("행정동_코드")["exp_shock_ma"].shift(1)

    return df


def clip_outliers(df: pd.DataFrame, cols: list[str], iqr_factor: float = 1.5) -> pd.DataFrame:
    """IQR 방식 이상치 클리핑"""
    df = df.copy()
    for col in cols:
        if col not in df.columns:
            continue
        q1 = df[col].quantile(0.25)
        q3 = df[col].quantile(0.75)
        iqr = q3 - q1
        lower = q1 - iqr_factor * iqr
        upper = q3 + iqr_factor * iqr
        df[col] = df[col].clip(lower, upper)
    return df


def create_cluster_features(df: pd.DataFrame) -> pd.DataFrame:
    """군집 분석용 행정동 단위 피처 (k-means 등)"""
    agg = df.groupby("행정동_코드").agg(
        매출_mean=("당월_매출_금액", "mean"),
        매출_std=("당월_매출_금액", "std"),
        성장률_mean=("성장률", "mean"),
        디저트_비중_mean=("디저트_비중", "mean"),
    ).reset_index()
    agg["매출_std"] = agg["매출_std"].fillna(0)
    return agg


def time_split(
    df: pd.DataFrame,
    test_year: int = 2024,
) -> tuple[pd.DataFrame, pd.DataFrame]:
    """시계열 기반 Train/Test 분리 (연도 기준)"""
    train = df[df["연도"] < test_year].copy()
    test = df[df["연도"] >= test_year].copy()
    return train, test


def add_cpi(
    df: pd.DataFrame,
    cpi_path: str | Path | None = None,
    data_dir: str | Path = "data/raw",
    inflation_excel_paths: dict | None = None,
) -> pd.DataFrame:
    """
    CPI·인플레이션·기대인플레이션 변수 병합.

    우선순위:
    1) 3개 엑셀(소비자물가지수, 월별 등락률, 기대인플레이션)이 있으면 → build_macro_quarterly로 분기 테이블 생성
    2) data/cpi.csv 또는 data/cpi_example.csv
    3) KOSIS 기반 예시값

    병합 컬럼: CPI, inflation_mom, expected_inflation, CPI_qoq, CPI_yoy, 물가상승률(CPI_qoq 또는 fallback)
    """
    df = df.copy()
    cpi_path = Path(cpi_path) if cpi_path else Path("data/cpi.csv")
    alt_path = Path("data/cpi_example.csv")
    data_dir = Path(data_dir)

    # 1) 3개 엑셀 기반 분기 거시변수
    try:
        from .load_inflation import build_macro_quarterly

        paths = inflation_excel_paths or {}
        macro = build_macro_quarterly(
            path_cpi=paths.get("cpi") or data_dir / "소비자물가지수_10년.xlsx",
            path_mom=paths.get("mom") or data_dir / "월별_소비자물가_등락률_10년.xlsx",
            path_expected=paths.get("expected") or data_dir / "기대인플레이션율_전국_10년.xlsx",
            data_dir=data_dir,
        )
        if len(macro) > 0:
            # 물가상승률: CPI_qoq(분기 대비) 사용, 없으면 inflation_mom/100
            if "CPI_qoq" in macro.columns:
                macro["물가상승률"] = macro["CPI_qoq"]
            elif "inflation_mom" in macro.columns:
                macro["물가상승률"] = macro["inflation_mom"] / 100
            else:
                macro["물가상승률"] = np.nan
            df = df.merge(macro, on=["연도", "분기"], how="left")
            if "lag1_비중" in df.columns:
                df["물가_x_lag1비중"] = df["물가상승률"].fillna(0) * df["lag1_비중"].fillna(0)
            return df
    except Exception:
        pass

    # 2) 기존 cpi.csv / cpi_example.csv
    if cpi_path.exists():
        cpi = pd.read_csv(cpi_path)
    elif alt_path.exists():
        cpi = pd.read_csv(alt_path)
    else:
        rows = []
        for y in range(2020, 2025):
            rate = {2020: 0.5, 2021: 2.5, 2022: 5.1, 2023: 3.6, 2024: 2.2}.get(y, 2.0) / 100 / 4
            for q in range(1, 5):
                rows.append({"연도": y, "분기": q, "물가상승률": rate})
        cpi = pd.DataFrame(rows)
    df = df.merge(cpi, on=["연도", "분기"], how="left")
    if "lag1_비중" in df.columns:
        df["물가_x_lag1비중"] = df["물가상승률"].fillna(0) * df["lag1_비중"].fillna(0)
    return df


def calculate_vif(df: pd.DataFrame, cols: list[str]) -> pd.DataFrame:
    """다중공선성: VIF 계산 (VIF>10 이면 제거 고려)"""
    try:
        from statsmodels.stats.outliers_influence import variance_inflation_factor
    except ImportError:
        raise ImportError("statsmodels 필요: pip install statsmodels")

    X = df[cols].dropna()
    vif = pd.DataFrame()
    vif["feature"] = X.columns
    vif["VIF"] = [variance_inflation_factor(X.values.astype(float), i) for i in range(X.shape[1])]
    return vif.sort_values("VIF", ascending=False)
