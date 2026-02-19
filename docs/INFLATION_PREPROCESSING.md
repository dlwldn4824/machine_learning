# 소비자물가(CPI)·인플레이션 전처리 상세 문서

행정동×연도×분기 데이터에 **전국 거시변수**(CPI, 물가등락률, 기대인플레이션)를 병합하기 위한 전처리 과정을 상세히 설명합니다.

---

## 1. 목표

| 목표 | 내용 |
|------|------|
| **입력** | 월별 전국 단위 엑셀 3종 (와이드 포맷) |
| **출력** | 분기별 테이블 `(연도, 분기, CPI, inflation_mom, expected_inflation, ...)` |
| **최종** | 행정동 df에 `on=["연도","분기"]` left merge |

---

## 2. 소스 파일 3종

### 2.1 소비자물가지수_10년.xlsx

| 항목 | 내용 |
|------|------|
| **내용** | 전국 CPI 지수 (2015년=100 기준) |
| **시트** | `데이터` (0번 시트 사용) |
| **구조** | 와이드 포맷, 월이 컬럼 |
| **행 구성** | Row 0: 시도별, 2017.010, 2017.020, … (날짜) / Row 1: 전국, CPI 값들 |
| **날짜 형식** | `2017.010` (년.월, 월은 01~12), `2018.07` 등 혼재 |

**파싱 방식**:
- 1열~끝: 날짜 컬럼
- `2017.010` → 숫자만 추출 `201701` → `YYYYMM` 파싱
- Row 1이 전국 CPI 값

---

### 2.2 월별_소비자물가_등락률_10년.xlsx

| 항목 | 내용 |
|------|------|
| **내용** | 총지수 전월비(MoM), 전년동월비(YoY), 전년누계비 |
| **시트** | `데이터` |
| **구조** | 와이드, **월당 3열** (전월비, 전년동월비, 전년누계비) |
| **행 구성** | Row 0: 날짜(2017.01 3번 반복, 2017.02 3번 …) / Row 1: 전월비(%), 전년동월비(%), … / Row 2: 총지수 값 |

**파싱 방식**:
- 매 3열마다 첫 번째 열 = **전월비(MoM)** % → `inflation_mom`
- `i = 0, 3, 6, …` 인덱스로 순회

---

### 2.3 기대인플레이션율_전국_10년.xlsx

| 항목 | 내용 |
|------|------|
| **내용** | 물가인식(지난 1년) % – 소비자 설문 기반 |
| **시트** | `데이터` |
| **구조** | Row 0: CSI코드별, 2017.01, 2017.02, … / Row 1: 물가인식(지난 1년), 값들 |

**파싱 방식**:
- 1열~끝: 월별 날짜
- Row 1: 기대인플레이션율 값

---

## 3. 전처리 파이프라인

### 3.1 전체 흐름

```
[엑셀 3종] → 와이드→롱 변환 → 월별 시리즈 → resample("QE").mean() → 분기 테이블 → merge
```

### 3.2 날짜 파싱 (`_parse_yyyymm`)

```python
"2017.01"   → "201701"
"2017.010"  → "201701"
"2018.07"   → "201807"
```

- `.`, 공백 제거 후 숫자만 추출
- 앞 6자리 = `YYYYMM`

### 3.3 월별→분기 변환 (`_monthly_to_quarterly`)

- **방법**: `resample("QE")` (Quarter End)
  - Q1: 1~3월 → 3월 말
  - Q2: 4~6월 → 6월 말
  - Q3: 7~9월 → 9월 말
  - Q4: 10~12월 → 12월 말
- **집계**: `mean()` (분기 평균) 또는 `last()` (분기말 값)
- **프로젝트**: 분기 평균 사용 (설명·일관성)

### 3.4 CPI 파생 변수

| 변수 | 계산 |
|------|------|
| CPI_qoq | `CPI.pct_change(1)` – 전분기 대비 변동률 |
| CPI_yoy | `CPI.pct_change(4)` – 전년 동분기 대비 변동률 |

### 3.5 물가상승률 매핑

- **우선**: `물가상승률 = CPI_qoq` (분기 대비)
- **fallback**: `물가상승률 = inflation_mom / 100` (MoM % → 소수)

---

## 4. 모듈 및 함수 (`load_inflation.py`)

### 4.1 `load_cpi_wide(path)`

- **입력**: 엑셀 경로
- **출력**: `pd.Series` (index=date, values=CPI)
- **처리**: Row 0 날짜, Row 1 값, 날짜 파싱 후 월별 시리즈

### 4.2 `load_inflation_mom_wide(path)`

- **입력**: 월별 등락률 엑셀 경로
- **출력**: 전월비(MoM) 월별 시리즈
- **처리**: 3열 단위로 첫 번째 값 추출 (총지수 Row 2)

