"""
dessert_2020_2024.csv vs 소비자물가(CPI) 상관관계 분석
- 분기별 디저트 매출·비중 집계
- CPI, inflation_mom, expected_inflation과 상관분석
- 산점도, 상관행렬, 시계열 비교 시각화
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import matplotlib.font_manager as fm
import seaborn as sns

plt.rcParams["axes.unicode_minus"] = False
for f in fm.fontManager.ttflist:
    if "AppleGothic" in f.name or "Nanum" in f.name or "Malgun" in f.name:
        plt.rcParams["font.family"] = f.name
        break
else:
    plt.rcParams["font.family"] = "DejaVu Sans"

FIG_DIR = Path("outputs/figures/correlation")
CSV_DIR = Path("outputs/correlation")
FIG_DIR.mkdir(parents=True, exist_ok=True)
CSV_DIR.mkdir(parents=True, exist_ok=True)


def main():
    # 1. 디저트 데이터 로드 (dessert_2020_2024 또는 dessert_ml_ready)
    dessert_path = Path("data/processed/dessert_2020_2024.csv")
    ml_path = Path("data/processed/dessert_ml_ready.csv")
    if ml_path.exists() and "디저트_비중" in pd.read_csv(ml_path, nrows=1).columns:
        df_dessert = pd.read_csv(ml_path)
        has_ratio = True
    else:
        df_dessert = pd.read_csv(dessert_path)
        has_ratio = False

    print("1. 디저트 데이터 로드")
    print(f"   행 수: {len(df_dessert):,}, 컬럼: {list(df_dessert.columns[:8])}...")

    # 2. 분기별 집계
    agg = df_dessert.groupby(["연도", "분기"]).agg(
        총_디저트_매출=("당월_매출_금액", "sum"),
        평균_디저트_매출=("당월_매출_금액", "mean"),
        행정동_수=("당월_매출_금액", "count"),
    ).reset_index()
    if has_ratio and "디저트_비중" in df_dessert.columns:
        ratio_agg = df_dessert.groupby(["연도", "분기"])["디저트_비중"].mean().reset_index().rename(columns={"디저트_비중": "평균_디저트_비중"})
        agg = agg.merge(ratio_agg, on=["연도", "분기"], how="left")
    agg["연분기"] = agg["연도"].astype(str) + "-Q" + agg["분기"].astype(str)

    print(f"   분기별 집계: {len(agg)}개 연분기")

    # 3. 소비자물가 분기 테이블 로드
    from src.data.load_inflation import build_macro_quarterly, _resolve_path

    data_dir = Path("data/raw")
    path_cpi = _resolve_path(data_dir, "소비자물가지수_10년.xlsx")
    path_mom = _resolve_path(data_dir, "월별_소비자물가_등락률_10년.xlsx")
    path_expected = _resolve_path(data_dir, "기대인플레이션율_전국_10년.xlsx")
    macro = build_macro_quarterly(path_cpi=path_cpi, path_mom=path_mom, path_expected=path_expected, data_dir=data_dir)

    if macro.empty:
        print("   경고: 소비자물가 엑셀이 없습니다. cpi_example 또는 예시값 사용.")
        cpi_ex = Path("data/cpi_example.csv")
        if cpi_ex.exists():
            macro = pd.read_csv(cpi_ex)
            if "물가상승률" in macro.columns and "연도" in macro.columns and "분기" in macro.columns:
                pass
            else:
                print("   cpi_example 형식 확인 필요.")
                return
        else:
            rows = []
            for y in range(2020, 2025):
                for q in range(1, 5):
                    r = {2020: 0.5, 2021: 2.5, 2022: 5.1, 2023: 3.6, 2024: 2.2}.get(y, 2.0) / 100 / 4
                    rows.append({"연도": y, "분기": q, "CPI": 100 + (y - 2020) * 2.5 + q * 0.2, "inflation_mom": r * 100, "expected_inflation": 2.5})
            macro = pd.DataFrame(rows)

    # 4. 병합
    merged = agg.merge(macro, on=["연도", "분기"], how="inner")
    print(f"\n2. 병합 후: {len(merged)}개 연분기")

    # 5. 상관분석
    num_cols = ["총_디저트_매출", "평균_디저트_매출"] + (["평균_디저트_비중"] if "평균_디저트_비중" in merged.columns else [])
    cpi_cols = [c for c in ["CPI", "inflation_mom", "expected_inflation", "CPI_qoq", "CPI_yoy"] if c in merged.columns]
    analyze_cols = num_cols + cpi_cols
    analyze_cols = [c for c in analyze_cols if c in merged.columns]
    corr = merged[analyze_cols].corr()

    print("\n3. 상관계수 (디저트 vs 물가)")
    sub = corr.loc[num_cols, cpi_cols] if cpi_cols else corr
    print(sub.to_string())

    # 6. 시각화
    # 6-1. 상관행렬 히트맵
    fig, ax = plt.subplots(figsize=(10, 8))
    sns.heatmap(corr, annot=True, fmt=".2f", cmap="RdYlBu_r", center=0, ax=ax, vmin=-0.8, vmax=0.8)
    ax.set_title("디저트 매출·비중 vs 소비자물가 상관행렬")
    plt.tight_layout()
    plt.savefig(FIG_DIR / "dessert_cpi_correlation_heatmap.png", dpi=120, bbox_inches="tight")
    plt.close()
    print(f"\n저장: {FIG_DIR / 'dessert_cpi_correlation_heatmap.png'}")

    # 6-2. CPI vs 총 디저트 매출 산점도
    fig, ax = plt.subplots(figsize=(8, 6))
    ax.scatter(merged["CPI"], merged["총_디저트_매출"] / 1e9, c=merged["연도"], cmap="viridis", s=80, alpha=0.8)
    for i, row in merged.iterrows():
        ax.annotate(row["연분기"], (row["CPI"], row["총_디저트_매출"] / 1e9), fontsize=7, alpha=0.7)
    ax.set_xlabel("CPI (소비자물가지수)")
    ax.set_ylabel("총 디저트 매출 (억원)")
    ax.set_title("CPI vs 총 디저트 매출 (분기별)")
    plt.colorbar(ax.collections[0], ax=ax, label="연도")
    plt.tight_layout()
    plt.savefig(FIG_DIR / "dessert_cpi_scatter.png", dpi=120, bbox_inches="tight")
    plt.close()
    print(f"저장: {FIG_DIR / 'dessert_cpi_scatter.png'}")

    # 6-3. 시계열 2축: CPI vs 총 디저트 매출
    fig, ax1 = plt.subplots(figsize=(12, 5))
    ax2 = ax1.twinx()
    x = range(len(merged))
    ax1.plot(x, merged["총_디저트_매출"] / 1e9, "b-o", label="총 디저트 매출(억)", linewidth=2)
    ax1.set_ylabel("총 디저트 매출 (억원)", color="b")
    ax1.tick_params(axis="y", labelcolor="b")
    if "CPI" in merged.columns:
        ax2.plot(x, merged["CPI"], "r-s", label="CPI", linewidth=2)
        ax2.set_ylabel("CPI", color="r")
        ax2.tick_params(axis="y", labelcolor="r")
    ax1.set_xticks(x)
    ax1.set_xticklabels(merged["연분기"], rotation=45, ha="right")
    ax1.set_xlabel("연분기")
    ax1.set_title("디저트 매출 vs CPI 시계열")
    ax1.legend(loc="upper left")
    if "CPI" in merged.columns:
        ax2.legend(loc="upper right")
    ax1.grid(alpha=0.3)
    plt.tight_layout()
    plt.savefig(FIG_DIR / "dessert_cpi_timeseries.png", dpi=120, bbox_inches="tight")
    plt.close()
    print(f"저장: {FIG_DIR / 'dessert_cpi_timeseries.png'}")

    # 6-4. 물가상승률(또는 CPI_qoq) vs 디저트 매출 성장률
    merged_sorted = merged.sort_values(["연도", "분기"])
    merged_sorted["매출_성장률"] = merged_sorted["총_디저트_매출"].pct_change(1)
    plot_df = merged_sorted.dropna(subset=["매출_성장률"])
    infl_col = "CPI_qoq" if "CPI_qoq" in plot_df.columns else ("물가상승률" if "물가상승률" in plot_df.columns else "inflation_mom")
    if infl_col in plot_df.columns:
        if infl_col == "inflation_mom":
            plot_df = plot_df.copy()
            plot_df[infl_col] = plot_df[infl_col] / 100
        fig, ax = plt.subplots(figsize=(8, 6))
        ax.scatter(plot_df[infl_col] * 100, plot_df["매출_성장률"] * 100, s=60, c="#667eea", alpha=0.8)
        for i, row in plot_df.iterrows():
            ax.annotate(row["연분기"], (row[infl_col] * 100, row["매출_성장률"] * 100), fontsize=7)
        ax.axhline(0, color="gray", ls="--")
        ax.axvline(0, color="gray", ls="--")
        ax.set_xlabel(f"{infl_col} (%)")
        ax.set_ylabel("디저트 매출 성장률 (%)")
        ax.set_title("물가 변동 vs 디저트 매출 성장률")
        plt.tight_layout()
        plt.savefig(FIG_DIR / "dessert_inflation_growth_scatter.png", dpi=120, bbox_inches="tight")
        plt.close()
        print(f"저장: {FIG_DIR / 'dessert_inflation_growth_scatter.png'}")

    # 7. 결과 저장 (CSV는 outputs/correlation/)
    corr.to_csv(CSV_DIR / "dessert_cpi_correlation.csv")
    merged.to_csv(CSV_DIR / "dessert_cpi_merged_quarterly.csv", index=False)
    print(f"\n저장: {CSV_DIR / 'dessert_cpi_correlation.csv'}, {CSV_DIR / 'dessert_cpi_merged_quarterly.csv'}")
    print("\n디저트-소비자물가 상관분석 완료.")


if __name__ == "__main__":
    main()
