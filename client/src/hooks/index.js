import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

/** Seconds remaining until `endsAt` (ms timestamp). */
export function useCountdown(endsAt) {
  const calc = () => Math.max(0, Math.ceil(((endsAt || 0) - Date.now()) / 1000));
  const [left, setLeft] = useState(calc);
  useEffect(() => {
    setLeft(calc());
    const t = setInterval(() => setLeft(calc()), 250);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endsAt]);
  return left;
}

export function useMediaQuery(query) {
  const get = () => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(query).matches : false);
  const [matches, setMatches] = useState(get);
  useEffect(() => {
    if (!window.matchMedia) return undefined;
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);
  return matches;
}

export const useIsDesktop = () => useMediaQuery('(min-width: 1024px)');

/** Back navigation that falls back to a sensible parent when there is no history (deep link / refresh). */
export function useGoBack(fallback = '/home') {
  const navigate = useNavigate();
  const location = useLocation();
  return useCallback(() => {
    if (location.key !== 'default' && window.history.length > 1) navigate(-1);
    else navigate(fallback, { replace: true });
  }, [navigate, location.key, fallback]);
}

export function useScrollY() {
  const [y, setY] = useState(() => (typeof window !== 'undefined' ? window.scrollY : 0));
  useEffect(() => {
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setY(window.scrollY));
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
    };
  }, []);
  return y;
}

export function useDocumentTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} · kuraat` : 'kuraat — Your partner for every gathering';
  }, [title]);
}

let lockCount = 0;
export function useLockBodyScroll(active) {
  useLayoutEffect(() => {
    if (!active) return undefined;
    lockCount += 1;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      lockCount -= 1;
      if (lockCount === 0) document.body.style.overflow = prev;
    };
  }, [active]);
}

/** Re-render on an interval (used for live order status). */
export function useNow(intervalMs = 30000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

/** Element height via ResizeObserver. */
export function useElementHeight() {
  const [node, setNode] = useState(null);
  const [height, setHeight] = useState(0);
  useLayoutEffect(() => {
    if (!node) return undefined;
    setHeight(node.offsetHeight);
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(([entry]) => setHeight(entry.borderBoxSize?.[0]?.blockSize ?? node.offsetHeight));
    ro.observe(node);
    return () => ro.disconnect();
  }, [node]);
  return [setNode, height];
}

/** Async action state: run(fn) → { loading, error }. */
export function useAsyncAction() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const run = useCallback(async (fn) => {
    setLoading(true);
    setError(null);
    try {
      const result = await fn();
      return result;
    } catch (e) {
      if (mounted.current) setError(e);
      throw e;
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, []);
  return { loading, error, setError, run };
}
