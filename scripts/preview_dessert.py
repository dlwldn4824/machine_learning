"""전처리된 디저트 데이터 미리보기 및 저장"""
import sys
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from src.data.load_dessert import load_dessert_data, aggregate_by_year_quarter_dong

if __name__ == "__main__":
    df = load_dessert_data()
    df = aggregate_by_year_quarter_dong(df, drop_age=True)

    # 저장
    out_path = Path("data/processed/dessert_2020_2024.csv")
    out_path.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(out_path, index=False, encoding="utf-8-sig")
    print(f"저장됨: {out_path}")
    print()

    # 미리보기
    print("=" * 60)
    print("전처리된 디저트 데이터 (년도·분기별 행정동 평균)")
    print("=" * 60)
    print(f"총 {len(df):,}행 | 연도: {sorted(df['연도'].unique())} | 행정동 수: {df['행정동_코드'].nunique()}")
    print()
    print("컬럼:", list(df.columns))
    print()
    print("--- 상위 10행 ---")
    pd.set_option("display.max_columns", 12)
    pd.set_option("display.width", 120)
    pd.set_option("display.max_colwidth", 15)
    print(df.head(10).to_string())
    print()
    print("--- 기본 통계 (당월 매출) ---")
    print(df[["당월_매출_금액", "당월_매출_건수"]].describe())
