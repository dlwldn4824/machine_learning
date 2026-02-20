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


def plot_monthly_trend(df: pd.DataFrame, out_dir: Path | str = "outputs/figures/basic") -> None:
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


def plot_quarterly_trend(df: pd.DataFrame, out_dir: Path | str = "outputs/figures/basic") -> None:
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


def plot_top_districts(df: pd.DataFrame, n: int = 15, out_dir: Path | str = "outputs/figures/basic") -> None:
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


def plot_gender_ratio(df: pd.DataFrame, out_dir: Path | str = "outputs/figures/basic") -> None:
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


def plot_preprocess_results(df: pd.DataFrame, out_dir: Path | str = "outputs/figures/preprocess") -> None:
    """전처리 결과 시각화 (preprocess.py 출력)"""
    import seaborn as sns

    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    df = df.dropna(subset=["lag1", "lag4"])

    # 1. 디저트 비중 분포
    fig, ax = plt.subplots(figsize=(8, 4))
    ax.hist(df["디저트_비중"], bins=50, color="#667eea", alpha=0.8, edgecolor="white")
    ax.set_xlabel("디저트 비중")
    ax.set_ylabel("빈도")
    ax.set_title("디저트 비중 분포 (카페+제과점 / 전체 상권)")
    plt.tight_layout()
    plt.savefig(out_dir / "preprocess_dessert_ratio.png", dpi=120, bbox_inches="tight")
    plt.close()
    print(f"저장: {out_dir / 'preprocess_dessert_ratio.png'}")

    # 2. 원본 vs 로그 변환 (분포 비교)
    fig, axes = plt.subplots(1, 2, figsize=(12, 4))
    axes[0].hist(df["당월_매출_금액"] / 1e8, bins=50, color="#667eea", alpha=0.8)
    axes[0].set_xlabel("당월 매출 (억원)")
    axes[0].set_ylabel("빈도")
    axes[0].set_title("원본 매출")
    axes[1].hist(df["log_당월_매출_금액"], bins=50, color="#10b981", alpha=0.8)
    axes[1].set_xlabel("log(매출+1)")
    axes[1].set_ylabel("빈도")
    axes[1].set_title("로그 변환 후")
    plt.tight_layout()
    plt.savefig(out_dir / "preprocess_log_transform.png", dpi=120, bbox_inches="tight")
    plt.close()
    print(f"저장: {out_dir / 'preprocess_log_transform.png'}")

    # 3. lag1 vs 당월 매출 (산점도)
    fig, ax = plt.subplots(figsize=(6, 6))
    sample = df.sample(min(2000, len(df)), random_state=42)
    ax.scatter(sample["lag1"] / 1e8, sample["당월_매출_금액"] / 1e8, alpha=0.3, s=10, c="#667eea")
    ax.set_xlabel("lag1 (전분기 매출, 억원)")
    ax.set_ylabel("당월 매출 (억원)")
    ax.set_title("전분기 매출 vs 당월 매출")
    ax.plot([0, sample["당월_매출_금액"].max() / 1e8], [0, sample["당월_매출_금액"].max() / 1e8], "r--", alpha=0.5, label="y=x")
    ax.legend()
    plt.tight_layout()
    plt.savefig(out_dir / "preprocess_lag1_scatter.png", dpi=120, bbox_inches="tight")
    plt.close()
    print(f"저장: {out_dir / 'preprocess_lag1_scatter.png'}")

    # 4. 성장률 분포
    fig, ax = plt.subplots(figsize=(8, 4))
    gr = df["성장률"].clip(-0.5, 0.5)
    ax.hist(gr, bins=60, color="#f59e0b", alpha=0.8, edgecolor="white")
    ax.axvline(0, color="gray", linestyle="--")
    ax.set_xlabel("성장률 (전분기 대비)")
    ax.set_ylabel("빈도")
    ax.set_title("성장률 분포 (±50%로 클리핑)")
    plt.tight_layout()
    plt.savefig(out_dir / "preprocess_growth_rate.png", dpi=120, bbox_inches="tight")
    plt.close()
    print(f"저장: {out_dir / 'preprocess_growth_rate.png'}")

    # 5. 계절성 (분기별 month_sin, month_cos)
    fig, axes = plt.subplots(1, 2, figsize=(10, 4))
    q_mean = df.groupby("분기")[["month_sin", "month_cos"]].mean()
    axes[0].bar(q_mean.index, q_mean["month_sin"], color="#8b5cf6", alpha=0.8)
    axes[0].set_xlabel("분기")
    axes[0].set_ylabel("month_sin 평균")
    axes[0].set_title("분기별 month_sin")
    axes[1].bar(q_mean.index, q_mean["month_cos"], color="#ec4899", alpha=0.8)
    axes[1].set_xlabel("분기")
    axes[1].set_ylabel("month_cos 평균")
    axes[1].set_title("분기별 month_cos")
    plt.tight_layout()
    plt.savefig(out_dir / "preprocess_seasonality.png", dpi=120, bbox_inches="tight")
    plt.close()
    print(f"저장: {out_dir / 'preprocess_seasonality.png'}")

    # 6. 파생 변수 상관행렬
    cols = ["당월_매출_금액", "디저트_비중", "log_당월_매출_금액", "lag1", "lag4", "성장률", "month_sin", "month_cos"]
    cols = [c for c in cols if c in df.columns]
    corr = df[cols].corr()
    fig, ax = plt.subplots(figsize=(8, 7))
    sns.heatmap(corr, annot=True, fmt=".2f", cmap="RdYlBu_r", center=0, ax=ax, vmin=-0.5, vmax=1)
    ax.set_title("전처리 변수 상관행렬")
    plt.tight_layout()
    plt.savefig(out_dir / "preprocess_correlation.png", dpi=120, bbox_inches="tight")
    plt.close()
    print(f"저장: {out_dir / 'preprocess_correlation.png'}")


