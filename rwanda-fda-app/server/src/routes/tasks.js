import { Router } from 'express';
import { query } from '../db/connection.js';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const userId = req.userId;
    const status = req.query.status; // optional filter: pending, in_progress, completed
    let sql = `SELECT id, title, description, status, priority, due_date, assigned_at, application_id 
               FROM tasks WHERE assigned_to = ?`;
    const params = [userId];
    if (status) {
      sql += ` AND status = ?`;
      params.push(status);
    }
    sql += ` ORDER BY due_date ASC, created_at DESC`;
    const rows = await query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const userId = req.userId;
    const [row] = await query(
      `SELECT id, title, description, status, priority, due_date, assigned_at, application_id, created_at, updated_at, assigned_to
       FROM tasks
       WHERE id = ? AND assigned_to = ?
       LIMIT 1`,
      [req.params.id, userId]
    );
    if (!row) return res.status(404).json({ error: 'Task not found' });
    res.json(row);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
