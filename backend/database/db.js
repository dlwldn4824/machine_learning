import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let db;

export function initDatabase() {
  db = new Database(path.join(__dirname, '../data/database.db'));
  
  // 일정 테이블
  db.exec(`
    CREATE TABLE IF NOT EXISTS schedules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      start_date TEXT NOT NULL,
      end_date TEXT,
      category_id INTEGER,
      is_adjustable INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (category_id) REFERENCES categories(id)
    )
  `);

  // 카테고리 테이블
  db.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      color TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Todo 테이블 (날짜 미정)
  db.exec(`
    CREATE TABLE IF NOT EXISTS todos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      category_id INTEGER,
      is_completed INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (category_id) REFERENCES categories(id)
    )
  `);

  // 채팅방 테이블
  db.exec(`
    CREATE TABLE IF NOT EXISTS chat_rooms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      code TEXT UNIQUE,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 채팅 메시지 테이블
  db.exec(`
    CREATE TABLE IF NOT EXISTS chat_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      room_id INTEGER NOT NULL,
      user_name TEXT NOT NULL,
      message TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (room_id) REFERENCES chat_rooms(id)
    )
  `);

  // 사용자 테이블 (인증)
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('student', 'professor')),
      name TEXT NOT NULL,
      chat_id TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 채팅방 멤버 테이블
  db.exec(`
    CREATE TABLE IF NOT EXISTS chat_room_members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      room_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      chat_id TEXT NOT NULL,
      joined_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (room_id) REFERENCES chat_rooms(id),
      FOREIGN KEY (user_id) REFERENCES users(id),
      UNIQUE(room_id, user_id)
    )
  `);

  // 채팅 분석 결과 테이블
  db.exec(`
    CREATE TABLE IF NOT EXISTS chat_analyses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      room_id INTEGER NOT NULL,
      user_name TEXT NOT NULL,
      message_id INTEGER NOT NULL,
      relevance_score REAL NOT NULL,
      keywords TEXT,
      contribution_score REAL DEFAULT 0,
      analyzed_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (room_id) REFERENCES chat_rooms(id),
      FOREIGN KEY (message_id) REFERENCES chat_messages(id)
    )
  `);

  // 기본 교수 계정 생성 (비밀번호: professor123)
  const defaultPassword = '$2b$10$rQ8K8K8K8K8K8K8K8K8K8O8K8K8K8K8K8K8K8K8K8K8K8K8K8K8K'; // 해시된 비밀번호 (실제로는 bcrypt 사용)
  const insertUser = db.prepare('INSERT OR IGNORE INTO users (username, password, role, name) VALUES (?, ?, ?, ?)');
  
  // 간단한 비밀번호 해싱을 위한 기본 계정 (실제로는 bcrypt 사용 권장)
  insertUser.run('professor', 'professor123', 'professor', '교수님');
  insertUser.run('student1', 'student123', 'student', '학생1');

  // 기본 카테고리 추가
  const defaultCategories = [
    { name: '업무', color: '#3B82F6' },
    { name: '개인', color: '#10B981' },
    { name: '학습', color: '#8B5CF6' },
    { name: '운동', color: '#F59E0B' }
  ];

  const insertCategory = db.prepare('INSERT OR IGNORE INTO categories (name, color) VALUES (?, ?)');
  defaultCategories.forEach(cat => {
    insertCategory.run(cat.name, cat.color);
  });

  console.log('데이터베이스 초기화 완료');
}

export function getDatabase() {
  if (!db) {
    initDatabase();
  }
  return db;
}
