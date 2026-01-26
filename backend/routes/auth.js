import express from 'express';
import { getDatabase } from '../database/db.js';

const router = express.Router();
const db = getDatabase();

// 로그인
router.post('/login', (req, res) => {
  try {
    const { username, password, role } = req.body;
    
    if (!username || !password || !role) {
      return res.status(400).json({ error: '사용자명, 비밀번호, 역할을 모두 입력해주세요.' });
    }

    const user = db.prepare('SELECT * FROM users WHERE username = ? AND role = ?').get(username, role);
    
    if (!user) {
      return res.status(401).json({ error: '사용자를 찾을 수 없습니다.' });
    }

    // 간단한 비밀번호 검증 (실제로는 bcrypt 사용 권장)
    if (user.password !== password) {
      // 기본 계정용 간단한 검증
      const defaultPasswords = {
        'professor': 'professor123',
        'student1': 'student123'
      };
      
      if (defaultPasswords[username] !== password) {
        return res.status(401).json({ error: '비밀번호가 일치하지 않습니다.' });
      }
    }

    // 세션 정보 반환 (실제로는 JWT 토큰 사용 권장)
    res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 회원가입
router.post('/register', (req, res) => {
  try {
    const { username, password, role, name } = req.body;
    
    if (!username || !password || !role || !name) {
      return res.status(400).json({ error: '모든 필드를 입력해주세요.' });
    }

    if (role !== 'student' && role !== 'professor') {
      return res.status(400).json({ error: '역할은 student 또는 professor여야 합니다.' });
    }

    try {
      const result = db.prepare('INSERT INTO users (username, password, role, name) VALUES (?, ?, ?, ?)')
        .run(username, password, role, name);
      
      const newUser = db.prepare('SELECT id, username, name, role FROM users WHERE id = ?')
        .get(result.lastInsertRowid);
      
      res.status(201).json({
        success: true,
        user: newUser
      });
    } catch (error) {
      if (error.message.includes('UNIQUE constraint')) {
        return res.status(409).json({ error: '이미 존재하는 사용자명입니다.' });
      }
      throw error;
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
