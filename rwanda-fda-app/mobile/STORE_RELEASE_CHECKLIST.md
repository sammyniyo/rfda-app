# App Store & Google Play release checklist (Rwanda FDA mobile)

Use this with **EAS Build** (`npx eas-cli` or `npx eas`). Run `eas login`, then `eas init` in this folder once to link an Expo project (adds `extra.eas.projectId` to `app.json` automatically). Push notifications need that project ID for `getExpoPushTokenAsync`.

**Before you submit:** fix any **logout crash** and run through login, notifications, and core flows on a **release** build (not Expo Go).

---

## Repository / Expo (do first)

1. **Assets:** Ensure `assets/icon.png`, `assets/adaptive-icon.png`, and `assets/RwandaFDA.png` exist (run `npm run generate-icons` from `RwandaFDA.png` if needed).
2. **Versions:** Bump `expo.version` (user-facing, e.g. `1.0.1`) for each store release. Android `versionCode` / iOS `buildNumber` are incremented by EAS when `autoIncrement` is on, or set them manually in `app.json` if you disable remote versioning.
3. **Bundle IDs:** `ios.bundleIdentifier` and `android.package` must match what you register in App Store Connect and Play Console (`com.rwandafda.app` today).
4. **Build:** `eas build --platform all --profile production` (or separate iOS/Android). Download artifacts or use EAS Submit.

---

## Apple App Store

1. **Apple Developer Program** membership; **App Store Connect** app record with the same bundle ID.
2. **Certificates & provisioning:** EAS can manage these (`eas credentials`) or you upload your own.
3. **Privacy & encryption:** `ITSAppUsesNonExemptEncryption` is set to `false` in `app.json` for standard TLS-only apps; confirm in App Store Connect **Export Compliance** if you add custom crypto.
4. **App Privacy (nutrition labels):** In App Store Connect, declare data you collect (e.g. account info, device/push token, diagnostics). Align with your **privacy policy**.
5. **Privacy policy URL:** Required for many apps; host a page describing data use, retention, and contact.
6. **Face ID:** `NSFaceIDUsageDescription` is set via `app.json` / `expo-local-authentication` plugin.
7. **Push notifications:** Enable the capability for the App ID; use the correct provisioning profile. Upload APNs key in Expo (EAS) if using Expo push.
8. **Screenshots & metadata:** Required sizes per device class; description, keywords, support URL, marketing URL (optional).
9. **Age rating** questionnaire in App Store Connect.
10. **Review notes:** Test account credentials if login is required; explain any hardware or backend dependencies.
11. **Guideline 2.1 – performance:** App must not crash on common paths (including **logout**).

---

## Google Play

1. **Play Console** developer account; create the app with package name `com.rwandafda.app` (must match `app.json`).
2. **App signing:** Use Play App Signing (recommended); upload **AAB** (EAS `production` profile uses `app-bundle`).
3. **Target API level:** Expo SDK 54’s prebuild template targets current Play requirements; re-run `eas build` after SDK upgrades to stay compliant.
4. **Privacy policy URL:** Required if the app accesses sensitive permissions or user data; recommended for any production app.
5. **Data safety form:** Declare collected/shared data (e.g. account, device ID, push token). Must match the app behavior and privacy policy.
6. **Content rating** questionnaire (e.g. IARC).
7. **Store listing:** Short/full description, screenshots, feature graphic, icon.
8. **Notifications:** Android 13+ uses runtime notification permission; the app requests permission via `expo-notifications`.
9. **Testing:** Use internal / closed testing tracks before production.
10. **Stability:** Fix **logout** and other crashes before production rollout.

---

## Optional commands

```bash
cd rwanda-fda-app/mobile
npx expo-doctor
eas build --platform ios --profile production
eas build --platform android --profile production
eas submit --platform ios --profile production --latest
eas submit --platform android --profile production --latest
```

For Play automated submit, configure a Google Play service account JSON and reference it in `eas.json` under `submit.production.android` (see [EAS Submit – Android](https://docs.expo.dev/submit/android/)).
