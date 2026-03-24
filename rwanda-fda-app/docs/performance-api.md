# `performance_api.php` and the mobile app

**Deployable full script:** [performance_api.php](./performance_api.php) — copy to `monitoring-tool/TM/performance_api.php` on the server (replace the existing file; keep your backup).

---

## “Web page instead of JSON” after Node/JWT login

If `EXPO_PUBLIC_AUTH_LOGIN_URL` points at the **Express** app (`server` → JWT), the app stores a **JWT**. The live **`performance_api.php`** almost always checks **`tbl_api_tokens`** (hex token from **PHP** `auth.php`), **not** JWTs. Unauthenticated, PHP returns the **HTML login** page — the app shows *Server returned a web page instead of JSON*.

**Fix for staff:** sign **out**, remove the custom auth URL from `.env` (or set it to `https://…/monitoring-tool/api/auth.php`), rebuild, sign in again so the token is the **64-character hex** from PHP.

**Fix for IT:** either validate JWT in `performance_api.php` or add a small exchange endpoint. See [performance-api-response.md](./performance-api-response.md).

## Why the URL shows a login page in the browser

Opening [performance_api.php](https://rwandafda.gov.rw/monitoring-tool/TM/performance_api.php) **without** a session or API token returns the **HTML Staff Login** page. That is normal: the endpoint is not meant to be tested like a public webpage.

The app calls it as **JSON** with:

- **`staff_id`** — the **logged-in staff member** from `auth.php` → `data.staff.staff_id` (stored on the user object after sign-in). Same value your endpoint expects for “current staff”.
- `month` query parameter  
- The **token** from `auth.php` (stored in `tbl_api_tokens`), sent as:
  - `Authorization: Bearer <token>` and/or raw `Authorization: <token>`
  - **`token=<token>` in the query string** (many PHP scripts read `$_GET['token']` and ignore `Authorization`)

## App showed 0 counts but the API returns data

The mobile app used to **cache** the performance JSON in **Expo SecureStore**. That store only holds **~2KB per value** on many devices. A real response with dozens of applications is **much larger**, so the cache **write fails silently** and the **previous empty payload** can keep showing — hero stats and lists look like `0`.

**Fix in the app:** performance / applications / tasks queries no longer use that cache. Pull the latest app and **sign out and back in** once if needed.

The dashboard also falls back to **`applications_summary`** / **`tasks_summary`** from the same JSON when building KPI numbers.

## “Server returned a web page instead of JSON”

The response body starts with `<` (HTML). Usually the script is **redirecting to the web login** or outputting an error page because it **never accepted the mobile API token**.

The app now tries, in order:

- **GET** with `staff_id`, `month`, and token as `token`, `api_token`, `access_token`, `auth_token`, or `user_token` (separate URL attempts)
- **GET** with only `staff_id` + `month` + `Authorization` header
- **POST** JSON body: `staff_id`, `month`, `token`, `api_token`, `access_token`
- **POST** `application/x-www-form-urlencoded` with the same fields

**Token + `staff_id`:** For API-token requests, the server resolves the real `tbl_staff.staff_id` from the token’s `user_id`. Sending `user_id` by mistake (or `staff_id=0`) no longer causes 403; the canonical staff row is used.

**Important:** `performance_api.php` must accept **POST** as well as **GET**. If the script returns **405** for POST, the mobile client’s POST retries fail last and the dashboard can show “Couldn’t complete request” even when the real problem was an earlier **401** (missing/invalid token). The reference server script merges `$_GET`, `$_POST`, and JSON `php://input` for `staff_id` and token fields.

### What to add in `performance_api.php` (server)

1. Read the token from any of:
   - `$_GET['token']`, `$_GET['api_token']`, `$_GET['access_token']`, …
   - `$_POST['token']` (JSON or form POST)
   - Header `Authorization: Bearer <hex>` or `Authorization: <hex>`  
     (`apache_request_headers()` / `$_SERVER['HTTP_AUTHORIZATION']` — Apache sometimes strips `Authorization`; then rely on query/POST.)

2. Validate that token against **`tbl_api_tokens`** the same way as other API scripts (same as `auth.php` insert).

3. If the token is valid, **skip** the web session check / login redirect for this request and return **JSON only** (no HTML, no `include` of the login layout).

4. Ensure **no output** before `header('Content-Type: application/json')` (no BOM, no warnings in production).

## If applications or tasks stay empty

1. **Staff row** — Login response must include `staff.staff_id`. If the user has no `tbl_staff` row linked to `user_id`, the app falls back to `user_id`, which may not match what `performance_api.php` expects for `staff_id`.

2. **Server validates token** — `performance_api.php` must validate the same token issued by `auth.php` (e.g. lookup in `tbl_api_tokens`), whether it comes from the header or from `$_GET['token']`.

3. **Response shape** — The app reads applications from `data.applications` and also tries `apps`, `application_list`, `assigned_applications`.

If your PHP uses another key, either add an alias in the JSON or ask to extend `extractPerformanceApplications` in `mobile/lib/monitoringPerformance.js`.

## Response contract

For a concise description of the JSON shape (including `data.staff`, summaries, and `applications[]`), see [performance-api-response.md](./performance-api-response.md).
