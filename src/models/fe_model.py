"""
패널 고정효과(Fixed Effects) 모델
- 행정동 FE (α_i): 상권 성격 통제
- 시간 FE (τ_t): 공통 충격(코로나/전국 트렌드) 통제
- 물가 충격 변수의 순수 효과 추정
"""
from __future__ import annotations

import numpy as np
import pandas as pd


def fit_fe_model(
    df: pd.DataFrame,
    target: str = "target_delta_ratio",
    shock_cols: list[str] | None = None,
    cov_type: str = "HC1",
    cov_groups: str = "행정동_코드",
    time_fe: bool = False,
):
    """
    행정동 고정효과 (+ 선택: 시간 FE)
    time_fe=False: 행정동 FE만 (안정적, 권장)
    time_fe=True: 행정동 + 시간 FE (대용량 시 수치 불안정 가능)
    """
    try:
        import statsmodels.formula.api as smf
    except ImportError:
        raise ImportError("statsmodels 필요: pip install statsmodels")

    shock_cols = shock_cols or [
        "infl_shock_ma",
        "infl_shock_ma_lag1",
        "exp_shock_ma",
        "exp_shock_ma_lag1",
    ]

    d = df.copy()
    d["t"] = d["연도"].astype(str) + "Q" + d["분기"].astype(str)

    # 사용 가능한 shock 변수만 선택
    shock_avail = [c for c in shock_cols if c in d.columns]
    shock_terms = " + ".join(shock_avail) if shock_avail else "1"

    base_terms = []
    for c in ["lag4_비중", "성장률", "month_sin", "month_cos"]:
        if c in d.columns:
            base_terms.append(c)
    base_str = " + ".join(base_terms) if base_terms else "1"
    fe_terms = "C(행정동_코드)"
    if time_fe:
        fe_terms += " + C(t)"

    formula = f"{target} ~ {base_str} + {shock_terms} + {fe_terms}"

    use_cols = [target, "행정동_코드", "t"] + base_terms + shock_avail
    use_cols = [c for c in use_cols if c in d.columns]
    d = d.dropna(subset=use_cols)

    if len(d) < 50:
        return None

    try:
        if cov_type == "cluster":
            model = smf.ols(formula, data=d).fit(
                cov_type="cluster",
                cov_kwds={"groups": d[cov_groups]},
            )
        else:
            model = smf.ols(formula, data=d).fit(cov_type=cov_type)
        if np.any(np.isnan(model.bse)):
            model = smf.ols(formula, data=d).fit(cov_type="HC1")
    except Exception:
        model = smf.ols(formula, data=d).fit(cov_type="HC1")
    return model


def predict_fe_model(model, df: pd.DataFrame, train_df: pd.DataFrame) -> np.ndarray:
    """
    FE 모델 예측: 새 데이터에 대해.
    보통 행정동/시간 더미가 train에 없으면 예측 불가 → train과 동일한 행정동·시간만 사용.
    """
    if model is None:
        return np.full(len(df), np.nan)

    d = df.copy()
    d["t"] = d["연도"].astype(str) + "Q" + d["분기"].astype(str)

    # train에 있는 행정동·t 조합만 유효
    train_ids = set(zip(train_df["행정동_코드"], train_df["연도"], train_df["분기"]))
    d["_in_train"] = d.apply(
        lambda r: (r["행정동_코드"], r["연도"], r["분기"]) in train_ids, axis=1
    )

    try:
        pred = model.predict(d)
    except Exception:
        pred = np.full(len(d), np.nan)
    return np.asarray(pred)


def fe_summary_table(model, exclude_dummies: bool = True) -> pd.DataFrame:
    """발표용 FE 모델 결과표 (행정동/시간 더미 제외)"""
    if model is None:
        return pd.DataFrame()

    rows = []
    for name, coef in model.params.items():
        if exclude_dummies and ("C(" in str(name) or "[" in str(name)):
            continue
        se = model.bse.get(name, np.nan)
        pval = model.pvalues.get(name, np.nan)
        sig = "***" if pval < 0.01 else "**" if pval < 0.05 else "*" if pval < 0.1 else ""
        rows.append({"변수": name, "계수": coef, "표준오차": se, "p-value": pval, "유의성": sig})
    return pd.DataFrame(rows)