def plot_kmeans_clusters(
    df: pd.DataFrame,
    n_clusters: int = 3,
    out_dir: Path | str = "outputs/figures/ml",
) -> None:
    """k-means 군집 결과: 군집별 평균 디저트 비중 추이 시각화"""
    from sklearn.cluster import KMeans
    from sklearn.preprocessing import StandardScaler

    from src.data.preprocess import create_cluster_features

    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    cluster_df = create_cluster_features(df)
    feat_cols = ["매출_mean", "매출_std", "성장률_mean", "디저트_비중_mean"]
    X = cluster_df[feat_cols].fillna(0)
    X_scaled = StandardScaler().fit_transform(X)

    km = KMeans(n_clusters=n_clusters, random_state=42)
    cluster_df["cluster"] = km.fit_predict(X_scaled)

    # 군집 라벨 -> 이름
    cluster_df["cluster_name"] = cluster_df["cluster"].map(
        lambda c: ["고소비 안정형", "저소비 변동형", "성장형"][c % 3]
    )

    # 원본 df에 군집 병합
    df_merged = df.merge(
        cluster_df[["행정동_코드", "cluster", "cluster_name"]],
        on="행정동_코드",
        how="left",
    )

    # 군집별 연도×분기 평균 디저트 비중 추이
    trend = (
        df_merged.dropna(subset=["cluster", "디저트_비중"])
        .groupby(["연도", "분기", "cluster_name"])["디저트_비중"]
        .mean()
        .reset_index()
    )
    trend["연분기"] = trend["연도"].astype(str) + "-Q" + trend["분기"].astype(str)

    fig, ax = plt.subplots(figsize=(12, 5))
    for name in trend["cluster_name"].unique():
        sub = trend[trend["cluster_name"] == name]
        ax.plot(sub["연분기"], sub["디저트_비중"], marker="o", label=name, linewidth=2)
    ax.set_xlabel("연분기")
    ax.set_ylabel("평균 디저트 비중")
    ax.set_title(f"k-means 군집({n_clusters}개)별 디저트 비중 추이")
    ax.legend()
    plt.xticks(rotation=45)
    plt.tight_layout()
    plt.savefig(out_dir / "kmeans_cluster_trend.png", dpi=120, bbox_inches="tight")
    plt.close()
    print(f"저장: {out_dir / 'kmeans_cluster_trend.png'}")


def plot_all(df: pd.DataFrame, out_dir: Path | str = "outputs/figures/basic") -> None:
    """모든 시각화 생성"""
    plot_monthly_trend(df, out_dir=out_dir)
    plot_top_districts(df, out_dir=out_dir)
    plot_gender_ratio(df, out_dir=out_dir)
