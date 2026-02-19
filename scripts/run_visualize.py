"""시각화 실행"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from src.data.load_dessert import load_dessert_data, aggregate_by_year_quarter_dong
from src.analysis.visualize import plot_all

if __name__ == "__main__":
    df = load_dessert_data()
    df = aggregate_by_year_quarter_dong(df, drop_age=True)
    plot_all(df)
    print("\n시각화 완료. outputs/ 폴더를 확인하세요.")
