"""
월별 전국 거시 변수 3종 → 분기별 테이블 (연도, 분기) 변환
- 소비자물가지수(CPI)
- 월별 소비자물가 등락률(인플레이션 MoM)
- 기대인플레이션율

엑셀 구조(와이드 포맷): 월이 컬럼으로 펼쳐져 있음.
"""
from __future__ import annotations

import pandas as pd
import numpy as np
from pathlib import Path


def _parse_yyyymm(s: str) -> str:
    """'2017.01', '2017.010', '2018.07' → '201701'"""
    s = str(s).replace(".", "").replace(" ", "")
    digits = "".join(c for c in s if c.isdigit())
    return digits[:6] if len(digits) >= 6 else ""


def _monthly_to_quarterly(series: pd.Series, agg: str = "mean") -> pd.DataFrame:
    """
    월별 시계열(date index) → 분기별 (연도, 분기)
    agg: 'mean' (분기평균) 또는 'last' (분기말)
    """
    s = series.dropna()
    if s.empty:
        return pd.DataFrame(columns=["연도", "분기", "value"])
    if agg == "last":
        q = s.resample("QE").last()
    else:
        q = s.resample("QE").mean()
    out = q.reset_index()
    out["연도"] = out["date"].dt.year
    out["분기"] = out["date"].dt.quarter
    return out[["연도", "분기", "value"]]


def load_cpi_wide(path: str | Path, sheet_name: str | int = 0) -> pd.DataFrame:
    """
    소비자물가지수_10년.xlsx
    - Row 0: 시도별, 2017.010, 2017.020, ...
    - Row 1: 전국, CPI 값
    - 반환: (date, value) 월별 시리즈
    """
    df = pd.read_excel(path, sheet_name=sheet_name, header=None)
    dates = df.iloc[0, 1:].astype(str)
    values = df.iloc[1, 1:]

    rows = []
    for d, v in zip(dates, values):
        yyyymm = _parse_yyyymm(d)
        if len(yyyymm) != 6:
            continue
        try:
            dt = pd.to_datetime(yyyymm, format="%Y%m")
            val = pd.to_numeric(v, errors="coerce")
            if not np.isnan(val):
                rows.append({"date": dt, "value": val})
        except Exception:
            continue
    out = pd.DataFrame(rows)
    if out.empty:
        return pd.Series(dtype=float)
    return out.set_index("date")["value"]


def load_inflation_mom_wide(path: str | Path, sheet_name: str | int = 0) -> pd.Series:
    """
    월별_소비자물가_등락률_10년.xlsx
    - Row 0: 지수종류, 2017.01, 2017.01, 2017.01, 2017.02, ... (월당 3열: 전월비, 전년동월비, 전년누계비)
    - Row 1: 지수종류, 전월비(%), 전년동월비(%), ...
    - Row 2: 총지수 값
    - 전월비(MoM) 사용 → inflation_mom
    """
    df = pd.read_excel(path, sheet_name=sheet_name, header=None)
    row_meta = df.iloc[1, 1:]
    row_values = df.iloc[2, 1:]

    # 매 3열마다 첫 번째 = 전월비(%)
    rows = []
    i = 0
    while i + 2 < len(row_meta):
        date_str = str(df.iloc[0, i + 1])
        yyyymm = _parse_yyyymm(date_str)
        if len(yyyymm) == 6:
            try:
                dt = pd.to_datetime(yyyymm, format="%Y%m")
                val = pd.to_numeric(row_values.iloc[i], errors="coerce")
                if not np.isnan(val):
                    rows.append({"date": dt, "value": val})
            except Exception:
                pass
        i += 3

    out = pd.DataFrame(rows)
    if out.empty:
        return pd.Series(dtype=float)
    return out.set_index("date")["value"]


