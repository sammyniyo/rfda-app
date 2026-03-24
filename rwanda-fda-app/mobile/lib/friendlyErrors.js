/**
 * Maps technical errors into short, user-facing copy (network, server, auth, etc.).
 */

const DEFAULT_TITLE = 'Something went wrong';
const DEFAULT_MESSAGE = "We couldn't load this right now. Pull down to refresh or try again in a moment.";

function isLikelyNetworkError(err) {
  if (!err) return false;
  const name = String(err.name || '');
  const msg = String(err.message || '').toLowerCase();
  if (name === 'TypeError' && (msg.includes('network') || msg.includes('fetch') || msg.includes('failed to fetch')))
    return true;
  if (msg.includes('network request failed')) return true;
  if (msg.includes('internet connection appears')) return true;
  return false;
}

/**
 * @param {unknown} err
 * @param {{ httpStatus?: number, serverMessage?: string }} [ctx]
 * @returns {{ title: string, message: string, kind: 'network' | 'server' | 'auth' | 'timeout' | 'unknown' }}
 */
export function friendlyErrorInfo(err, ctx = {}) {
  const httpStatus = ctx.httpStatus ?? err?.status ?? err?.statusCode;
  const serverMessage = ctx.serverMessage ?? err?.serverMessage;

  if (isLikelyNetworkError(err)) {
    return {
      title: "You're offline",
      message:
        'No internet connection or the network is unstable. Check Wi‑Fi or mobile data, then pull down to reconnect.',
      kind: 'network',
    };
  }

  if (httpStatus === 401 || httpStatus === 403) {
    const m = String(err?.message || '').toLowerCase();
    if (m.includes('no active staff profile') || m.includes('tbl_staff')) {
      return {
        title: 'Account not linked to staff',
        message:
          'Your login works, but there is no active staff record for your user. Contact IT to link your account in tbl_staff, then sign out and sign in again.',
        kind: 'auth',
      };
    }
    return {
      title: 'Session issue',
      message:
        'Your API token may have expired or the server rejected the request. Sign out and sign in again (use PHP auth if you use applications/performance). Contact IT if this continues.',
      kind: 'auth',
    };
  }

  if (httpStatus === 408 || httpStatus === 504) {
    return {
      title: 'Request timed out',
      message: 'The server took too long to respond. Pull down to try again.',
      kind: 'timeout',
    };
  }

  if (httpStatus >= 500 && httpStatus < 600) {
    return {
      title: 'Server is busy',
      message:
        "Rwanda FDA's systems are temporarily unavailable. Please wait a minute and pull down to refresh.",
      kind: 'server',
    };
  }

  if (httpStatus === 404) {
    return {
      title: 'Not found',
      message: "We couldn't find that resource. If this keeps happening, contact support.",
      kind: 'server',
    };
  }

  if (err?.code === 'TM_JWT_TOKEN') {
    return {
      title: 'Use PHP sign-in for applications',
      message:
        'You are signed in with the Node/JWT login. The Monitoring Tool (applications, tasks, performance) needs the hex API token from PHP auth.php. Sign out, remove EXPO_PUBLIC_AUTH_LOGIN_URL from your app env (or point login to …/api/auth.php), then sign in again. IT can alternatively teach performance_api.php to accept your JWT.',
      kind: 'auth',
    };
  }

  const rawMsg = String(err?.message || '').toLowerCase();
  if (rawMsg.includes('missing staff')) {
    return {
      title: 'Profile incomplete',
      message: "We couldn't find your staff ID. Sign out and sign in again, or contact your administrator.",
      kind: 'unknown',
    };
  }

  if (serverMessage && typeof serverMessage === 'string' && serverMessage.length < 200) {
    return {
      title: DEFAULT_TITLE,
      message: serverMessage,
      kind: 'server',
    };
  }

  if (httpStatus >= 400 && httpStatus < 500) {
    return {
      title: "Couldn't complete request",
      message: 'Something was wrong with the request. Pull down to try again.',
      kind: 'server',
    };
  }

  const detail = String(err?.message || '').trim();
  if (detail && detail.length < 400) {
    return {
      title: DEFAULT_TITLE,
      message: detail,
      kind: 'unknown',
    };
  }

  return {
    title: DEFAULT_TITLE,
    message: DEFAULT_MESSAGE,
    kind: 'unknown',
  };
}

/**
 * For fetch failures: build error info from Response + parsed JSON body.
 */
export function friendlyErrorFromResponse(res, payload) {
  const serverMessage =
    (payload && typeof payload === 'object' && (payload.message || payload.error || payload.detail)) || null;
  const msg =
    typeof serverMessage === 'string'
      ? serverMessage
      : serverMessage != null
        ? String(serverMessage)
        : null;
  const err = new Error(msg || `HTTP ${res.status}`);
  err.status = res.status;
  err.serverMessage = msg;
  return friendlyErrorInfo(err, { httpStatus: res.status, serverMessage: msg });
}