### 4.3 `load_expected_inflation_wide(path)`

- **입력**: 기대인플레이션 엑셀 경로
- **출력**: 물가인식(지난 1년) 월별 시리즈

### 4.4 `build_macro_quarterly(...)`

- **입력**: `path_cpi`, `path_mom`, `path_expected`, `data_dir`, `agg`
- **출력**: `pd.DataFrame` 컬럼 `연도, 분기, CPI, inflation_mom, expected_inflation, CPI_qoq, CPI_yoy`
- **경로**: `data_dir` 없으면 `~/Downloads` 탐색

### 4.5 `_resolve_path(base, name)`

- `base/name` 존재 시 반환
- 없으면 `~/Downloads/name` 반환 (존재 시)

---

## 5. 최종 출력 형태

### 5.1 `macro_q` 테이블

| 연도 | 분기 | CPI | inflation_mom | expected_inflation | CPI_qoq | CPI_yoy |
|------|------|-----|---------------|---------------------|---------|---------|
| 2017 | 1 | 97.52 | 0.43 | 2.67 | NaN | NaN |
| 2017 | 2 | 97.44 | -0.07 | 2.57 | -0.0008 | NaN |
| … | … | … | … | … | … | … |

### 5.2 행정동 df에 병합

```python
df = df.merge(macro_q, on=["연도", "분기"], how="left")
```

- 각 행정동×연도×분기 행에 **동일한** 전국 거시변수 붙음
- 결측: 해당 연분기 거시 데이터 없을 때

---

## 6. 시각화 (`outputs/inflation/`)

### 6.1 생성 그래프

| 파일 | 내용 |
|------|------|
| inflation_cpi_trend.png | 분기별 CPI 시계열 |
| inflation_cpi_qoq_yoy.png | CPI_qoq(분기대비), CPI_yoy(전년동기대비) 막대 |
| inflation_mom.png | inflation_mom(전월비 분기평균) 막대 |
| inflation_expected.png | 기대인플레이션율 시계열 |
| inflation_cpi_vs_expected.png | CPI vs 기대인플레이션 2축 |
| inflation_물가상승률.png | 최종 병합용 물가상승률(CPI_qoq) |
| inflation_cpi_monthly_raw.png | 월별 CPI 원본 (전처리 전) |

### 6.2 실행

```bash
python scripts/run_inflation_viz.py
```

---

## 7. 파일 배치

| 위치 | 파일 |
|------|------|
| `data/raw/` 또는 `~/Downloads/` | 소비자물가지수_10년.xlsx |
| | 월별_소비자물가_등락률_10년.xlsx |
| | 기대인플레이션율_전국_10년.xlsx |
| `outputs/inflation/` | 시각화 PNG |

---

## 8. add_cpi() 연동

`preprocess.py`의 `add_cpi()`는 다음 순서로 시도합니다.

1. **3개 엑셀** → `build_macro_quarterly()` 호출
2. `data/cpi.csv`
3. `data/cpi_example.csv`
4. KOSIS 기반 예시값 (2020~2024 연도별 상승률 근사)

엑셀이 있으면 `CPI`, `inflation_mom`, `expected_inflation`, `CPI_qoq`, `CPI_yoy`, `물가상승률`, `물가_x_lag1비중` 등이 추가됩니다.

---

## 9. 자주 발생하는 이슈

| 이슈 | 대응 |
|------|------|
| 엑셀 헤더 2~3줄 | 현재 코드는 `header=None`로 읽어 Row 0,1,2 인덱스 사용. 시트 구조 바뀌면 인덱스 수정 필요 |
| 날짜 "2024년 1월" | `_parse_yyyymm`에서 숫자만 추출. 한글 포함 시 전처리 추가 |
| 값 "1.2%" 문자열 | `pd.to_numeric(..., errors="coerce")` + `str.replace("%","")` |
| 파일 없음 | `data/raw/`, `~/Downloads` 둘 다 확인. 경로 직접 지정 시 `inflation_excel_paths` 인자 사용 |

---

## 10. 변수 해석

| 변수 | 의미 | 단위 |
|------|------|------|
| CPI | 소비자물가지수 (2015=100) | 지수 |
| inflation_mom | 전월 대비 물가 변동률 (분기 평균) | % |
| expected_inflation | 물가인식(지난 1년), 설문 기반 | % |
| CPI_qoq | 전분기 대비 CPI 변동률 | 비율 (0.01=1%) |
| CPI_yoy | 전년 동분기 대비 CPI 변동률 | 비율 |
| 물가상승률 | ML 피처용. CPI_qoq와 동일 | 비율 |
