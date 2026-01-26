import express from 'express';
import { getDatabase } from '../database/db.js';
import { analyzeChatRoom, calculateRelevanceScore, extractKeywords, classifyMessage } from '../services/chatAnalyzer.js';

const router = express.Router();
const db = getDatabase();

// 채팅방 분석 실행
router.post('/analyze/:roomId', async (req, res) => {
  try {
    const { roomId } = req.params;

    // 채팅방 존재 확인
    const room = db.prepare('SELECT * FROM chat_rooms WHERE id = ?').get(roomId);
    if (!room) {
      return res.status(404).json({ error: '채팅방을 찾을 수 없습니다.' });
    }

    // 메시지 가져오기
    const messages = db.prepare(`
      SELECT * FROM chat_messages 
      WHERE room_id = ? 
      ORDER BY created_at ASC
    `).all(roomId);

    if (messages.length === 0) {
      return res.json({
        roomId: parseInt(roomId),
        roomName: room.name,
        analysis: {
          totalMessages: 0,
          relevantMessages: 0,
          irrelevantMessages: 0,
          averageRelevance: 0,
          topKeywords: [],
          userContributions: {}
        }
      });
    }

    // 분석 실행
    const analysis = analyzeChatRoom(messages);

    // 분석 결과를 데이터베이스에 저장
    messages.forEach(msg => {
      const relevance = calculateRelevanceScore(msg.message);
      const keywords = extractKeywords(msg.message).join(',');
      const classification = classifyMessage(msg.message);

      // 기존 분석 결과가 있으면 업데이트, 없으면 삽입
      const existing = db.prepare(`
        SELECT id FROM chat_analyses 
        WHERE message_id = ?
      `).get(msg.id);

      if (existing) {
        db.prepare(`
          UPDATE chat_analyses 
          SET relevance_score = ?, keywords = ?, analyzed_at = CURRENT_TIMESTAMP
          WHERE message_id = ?
        `).run(relevance, keywords, msg.id);
      } else {
        db.prepare(`
          INSERT INTO chat_analyses (room_id, user_name, message_id, relevance_score, keywords)
          VALUES (?, ?, ?, ?, ?)
        `).run(roomId, msg.user_name, msg.id, relevance, keywords);
      }
    });

    // 사용자별 기여도 점수 업데이트
    Object.keys(analysis.userContributions).forEach(userName => {
      const contribution = analysis.userContributions[userName];
      
      // 해당 사용자의 모든 메시지에 기여도 점수 업데이트
      const userMessages = messages.filter(m => m.user_name === userName);
      userMessages.forEach(msg => {
        db.prepare(`
          UPDATE chat_analyses 
          SET contribution_score = ?
          WHERE message_id = ? AND user_name = ?
        `).run(contribution.contributionScore, msg.id, userName);
      });
    });

    res.json({
      roomId: parseInt(roomId),
      roomName: room.name,
      analysis
    });
  } catch (error) {
    console.error('분석 오류:', error);
    res.status(500).json({ error: error.message });
  }
});

// 분석 결과 조회
router.get('/results/:roomId', (req, res) => {
  try {
    const { roomId } = req.params;

    const room = db.prepare('SELECT * FROM chat_rooms WHERE id = ?').get(roomId);
    if (!room) {
      return res.status(404).json({ error: '채팅방을 찾을 수 없습니다.' });
    }

    const messages = db.prepare(`
      SELECT * FROM chat_messages 
      WHERE room_id = ? 
      ORDER BY created_at ASC
    `).all(roomId);

    const analysis = analyzeChatRoom(messages);

    res.json({
      roomId: parseInt(roomId),
      roomName: room.name,
      analysis
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 채팅 URL로 채팅방 생성 및 분석 (크롤링 시뮬레이션)
router.post('/analyze-url', async (req, res) => {
  try {
    const { url, roomName } = req.body;

    if (!url) {
      return res.status(400).json({ error: '채팅 URL을 입력해주세요.' });
    }

    // 실제로는 여기서 URL을 크롤링하여 메시지를 가져옴
    // 현재는 기존 채팅방을 사용하거나 새로 생성
    let room;
    
    // URL에서 roomId 추출 시도 (예: /chat/rooms/123)
    const roomIdMatch = url.match(/rooms\/(\d+)/);
    
    if (roomIdMatch) {
      const roomId = parseInt(roomIdMatch[1]);
      room = db.prepare('SELECT * FROM chat_rooms WHERE id = ?').get(roomId);
    }

    // 채팅방이 없으면 새로 생성
    if (!room) {
      const result = db.prepare('INSERT INTO chat_rooms (name, type) VALUES (?, ?)')
        .run(roomName || '분석 채팅방', 'team');
      room = db.prepare('SELECT * FROM chat_rooms WHERE id = ?')
        .get(result.lastInsertRowid);
    }

    // 메시지 가져오기 및 분석
    const messages = db.prepare(`
      SELECT * FROM chat_messages 
      WHERE room_id = ? 
      ORDER BY created_at ASC
    `).all(room.id);

    const analysis = analyzeChatRoom(messages);

    res.json({
      roomId: room.id,
      roomName: room.name,
      url,
      analysis
    });
  } catch (error) {
    console.error('URL 분석 오류:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
