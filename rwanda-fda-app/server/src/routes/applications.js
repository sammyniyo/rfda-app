import { Router } from 'express';
import { query } from '../db/connection.js';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const userId = req.userId;
    const status = req.query.status;
    let sql = `SELECT id, reference_number, type, title, status, submitted_at, updated_at 
               FROM applications WHERE user_id = ?`;
    const params = [userId];
    if (status) {
      sql += ` AND status = ?`;
      params.push(status);
    }
    sql += ` ORDER BY updated_at DESC`;
    const rows = await query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const [row] = await query(
      `SELECT * FROM applications WHERE id = ?`,
      [req.params.id]
    );
    if (!row) return res.status(404).json({ error: 'Application not found' });
    res.json(row);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