def load_expected_inflation_wide(path: str | Path, sheet_name: str | int = 0) -> pd.Series:
    """
    기대인플레이션율_전국_10년.xlsx
    - Row 0: CSI코드별, 2017.01, 2017.02, ...
    - Row 1: 물가인식(지난 1년), 값들
    """
    df = pd.read_excel(path, sheet_name=sheet_name, header=None)
    dates = df.iloc[0, 1:].astype(str)
    values = df.iloc[1, 1:]

    rows = []
    for d, v in zip(dates, values):
        yyyymm = _parse_yyyymm(d)
        if len(yyyymm) != 6:
            continue
        try:
            dt = pd.to_datetime(yyyymm, format="%Y%m")
            val = pd.to_numeric(v, errors="coerce")
            if not np.isnan(val):
                rows.append({"date": dt, "value": val})
        except Exception:
            continue
    out = pd.DataFrame(rows)
    if out.empty:
        return pd.Series(dtype=float)
    return out.set_index("date")["value"]


def _resolve_path(base: Path, name: str) -> Path:
    """base에 없으면 ~/Downloads 시도"""
    p = base / name
    if p.exists():
        return p
    alt = Path.home() / "Downloads" / name
    return alt if alt.exists() else p


def build_macro_quarterly(
    path_cpi: str | Path | None = None,
    path_mom: str | Path | None = None,
    path_expected: str | Path | None = None,
    data_dir: str | Path = "data/raw",
    agg: str = "mean",
) -> pd.DataFrame:
    """
    3개 엑셀에서 분기별 거시변수 테이블 생성.

    반환 컬럼: 연도, 분기, CPI, inflation_mom, expected_inflation[, CPI_qoq, CPI_yoy]

    path_* 가 None 이면 data_dir 하위 기본 파일명 사용. 없으면 ~/Downloads 확인.
    """
    data_dir = Path(data_dir)
    default_names = {
        "path_cpi": "소비자물가지수_10년.xlsx",
        "path_mom": "월별_소비자물가_등락률_10년.xlsx",
        "path_expected": "기대인플레이션율_전국_10년.xlsx",
    }
    path_cpi = path_cpi or _resolve_path(data_dir, default_names["path_cpi"])
    path_mom = path_mom or _resolve_path(data_dir, default_names["path_mom"])
    path_expected = path_expected or _resolve_path(data_dir, default_names["path_expected"])

    macro_q = None

    if Path(path_cpi).exists():
        cpi_m = load_cpi_wide(path_cpi)
        if not cpi_m.empty:
            cpi_q = _monthly_to_quarterly(cpi_m, agg=agg).rename(columns={"value": "CPI"})
            macro_q = cpi_q

    if Path(path_mom).exists():
        mom_m = load_inflation_mom_wide(path_mom)
        if not mom_m.empty:
            mom_q = _monthly_to_quarterly(mom_m, agg=agg).rename(columns={"value": "inflation_mom"})
            if macro_q is None:
                macro_q = mom_q
            else:
                macro_q = macro_q.merge(mom_q, on=["연도", "분기"], how="outer")

    if Path(path_expected).exists():
        exp_m = load_expected_inflation_wide(path_expected)
        if not exp_m.empty:
            exp_q = _monthly_to_quarterly(exp_m, agg=agg).rename(columns={"value": "expected_inflation"})
            if macro_q is None:
                macro_q = exp_q
            else:
                macro_q = macro_q.merge(exp_q, on=["연도", "분기"], how="outer")

    if macro_q is None:
        return pd.DataFrame(columns=["연도", "분기", "CPI", "inflation_mom", "expected_inflation"])

    macro_q = macro_q.sort_values(["연도", "분기"]).reset_index(drop=True)

    # CPI 기준 분기 인플레이션 (선택)
    if "CPI" in macro_q.columns:
        macro_q["CPI_qoq"] = macro_q["CPI"].pct_change(1)
        macro_q["CPI_yoy"] = macro_q["CPI"].pct_change(4)

    return macro_q
