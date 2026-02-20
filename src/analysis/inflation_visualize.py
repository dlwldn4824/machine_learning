"""소비자물가(CPI)·인플레이션 전처리 결과 시각화"""
import matplotlib.pyplot as plt
import matplotlib.font_manager as fm
import pandas as pd
import numpy as np
from pathlib import Path

plt.rcParams["axes.unicode_minus"] = False
for f in fm.fontManager.ttflist:
    if "AppleGothic" in f.name or "Nanum" in f.name or "Malgun" in f.name:
        plt.rcParams["font.family"] = f.name
        break
else:
    plt.rcParams["font.family"] = "DejaVu Sans"

OUT_DIR = Path("outputs/figures/inflation")


def plot_inflation_all(
    macro_q: pd.DataFrame,
    cpi_monthly: pd.Series | None = None,
    mom_monthly: pd.Series | None = None,
    expected_monthly: pd.Series | None = None,
    out_dir: Path | str = "outputs/figures/inflation",
) -> None:
    """소비자물가 전처리 결과 전체 시각화"""
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    if macro_q.empty:
        print("  경고: macro_q가 비어 있음. 시각화를 건너뜁니다.")
        return

    macro = macro_q.copy()
    macro["연분기"] = macro["연도"].astype(str) + "-Q" + macro["분기"].astype(str)

    # 1. CPI 시계열
    if "CPI" in macro.columns:
        fig, ax = plt.subplots(figsize=(14, 5))
        ax.plot(macro["연분기"], macro["CPI"], marker="o", color="#2563eb", linewidth=2, markersize=5)
        ax.fill_between(range(len(macro)), macro["CPI"], alpha=0.2)
        ax.set_xlabel("연분기")
        ax.set_ylabel("CPI (2015=100)")
        ax.set_title("분기별 소비자물가지수(CPI) 추이")
        plt.xticks(rotation=45)
        plt.tight_layout()
        plt.savefig(out_dir / "inflation_cpi_trend.png", dpi=120, bbox_inches="tight")
        plt.close()
        print(f"저장: {out_dir / 'inflation_cpi_trend.png'}")

    # 2. CPI_qoq, CPI_yoy 시계열
    if "CPI_qoq" in macro.columns and "CPI_yoy" in macro.columns:
        fig, axes = plt.subplots(2, 1, figsize=(14, 8), sharex=True)
        ax1, ax2 = axes
        x = range(len(macro))
        ax1.bar([i - 0.2 for i in x], macro["CPI_qoq"] * 100, width=0.4, label="CPI_qoq (분기대비 %)", color="#10b981", alpha=0.8)
        ax1.axhline(0, color="gray", linestyle="-", linewidth=0.5)
        ax1.set_ylabel("변동률 (%)")
        ax1.set_title("분기 대비 CPI 변동률 (QoQ)")
        ax1.legend(loc="upper right")
        ax1.grid(axis="y", alpha=0.3)

        ax2.bar([i + 0.2 for i in x], macro["CPI_yoy"] * 100, width=0.4, label="CPI_yoy (전년동기대비 %)", color="#f59e0b", alpha=0.8)
        ax2.axhline(0, color="gray", linestyle="-", linewidth=0.5)
        ax2.set_xlabel("연분기")
        ax2.set_ylabel("변동률 (%)")
        ax2.set_title("전년 동분기 대비 CPI 변동률 (YoY)")
        ax2.set_xticks(x)
        ax2.set_xticklabels(macro["연분기"], rotation=45, ha="right")
        ax2.legend(loc="upper right")
        ax2.grid(axis="y", alpha=0.3)
        plt.tight_layout()
        plt.savefig(out_dir / "inflation_cpi_qoq_yoy.png", dpi=120, bbox_inches="tight")
        plt.close()
        print(f"저장: {out_dir / 'inflation_cpi_qoq_yoy.png'}")

    # 3. inflation_mom (월별 등락률 → 분기 평균)
    if "inflation_mom" in macro.columns:
        fig, ax = plt.subplots(figsize=(14, 5))
        ax.bar(range(len(macro)), macro["inflation_mom"], color="#8b5cf6", alpha=0.8, edgecolor="white")
        ax.axhline(0, color="gray", linestyle="--")
        ax.set_xticks(range(len(macro)))
        ax.set_xticklabels(macro["연분기"], rotation=45, ha="right")
        ax.set_xlabel("연분기")
        ax.set_ylabel("inflation_mom (%, 전월비 분기평균)")
        ax.set_title("분기별 물가 등락률 (전월비 MoM, 분기 평균)")
        ax.grid(axis="y", alpha=0.3)
        plt.tight_layout()
        plt.savefig(out_dir / "inflation_mom.png", dpi=120, bbox_inches="tight")
        plt.close()
        print(f"저장: {out_dir / 'inflation_mom.png'}")

    # 4. expected_inflation (기대인플레이션)
    if "expected_inflation" in macro.columns:
        fig, ax = plt.subplots(figsize=(14, 5))
        ax.plot(macro["연분기"], macro["expected_inflation"], marker="o", color="#ec4899", linewidth=2, markersize=5)
        ax.fill_between(range(len(macro)), macro["expected_inflation"], alpha=0.2)
        ax.set_xticks(range(len(macro)))
        ax.set_xticklabels(macro["연분기"], rotation=45, ha="right")
        ax.set_xlabel("연분기")
        ax.set_ylabel("기대인플레이션율 (%)")
        ax.set_title("분기별 기대인플레이션율 (물가인식 지난 1년, 분기 평균)")
        ax.grid(axis="y", alpha=0.3)
        plt.tight_layout()
        plt.savefig(out_dir / "inflation_expected.png", dpi=120, bbox_inches="tight")
        plt.close()
        print(f"저장: {out_dir / 'inflation_expected.png'}")

    # 5. CPI vs 기대인플레이션 비교
    if "CPI" in macro.columns and "expected_inflation" in macro.columns:
        fig, ax1 = plt.subplots(figsize=(14, 5))
        ax2 = ax1.twinx()
        x = range(len(macro))
        ln1 = ax1.plot(x, macro["CPI"], "b-o", linewidth=2, label="CPI", markersize=4)
        ax1.set_ylabel("CPI", color="b")
        ax1.tick_params(axis="y", labelcolor="b")
        ln2 = ax2.plot(x, macro["expected_inflation"], "m-s", linewidth=2, label="기대인플레이션(%)", markersize=4)
        ax2.set_ylabel("기대인플레이션 (%)", color="m")
        ax2.tick_params(axis="y", labelcolor="m")
        ax1.set_xticks(x)
        ax1.set_xticklabels(macro["연분기"], rotation=45, ha="right")
        ax1.set_xlabel("연분기")
        ax1.set_title("CPI vs 기대인플레이션율 추이")
        lns = ln1 + ln2
        ax1.legend(lns, [l.get_label() for l in lns], loc="upper left")
        ax1.grid(axis="y", alpha=0.3)
        plt.tight_layout()
        plt.savefig(out_dir / "inflation_cpi_vs_expected.png", dpi=120, bbox_inches="tight")
        plt.close()
        print(f"저장: {out_dir / 'inflation_cpi_vs_expected.png'}")

    # 6. 물가상승률(최종 병합용)
    if "물가상승률" in macro.columns:
        fig, ax = plt.subplots(figsize=(14, 5))
        vals = macro["물가상승률"] * 100
        colors = ["#ef4444" if v < 0 else "#10b981" for v in vals]
        ax.bar(range(len(macro)), vals, color=colors, alpha=0.8)
        ax.axhline(0, color="gray", linestyle="-")
        ax.set_xticks(range(len(macro)))
        ax.set_xticklabels(macro["연분기"], rotation=45, ha="right")
        ax.set_xlabel("연분기")
        ax.set_ylabel("물가상승률 (CPI_qoq, %)")
        ax.set_title("최종 병합용 물가상승률 (CPI 분기대비)")
        ax.grid(axis="y", alpha=0.3)
        plt.tight_layout()
        plt.savefig(out_dir / "inflation_물가상승률.png", dpi=120, bbox_inches="tight")
        plt.close()
        print(f"저장: {out_dir / 'inflation_물가상승률.png'}")

    # 7. 월별 원본 시계열 (있는 경우)
    if cpi_monthly is not None and not cpi_monthly.empty:
        fig, ax = plt.subplots(figsize=(14, 4))
        ax.plot(cpi_monthly.index, cpi_monthly.values, color="#2563eb", alpha=0.8)
        ax.set_xlabel("날짜")
        ax.set_ylabel("CPI")
        ax.set_title("월별 소비자물가지수 (전처리 전 원본)")
        ax.grid(alpha=0.3)
        plt.xticks(rotation=45)
        plt.tight_layout()
        plt.savefig(out_dir / "inflation_cpi_monthly_raw.png", dpi=120, bbox_inches="tight")
        plt.close()
        print(f"저장: {out_dir / 'inflation_cpi_monthly_raw.png'}")
