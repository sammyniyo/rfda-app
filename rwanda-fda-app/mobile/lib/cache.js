import * as SecureStore from 'expo-secure-store';

/**
 * Uses SecureStore, which has a small per-value size limit (~2KB on many devices).
 * Do not use cacheKey in useQuery for large API payloads (e.g. full performance_api JSON);
 * writes fail silently and leave stale empty data — see dashboard / applications / tasks queries.
 */
const CACHE_PREFIX = 'rfda_cache_';

function buildKey(key) {
  return `${CACHE_PREFIX}${key}`;
}

export async function readCachedJson(key) {
  if (!key) return null;
  try {
    const raw = await SecureStore.getItemAsync(buildKey(key));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function writeCachedJson(key, data) {
  if (!key) return;
  try {
    await SecureStore.setItemAsync(
      buildKey(key),
      JSON.stringify({
        data,
        syncedAt: new Date().toISOString(),
      })
    );
  } catch {
    // Ignore cache write failures (size/device restrictions).
  }
}

