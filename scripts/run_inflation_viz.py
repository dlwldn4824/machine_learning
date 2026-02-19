"""소비자물가(CPI)·인플레이션 전처리 + 시각화 실행"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from src.data.load_inflation import (
    build_macro_quarterly,
    load_cpi_wide,
    load_inflation_mom_wide,
    load_expected_inflation_wide,
    _resolve_path,
)
from src.analysis.inflation_visualize import plot_inflation_all

if __name__ == "__main__":
    data_dir = Path("data/raw")
    path_cpi = _resolve_path(data_dir, "소비자물가지수_10년.xlsx")
    path_mom = _resolve_path(data_dir, "월별_소비자물가_등락률_10년.xlsx")
    path_expected = _resolve_path(data_dir, "기대인플레이션율_전국_10년.xlsx")

    print("1. 거시변수 분기 테이블 생성...")
    macro_q = build_macro_quarterly(
        path_cpi=path_cpi,
        path_mom=path_mom,
        path_expected=path_expected,
        data_dir=data_dir,
        agg="mean",
    )

    if macro_q.empty:
        print("  경고: 3개 엑셀 파일이 없습니다. data/raw/ 또는 ~/Downloads 에 파일을 넣어주세요.")
        sys.exit(1)

    # 물가상승률 매핑 (add_cpi와 동일)
    import numpy as np
    if "CPI_qoq" in macro_q.columns:
        macro_q = macro_q.copy()
        macro_q["물가상승률"] = macro_q["CPI_qoq"]
    elif "inflation_mom" in macro_q.columns:
        macro_q = macro_q.copy()
        macro_q["물가상승률"] = macro_q["inflation_mom"] / 100

    print(f"   분기 테이블: {len(macro_q)}행")
    print(macro_q.head(10).to_string())

    print("\n2. 시각화 생성 (outputs/inflation/)...")
    cpi_m = load_cpi_wide(path_cpi) if path_cpi.exists() else None
    mom_m = load_inflation_mom_wide(path_mom) if path_mom.exists() else None
    exp_m = load_expected_inflation_wide(path_expected) if path_expected.exists() else None
    plot_inflation_all(macro_q, cpi_monthly=cpi_m, mom_monthly=mom_m, expected_monthly=exp_m)

    print("\n소비자물가 전처리 시각화 완료. outputs/inflation/ 폴더를 확인하세요.")
