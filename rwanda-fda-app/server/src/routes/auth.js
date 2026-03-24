/**
 * Auth API — same users as Monitoring Tool web (includes/auth.php).
 * Uses tbl_hm_users + tbl_staff. Point DB_* in .env to the same DB as includes/config.php.
 */
import { Router } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../db/connection.js';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'rwanda-fda-secret-change-in-production';
const JWT_EXPIRES = process.env.JWT_EXPIRES || '7d';

// POST /api/auth/login — same credentials as web (tbl_hm_users + tbl_staff)
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Please enter your email and password.' });
    }

    const emailNorm = email.trim().toLowerCase();
    const rows = await query(
      `SELECT user_id, user_email, user_passcode, user_access, user_status 
       FROM tbl_hm_users WHERE LOWER(TRIM(user_email)) = ? AND user_status = 1 LIMIT 1`,
      [emailNorm]
    );

    if (!rows.length) {
      return res.status(401).json({ error: 'The email or password you entered is incorrect. Please try again.' });
    }

    const row = rows[0];
    const stored = row.user_passcode;
    const input = String(password ?? '').trim();
    const storedStr = stored == null ? '' : String(stored).trim();
    let valid = false;
    if (storedStr.startsWith('$2y$') || storedStr.startsWith('$2a$') || storedStr.startsWith('$2b$')) {
      valid = await bcrypt.compare(input, storedStr);
    } else {
      // Plain passcodes (e.g. "3244") and legacy string matches; DB drivers may return numbers as strings.
      valid =
        input === storedStr ||
        (input !== '' && !Number.isNaN(Number(input)) && !Number.isNaN(Number(storedStr)) && Number(input) === Number(storedStr));
    }

    if (!valid) {
      return res.status(401).json({ error: 'The email or password you entered is incorrect. Please try again.' });
    }

    const userId = row.user_id;
    const token = jwt.sign(
      { userId, email: row.user_email },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES }
    );

    const [staffRow] = await query(
      `SELECT staff_id, staff_names, staff_email, staff_phone, staff_duty_station 
       FROM tbl_staff WHERE user_id = ? AND (staff_status = 1 OR staff_status IS NULL) LIMIT 1`,
      [userId]
    );

    res.json({
      token,
      user: {
        id: userId,
        user_id: userId,
        email: row.user_email,
        name: staffRow?.staff_names ?? row.user_email.split('@')[0],
        role: row.user_access,
        department: staffRow?.staff_duty_station ?? null,
        phone: staffRow?.staff_phone ?? null,
        staff_id: staffRow?.staff_id ?? null,
      },
    });
  } catch (err) {
    console.error(err);
    const isDbUnreachable = err?.code === 'ETIMEDOUT' || err?.code === 'ECONNREFUSED' || err?.code === 'ENOTFOUND';
    if (isDbUnreachable) {
      return res.status(503).json({
        error: 'Database unreachable. If using a remote host, check network, VPN, or firewall (port 3306). For local dev, use a local MySQL or SSH tunnel.',
      });
    }
    res.status(500).json({ error: 'Something went wrong. Please try again later.' });
  }
});

// POST /api/auth/forgot-password — request password reset
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || typeof email !== 'string') {
      return res.status(400).json({ error: 'Please enter your email address.' });
    }

    const emailNorm = email.trim().toLowerCase();
    const [row] = await query(
      `SELECT user_id FROM tbl_hm_users WHERE LOWER(TRIM(user_email)) = ? AND user_status = 1 LIMIT 1`,
      [emailNorm]
    );

    // Always respond the same (don't reveal if email exists)
    const successResponse = { message: 'If an account exists with that email, you will receive a password reset link.' };

    if (!row) {
      return res.json(successResponse);
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await query(
      `CREATE TABLE IF NOT EXISTS tbl_password_resets (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        token VARCHAR(64) NOT NULL,
        expires_at DATETIME NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_token (token),
        INDEX idx_expires (expires_at)
      )`
    );

    await query(
      `INSERT INTO tbl_password_resets (user_id, token, expires_at) VALUES (?, ?, ?)`,
      [row.user_id, token, expiresAt]
    );

    const baseUrl = process.env.RESET_LINK_BASE_URL || process.env.APP_URL || 'http://localhost:3000';
    const resetLink = `${baseUrl.replace(/\/$/, '')}/reset-password?token=${token}`;

    // Optional: send email via nodemailer if configured
    if (process.env.SMTP_HOST) {
      try {
        const { default: nodemailer } = await import('nodemailer');
        const transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: parseInt(process.env.SMTP_PORT || '587', 10),
          secure: process.env.SMTP_SECURE === 'true',
          auth: process.env.SMTP_USER ? {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
          } : undefined,
        });
        await transporter.sendMail({
          from: process.env.SMTP_FROM || process.env.SMTP_USER || 'noreply@rwandafda.gov.rw',
          to: emailNorm,
          subject: 'Rwanda FDA — Reset your password',
          text: `You requested a password reset. Click the link below to set a new password (expires in 1 hour):\n\n${resetLink}`,
          html: `<p>You requested a password reset.</p><p><a href="${resetLink}">Reset your password</a></p><p>This link expires in 1 hour.</p>`,
        });
      } catch (mailErr) {
        console.error('Failed to send reset email:', mailErr.message);
      }
    } else {
      console.log('[Dev] Password reset link:', resetLink);
    }

    return res.json(successResponse);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "We couldn't process your request. Please try again later." });
  }
});

// POST /api/auth/reset-password — set new password with token
router.post('/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) {
      return res.status(400).json({ error: 'This reset link is invalid. Please request a new password reset.' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Your password must be at least 6 characters long.' });
    }

    const [resetRow] = await query(
      `SELECT id, user_id FROM tbl_password_resets WHERE token = ? AND expires_at > NOW() LIMIT 1`,
      [token]
    );

    if (!resetRow) {
      return res.status(400).json({ error: 'This reset link has expired or is invalid. Please request a new password reset.' });
    }

    const hash = await bcrypt.hash(newPassword, 10);
    await query(
      `UPDATE tbl_hm_users SET user_passcode = ? WHERE user_id = ?`,
      [hash, resetRow.user_id]
    );
    await query(`DELETE FROM tbl_password_resets WHERE id = ?`, [resetRow.id]);

    return res.json({ message: 'Password updated. You can now sign in.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong. Please try again later.' });
  }
});

// POST /api/auth/refresh
router.post('/refresh', async (req, res) => {
  try {
    const auth = req.headers.authorization;
    const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Token required' });

    const decoded = jwt.verify(token, JWT_SECRET);
    const [row] = await query(
      `SELECT user_id, user_email, user_access FROM tbl_hm_users WHERE user_id = ? AND user_status = 1`,
      [decoded.userId]
    );
    if (!row) return res.status(401).json({ error: 'User not found' });

    const [staffRow] = await query(
      `SELECT staff_id, staff_names, staff_phone, staff_duty_station FROM tbl_staff WHERE user_id = ? LIMIT 1`,
      [decoded.userId]
    );

    const newToken = jwt.sign(
      { userId: row.user_id, email: row.user_email },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES }
    );
    res.json({
      token: newToken,
      user: {
        id: row.user_id,
        user_id: row.user_id,
        email: row.user_email,
        name: staffRow?.staff_names ?? row.user_email.split('@')[0],
        role: row.user_access,
        department: staffRow?.staff_duty_station ?? null,
        phone: staffRow?.staff_phone ?? null,
        staff_id: staffRow?.staff_id ?? null,
      },
    });
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
});

export default router;
export { JWT_SECRET };
