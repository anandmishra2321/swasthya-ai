import { useCallback, useEffect, useRef, useState } from 'react';

export interface AsyncState<T> {
  data: T | null;
  error: string | null;
  /** True when not-configured responses are expected for this resource. */
  loading: boolean;
  reload: () => void;
}

/**
 * Minimal data-fetching hook for read-only panels.
 *
 * Deliberately tiny: no cache, no dedupe, no retries. Every panel shows the
 * real API result — including empty and error states — instead of substituting
 * placeholder data, which is a hard requirement of this project.
 */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[] = []): AsyncState<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [nonce, setNonce] = useState(0);

  // Guards against setting state after the component unmounts or a newer
  // request has already been issued.
  const requestRef = useRef(0);

  useEffect(() => {
    const requestId = ++requestRef.current;
    let active = true;

    setLoading(true);
    setError(null);

    fn()
      .then((result) => {
        if (!active || requestRef.current !== requestId) return;
        setData(result);
      })
      .catch((err: any) => {
        if (!active || requestRef.current !== requestId) return;
        setError(err?.message || 'Something went wrong while loading this section.');
      })
      .finally(() => {
        if (!active || requestRef.current !== requestId) return;
        setLoading(false);
      });

    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  return { data, error, loading, reload };
}
