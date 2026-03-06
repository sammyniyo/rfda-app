# Rwanda FDA Portal

Web and mobile apps for Rwanda Food and Drug Authority: **single sign-on** (users table), **login with Face ID / fingerprint**, profile, tasks, applications and statuses, and notifications (new assignments, delays, etc.).

## Stack

- **Backend**: Node.js, Express, MySQL, JWT auth
- **Web**: React (Vite), React Router
- **Mobile**: Expo (React Native) — **Android & iOS** with biometric login

## Setup

### 1. Database

Copy `server/.env.example` to `server/.env` and set MySQL + JWT:

```bash
cp server/.env.example server/.env
# Set: DB_HOST, DB_USER, DB_PASSWORD, DB_NAME, JWT_SECRET
```

Auth and profile use your existing **tbl_hm_users** (user_email, user_passcode) and **tbl_staff** (linked by user_id). Plain or bcrypt passwords are supported. To test the connection: **GET /api/db-test** (returns `{ ok, database, tbl_hm_users_exists }`).

### 2. Backend

```bash
cd server
npm install
npm run dev
```

API runs at `http://localhost:4000`. All `/api/profile`, `/api/tasks`, `/api/applications`, `/api/notifications` routes require `Authorization: Bearer <token>`.

### 3. Web frontend

```bash
cd client
npm install
npm run dev
```

Runs at `http://localhost:3000` (proxies `/api` to backend). **Update the client to use login** (e.g. call `POST /api/auth/login` and send the token with requests).

### 4. Mobile app (Android & iOS)

```bash
cd mobile
npm install
npx expo start
```

- **Expo Go**: Scan QR for quick test. Set `EXPO_PUBLIC_API_URL` to your machine’s IP (e.g. `http://192.168.1.10:4000`) so the device can reach the API.
- **Face ID / fingerprint**: Works in a **development build** (not in Expo Go on iOS). Run `npx expo run:ios` or `npx expo run:android` for a dev build.
- **Logo**: Place the official Rwanda FDA logo in `mobile/assets/logo.png` and update `mobile/components/LoginScreen.jsx` as described in `mobile/assets/README.md`.

## Auth (single sign-on)

- **POST /api/auth/login** — Body: `{ "email", "password" }`. Validates against **tbl_hm_users** (user_email, user_passcode); joins **tbl_staff** for name/department. Returns `{ token, user }`.
- **POST /api/auth/refresh** — Header: `Authorization: Bearer <token>`. Returns new `{ token, user }`.
- **GET /api/db-test** — No auth. Tests MySQL connection and whether `tbl_hm_users` exists.
- All other API routes require `Authorization: Bearer <token>`.

## Features

- **Login**: Email + password (SSO against `users` table), optional **Face ID** / **fingerprint** after first sign-in (token stored in secure store).
- **Dashboard** – Pending tasks, applications, notifications summary.
- **My Profile** – From **tbl_hm_users** + **tbl_staff** (name, email, department, phone, degree, etc.).
- **My Tasks** – List/filter by status.
- **My Applications** – List with status; filter by status.
- **Notifications** – New assignments, delays, etc.; unread highlighted.

## Customising for your DB

- **Auth & profile** are wired to **tbl_hm_users** and **tbl_staff**.
- **Tasks, applications, notifications** currently expect tables `tasks`, `applications`, `notifications`. If you use different tables (e.g. `tbl_hm_applications`), edit `server/src/routes/tasks.js`, `applications.js`, and `notifications.js` to match your schema.
