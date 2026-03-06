/**
 * User-friendly error and success messages
 */

export const errors = {
  login: {
    emptyFields: 'Please enter your email and password.',
    invalidCredentials: 'The email or password you entered is incorrect. Please try again.',
    connection: 'We couldn\'t connect to the server. Please check your internet connection and try again.',
  },
  forgotPassword: {
    emptyEmail: 'Please enter your email address.',
    requestFailed: 'We couldn\'t process your request. Please try again later.',
    connection: 'We couldn\'t connect to the server. Please check your internet connection and try again.',
  },
  resetPassword: {
    passwordsMismatch: 'The two passwords don\'t match. Please enter them again.',
    tooShort: 'Your password must be at least 6 characters long.',
    invalidToken: 'This reset link has expired or is invalid. Please request a new password reset.',
    requestFailed: 'We couldn\'t update your password. Please try again or request a new reset link.',
    connection: 'We couldn\'t connect to the server. Please check your internet connection and try again.',
  },
  biometric: {
    signInFirst: 'Sign in with your password first to enable biometric sign-in for faster access next time.',
    failed: 'Biometric verification didn\'t work. Please try again or sign in with your password.',
  },
  general: {
    unexpected: 'Something went wrong. Please try again.',
  },
};

export const serverErrors = {
  AUTH_INVALID: 'Invalid email or password.',
  AUTH_REQUIRED: 'Please sign in to continue.',
  RESET_INVALID: 'This reset link has expired or is invalid. Please request a new one.',
  RESET_PASSWORD_SHORT: 'Password must be at least 6 characters.',
};
