import express from 'express';
import { getDatabase } from '../database/db.js';

const router = express.Router();
const db = getDatabase();

// 모든 Todo 조회
router.get('/', (req, res) => {
  try {
    const todos = db.prepare(`
      SELECT t.*, c.name as category_name, c.color as category_color
      FROM todos t
      LEFT JOIN categories c ON t.category_id = c.id
      ORDER BY t.created_at DESC
    `).all();
    
    res.json(todos);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Todo 생성
router.post('/', (req, res) => {
  try {
    const { title, description, category_id } = req.body;
    
    if (!title) {
      return res.status(400).json({ error: '제목은 필수입니다.' });
    }
    
    const result = db.prepare(`
      INSERT INTO todos (title, description, category_id)
      VALUES (?, ?, ?)
    `).run(title, description || null, category_id || null);
    
    const newTodo = db.prepare(`
      SELECT t.*, c.name as category_name, c.color as category_color
      FROM todos t
      LEFT JOIN categories c ON t.category_id = c.id
      WHERE t.id = ?
    `).get(result.lastInsertRowid);
    
    res.status(201).json(newTodo);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Todo 완료 상태 토글
router.patch('/:id/toggle', (req, res) => {
  try {
    const todo = db.prepare('SELECT is_completed FROM todos WHERE id = ?').get(req.params.id);
    
    if (!todo) {
      return res.status(404).json({ error: 'Todo를 찾을 수 없습니다.' });
    }
    
    const newStatus = todo.is_completed ? 0 : 1;
    db.prepare('UPDATE todos SET is_completed = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(newStatus, req.params.id);
    
    const updatedTodo = db.prepare(`
      SELECT t.*, c.name as category_name, c.color as category_color
      FROM todos t
      LEFT JOIN categories c ON t.category_id = c.id
      WHERE t.id = ?
    `).get(req.params.id);
    
    res.json(updatedTodo);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Todo 삭제
router.delete('/:id', (req, res) => {
  try {
    const result = db.prepare('DELETE FROM todos WHERE id = ?').run(req.params.id);
    
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Todo를 찾을 수 없습니다.' });
    }
    
    res.json({ message: 'Todo가 삭제되었습니다.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
