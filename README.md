# Todo Calendar App

캘린더 일정 관리 및 팀 채팅 기능을 제공하는 웹 애플리케이션입니다.

## 🚀 주요 기능

### 1. 캘린더 기능
- **일정 관리**: 일정을 카테고리별로 입력하고 관리
- **일정 등록 시 입력 항목**:
  - 어떤 일정인지 (제목, 설명)
  - 언제 하는지 (시작 날짜, 종료 날짜)
  - 조정 가능한 일정인지 여부
- **카테고리별 색상 구분**: 각 카테고리마다 색상을 지정하여 시각적으로 구분
- **월별 캘린더 뷰**: 월 단위로 일정을 한눈에 확인

### 2. Todo 리스트
- **날짜 미정 할 일**: 아직 일정이 정해지지 않은 할 일을 관리
- **카테고리 분류**: Todo도 카테고리별로 분류 가능
- **완료 체크**: 완료된 항목과 미완료 항목 구분

### 3. 채팅 기능
- **팀/동아리 채팅**: 여러 채팅방 생성 및 관리
- **실시간 메시징**: Socket.io를 활용한 실시간 채팅
- **채팅방별 메시지 관리**: 각 채팅방의 메시지 히스토리 저장

## 🛠️ 기술 스택

- **Frontend**: React 18 + Vite
- **Backend**: Node.js + Express
- **Database**: SQLite (better-sqlite3)
- **Real-time**: Socket.io
- **Date Library**: date-fns

## 📁 프로젝트 구조

```
machine_learning/
├── frontend/              # React 프론트엔드
│   ├── src/
│   │   ├── components/
│   │   │   ├── Calendar.jsx      # 캘린더 컴포넌트
│   │   │   ├── ScheduleModal.jsx  # 일정 추가/수정 모달
│   │   │   ├── TodoList.jsx      # Todo 리스트 컴포넌트
│   │   │   └── Chat.jsx          # 채팅 컴포넌트
│   │   ├── App.jsx
│   │   └── main.jsx
│   └── package.json
├── backend/               # Node.js 백엔드
│   ├── database/
│   │   └── db.js         # 데이터베이스 초기화
│   ├── routes/
│   │   ├── schedules.js  # 일정 API
│   │   ├── todos.js      # Todo API
│   │   ├── categories.js # 카테고리 API
│   │   └── chat.js       # 채팅 API
│   ├── server.js         # Express 서버
│   └── package.json
└── package.json          # 루트 워크스페이스 설정
```

## 🛠️ 설치 및 실행

### 1. 의존성 설치

**npm 사용 시:**
```bash
npm run install:all
```

**pnpm 사용 시 (권장):**
```bash
pnpm install
# 빌드 스크립트 승인 (better-sqlite3 등)
pnpm approve-builds
# 모든 패키지 선택 (스페이스바로 선택, 엔터로 확인)
```

### 2. 개발 서버 실행

프론트엔드와 백엔드를 동시에 실행:

**npm 사용 시:**
```bash
npm run dev
```

**pnpm 사용 시:**
```bash
pnpm run dev
```

개별 실행:

**npm 사용 시:**
```bash
# 프론트엔드만 실행 (포트 3000)
npm run dev --workspace=frontend

# 백엔드만 실행 (포트 5000)
npm run dev --workspace=backend
```

**pnpm 사용 시:**
```bash
# 프론트엔드만 실행 (포트 3000)
pnpm --filter frontend dev

# 백엔드만 실행 (포트 5000)
pnpm --filter backend dev
```

### 3. 빌드

```bash
npm run build
# 또는
pnpm run build
```

## 🌐 접속 주소

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:5001
- **API Health Check**: http://localhost:5001/api/health

## 📝 API 엔드포인트

### 일정 (Schedules)
- `GET /api/schedules` - 일정 목록 조회
- `GET /api/schedules/:id` - 특정 일정 조회
- `POST /api/schedules` - 일정 생성
- `PUT /api/schedules/:id` - 일정 수정
- `DELETE /api/schedules/:id` - 일정 삭제

### Todo
- `GET /api/todos` - Todo 목록 조회
- `POST /api/todos` - Todo 생성
- `PATCH /api/todos/:id/toggle` - Todo 완료 상태 토글
- `DELETE /api/todos/:id` - Todo 삭제

### 카테고리 (Categories)
- `GET /api/categories` - 카테고리 목록 조회
- `POST /api/categories` - 카테고리 생성
- `PUT /api/categories/:id` - 카테고리 수정
- `DELETE /api/categories/:id` - 카테고리 삭제

### 채팅 (Chat)
- `GET /api/chat/rooms` - 채팅방 목록 조회
- `POST /api/chat/rooms` - 채팅방 생성
- `GET /api/chat/rooms/:roomId/messages` - 채팅방 메시지 조회

## 🎯 사용 방법

### 일정 추가하기
1. 캘린더에서 날짜를 클릭
2. 일정 제목, 설명, 날짜, 카테고리, 조정 가능 여부 입력
3. 저장 버튼 클릭

### Todo 추가하기
1. 캘린더 위의 "할 일 목록" 섹션에서 "+" 버튼 클릭
2. 할 일 제목과 카테고리 입력
3. 추가 버튼 클릭

### 채팅하기
1. 상단 네비게이션에서 "채팅" 탭 클릭
2. 이름 입력 후 시작
3. 새 채팅방 생성 또는 기존 채팅방 선택
4. 메시지 입력 후 전송

## 📦 데이터베이스

SQLite 데이터베이스가 `backend/data/database.db`에 자동 생성됩니다.
초기 실행 시 기본 카테고리(업무, 개인, 학습, 운동)가 자동으로 생성됩니다.

## 🔧 환경 변수

백엔드 환경 변수 설정 (선택사항):

```bash
PORT=5001
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
```

## 📝 주요 스크립트

- `npm run dev` - 프론트엔드와 백엔드 동시 실행
- `npm run build` - 프론트엔드 프로덕션 빌드
- `npm run start` - 백엔드 프로덕션 모드 실행
- `npm run install:all` - 모든 워크스페이스 의존성 설치
