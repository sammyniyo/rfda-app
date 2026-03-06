import { Router } from 'express';
import { query } from '../db/connection.js';
import { sendPushToUser } from '../lib/push.js';

const router = Router();

async function ensurePushTokensTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS tbl_push_tokens (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      token VARCHAR(256) NOT NULL,
      platform VARCHAR(20) DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_user_token (user_id, token(200)),
      INDEX idx_user (user_id)
    )
  `);
}

// POST /api/notifications/register-device — register Expo push token
router.post('/register-device', async (req, res) => {
  try {
    const { token } = req.body;
    if (!token || typeof token !== 'string') {
      return res.status(400).json({ error: 'Token is required' });
    }

    await ensurePushTokensTable();

    const userId = req.userId;
    const platform = req.body.platform || null;

    await query(
      `INSERT INTO tbl_push_tokens (user_id, token, platform) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE platform = VALUES(platform), created_at = NOW()`,
      [userId, token, platform]
    );

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/notifications — create notification and send push (for other services / future use)
router.post('/', async (req, res) => {
  try {
    const { userId: targetUserId, type, title, message, link } = req.body;
    const actorUserId = req.userId;
    if (!targetUserId || !title) {
      return res.status(400).json({ error: 'userId and title are required' });
    }

    const [result] = await query(
      `INSERT INTO notifications (user_id, type, title, message, link) VALUES (?, ?, ?, ?, ?)`,
      [targetUserId, type || 'general', title, message || '', link || null]
    );

    await sendPushToUser(targetUserId, {
      title: title,
      body: message || '',
      data: { link: link || '' },
    });

    res.json({ id: result?.insertId, ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const userId = req.userId;
    const unreadOnly = req.query.unread === 'true';
    let sql = `SELECT id, type, title, message, read_at, created_at, link 
               FROM notifications WHERE user_id = ?`;
    const params = [userId];
    if (unreadOnly) {
      sql += ` AND read_at IS NULL`;
    }
    sql += ` ORDER BY created_at DESC LIMIT 50`;
    const rows = await query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

router.patch('/:id/read', async (req, res) => {
  try {
    await query(
      `UPDATE notifications SET read_at = NOW() WHERE id = ? AND user_id = ?`,
      [req.params.id, req.userId]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
