"""ML 전처리 실행 및 저장"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from src.data.load_dessert import load_dessert_data, aggregate_by_year_quarter_dong
from src.data.preprocess import preprocess_ml

if __name__ == "__main__":
    df = load_dessert_data()
    df = aggregate_by_year_quarter_dong(df, drop_age=True)
    df = preprocess_ml(df)

    out = Path("data/processed/dessert_ml_ready.csv")
    out.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(out, index=False, encoding="utf-8-sig")

    print(f"저장: {out}")
    print(f"행 수: {len(df):,} | 결측 제거 후: {df.dropna().shape[0]:,}")
    print("\n추가된 컬럼:")
    added = ["디저트_비중", "log_당월_매출_금액", "lag1", "lag4", "성장률", "month_sin", "month_cos"]
    for c in added:
        if c in df.columns:
            print(f"  - {c}")
