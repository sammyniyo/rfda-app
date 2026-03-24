/**
 * Monitoring Tool `performance_api.php` expects `staff_id` (tbl_staff.staff_id), not `user_id`.
 * Source: auth.php → `data.staff.staff_id` (LoginScreen / persisted user).
 *
 * Do **not** fall back to `user.id` — that is often `user_id` and mismatches `staff_id`, which
 * used to surface as 403 / “Session issue”. With token auth the server now corrects staff_id,
 * but the client should still send the real staff id when known.
 *
 * @param {{ staff_id?: string|number|null, id?: string|number|null }|null|undefined} user
 * @returns {string|number|null}
 */
export function getMonitoringStaffId(user) {
  if (!user) return null;
  const sid = user.staff_id;
  if (sid != null && String(sid).trim() !== '') return sid;
  return null;
}
