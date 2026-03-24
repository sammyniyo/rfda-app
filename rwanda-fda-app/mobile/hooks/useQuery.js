import { useState, useEffect, useRef } from 'react';
import { readCachedJson, writeCachedJson } from '../lib/cache';
import { friendlyErrorInfo } from '../lib/friendlyErrors';

export function useQuery(fn, deps = [], options = {}) {
  const { cacheKey } = options;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [errorInfo, setErrorInfo] = useState(null);
  const [fromCache, setFromCache] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState(null);
  const hasMountedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    const run = async (mode = 'initial') => {
      if (mode === 'refresh') setRefreshing(true);
      else setLoading(true);
      if (mode !== 'cache') {
        setError(null);
        setErrorInfo(null);
      }

      try {
        const result = await fn();
        if (cancelled) return;
        setData(result);
        setErrorInfo(null);
        setFromCache(false);
        const syncedAt = new Date().toISOString();
        setLastSyncedAt(syncedAt);
        if (cacheKey) await writeCachedJson(cacheKey, result);
      } catch (err) {
        if (!cancelled) {
          const info = friendlyErrorInfo(err);
          setErrorInfo(info);
          setError(info.message);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    };

    (async () => {
      if (cacheKey) {
        const cached = await readCachedJson(cacheKey);
        if (!cancelled && cached && Object.prototype.hasOwnProperty.call(cached, 'data')) {
          setData(cached.data);
          setFromCache(true);
          setLastSyncedAt(cached.syncedAt || null);
          setLoading(false);
        }
      }
      await run(hasMountedRef.current ? 'refresh' : 'initial');
      hasMountedRef.current = true;
    })();

    return () => {
      cancelled = true;
    };
  }, deps);

  const refetch = async () => {
    setRefreshing(true);
    setError(null);
    setErrorInfo(null);
    try {
      const result = await fn();
      setData(result);
      setErrorInfo(null);
      setFromCache(false);
      const syncedAt = new Date().toISOString();
      setLastSyncedAt(syncedAt);
      if (cacheKey) await writeCachedJson(cacheKey, result);
      return result;
    } catch (err) {
      const info = friendlyErrorInfo(err);
      setErrorInfo(info);
      setError(info.message);
      throw err;
    } finally {
      setRefreshing(false);
    }
  };

  return { data, loading, refreshing, error, errorInfo, refetch, fromCache, lastSyncedAt };
}
