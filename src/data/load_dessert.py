"""
서울시 상권분석 데이터에서 카페·제과점(디저트) 데이터 로딩 및 필터링
"""
import pandas as pd
from pathlib import Path

# 서울시 상권분석 서비스 기준 - 디저트 업종 (카페, 제과점)
DESSERT_CATEGORIES = ["제과점", "커피-음료"]  # 실제 컬럼값 기준

# 업종 컬럼명
INDUSTRY_COL = "서비스_업종_코드_명"


def load_raw_data(data_dir: str | Path = "data/raw", encoding: str = "cp949") -> pd.DataFrame:
    """
    data/raw 폴더의 서울시 상권분석 CSV/Excel 파일 로드
    여러 파일이 있으면 모두 합쳐서 반환
    """
    data_dir = Path(data_dir)
    if not data_dir.exists():
        raise FileNotFoundError(f"데이터 폴더가 없습니다: {data_dir}")

    dfs = []
    for ext in ["*.csv", "*.xlsx", "*.xls"]:
        for f in data_dir.glob(ext):
            try:
                if f.suffix.lower() == ".csv":
                    try:
                        df = pd.read_csv(f, encoding=encoding)
                    except UnicodeDecodeError:
                        df = pd.read_csv(f, encoding="utf-8-sig")
                else:
                    df = pd.read_excel(f)
                df["_source_file"] = f.name
                dfs.append(df)
            except Exception as e:
                print(f"파일 로드 실패 {f}: {e}")

    if not dfs:
        return pd.DataFrame()

    return pd.concat(dfs, ignore_index=True)


def filter_dessert(df: pd.DataFrame, col: str | None = None) -> pd.DataFrame:
    """
    카페·제과점 등 디저트 업종만 필터링
    서울시 상권 데이터: 서비스_업종_코드_명 기준 제과점, 커피-음료
    """
    col = col or INDUSTRY_COL
    if col not in df.columns:
        candidates = [c for c in df.columns if "업종" in str(c) or "업태" in str(c)]
        if not candidates:
            raise ValueError("업종 컬럼을 찾을 수 없습니다. col 인자로 지정해주세요.")
        col = candidates[0]

    return df[df[col].isin(DESSERT_CATEGORIES)].copy()


def load_dessert_data(
    data_dir: str | Path = "data/raw",
    industry_col: str | None = None,
) -> pd.DataFrame:
    """
    raw 데이터 로드 후 디저트(카페·제과점)만 필터링
    """
    raw = load_raw_data(data_dir)
    return filter_dessert(raw, col=industry_col or INDUSTRY_COL)
