"""디저트 소비 데이터 시각화"""
import matplotlib.pyplot as plt
import matplotlib.font_manager as fm
import pandas as pd
from pathlib import Path

plt.rcParams["axes.unicode_minus"] = False
# 한글 폰트 (맥 기본)
for f in fm.fontManager.ttflist:
    if "AppleGothic" in f.name or "Nanum" in f.name or "Malgun" in f.name:
        plt.rcParams["font.family"] = f.name
        break
else:
    plt.rcParams["font.family"] = "DejaVu Sans"


def plot_monthly_trend(df: pd.DataFrame, out_dir: Path | str = "outputs") -> None:
    """월별(분기별) 디저트 매출 추이 - 5개년 (데이터는 분기 단위)"""
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    # 분기 -> 대표 월 (3, 6, 9, 12)
    q_to_month = {1: 3, 2: 6, 3: 9, 4: 12}
    df = df.copy()
    df["대표월"] = df["분기"].map(q_to_month)
    df["년월"] = df["연도"].astype(str) + "-" + df["대표월"].astype(str).str.zfill(2)

    agg = df.groupby(["연도", "분기", "년월"])["당월_매출_금액"].sum().reset_index()
    agg["매출_억"] = agg["당월_매출_금액"] / 100_000_000

    fig, ax = plt.subplots(figsize=(16, 5))
    x = range(len(agg))
    ax.plot(x, agg["매출_억"], marker="o", color="#667eea", linewidth=2, markersize=5)
    ax.fill_between(x, agg["매출_억"], alpha=0.25)
    ax.set_xticks(x)
    ax.set_xticklabels(agg["년월"], rotation=45, ha="right")
    ax.set_xlabel("년월")
    ax.set_ylabel("매출 (억원)")
    ax.set_title("디저트(카페·제과점) 총 매출 추이 (2020~2024 분기별)")
    ax.grid(axis="y", alpha=0.3)
    plt.tight_layout()
    plt.savefig(out_dir / "monthly_trend.png", dpi=120, bbox_inches="tight")
    plt.close()
    print(f"저장: {out_dir / 'monthly_trend.png'}")


def plot_quarterly_trend(df: pd.DataFrame, out_dir: Path | str = "outputs") -> None:
    """연도·분기별 매출 추이 (라인)"""
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    df = df.copy()
    df["연분기"] = df["연도"].astype(str) + "-Q" + df["분기"].astype(str)
    agg = df.groupby("연분기")["당월_매출_금액"].sum().reset_index()
    agg["매출_억"] = agg["당월_매출_금액"] / 100_000_000

    fig, ax = plt.subplots(figsize=(14, 5))
    ax.plot(agg["연분기"], agg["매출_억"], marker="o", color="#667eea", linewidth=2, markersize=6)
    ax.fill_between(range(len(agg)), agg["매출_억"], alpha=0.3)
    ax.set_xlabel("연분기")
    ax.set_ylabel("매출 (억원)")
    ax.set_title("연분기별 디저트 총 매출 추이")
    plt.xticks(rotation=45)
    plt.tight_layout()
    plt.savefig(out_dir / "quarterly_trend.png", dpi=120, bbox_inches="tight")
    plt.close()
    print(f"저장: {out_dir / 'quarterly_trend.png'}")


def plot_top_districts(df: pd.DataFrame, n: int = 15, out_dir: Path | str = "outputs") -> None:
    """매출 상위 행정동 (전체 기간 합계)"""
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    agg = df.groupby("행정동_코드_명")["당월_매출_금액"].sum().sort_values(ascending=True).tail(n)
    agg = agg / 100_000_000  # 억원

    fig, ax = plt.subplots(figsize=(10, 8))
    bars = ax.barh(agg.index, agg.values, color="#10b981", alpha=0.8)
    ax.set_xlabel("매출 (억원)")
    ax.set_title(f"디저트 매출 상위 {n}개 행정동 (2020~2024 합계)")
    plt.tight_layout()
    plt.savefig(out_dir / "top_districts.png", dpi=120, bbox_inches="tight")
    plt.close()
    print(f"저장: {out_dir / 'top_districts.png'}")


def plot_gender_ratio(df: pd.DataFrame, out_dir: Path | str = "outputs") -> None:
    """연도별 남성/여성 매출 비율"""
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    agg = df.groupby("연도").agg(
        남성=("남성_매출_금액", "sum"),
        여성=("여성_매출_금액", "sum"),
    ).reset_index()

    fig, ax = plt.subplots(figsize=(10, 5))
    x = range(len(agg))
    w = 0.35
    ax.bar([i - w / 2 for i in x], agg["남성"] / 1e8, w, label="남성", color="#3b82f6", alpha=0.9)
    ax.bar([i + w / 2 for i in x], agg["여성"] / 1e8, w, label="여성", color="#ec4899", alpha=0.9)
    ax.set_xticks(x)
    ax.set_xticklabels(agg["연도"].astype(str))
    ax.set_xlabel("연도")
    ax.set_ylabel("매출 (억원)")
    ax.set_title("연도별 성별 디저트 매출")
    ax.legend()
    plt.tight_layout()
    plt.savefig(out_dir / "gender_ratio.png", dpi=120, bbox_inches="tight")
    plt.close()
    print(f"저장: {out_dir / 'gender_ratio.png'}")


def plot_all(df: pd.DataFrame, out_dir: Path | str = "outputs") -> None:
    """모든 시각화 생성"""
    plot_monthly_trend(df, out_dir=out_dir)
    plot_top_districts(df, out_dir=out_dir)
    plot_gender_ratio(df, out_dir=out_dir)
