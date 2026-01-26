import express from 'express';
import { getDatabase } from '../database/db.js';

const router = express.Router();
const db = getDatabase();

// 모든 일정 조회
router.get('/', (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    let query = `
      SELECT s.*, c.name as category_name, c.color as category_color
      FROM schedules s
      LEFT JOIN categories c ON s.category_id = c.id
    `;
    
    const params = [];
    if (startDate && endDate) {
      query += ' WHERE s.start_date >= ? AND s.start_date <= ?';
      params.push(startDate, endDate);
    }
    
    query += ' ORDER BY s.start_date ASC';
    
    const schedules = db.prepare(query).all(...params);
    res.json(schedules);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 특정 일정 조회
router.get('/:id', (req, res) => {
  try {
    const schedule = db.prepare(`
      SELECT s.*, c.name as category_name, c.color as category_color
      FROM schedules s
      LEFT JOIN categories c ON s.category_id = c.id
      WHERE s.id = ?
    `).get(req.params.id);
    
    if (!schedule) {
      return res.status(404).json({ error: '일정을 찾을 수 없습니다.' });
    }
    
    res.json(schedule);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 일정 생성
router.post('/', (req, res) => {
  try {
    const { title, description, start_date, end_date, category_id, is_adjustable } = req.body;
    
    if (!title || !start_date) {
      return res.status(400).json({ error: '제목과 시작 날짜는 필수입니다.' });
    }
    
    const result = db.prepare(`
      INSERT INTO schedules (title, description, start_date, end_date, category_id, is_adjustable)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(title, description || null, start_date, end_date || null, category_id || null, is_adjustable ? 1 : 0);
    
    const newSchedule = db.prepare(`
      SELECT s.*, c.name as category_name, c.color as category_color
      FROM schedules s
      LEFT JOIN categories c ON s.category_id = c.id
      WHERE s.id = ?
    `).get(result.lastInsertRowid);
    
    res.status(201).json(newSchedule);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 일정 수정
router.put('/:id', (req, res) => {
  try {
    const { title, description, start_date, end_date, category_id, is_adjustable } = req.body;
    
    const result = db.prepare(`
      UPDATE schedules
      SET title = ?, description = ?, start_date = ?, end_date = ?, 
          category_id = ?, is_adjustable = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(title, description || null, start_date, end_date || null, 
           category_id || null, is_adjustable ? 1 : 0, req.params.id);
    
    if (result.changes === 0) {
      return res.status(404).json({ error: '일정을 찾을 수 없습니다.' });
    }
    
    const updatedSchedule = db.prepare(`
      SELECT s.*, c.name as category_name, c.color as category_color
      FROM schedules s
      LEFT JOIN categories c ON s.category_id = c.id
      WHERE s.id = ?
    `).get(req.params.id);
    
    res.json(updatedSchedule);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 일정 삭제
router.delete('/:id', (req, res) => {
  try {
    const result = db.prepare('DELETE FROM schedules WHERE id = ?').run(req.params.id);
    
    if (result.changes === 0) {
      return res.status(404).json({ error: '일정을 찾을 수 없습니다.' });
    }
    
    res.json({ message: '일정이 삭제되었습니다.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
