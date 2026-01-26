import express from 'express';
import { getDatabase } from '../database/db.js';

const router = express.Router();
const db = getDatabase();

// 사용자 chat_id 업데이트
router.put('/:userId/chat-id', (req, res) => {
  try {
    const { userId } = req.params;
    const { chat_id } = req.body;

    if (!chat_id || chat_id.trim().length === 0) {
      return res.status(400).json({ error: '채팅 ID를 입력해주세요.' });
    }

    // chat_id 중복 확인
    const existing = db.prepare('SELECT id FROM users WHERE chat_id = ? AND id != ?')
      .get(chat_id, userId);

    if (existing) {
      return res.status(409).json({ error: '이미 사용 중인 채팅 ID입니다.' });
    }

    const result = db.prepare('UPDATE users SET chat_id = ? WHERE id = ?')
      .run(chat_id, userId);

    if (result.changes === 0) {
      return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
    }

    const updatedUser = db.prepare('SELECT id, username, name, role, chat_id FROM users WHERE id = ?')
      .get(userId);

    res.json(updatedUser);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// chat_id로 사용자 검색
router.get('/search/:chatId', (req, res) => {
  try {
    const { chatId } = req.params;

    const users = db.prepare(`
      SELECT id, username, name, role, chat_id 
      FROM users 
      WHERE chat_id LIKE ? AND chat_id IS NOT NULL
      LIMIT 10
    `).all(`%${chatId}%`);

    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 현재 사용자 정보 조회
router.get('/me', (req, res) => {
  try {
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({ error: '사용자 ID가 필요합니다.' });
    }

    const user = db.prepare('SELECT id, username, name, role, chat_id FROM users WHERE id = ?')
      .get(userId);

    if (!user) {
      return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
    }

    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
