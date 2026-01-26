import express from 'express';
import { getDatabase } from '../database/db.js';

const router = express.Router();
const db = getDatabase();

// 채팅방 멤버 추가
router.post('/rooms/:roomId/members', (req, res) => {
  try {
    const { roomId } = req.params;
    const { user_id, chat_id } = req.body;

    if (!user_id || !chat_id) {
      return res.status(400).json({ error: '사용자 ID와 채팅 ID가 필요합니다.' });
    }

    // 이미 멤버인지 확인
    const existing = db.prepare(`
      SELECT id FROM chat_room_members 
      WHERE room_id = ? AND user_id = ?
    `).get(roomId, user_id);

    if (existing) {
      return res.status(409).json({ error: '이미 채팅방 멤버입니다.' });
    }

    const result = db.prepare(`
      INSERT INTO chat_room_members (room_id, user_id, chat_id)
      VALUES (?, ?, ?)
    `).run(roomId, user_id, chat_id);

    const member = db.prepare(`
      SELECT crm.*, u.name, u.chat_id
      FROM chat_room_members crm
      JOIN users u ON crm.user_id = u.id
      WHERE crm.id = ?
    `).get(result.lastInsertRowid);

    res.status(201).json(member);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 채팅방 멤버 조회
router.get('/rooms/:roomId/members', (req, res) => {
  try {
    const members = db.prepare(`
      SELECT crm.*, u.name, u.chat_id, u.username
      FROM chat_room_members crm
      JOIN users u ON crm.user_id = u.id
      WHERE crm.room_id = ?
    `).all(req.params.roomId);

    res.json(members);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 모든 채팅방 조회
router.get('/rooms', (req, res) => {
  try {
    const rooms = db.prepare('SELECT * FROM chat_rooms ORDER BY created_at DESC').all();
    res.json(rooms);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 코드로 채팅방 조회
router.get('/rooms/code/:code', (req, res) => {
  try {
    const { code } = req.params;
    const room = db.prepare('SELECT * FROM chat_rooms WHERE code = ?').get(code);
    
    if (!room) {
      return res.status(404).json({ error: '채팅방을 찾을 수 없습니다.' });
    }
    
    res.json(room);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 고유 코드 생성 함수
function generateRoomCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// 채팅방 생성
router.post('/rooms', (req, res) => {
  try {
    const { name, type, creator_id, creator_chat_id, member_ids } = req.body;
    
    if (!name || !type) {
      return res.status(400).json({ error: '이름과 타입은 필수입니다.' });
    }
    
    // 고유 코드 생성 (중복 확인)
    let code = generateRoomCode();
    let attempts = 0;
    while (db.prepare('SELECT id FROM chat_rooms WHERE code = ?').get(code) && attempts < 10) {
      code = generateRoomCode();
      attempts++;
    }
    
    if (attempts >= 10) {
      return res.status(500).json({ error: '코드 생성에 실패했습니다. 다시 시도해주세요.' });
    }
    
    // 채팅방 생성
    const result = db.prepare('INSERT INTO chat_rooms (name, type, code) VALUES (?, ?, ?)')
      .run(name, type, code);
    
    const roomId = result.lastInsertRowid;
    
    // 생성자를 멤버로 추가
    if (creator_id && creator_chat_id) {
      db.prepare(`
        INSERT INTO chat_room_members (room_id, user_id, chat_id)
        VALUES (?, ?, ?)
      `).run(roomId, creator_id, creator_chat_id);
    }

    // 초대된 멤버들 추가
    if (member_ids && Array.isArray(member_ids)) {
      member_ids.forEach(member => {
        if (member.user_id && member.chat_id) {
          try {
            db.prepare(`
              INSERT INTO chat_room_members (room_id, user_id, chat_id)
              VALUES (?, ?, ?)
            `).run(roomId, member.user_id, member.chat_id);
          } catch (err) {
            // 이미 멤버인 경우 무시
            console.log('Member already exists:', err);
          }
        }
      });
    }
    
    const newRoom = db.prepare('SELECT * FROM chat_rooms WHERE id = ?')
      .get(roomId);
    
    res.status(201).json(newRoom);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 특정 채팅방의 메시지 조회
router.get('/rooms/:roomId/messages', (req, res) => {
  try {
    const messages = db.prepare(`
      SELECT * FROM chat_messages
      WHERE room_id = ?
      ORDER BY created_at ASC
    `).all(req.params.roomId);
    
    res.json(messages);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 메시지 저장 (Socket.io에서도 사용)
export function saveMessage(roomId, userName, message) {
  const db = getDatabase();
  const result = db.prepare(`
    INSERT INTO chat_messages (room_id, user_name, message)
    VALUES (?, ?, ?)
  `).run(roomId, userName, message);
  
  return db.prepare('SELECT * FROM chat_messages WHERE id = ?')
    .get(result.lastInsertRowid);
}

export default router;
