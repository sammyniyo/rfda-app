import { Router } from 'express';
import pool from '../db/connection.js';

const router = Router();

// GET /api/db-test — test MySQL connection (no auth)
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT 1 AS ok');
    const [countResult] = await pool.execute(
      "SELECT COUNT(*) AS n FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'tbl_hm_users'"
    );
    const hasUsersTable = (countResult[0]?.n ?? 0) > 0;
    res.json({
      ok: true,
      database: 'connected',
      tbl_hm_users_exists: !!hasUsersTable,
    });
  } catch (err) {
    console.error('DB test error:', err.message);
    res.status(500).json({
      ok: false,
      error: err.message,
      database: 'disconnected',
    });
  }
});

export default router;
