import { Router } from 'express';
import { query } from '../db/connection.js';

const router = Router();

// Get current user profile (from JWT) — tbl_hm_users + tbl_staff
router.get('/', async (req, res) => {
  try {
    const userId = req.userId;

    const [userRow] = await query(
      `SELECT user_id, user_email, user_access, user_status FROM tbl_hm_users WHERE user_id = ?`,
      [userId]
    );
    if (!userRow) return res.status(404).json({ error: 'Profile not found' });

    const [staffRow] = await query(
      `SELECT staff_id, staff_names, staff_email, staff_personal_email, staff_phone, staff_duty_station, 
              staff_degree, staff_qualifications, staff_hire_date, staff_group, supervisor_id 
       FROM tbl_staff WHERE user_id = ? LIMIT 1`,
      [userId]
    );

    let reportsTo = null;
    let directReports = [];

    if (staffRow?.supervisor_id) {
      const [managerRow] = await query(
        `SELECT s.staff_id, s.user_id, s.staff_names, s.staff_email, s.staff_phone, s.staff_duty_station,
                s.staff_group, u.user_access
         FROM tbl_staff s
         LEFT JOIN tbl_hm_users u ON u.user_id = s.user_id
         WHERE s.staff_id = ?
         LIMIT 1`,
        [staffRow.supervisor_id]
      );

      if (managerRow) {
        reportsTo = {
          staff_id: managerRow.staff_id,
          user_id: managerRow.user_id,
          name: managerRow.staff_names,
          email: managerRow.staff_email,
          phone: managerRow.staff_phone,
          department: managerRow.staff_duty_station,
          staff_group: managerRow.staff_group,
          role: managerRow.user_access,
        };
      }
    }

    if (staffRow?.staff_id) {
      directReports = await query(
        `SELECT s.staff_id, s.user_id, s.staff_names, s.staff_email, s.staff_phone, s.staff_duty_station,
                s.staff_group, u.user_access,
                COALESCE(t.pending_tasks, 0) AS pending_tasks,
                COALESCE(a.total_applications, 0) AS total_applications
         FROM tbl_staff s
         LEFT JOIN tbl_hm_users u ON u.user_id = s.user_id
         LEFT JOIN (
           SELECT assigned_to, SUM(CASE WHEN status <> 'completed' THEN 1 ELSE 0 END) AS pending_tasks
           FROM tasks
           GROUP BY assigned_to
         ) t ON t.assigned_to = s.user_id
         LEFT JOIN (
           SELECT user_id, COUNT(*) AS total_applications
           FROM applications
           GROUP BY user_id
         ) a ON a.user_id = s.user_id
         WHERE s.supervisor_id = ?
         ORDER BY s.staff_names ASC`,
        [staffRow.staff_id]
      );
    }

    res.json({
      id: userRow.user_id,
      user_id: userRow.user_id,
      name: staffRow?.staff_names ?? userRow.user_email.split('@')[0],
      email: staffRow?.staff_email || userRow.user_email,
      personal_email: staffRow?.staff_personal_email ?? null,
      role: userRow.user_access,
      department: staffRow?.staff_duty_station ?? null,
      phone: staffRow?.staff_phone ?? null,
      staff_id: staffRow?.staff_id ?? null,
      degree: staffRow?.staff_degree ?? null,
      qualifications: staffRow?.staff_qualifications ?? null,
      hire_date: staffRow?.staff_hire_date ?? null,
      staff_group: staffRow?.staff_group ?? null,
      supervisor_id: staffRow?.supervisor_id ?? null,
      reports_to: reportsTo,
      direct_reports: directReports.map((r) => ({
        staff_id: r.staff_id,
        user_id: r.user_id,
        name: r.staff_names,
        email: r.staff_email,
        phone: r.staff_phone,
        department: r.staff_duty_station,
        staff_group: r.staff_group,
        role: r.user_access,
        pending_tasks: Number(r.pending_tasks || 0),
        total_applications: Number(r.total_applications || 0),
      })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
