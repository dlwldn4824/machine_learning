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
    if add_growth:
        df = add_growth_rate(df)
    if add_season:
        df = add_seasonality(df)

    # lag/성장률에서 생긴 결측 제거 (옵션: dropna)
    return df
