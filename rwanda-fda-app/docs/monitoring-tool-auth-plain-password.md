# Plain-text passcodes vs `auth.php` (Monitoring Tool)

The mobile app sends the password/passcode as entered (e.g. `3244`). If **`user_passcode` in `tbl_hm_users` is stored in plain text** but `auth.php` only checks `password_verify()` against a bcrypt hash, login will fail for those users.

**Ready-to-deploy file in this repo:** `docs/auth.php` — copy it to `monitoring-tool/api/auth.php` on the server (your backup can stay as `auth_old.php` or similar).

## Fix on the PHP side

After you load the user row, compare in this order:

1. If `user_passcode` looks like bcrypt (`$2y$`, `$2a$`, `$2b$`), use `password_verify($input, $stored)`.
2. Else treat legacy/plain storage: compare as strings (and optionally normalize numeric codes).

Example logic (adapt to your variable names):

```php
$input = isset($_POST['password']) ? trim((string)$_POST['password']) : '';
// also read user_passcode / passcode if your API uses those keys
$stored = $row['user_passcode'] ?? '';

$ok = false;
if ($stored !== '' && preg_match('/^\$2[aby]\$/', $stored)) {
    $ok = password_verify($input, $stored);
} else {
    $ok = hash_equals((string)$stored, (string)$input);
}

if (!$ok) {
    // reject login
}
```

Use `hash_equals` for plain comparison to reduce timing leaks.

## Alternative: use the Node API for login

The Express route `server/src/routes/auth.js` already supports **bcrypt or plain** `user_passcode` (with trim + numeric equality for codes like `3244`).

1. Run the Node server with the same MySQL database as the Monitoring Tool.
2. In the mobile app `.env`, set for example:

   `EXPO_PUBLIC_AUTH_LOGIN_URL=http://YOUR_HOST:3001/api/auth/login`

   Or keep PHP as primary and add:

   `EXPO_PUBLIC_AUTH_FALLBACK_LOGIN_URL=http://YOUR_HOST:3001/api/auth/login`

Rebuild the app after changing env vars.
