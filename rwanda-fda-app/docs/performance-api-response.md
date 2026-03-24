# `performance_api.php` — response shape (staff-scoped)

When the client sends the **logged-in staff id** (and a valid API token), a successful JSON body looks like:

```json
{
  "success": true,
  "message": "Staff performance data retrieved successfully",
  "data": { ... },
  "generated_at": "2026-03-23T..."
}
```

## Top-level `data` fields (mobile-relevant)

| Field | Notes |
|--------|--------|
| `staff` | Canonical staff profile for the row returned (see below). |
| `filter` | `application_types`, `date_cutoff`, `date_ceiling`, `note`. |
| `fair_score`, `score_label`, `accuracy`, `workload`, `low_volume`, `kpi_value` | KPI / scoring. |
| `total_work_items`, `total_app_assignments`, `total_tasks` | Counts. |
| `applications_summary` | `total`, `unique_applications`, `active`, `completed`, `ontime`, `at_risk`, `delayed`, `avg_completion_days`. |
| `tasks_summary` | Same style for tasks. |
| `per_type_breakdown` | Array of `{ label, total, active, completed, ontime, at_risk, delayed, tasks_* }`. |
| `stage_breakdown` | `{ application_type, type_label, stage, total, ontime, at_risk, delayed }[]`. |
| `applications` | Assignment-level rows for lists / drill-down. |
| `tasks` | Task rows (may be empty). |
| `formula`, `calculation_details` | Transparency for fair score. |

## `data.staff` (merged into app user after load)

The mobile app merges this into SecureStore-backed `user` when the dashboard loads performance data (only when values change):

- `staff_id` (number)
- `name`
- `email`
- `group` (also stored as `dutyStation` for UI that expects duty station)
- `is_non_statute` (boolean)

## `applications[]` item (typical)

- `application_type`, `type_label`
- `assignment_id`, `application_id`, `tracking_no`, `applicant`
- `assigned_stage`, `stage_id`, `current_stage_name`, `current_stage_id`
- `assignment_date`, `submission_date`
- `days_allowed`, `days_taken`, `days_remaining`
- `timeline_status`: e.g. `ontime`, `delayed`, `tobedelayed`
- `is_active`, `is_completed`, `assigned_by`

## Timeline status

The API may return `tobedelayed` for at-risk items; the app maps that to “At risk” in UI.

See also [performance-api.md](./performance-api.md) for tokens, HTML login responses, and caching.
