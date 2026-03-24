<?php
/**
 * Monitoring Tool API — auth.php
 * Replace: monitoring-tool/api/auth.php (keep your backup as auth_old.php or similar).
 *
 * - Bcrypt (password_hash) and plain / legacy user_passcode (e.g. numeric codes).
 * - JSON + form: user_email|email, user_passcode|password|passcode
 */
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
require_once '../includes/config.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    exit();
}

// JSON body
$input = json_decode(file_get_contents('php://input'), true);
if (!is_array($input)) {
    $input = [];
}

// Merge classic form POST (x-www-form-urlencoded / multipart)
if (!empty($_POST)) {
    $input = array_merge($input, $_POST);
}

$email = trim((string) ($input['user_email'] ?? $input['email'] ?? ''));
$passcode = $input['user_passcode'] ?? $input['password'] ?? $input['passcode'] ?? null;

// Normalise passcode: allow numeric JSON (3244) without forcing string issues
if ($passcode !== null && !is_string($passcode)) {
    $passcode = (string) $passcode;
}

if ($email === '' || $passcode === null || $passcode === '') {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Email and passcode are required']);
    exit();
}

try {
    // Fetch user + staff info via LEFT JOIN
    $stmt = $pdo->prepare("
        SELECT 
            u.user_id, u.user_email, u.user_passcode, u.user_access, u.user_status, u.role_id,
            s.staff_id, s.staff_names, s.staff_email, s.staff_phone, s.staff_gender,
            s.staff_group, s.group_id, s.staff_duty_station, s.staff_employment_type,
            s.staff_hire_date, s.staff_degree, s.staff_qualifications, s.supervisor_id
        FROM tbl_hm_users u
        LEFT JOIN tbl_staff s ON s.user_id = u.user_id
        WHERE LOWER(TRIM(u.user_email)) = LOWER(?)
        LIMIT 1
    ");
    $stmt->execute([$email]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$user) {
        http_response_code(401);
        echo json_encode(['success' => false, 'message' => 'Invalid credentials']);
        exit();
    }

    if ($user['user_status'] != 1) {
        http_response_code(403);
        echo json_encode(['success' => false, 'message' => 'Account is inactive']);
        exit();
    }

    $stored = $user['user_passcode'];
    $storedStr = $stored === null ? '' : trim((string) $stored);
    $inputStr = trim((string) $passcode);

    $passwordOk = false;
    if ($storedStr !== '' && preg_match('/^\$2[aby]\$/', $storedStr)) {
        // Bcrypt / password_hash
        $passwordOk = password_verify($inputStr, $storedStr);
    } else {
        // Plain text or legacy (e.g. passcode "3244" stored as string or integer in DB)
        if (hash_equals($storedStr, $inputStr)) {
            $passwordOk = true;
        } elseif ($inputStr !== '' && is_numeric($inputStr) && is_numeric($storedStr)) {
            $passwordOk = ((string) (int) $inputStr === (string) (int) $storedStr);
        }
    }

    if (!$passwordOk) {
        http_response_code(401);
        echo json_encode(['success' => false, 'message' => 'Invalid credentials']);
        exit();
    }

    // Generate API token
    $token = bin2hex(random_bytes(32));
    $expires_at = date('Y-m-d H:i:s', strtotime('+24 hours'));

    $stmt = $pdo->prepare("
        INSERT INTO tbl_api_tokens (user_id, token, expires_at, created_at) 
        VALUES (?, ?, ?, NOW())
    ");
    $stmt->execute([$user['user_id'], $token, $expires_at]);

    // Build staff block (null-safe in case no staff record linked)
    $staff = $user['staff_id'] ? [
        'staff_id'            => (int) $user['staff_id'],
        'staff_names'         => $user['staff_names'],
        'staff_email'         => $user['staff_email'],
        'staff_phone'         => $user['staff_phone'],
        'staff_gender'        => $user['staff_gender'],
        'staff_group'         => $user['staff_group'],
        'group_id'            => $user['group_id'],
        'staff_duty_station'  => $user['staff_duty_station'],
        'staff_employment_type' => $user['staff_employment_type'],
        'staff_hire_date'     => $user['staff_hire_date'],
        'staff_degree'        => $user['staff_degree'],
        'staff_qualifications'=> $user['staff_qualifications'],
        'supervisor_id'       => $user['supervisor_id'],
    ] : null;

    http_response_code(200);
    echo json_encode([
        'success' => true,
        'message' => 'Login successful',
        'data' => [
            'token'      => $token,
            'expires_at' => $expires_at,
            'user' => [
                'user_id'     => $user['user_id'],
                'user_email'  => $user['user_email'],
                'user_access' => $user['user_access'],
                'role_id'     => $user['role_id'],
            ],
            'staff' => $staff,
        ]
    ]);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Database error: ' . $e->getMessage()]);
}
