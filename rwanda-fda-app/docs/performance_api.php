<?php
/**
 * Staff performance API — JSON for web + mobile (Rwanda FDA Monitoring Tool).
 *
 * Deploy: copy to `monitoring-tool/TM/performance_api.php` (same folder as `data.php`).
 * Requires: `../includes/config.php` (must define `$pdo`), `./data.php` (`getDB()`).
 *
 * Auth (either):
 * - PHP session `$_SESSION['user_id']` (browser already logged in; do not use `includes/auth.php`
 *   here — it redirects unauthenticated users to HTML login and breaks the mobile app).
 * - API token from `api/auth.php`: query params `token`, `api_token`, `access_token`, `auth_token`,
 *   `user_token`, or header `Authorization: Bearer <hex>` / `Authorization: <hex>`.
 *   Validated against `tbl_api_tokens` (`expires_at > NOW()`).
 *
 * Token-authenticated callers: `staff_id` is taken from `tbl_staff` for the token’s `user_id`
 * (client `staff_id` is ignored if wrong — avoids mobile sending `user_id` by mistake).
 * Session-authenticated callers must pass a valid `staff_id` (browser / existing tool behaviour).
 *
 * Methods: GET, POST (JSON body or `application/x-www-form-urlencoded`), OPTIONS (CORS preflight).
 *
 * PHP 8.1+ recommended (`match`, arrow functions). See also `docs/performance-api.md`.
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('X-Content-Type-Options: nosniff');

require_once __DIR__ . '/../includes/config.php';
require_once __DIR__ . '/data.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

function api_json(int $code, array $payload): void
{
    http_response_code($code);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE);
    exit();
}

function get_staff_id_by_user_id(PDO $pdo, int $user_id): int
{
    $stmt = $pdo->prepare("
        SELECT staff_id
        FROM tbl_staff
        WHERE user_id = ? AND staff_status = 1
        LIMIT 1
    ");
    $stmt->execute([$user_id]);
    return (int)($stmt->fetchColumn() ?: 0);
}

$method = $_SERVER['REQUEST_METHOD'] ?? '';
if (!in_array($method, ['GET', 'POST'], true)) {
    api_json(405, ['success' => false, 'message' => 'Method not allowed']);
}

$rawInput = @file_get_contents('php://input');
$jsonInput = json_decode($rawInput ?: '', true);
if (!is_array($jsonInput)) $jsonInput = [];
$input = array_merge($_GET ?? [], $_POST ?? [], $jsonInput);

session_start();
$current_user_id = (int)($_SESSION['user_id'] ?? 0);
if ($current_user_id <= 0) {
    $token = trim((string)(
        $input['token'] ??
        $input['api_token'] ??
        $input['access_token'] ??
        $input['auth_token'] ??
        $input['user_token'] ??
        ''
    ));
    if ($token === '') {
        $h = trim((string)($_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? ''));
        if ($h !== '') {
            $token = (stripos($h, 'Bearer ') === 0) ? trim(substr($h, 7)) : $h;
        }
    }

    if ($token !== '') {
        $stmtToken = $pdo->prepare("
            SELECT user_id
            FROM tbl_api_tokens
            WHERE token = ? AND expires_at > NOW()
            ORDER BY token_id DESC
            LIMIT 1
        ");
        $stmtToken->execute([$token]);
        $tok = $stmtToken->fetch(PDO::FETCH_ASSOC);
        if ($tok) {
            $current_user_id = (int)($tok['user_id'] ?? 0);
        }
    }
}

if ($current_user_id <= 0) {
    api_json(401, ['success' => false, 'message' => 'Unauthorized']);
}

$db = getDB();
$staff_id = get_staff_id_by_user_id($pdo, $current_user_id);
if ($staff_id <= 0) {
    api_json(404, ['success' => false, 'message' => 'No active staff profile found for this user']);
}

$requested_staff_id = (int)($input['staff_id'] ?? 0);
if ($requested_staff_id > 0 && $requested_staff_id !== $staff_id) {
    api_json(403, ['success' => false, 'message' => 'You may only request your own performance data']);
}

// ─────────────────────────────────────────────────────────────
// Fixed date range — full 2026 YTD
// ─────────────────────────────────────────────────────────────

$date_cutoff = '2026-01-01';
$datetoday   = date('Y-m-d');

// ─────────────────────────────────────────────────────────────
// App config — mirrors performance.php exactly, including poe types
// ─────────────────────────────────────────────────────────────

$all_types = [
    'pil-premise', 'pil-gmp', 'chcr-cos',
    'diec-import', 'diec-import-poe',
    'fiec-import', 'fiec-import-poe',
    'fric-food', 'fsmil-premise', 'hmdr-med',
    'pil-disposal', 'vmdr-med',
];

$app_config = [
    'pil-premise'     => ['table' => 'tbl_hm_applications_pil_premise',           'pk' => 'application_id',    'stage' => 'application_current_stage', 'status_table' => 'tbl_hm_applications_status_pil_premise',   'tracking' => 'tracking_no',     'applicant' => 'applicant_name', 'timeline_table' => 'tbl_stage_timeline_config_pil_premise'],
    'pil-gmp'         => ['table' => 'tbl_hm_applications_pil_gmp',               'pk' => 'application_id',    'stage' => 'application_current_stage', 'status_table' => 'tbl_hm_applications_status_pil_gmp',       'tracking' => 'tracking_no',     'applicant' => 'applicant_name'],
    'chcr-cos'        => ['table' => 'tbl_hm_applications_cosmetics',             'pk' => 'hm_application_id', 'stage' => 'application_current_stage', 'status_table' => 'tbl_hm_applications_status_cosmetics',     'tracking' => 'tracking_no',     'applicant' => 'applicant_name'],
    'diec-import'     => ['table' => 'tbl_hm_applications_drugie',                'pk' => 'application_id',    'stage' => 'current_stage',             'status_table' => 'tbl_hm_application_status_diec',           'tracking' => 'tracking_number', 'applicant' => 'applicant_name', 'stage_col' => 'stage_description'],
    'fiec-import'     => ['table' => 'tbl_hm_applications_food_fiec',             'pk' => 'application_id',    'stage' => 'current_stage',             'status_table' => 'tbl_hm_application_status_fiec',           'tracking' => 'tracking_number', 'applicant' => 'applicant_name', 'stage_col' => 'stage_description'],
    'diec-import-poe' => ['table' => 'tbl_hm_applications_drugie_inspection',     'pk' => 'inspection_id',     'stage' => 'inspection_current_stage',  'status_table' => 'tbl_hm_applications_drugie_poe_stages',    'tracking' => 'inspection_no',   'applicant' => 'applicant_name', 'stage_col' => 'stage_description'],
    'fiec-import-poe' => ['table' => 'tbl_hm_applications_food_fiec_inspection',  'pk' => 'inspection_id',     'stage' => 'inspection_current_stage',  'status_table' => 'tbl_hm_applications_fiec_poe_stages',      'tracking' => 'inspection_no',   'applicant' => 'applicant_name', 'stage_col' => 'stage_description'],
    'fric-food'       => ['table' => 'tbl_hm_applications_food',                  'pk' => 'hm_application_id', 'stage' => 'application_current_stage', 'status_table' => 'tbl_hm_applications_status_food',          'tracking' => 'tracking_no',     'applicant' => 'applicant_name'],
    'fsmil-premise'   => ['table' => 'tbl_hm_applications_premise_food',          'pk' => 'application_id',    'stage' => 'application_current_stage', 'status_table' => 'tbl_hm_applications_status_food_ins',      'tracking' => 'tracking_no',     'applicant' => 'applicant_name'],
    'hmdr-med'        => ['table' => 'tbl_hm_applications',                       'pk' => 'hm_application_id', 'stage' => 'application_current_stage', 'status_table' => 'tbl_hm_applications_status',               'tracking' => 'tracking_no',     'applicant' => 'hm_mah'],
    'pil-disposal'    => ['table' => 'tbl_hm_applications_pil_disposal',          'pk' => 'application_id',    'stage' => 'application_current_stage', 'status_table' => 'tbl_hm_applications_status_pil_disposal',  'tracking' => 'tracking_no',     'applicant' => 'applicant_name'],
    'vmdr-med'        => ['table' => 'tbl_hm_applications_veterinary',            'pk' => 'hm_application_id', 'stage' => 'application_current_stage', 'status_table' => 'tbl_hm_applications_status_veterinary',    'tracking' => 'tracking_no',     'applicant' => 'applicant_name'],
];

$app_display_names = [
    'pil-premise'     => 'PIL Premise',      'pil-gmp'         => 'PIL GMP',
    'chcr-cos'        => 'Cosmetics',        'diec-import'     => 'Drug Import',
    'diec-import-poe' => 'Drug Import POE',  'fiec-import'     => 'Food Import',
    'fiec-import-poe' => 'Food Import POE',  'fric-food'       => 'Food Registration',
    'fsmil-premise'   => 'Food Premise',     'hmdr-med'        => 'Human Medicine',
    'pil-disposal'    => 'PIL Disposal',     'vmdr-med'        => 'Veterinary Medicine',
];

// Mirrors performance.php exactly — poe types have empty exclusion lists
$applicant_side_stages = [
    'pil-premise'     => [5, 11, 19, 28, 14, 15, 20, 10, 30, 37],
    'pil-gmp'         => [5, 10, 12, 14, 19],
    'chcr-cos'        => [16, 17, 25, 26, 27, 29, 39, 10],
    'diec-import'     => [4, 10],
    'diec-import-poe' => [],
    'fiec-import'     => [4, 10],
    'fiec-import-poe' => [],
    'fric-food'       => [16, 17, 25, 26, 27, 29, 39, 10],
    'fsmil-premise'   => [5, 11, 19, 28, 10, 14, 15, 20, 30],
    'hmdr-med'        => [16, 17, 25, 26, 27, 29, 39, 10, 14, 24, 30],
    'pil-disposal'    => [5, 11, 19, 28],
    'vmdr-med'        => [16, 17, 25, 26, 27, 29, 39],
];

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function isValidDatePerf(?string $date): bool {
    return !empty($date) && $date !== '0000-00-00' && strtotime($date) > 0;
}

function getDaysBetweenRound(string $start, string $end): int {
    if (!isValidDatePerf($start) || !isValidDatePerf($end)) return 0;
    return max(0, (int) round((strtotime($end) - strtotime($start)) / 86400));
}

// ─────────────────────────────────────────────────────────────
// Main logic
// ─────────────────────────────────────────────────────────────

try {

    // ── Verify staff member ───────────────────────────────────

    $stmtStaff = $db->prepare("
        SELECT staff_id, staff_names, staff_email, staff_group, supervisor_id
        FROM tbl_staff
        WHERE staff_id = ? AND staff_status = 1
        LIMIT 1
    ");
    $stmtStaff->execute([$staff_id]);
    $staff_row = $stmtStaff->fetch(PDO::FETCH_ASSOC);

    if (!$staff_row) {
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => "No active staff found with staff_id = {$staff_id}."]);
        exit();
    }

    // ── Aggregation containers ────────────────────────────────

    $applications    = [];
    $tasks           = [];
    $divisionTotal   = 0;
    $per_type_totals = [];

    // ═══════════════════════════════════════════════════════════
    // Loop every application type
    // ═══════════════════════════════════════════════════════════

    foreach ($all_types as $filter_type) {

        $cfg         = $app_config[$filter_type];
        $table       = $cfg['table'];
        $pk          = $cfg['pk'];
        $f_stage     = $cfg['stage'];
        $f_tracking  = $cfg['tracking'];
        $f_applicant = $cfg['applicant'];
        $status_tbl  = $cfg['status_table'];
        $stage_col   = $cfg['stage_col'] ?? 'status_description';

        $excluded_stages = array_map('intval', $applicant_side_stages[$filter_type] ?? []);
        $excl_list       = !empty($excluded_stages) ? implode(',', $excluded_stages) : null;

        $type_applications = [];

        // ═══════════════════════════════════════════════════════
        // PATH A — hmdr-med
        // ═══════════════════════════════════════════════════════
        if ($filter_type === 'hmdr-med') {

            $asgn_sql = "
                SELECT
                    aa.assignment_id, aa.application_id, aa.stage_id,
                    aa.assignment_date, aa.submission_date, aa.assigned_by,
                    aa.assignment_status, aa.is_active, aa.timelines_number_of_days,
                    ab.staff_names AS assigned_by_name,
                    a.hm_application_id         AS _pk,
                    a.tracking_no               AS _tracking,
                    a.hm_mah                    AS _applicant,
                    a.application_current_stage AS _current_stage,
                    COALESCE(hs.status_description, CONCAT('Stage ', aa.stage_id)) AS _stage_name,
                    COALESCE(hs_cur.status_description, CONCAT('Stage ', a.application_current_stage)) AS _current_stage_name
                FROM tbl_application_assignment aa
                LEFT JOIN tbl_staff ab ON aa.assigned_by = ab.staff_id
                LEFT JOIN tbl_hm_applications a ON aa.application_id = a.hm_application_id
                LEFT JOIN tbl_hm_applications_status hs ON aa.stage_id = hs.status_id
                LEFT JOIN tbl_hm_applications_status hs_cur ON a.application_current_stage = hs_cur.status_id
                WHERE aa.application_type = 'hmdr-med'
                  AND aa.staff_id         = :staff_id
                  AND aa.staff_id IS NOT NULL
                  AND aa.staff_id != 0
                  AND aa.assignment_date >= :cutoff";

            if ($excl_list) {
                $asgn_sql .= " AND (a.application_current_stage IS NULL OR a.application_current_stage NOT IN ({$excl_list}))";
            }
            $asgn_sql .= " ORDER BY aa.assignment_date DESC";

            $stmt = $db->prepare($asgn_sql);
            $stmt->execute([':staff_id' => $staff_id, ':cutoff' => $date_cutoff]);
            $raw_assignments = $stmt->fetchAll(PDO::FETCH_ASSOC);

            foreach ($raw_assignments as $asgn) {
                $is_active = false; $is_completed = false;

                if (isset($asgn['is_active'])) {
                    if ((int)$asgn['is_active'] === 1) $is_active = true;
                    else                               $is_completed = true;
                }
                if (!empty($asgn['assignment_status'])) {
                    if ($asgn['assignment_status'] === 'completed') { $is_completed = true; $is_active = false; }
                    elseif ($asgn['assignment_status'] === 'active') { $is_active = true; $is_completed = false; }
                }
                if (!empty($asgn['submission_date'])) { $is_completed = true; $is_active = false; }
                if (!$is_active && !$is_completed) $is_active = true;

                $days_allowed = !empty($asgn['timelines_number_of_days'])
                    ? (int)$asgn['timelines_number_of_days'] : 30;

                $tl_status = 'ontime'; $days_taken = 0; $days_remaining = null;

                if ($is_completed && !empty($asgn['submission_date'])) {
                    $days_taken = max(0, getDaysBetweenRound($asgn['assignment_date'], $asgn['submission_date']));
                    $tl_status  = $days_taken > $days_allowed ? 'delayed' : 'ontime';
                } elseif ($is_active) {
                    $days_taken     = max(0, getDaysBetweenRound($asgn['assignment_date'], $datetoday));
                    $days_remaining = $days_allowed - $days_taken;
                    if ($days_taken > $days_allowed)  $tl_status = 'delayed';
                    elseif ($days_remaining <= 5)     $tl_status = 'tobedelayed';
                    else                              $tl_status = 'ontime';
                }

                $type_applications[] = [
                    'application_type'   => $filter_type,
                    'type_label'         => $app_display_names[$filter_type],
                    'assignment_id'      => (int)$asgn['assignment_id'],
                    'application_id'     => (int)$asgn['application_id'],
                    'tracking_no'        => $asgn['_tracking'] ?? null,
                    'applicant'          => $asgn['_applicant'] ?? null,
                    'assigned_stage'     => $asgn['_stage_name'] ?? ('Stage ' . $asgn['stage_id']),
                    'stage_id'           => (int)$asgn['stage_id'],
                    'current_stage_name' => $asgn['_current_stage_name'] ?? null,
                    'current_stage_id'   => isset($asgn['_current_stage']) ? (int)$asgn['_current_stage'] : null,
                    'assignment_date'    => $asgn['assignment_date'],
                    'submission_date'    => $asgn['submission_date'] ?: null,
                    'days_allowed'       => $days_allowed,
                    'days_taken'         => $days_taken,
                    'days_remaining'     => $days_remaining,
                    'timeline_status'    => $tl_status,
                    'is_active'          => $is_active,
                    'is_completed'       => $is_completed,
                    'assigned_by'        => $asgn['assigned_by_name'] ?? null,
                ];
            }

        // ═══════════════════════════════════════════════════════
        // PATH B — diec/fiec + poe variants
        // ═══════════════════════════════════════════════════════
        } elseif (in_array($filter_type, ['diec-import', 'fiec-import', 'diec-import-poe', 'fiec-import-poe'])) {

            $asgn_sql = "
                SELECT
                    aa.assignment_id, aa.application_id, aa.stage_id,
                    aa.assignment_date, aa.submission_date, aa.assigned_by,
                    aa.assignment_status, aa.is_active, aa.timelines_number_of_days,
                    ab.staff_names AS assigned_by_name,
                    COALESCE(stg.`{$stage_col}`, CONCAT('Stage ', aa.stage_id)) AS assigned_stage_name
                FROM tbl_application_assignment aa
                LEFT JOIN tbl_staff ab ON aa.assigned_by = ab.staff_id
                LEFT JOIN `{$status_tbl}` stg ON aa.stage_id = stg.stage_id
                WHERE aa.application_type = :app_type
                  AND aa.staff_id         = :staff_id
                  AND aa.assignment_date >= :cutoff";

            if ($excl_list) $asgn_sql .= " AND aa.stage_id NOT IN ({$excl_list})";
            $asgn_sql .= " ORDER BY aa.assignment_date DESC";

            $stmt = $db->prepare($asgn_sql);
            $stmt->execute([':app_type' => $filter_type, ':staff_id' => $staff_id, ':cutoff' => $date_cutoff]);
            $raw_assignments = $stmt->fetchAll(PDO::FETCH_ASSOC);

            $app_ids = array_unique(array_column($raw_assignments, 'application_id'));
            $app_details = [];
            foreach (array_chunk($app_ids, 50) as $chunk) {
                $ph = implode(',', array_fill(0, count($chunk), '?'));
                try {
                    $s2 = $db->prepare("
                        SELECT
                            a.`{$pk}`          AS _pk,
                            a.`{$f_stage}`     AS _stage_id,
                            a.`{$f_tracking}`  AS _tracking,
                            a.`{$f_applicant}` AS _applicant,
                            COALESCE(hs.`{$stage_col}`, CONCAT('Stage ', a.`{$f_stage}`)) AS _current_stage_name
                        FROM `{$table}` a
                        LEFT JOIN `{$status_tbl}` hs ON a.`{$f_stage}` = hs.stage_id
                        WHERE a.`{$pk}` IN ({$ph})
                    ");
                    $s2->execute($chunk);
                    foreach ($s2->fetchAll(PDO::FETCH_ASSOC) as $row) {
                        $app_details[(string)$row['_pk']] = $row;
                    }
                } catch (Exception $e) {
                    error_log("App details query error [{$filter_type}]: " . $e->getMessage());
                }
            }

            foreach ($raw_assignments as $asgn) {
                $app_id = (string)$asgn['application_id'];
                $app    = $app_details[$app_id] ?? null;

                // Active/completed resolution — mirrors performance.php diec/fiec path
                $is_active = true; $is_completed = false;
                if (!empty($asgn['submission_date'])) {
                    $is_completed = true; $is_active = false;
                } elseif (!empty($asgn['assignment_status'])) {
                    if ($asgn['assignment_status'] === 'completed') { $is_completed = true; $is_active = false; }
                    elseif ($asgn['assignment_status'] === 'active') { $is_active = true; $is_completed = false; }
                } elseif (isset($asgn['is_active'])) {
                    $is_active    = ((int)$asgn['is_active'] === 1);
                    $is_completed = !$is_active;
                }

                $days_allowed = !empty($asgn['timelines_number_of_days'])
                    ? (int)$asgn['timelines_number_of_days'] : 30;

                $tl_status = 'ontime'; $days_taken = 0; $days_remaining = null;

                if ($is_completed && !empty($asgn['submission_date'])) {
                    $days_taken = max(0, (int)round(
                        (strtotime($asgn['submission_date']) - strtotime($asgn['assignment_date'])) / 86400
                    ));
                    $tl_status = $days_taken > $days_allowed ? 'delayed' : 'ontime';
                } elseif ($is_active) {
                    $days_taken     = max(0, (int)round((strtotime($datetoday) - strtotime($asgn['assignment_date'])) / 86400));
                    $days_remaining = $days_allowed - $days_taken;
                    $tl_status      = $days_taken > $days_allowed ? 'delayed' : 'ontime';
                } else {
                    $tl_status = 'ontime';
                }

                $type_applications[] = [
                    'application_type'   => $filter_type,
                    'type_label'         => $app_display_names[$filter_type],
                    'assignment_id'      => (int)$asgn['assignment_id'],
                    'application_id'     => (int)$app_id,
                    'tracking_no'        => $app['_tracking'] ?? null,
                    'applicant'          => $app['_applicant'] ?? null,
                    'assigned_stage'     => $asgn['assigned_stage_name'],
                    'stage_id'           => (int)$asgn['stage_id'],
                    'current_stage_name' => $app['_current_stage_name'] ?? null,
                    'current_stage_id'   => isset($app['_stage_id']) ? (int)$app['_stage_id'] : null,
                    'assignment_date'    => $asgn['assignment_date'],
                    'submission_date'    => $asgn['submission_date'] ?: null,
                    'days_allowed'       => $days_allowed,
                    'days_taken'         => $days_taken,
                    'days_remaining'     => $days_remaining,
                    'timeline_status'    => $tl_status,
                    'is_active'          => $is_active,
                    'is_completed'       => $is_completed,
                    'assigned_by'        => $asgn['assigned_by_name'] ?? null,
                ];
            }

        // ═══════════════════════════════════════════════════════
        // PATH C — all other types (general path)
        // ═══════════════════════════════════════════════════════
        } else {

            $asgn_stage_col      = $cfg['stage_col'] ?? 'status_description';
            $asgn_stage_join_col = isset($cfg['stage_col']) ? 'stage_id' : 'status_id';

            $asgn_sql = "
                SELECT
                    aa.assignment_id, aa.application_id, aa.stage_id,
                    aa.assignment_date, aa.submission_date,
                    aa.assignment_status, aa.is_active, aa.timelines_number_of_days,
                    ab.staff_names AS assigned_by_name,
                    COALESCE(stg.`{$asgn_stage_col}`, CONCAT('Stage ', aa.stage_id)) AS assigned_stage_name
                FROM tbl_application_assignment aa
                LEFT JOIN tbl_staff ab ON aa.assigned_by = ab.staff_id
                LEFT JOIN `{$table}` app_tbl ON aa.application_id = app_tbl.`{$pk}`
                LEFT JOIN `{$status_tbl}` stg ON aa.stage_id = stg.`{$asgn_stage_join_col}`
                WHERE aa.application_type = :app_type
                  AND aa.staff_id         = :staff_id
                  AND aa.assignment_date >= :cutoff";

            if ($excl_list) {
                $asgn_sql .= " AND aa.stage_id NOT IN ({$excl_list})";
                $asgn_sql .= " AND (app_tbl.`{$f_stage}` IS NULL OR app_tbl.`{$f_stage}` NOT IN ({$excl_list}))";
            }
            $asgn_sql .= " ORDER BY aa.assignment_date DESC";

            $stmt = $db->prepare($asgn_sql);
            $stmt->execute([':app_type' => $filter_type, ':staff_id' => $staff_id, ':cutoff' => $date_cutoff]);
            $raw_assignments = $stmt->fetchAll(PDO::FETCH_ASSOC);

            $app_ids = array_unique(array_column($raw_assignments, 'application_id'));
            $app_details = [];

            foreach (array_chunk($app_ids, 50) as $chunk) {
                $ph = implode(',', array_fill(0, count($chunk), '?'));

                $has_ref_no = false;
                try {
                    $col_check  = $db->query("SHOW COLUMNS FROM `{$table}` LIKE 'reference_no'");
                    $has_ref_no = ($col_check->rowCount() > 0);
                } catch (Exception $e) { $has_ref_no = false; }

                $ref_no_select   = $has_ref_no ? "a.reference_no AS _ref_no," : "NULL AS _ref_no,";
                $stage_col_field = $cfg['stage_col'] ?? 'status_description';
                $status_join_col = isset($cfg['stage_col']) ? 'stage_id' : 'status_id';

                try {
                    $s2 = $db->prepare("
                        SELECT
                            a.`{$pk}`               AS _pk,
                            a.`{$f_stage}`          AS _stage_id,
                            a.`{$f_tracking}`       AS _tracking,
                            {$ref_no_select}
                            a.`{$f_applicant}`      AS _applicant,
                            hs.`{$stage_col_field}` AS _stage_name
                        FROM `{$table}` a
                        LEFT JOIN `{$status_tbl}` hs ON a.`{$f_stage}` = hs.`{$status_join_col}`
                        WHERE a.`{$pk}` IN ({$ph})
                    ");
                    $s2->execute($chunk);
                    foreach ($s2->fetchAll(PDO::FETCH_ASSOC) as $row) {
                        $app_details[(string)$row['_pk']] = $row;
                    }
                } catch (Exception $e) {
                    error_log("App details query error [{$filter_type}]: " . $e->getMessage());
                }
            }

            // Stage-specific timelines
            if (isset($cfg['timeline_table'])) {
                $tl_stmt = $db->prepare("
                    SELECT stage_id, expected_working_days, warning_threshold_days
                    FROM {$cfg['timeline_table']} WHERE is_active = 1
                ");
                $tl_stmt->execute();
                $timelines = []; $warning_thresholds = [];
                foreach ($tl_stmt->fetchAll(PDO::FETCH_ASSOC) as $tl) {
                    $timelines[$tl['stage_id']]          = (int)$tl['expected_working_days'];
                    $warning_thresholds[$tl['stage_id']] = (int)($tl['warning_threshold_days'] ?? 5);
                }
            }

            foreach ($raw_assignments as $asgn) {
                $app_id = (string)$asgn['application_id'];
                $app    = $app_details[$app_id] ?? $app_details[(int)$app_id] ?? null;

                $stage_id           = $app['_stage_id'] ?? null;
                $current_stage_name = !empty($app['_stage_name'])
                    ? $app['_stage_name']
                    : (!empty($stage_id) ? 'Stage ' . $stage_id : null);

                $is_active    = ($asgn['assignment_status'] === 'active' && (int)$asgn['is_active'] === 1);
                $is_completed = ($asgn['assignment_status'] === 'completed');
                if (!empty($asgn['submission_date'])) { $is_completed = true; $is_active = false; }
                if (!$is_active && !$is_completed)     { $is_active = true; }

                $days_allowed      = !empty($asgn['timelines_number_of_days'])
                    ? (int)$asgn['timelines_number_of_days'] : 30;
                $warning_threshold = 5;

                $tl_status = 'ontime'; $days_taken = 0; $days_remaining = null;

                if ($is_completed && !empty($asgn['submission_date'])) {
                    $days_taken = max(0, (int)round(
                        (strtotime($asgn['submission_date']) - strtotime($asgn['assignment_date'])) / 86400
                    ));
                    $tl_status = $days_taken > $days_allowed ? 'delayed' : 'ontime';
                } elseif ($is_active) {
                    $days_taken     = max(0, (int)round((strtotime($datetoday) - strtotime($asgn['assignment_date'])) / 86400));
                    $days_remaining = $days_allowed - $days_taken;
                    $warning_point  = $days_allowed - $warning_threshold;
                    if ($days_taken > $days_allowed)       $tl_status = 'delayed';
                    elseif ($days_taken >= $warning_point) $tl_status = 'tobedelayed';
                    else                                   $tl_status = 'ontime';
                } else {
                    $tl_status = 'ontime';
                }

                $type_applications[] = [
                    'application_type'   => $filter_type,
                    'type_label'         => $app_display_names[$filter_type],
                    'assignment_id'      => (int)$asgn['assignment_id'],
                    'application_id'     => (int)$app_id,
                    'tracking_no'        => !empty($app['_tracking']) ? $app['_tracking'] : ($app['_ref_no'] ?? null),
                    'applicant'          => $app['_applicant'] ?? null,
                    'assigned_stage'     => !empty($asgn['assigned_stage_name'])
                                               ? $asgn['assigned_stage_name']
                                               : (!empty($asgn['stage_id']) ? 'Stage ' . $asgn['stage_id'] : 'Unlinked'),
                    'stage_id'           => (int)$asgn['stage_id'],
                    'current_stage_name' => $current_stage_name,
                    'current_stage_id'   => isset($stage_id) ? (int)$stage_id : null,
                    'assignment_date'    => $asgn['assignment_date'],
                    'submission_date'    => $asgn['submission_date'] ?: null,
                    'days_allowed'       => $days_allowed,
                    'days_taken'         => $days_taken,
                    'days_remaining'     => $days_remaining,
                    'timeline_status'    => $tl_status,
                    'is_active'          => $is_active,
                    'is_completed'       => $is_completed,
                    'assigned_by'        => $asgn['assigned_by_name'] ?? null,
                ];
            }
        }

        // ── Merge assignments into master list ────────────────

        $applications = array_merge($applications, $type_applications);

        // ── Per-type assignment summary ───────────────────────

        $t_total     = count($type_applications);
        $t_completed = count(array_filter($type_applications, fn($a) => $a['is_completed']));
        $t_active    = count(array_filter($type_applications, fn($a) => $a['is_active']));
        $t_ontime    = count(array_filter($type_applications, fn($a) => $a['timeline_status'] === 'ontime'));
        $t_atrisk    = count(array_filter($type_applications, fn($a) => $a['timeline_status'] === 'tobedelayed'));
        $t_delayed   = count(array_filter($type_applications, fn($a) => $a['timeline_status'] === 'delayed'));

        $per_type_totals[$filter_type] = [
            'label'     => $app_display_names[$filter_type],
            'total'     => $t_total,
            'active'    => $t_active,
            'completed' => $t_completed,
            'ontime'    => $t_ontime,
            'at_risk'   => $t_atrisk,
            'delayed'   => $t_delayed,
        ];

        // ═══════════════════════════════════════════════════════
        // TASKS — mirrors performance.php tasks block exactly
        //
        // Critical fixes vs previous version:
        //   1. Uses t.original_assignee column (not assigned_to) — matches performance.php
        //   2. completed_late = completed after due date → counts as ONTIME in accuracy score
        //      (performance.php: in_array($task_tl_status, ['ontime','completed_late']) → task_ontime++)
        //   3. Only truly overdue active tasks count as 'delayed' in scoring
        // ═══════════════════════════════════════════════════════

        try {
            $task_sql = "
                SELECT
                    t.task_id, t.title, t.description, t.task_category,
                    t.status, t.priority, t.due_date, t.completed_at,
                    t.created_at, t.original_assignee, t.assigned_by,
                    ab.staff_names AS assigned_by_name
                FROM tbl_tasks t
                LEFT JOIN tbl_staff ab ON t.assigned_by = ab.staff_id
                WHERE t.is_deleted        = 0
                  AND t.application_type  = :app_type
                  AND t.original_assignee = :staff_id
                  AND t.status NOT IN ('cancelled')
                  AND t.created_at       >= :cutoff
                ORDER BY t.due_date ASC";

            $task_stmt = $db->prepare($task_sql);
            $task_stmt->execute([
                ':app_type' => $filter_type,
                ':staff_id' => $staff_id,
                ':cutoff'   => $date_cutoff,
            ]);
            $type_raw_tasks = $task_stmt->fetchAll(PDO::FETCH_ASSOC);

            $type_task_completed = 0;
            $type_task_active    = 0;

            foreach ($type_raw_tasks as $task) {
                $task_is_completed = in_array($task['status'], ['completed', 'review']);
                $task_is_active    = !$task_is_completed;

                $due_ts     = strtotime($task['due_date']);
                $today_ts   = strtotime($datetoday);
                $created_ts = strtotime($task['created_at']);

                $task_days_allowed = max(1, (int)round(($due_ts - $created_ts) / 86400));

                if ($task_is_completed && !empty($task['completed_at'])) {
                    $completed_ts        = strtotime($task['completed_at']);
                    $task_days_taken     = max(0, (int)round(($completed_ts - $created_ts) / 86400));
                    $task_days_remaining = null;
                    // completed_late: done but after due date — ONTIME in scoring (mirrors performance.php)
                    $task_tl_status = $completed_ts > $due_ts ? 'completed_late' : 'ontime';
                } elseif ($task_is_completed) {
                    // completed but no completed_at — assume on time
                    $task_days_taken     = $task_days_allowed;
                    $task_days_remaining = 0;
                    $task_tl_status      = 'ontime';
                } else {
                    $task_days_taken     = max(0, (int)round(($today_ts - $created_ts) / 86400));
                    $task_days_remaining = (int)round(($due_ts - $today_ts) / 86400);
                    if ($today_ts > $due_ts)           $task_tl_status = 'delayed';
                    elseif ($task_days_remaining <= 2) $task_tl_status = 'tobedelayed';
                    else                               $task_tl_status = 'ontime';
                }

                if ($task_is_completed) $type_task_completed++;
                else                   $type_task_active++;

                $tasks[] = [
                    'application_type' => $filter_type,
                    'type_label'       => $app_display_names[$filter_type],
                    'task_id'          => (int)$task['task_id'],
                    'title'            => $task['title'],
                    'description'      => $task['description'],
                    'category'         => $task['task_category'],
                    'status'           => $task['status'],
                    'priority'         => $task['priority'],
                    'due_date'         => $task['due_date'],
                    'completed_at'     => $task['completed_at'] ?: null,
                    'created_at'       => $task['created_at'],
                    'days_allowed'     => $task_days_allowed,
                    'days_taken'       => $task_days_taken,
                    'days_remaining'   => $task_days_remaining,
                    // ontime | tobedelayed | delayed | completed_late
                    'timeline_status'  => $task_tl_status,
                    'is_active'        => $task_is_active,
                    'is_completed'     => $task_is_completed,
                    'assigned_by'      => $task['assigned_by_name'] ?? null,
                ];
            }

            $per_type_totals[$filter_type]['tasks_total']    = count($type_raw_tasks);
            $per_type_totals[$filter_type]['tasks_completed'] = $type_task_completed;
            $per_type_totals[$filter_type]['tasks_active']    = $type_task_active;

        } catch (Exception $e) {
            error_log("Tasks error [{$filter_type}]: " . $e->getMessage());
            $per_type_totals[$filter_type]['tasks_total']    = 0;
            $per_type_totals[$filter_type]['tasks_completed'] = 0;
            $per_type_totals[$filter_type]['tasks_active']    = 0;
        }

        // ── Division total for this type ──────────────────────
        // Mirrors performance.php: sum each staff member's count (GROUP BY staff_id)
        // so the denominator represents the same pool as the dashboard

        $divAsgnSql = "SELECT aa.staff_id, COUNT(*) AS staff_total FROM tbl_application_assignment aa";

        if ($filter_type === 'hmdr-med') {
            $divAsgnSql .= " LEFT JOIN tbl_hm_applications a ON aa.application_id = a.hm_application_id";
        } elseif (!in_array($filter_type, ['diec-import', 'fiec-import', 'diec-import-poe', 'fiec-import-poe'])) {
            $divAsgnSql .= " LEFT JOIN `{$table}` app_tbl ON aa.application_id = app_tbl.`{$pk}`";
        }

        $divAsgnSql .= "
            WHERE aa.application_type = :t
              AND aa.staff_id IS NOT NULL
              AND aa.staff_id != 0
              AND aa.assignment_date >= :c";

        if ($excl_list) {
            if ($filter_type === 'hmdr-med') {
                $divAsgnSql .= " AND (a.application_current_stage IS NULL OR a.application_current_stage NOT IN ({$excl_list}))";
            } elseif (in_array($filter_type, ['diec-import', 'fiec-import', 'diec-import-poe', 'fiec-import-poe'])) {
                $divAsgnSql .= " AND aa.stage_id NOT IN ({$excl_list})";
            } else {
                $divAsgnSql .= " AND aa.stage_id NOT IN ({$excl_list})";
                $divAsgnSql .= " AND (app_tbl.`{$f_stage}` IS NULL OR app_tbl.`{$f_stage}` NOT IN ({$excl_list}))";
            }
        }
        $divAsgnSql .= " GROUP BY aa.staff_id";

        $stmtDivAsgn = $db->prepare($divAsgnSql);
        $stmtDivAsgn->execute([':t' => $filter_type, ':c' => $date_cutoff]);
        $divisionTotal += (int)array_sum(array_column($stmtDivAsgn->fetchAll(PDO::FETCH_ASSOC), 'staff_total'));

        // Task division total — uses original_assignee to match performance.php exactly
        $stmtDivTasks = $db->prepare("
            SELECT original_assignee, COUNT(*) AS staff_total
            FROM tbl_tasks
            WHERE application_type = :t
              AND is_deleted        = 0
              AND status           != 'cancelled'
              AND created_at       >= :c
            GROUP BY original_assignee
        ");
        $stmtDivTasks->execute([':t' => $filter_type, ':c' => $date_cutoff]);
        $divisionTotal += (int)array_sum(array_column($stmtDivTasks->fetchAll(PDO::FETCH_ASSOC), 'staff_total'));

    } // end foreach $all_types

    // ─────────────────────────────────────────────────────────────
    // Aggregate summary counters
    // ─────────────────────────────────────────────────────────────

    $app_total     = count($applications);
    $app_completed = count(array_filter($applications, fn($a) => $a['is_completed']));
    $app_active    = count(array_filter($applications, fn($a) => $a['is_active']));
    $app_ontime    = count(array_filter($applications, fn($a) => $a['timeline_status'] === 'ontime'));
    $app_atrisk    = count(array_filter($applications, fn($a) => $a['timeline_status'] === 'tobedelayed'));
    $app_delayed   = count(array_filter($applications, fn($a) => $a['timeline_status'] === 'delayed'));
    $unique_apps   = count(array_unique(array_column($applications, 'application_id')));

    $completed_days = array_map(
        fn($a) => $a['days_taken'],
        array_filter($applications, fn($a) => $a['is_completed'] && $a['days_taken'] > 0)
    );
    $avg_completion_days = count($completed_days) > 0
        ? (int)round(array_sum($completed_days) / count($completed_days))
        : 0;

    $task_total     = count($tasks);
    $task_completed = count(array_filter($tasks, fn($t) => $t['is_completed']));
    $task_active    = count(array_filter($tasks, fn($t) => $t['is_active']));
    $task_delayed   = count(array_filter($tasks, fn($t) => $t['timeline_status'] === 'delayed'));
    $task_atrisk    = count(array_filter($tasks, fn($t) => $t['timeline_status'] === 'tobedelayed'));
    $task_late      = count(array_filter($tasks, fn($t) => $t['timeline_status'] === 'completed_late'));

    // task_ontime includes completed_late — mirrors performance.php
    // in_array($task_tl_status, ['ontime','completed_late']) => task_ontime++
    $task_ontime = count(array_filter($tasks, fn($t) => in_array($t['timeline_status'], ['ontime', 'completed_late'])));

    // Grand totals for fair score
    $N             = $app_ontime + $task_ontime;   // ontime (completed_late counts)
    $D             = $app_total  + $task_total;    // total work items
    $grand_delayed = $app_delayed + $task_delayed; // only truly delayed active tasks

    // ─────────────────────────────────────────────────────────────
    // Fair Score — exact mirror of calcScoreData() in performance.php
    // ─────────────────────────────────────────────────────────────

    if ($D == 0) {
        $ontime_rate   = 0.0;
        $volume_pct    = 0.0;
        $fair_score    = 0;
        $score_label   = 'No Data';
        $low_volume    = true;
        $accuracy_base = 0;
    } else {
        $accuracy_base = $N + $grand_delayed;
        $ontime_rate   = $accuracy_base > 0
            ? round(($N / $accuracy_base) * 100, 1)
            : 100.0;

        $volume_pct = $divisionTotal > 0
            ? round(($D / $divisionTotal) * 100, 1)
            : 0.0;

        $raw_score  = ($ontime_rate * (1 - 0.40)) + ($volume_pct * 0.40);
        $fair_score = (int)round(max(0, min(100, $raw_score)));
        $low_volume = ($volume_pct < 20 && $divisionTotal > 0);

        $score_label = match(true) {
            $fair_score >= 80 => 'Excellent',
            $fair_score >= 60 => 'Good',
            $fair_score >= 40 => 'Average',
            $fair_score >= 20 => 'Below Average',
            default           => 'Poor',
        };
    }

    // ─────────────────────────────────────────────────────────────
    // Stage breakdown
    // ─────────────────────────────────────────────────────────────

    $stage_breakdown = [];
    foreach ($applications as $a) {
        $key = $a['application_type'] . '::' . $a['assigned_stage'];
        if (!isset($stage_breakdown[$key])) {
            $stage_breakdown[$key] = [
                'application_type' => $a['application_type'],
                'type_label'       => $a['type_label'],
                'stage'            => $a['assigned_stage'],
                'total'            => 0, 'ontime' => 0, 'at_risk' => 0, 'delayed' => 0,
            ];
        }
        $stage_breakdown[$key]['total']++;
        if ($a['timeline_status'] === 'delayed')         $stage_breakdown[$key]['delayed']++;
        elseif ($a['timeline_status'] === 'tobedelayed') $stage_breakdown[$key]['at_risk']++;
        else                                             $stage_breakdown[$key]['ontime']++;
    }

    // ─────────────────────────────────────────────────────────────
    // Response
    // ─────────────────────────────────────────────────────────────

    http_response_code(200);
    echo json_encode([
        'success' => true,
        'message' => 'Staff performance data retrieved successfully',
        'data'    => [

            'staff' => [
                'staff_id'       => (int)$staff_row['staff_id'],
                'name'           => $staff_row['staff_names'],
                'email'          => $staff_row['staff_email'],
                'group'          => $staff_row['staff_group'],
                'is_non_statute' => !empty($staff_row['staff_group'])
                                    && strtolower(trim($staff_row['staff_group'])) !== 'under statute',
            ],

            'filter' => [
                'application_types' => $all_types,
                'date_cutoff'       => $date_cutoff,
                'date_ceiling'      => 'today (' . $datetoday . ')',
                'note'              => 'Full 2026 YTD — all 12 application types aggregated',
            ],

            'fair_score'  => $fair_score,
            'score_label' => $score_label,
            'accuracy'    => $ontime_rate,
            'workload'    => $volume_pct,
            'low_volume'  => $low_volume,
            'kpi_value'   => $fair_score,

            'total_work_items'      => $D,
            'total_app_assignments' => $app_total,
            'total_tasks'           => $task_total,

            'applications_summary' => [
                'total'               => $app_total,
                'unique_applications' => $unique_apps,
                'active'              => $app_active,
                'completed'           => $app_completed,
                'ontime'              => $app_ontime,
                'at_risk'             => $app_atrisk,
                'delayed'             => $app_delayed,
                'avg_completion_days' => $avg_completion_days,
            ],

            'tasks_summary' => [
                'total'          => $task_total,
                'active'         => $task_active,
                'completed'      => $task_completed,
                'ontime'         => $task_ontime,       // includes completed_late
                'at_risk'        => $task_atrisk,
                'delayed'        => $task_delayed,      // overdue active tasks only
                'completed_late' => $task_late,         // done past due — scored as ontime
            ],

            'per_type_breakdown' => array_values($per_type_totals),
            'stage_breakdown'    => array_values($stage_breakdown),
            'applications'       => $applications,
            'tasks'              => $tasks,

            'formula' => '(Accuracy × 60%) + (Volume Share × 40%)',
            'calculation_details' => [
                'notes' => [
                    'completed_late tasks count as ONTIME in accuracy (mirrors performance.php)',
                    'only overdue active tasks count as delayed in accuracy',
                    'tobedelayed excluded from accuracy numerator and denominator',
                    'tasks queried via original_assignee column — matches performance.php',
                    'division_total groups by staff_id / original_assignee — same method as performance.php',
                    'includes diec-import-poe and fiec-import-poe types (no stage exclusions)',
                ],
                'accuracy' => [
                    'N'       => $N,
                    'D'       => $accuracy_base,
                    'result'  => $ontime_rate . '%',
                    'formula' => 'ontime / (ontime + delayed) × 100',
                ],
                'volume_share' => [
                    'staff_total'    => $D,
                    'division_total' => $divisionTotal,
                    'result'         => $volume_pct . '%',
                    'formula'        => 'staff_total / division_total × 100',
                ],
                'fair_score' => [
                    'result'  => $fair_score . '%',
                    'formula' => '(accuracy × 60%) + (volume_share × 40%)',
                ],
            ],
        ],
        'generated_at' => date('Y-m-d H:i:s'),
    ]);

} catch (PDOException $e) {
    api_json(500, ['success' => false, 'message' => 'Database error: ' . $e->getMessage()]);
} catch (Exception $e) {
    api_json(500, ['success' => false, 'message' => 'Server error: ' . $e->getMessage()]);
}