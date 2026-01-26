import express from 'express';
import { getDatabase } from '../database/db.js';

const router = express.Router();
const db = getDatabase();

// 모든 카테고리 조회
router.get('/', (req, res) => {
  try {
    const categories = db.prepare('SELECT * FROM categories ORDER BY name ASC').all();
    res.json(categories);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 카테고리 생성
router.post('/', (req, res) => {
  try {
    const { name, color } = req.body;
    
    if (!name || !color) {
      return res.status(400).json({ error: '이름과 색상은 필수입니다.' });
    }
    
    const result = db.prepare('INSERT INTO categories (name, color) VALUES (?, ?)')
      .run(name, color);
    
    const newCategory = db.prepare('SELECT * FROM categories WHERE id = ?')
      .get(result.lastInsertRowid);
    
    res.status(201).json(newCategory);
  } catch (error) {
    if (error.message.includes('UNIQUE constraint')) {
      return res.status(409).json({ error: '이미 존재하는 카테고리입니다.' });
    }
    res.status(500).json({ error: error.message });
  }
});

// 카테고리 수정
router.put('/:id', (req, res) => {
  try {
    const { name, color } = req.body;
    
    const result = db.prepare('UPDATE categories SET name = ?, color = ? WHERE id = ?')
      .run(name, color, req.params.id);
    
    if (result.changes === 0) {
      return res.status(404).json({ error: '카테고리를 찾을 수 없습니다.' });
    }
    
    const updatedCategory = db.prepare('SELECT * FROM categories WHERE id = ?')
      .get(req.params.id);
    
    res.json(updatedCategory);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 카테고리 삭제
router.delete('/:id', (req, res) => {
  try {
    const result = db.prepare('DELETE FROM categories WHERE id = ?').run(req.params.id);
    
    if (result.changes === 0) {
      return res.status(404).json({ error: '카테고리를 찾을 수 없습니다.' });
    }
    
    res.json({ message: '카테고리가 삭제되었습니다.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
