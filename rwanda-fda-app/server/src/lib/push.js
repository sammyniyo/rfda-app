/**
 * Push notification helper.
 * Call sendPushToUser() whenever a notification is created for a user.
 *
 * Example:
 *   import { sendPushToUser } from './lib/push.js';
 *   await sendPushToUser(userId, {
 *     title: 'New task assigned',
 *     body: 'You have been assigned a new task.',
 *     data: { link: '/tasks/123' },
 *   });
 */

import { query } from '../db/connection.js';

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

export async function sendPushToUser(userId, { title, body, data = {} }) {
  try {
    await ensurePushTokensTable();
    const tokens = await query(
      `SELECT token FROM tbl_push_tokens WHERE user_id = ?`,
      [userId]
    );
    if (!tokens?.length) return;

    const messages = tokens.map(({ token }) => ({
      to: token,
      sound: 'default',
      title: title || 'Rwanda FDA',
      body: body || '',
      data,
    }));

    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messages),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error('Push send failed:', res.status, text);
    }
  } catch (err) {
    console.error('Push send error:', err.message);
  }
}
