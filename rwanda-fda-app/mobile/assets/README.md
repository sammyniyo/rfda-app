# Assets

## Logo

To show the **official Rwanda FDA logo** on the login screen:

1. Copy your Rwanda FDA logo image (e.g. `RwandaFDA-....png`) into this folder.
2. Rename it to `logo.png`.
3. In `components/LoginScreen.jsx`, replace the placeholder with the local asset:

   Change:
   ```js
   const LOGO_PLACEHOLDER = { uri: 'data:image/png;base64,...' };
   // ...
   source={LOGO_PLACEHOLDER}
   ```
   To:
   ```js
   source={require('../assets/logo.png')}
   ```
   (and remove the `LOGO_PLACEHOLDER` constant.)

For Expo builds you may also want to add `icon.png`, `splash.png`, and `adaptive-icon.png` in this folder for the app icon and splash screen.
