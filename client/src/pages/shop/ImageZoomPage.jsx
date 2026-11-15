import { useCallback, useEffect, useRef, useState } from 'react';
import { Navigate, useParams, useSearchParams } from 'react-router-dom';
import { Minimize2, Share2, X, ZoomIn, ZoomOut } from 'lucide-react';
import { IconButton } from '@/components/ui';
import { productGallery } from '@/assets/images.js';
import { getProduct } from '@/domain';
import { ROUTES } from '@/config/routes.js';
import { useToast } from '@/context/ToastContext.jsx';
import { useDocumentTitle, useGoBack, useLockBodyScroll } from '@/hooks';
import { cn } from '@/lib/cn.js';

const MIN = 1;
const MAX = 3;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

/** 11 · Image zoom — pinch / wheel / slider / buttons, double-tap, drag to pan, thumbnails. */
export default function ImageZoomPage() {
  const { productId } = useParams();
  const product = getProduct(productId);
  const [params, setParams] = useSearchParams();
  const goBack = useGoBack(product ? ROUTES.product(product.id) : ROUTES.home);
  const toast = useToast();
  useDocumentTitle(product ? `${product.name} photos` : 'Photos');
  useLockBodyScroll(true);

  const images = product ? productGallery(product) : [];
  const index = clamp(Number(params.get('i')) || 0, 0, Math.max(0, images.length - 1));
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const stageRef = useRef(null);
  const pointers = useRef(new Map());
  const gesture = useRef(null);

  const clampOffset = useCallback((o, s) => {
    const el = stageRef.current;
    if (!el) return o;
    const maxX = ((s - 1) * el.clientWidth) / 2;
    const maxY = ((s - 1) * el.clientHeight) / 2;
    return { x: clamp(o.x, -maxX, maxX), y: clamp(o.y, -maxY, maxY) };
  }, []);

  const zoomTo = useCallback(
    (next) => {
      const s = clamp(Math.round(next * 100) / 100, MIN, MAX);
      setScale(s);
      setOffset((o) => clampOffset(o, s));
    },
    [clampOffset],
  );

  const select = (i) => {
    setParams({ i: String(i) }, { replace: true });
    setScale(1);
    setOffset({ x: 0, y: 0 });
  };

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') goBack();
      if (e.key === 'ArrowRight') select((index + 1) % images.length);
      if (e.key === 'ArrowLeft') select((index + images.length - 1) % images.length);
      if (e.key === '+' || e.key === '=') zoomTo(scale + 0.25);
      if (e.key === '-') zoomTo(scale - 0.25);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // Non-passive wheel listener so the page never scrolls behind the viewer
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return undefined;
    const onWheel = (e) => {
      e.preventDefault();
      setScale((s) => {
        const next = clamp(s * (e.deltaY < 0 ? 1.1 : 0.9), MIN, MAX);
        setOffset((o) => clampOffset(o, next));
        return Math.round(next * 100) / 100;
      });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [clampOffset]);

  if (!product) return <Navigate to={ROUTES.home} replace />;

  const onPointerDown = (e) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pts = [...pointers.current.values()];
    if (pts.length === 2) {
      gesture.current = { type: 'pinch', dist: Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y), scale };
    } else {
      gesture.current = { type: 'pan', x: e.clientX, y: e.clientY, offset, moved: false, at: Date.now() };
    }
  };

  const onPointerMove = (e) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = gesture.current;
    if (!g) return;
    if (g.type === 'pinch') {
      const pts = [...pointers.current.values()];
      if (pts.length < 2) return;
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      zoomTo(g.scale * (dist / g.dist));
    } else if (g.type === 'pan') {
      const dx = e.clientX - g.x;
      const dy = e.clientY - g.y;
      if (Math.abs(dx) + Math.abs(dy) > 4) g.moved = true;
      if (scale > 1) setOffset(clampOffset({ x: g.offset.x + dx, y: g.offset.y + dy }, scale));
    }
  };

  const onPointerUp = (e) => {
    const g = gesture.current;
    pointers.current.delete(e.pointerId);
    if (g?.type === 'pan' && scale <= 1 && g.moved) {
      const dx = e.clientX - g.x;
      if (Math.abs(dx) > 50) select(dx < 0 ? (index + 1) % images.length : (index + images.length - 1) % images.length);
    }
    if (pointers.current.size === 0) gesture.current = null;
  };

  const share = async () => {
    const url = window.location.origin + ROUTES.product(product.id);
    try {
      if (navigator.share) {
        await navigator.share({ title: `${product.name} · kuraat`, text: product.description[0], url });
      } else {
        await navigator.clipboard.writeText(url);
        toast.show('Link copied to clipboard');
      }
    } catch (err) {
      if (err?.name !== 'AbortError') toast.show('Could not share this photo', { tone: 'error' });
    }
  };

  const percent = Math.round(scale * 100);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-viewer text-white" role="dialog" aria-modal="true" aria-label={`${product.name} photo viewer`}>
      <div className="relative z-10 mx-auto flex w-full max-w-[960px] items-center justify-between px-5 pb-3 pt-4">
        <IconButton icon={X} label="Close" variant="viewer" onClick={goBack} />
        <p className="tabular text-[16px] font-bold" aria-live="polite">
          {index + 1} / {images.length}
        </p>
        <IconButton icon={Share2} label="Share" variant="viewer" onClick={share} />
      </div>

      <div
        ref={stageRef}
        className={cn('relative flex-1 touch-none overflow-hidden', scale > 1 ? 'cursor-grab active:cursor-grabbing' : 'cursor-zoom-in')}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onDoubleClick={() => {
          if (scale > 1) {
            setScale(1);
            setOffset({ x: 0, y: 0 });
          } else zoomTo(2);
        }}
      >
        <img
          key={images[index]}
          src={images[index]}
          alt={`${product.name} — photo ${index + 1}`}
          draggable="false"
          className="absolute inset-0 m-auto max-h-full w-full animate-fade-in select-none object-contain lg:w-auto"
          style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`, transition: gesture.current ? 'none' : 'transform 160ms ease-out' }}
        />

        <div className="absolute right-5 top-1/2 flex -translate-y-1/2 flex-col gap-1 rounded-pill border border-white/20 bg-white/[0.12] p-1.5 backdrop-blur-md" onPointerDown={(e) => e.stopPropagation()}>
          <IconButton icon={ZoomIn} label="Zoom in" variant="plain" className="text-white hover:bg-white/15" onClick={() => zoomTo(scale + 0.25)} disabled={scale >= MAX} />
          <IconButton icon={ZoomOut} label="Zoom out" variant="plain" className="text-white hover:bg-white/15" onClick={() => zoomTo(scale - 0.25)} disabled={scale <= MIN} />
          <IconButton
            icon={Minimize2}
            label="Fit to screen"
            variant="plain"
            className="text-white hover:bg-white/15"
            onClick={() => {
              setScale(1);
              setOffset({ x: 0, y: 0 });
            }}
          />
        </div>

        <span className="tabular absolute bottom-4 left-5 rounded-pill bg-maroon/90 px-3 py-1.5 text-label">{percent}%</span>
      </div>

      <div className="mx-auto w-full max-w-[640px] px-5 pb-[max(20px,env(safe-area-inset-bottom))] pt-4">
        <div className="flex items-center gap-3">
          <button type="button" aria-label="Zoom out" onClick={() => zoomTo(scale - 0.25)} className="text-white/80 hover:text-white">
            <ZoomOut size={20} strokeWidth={1.8} />
          </button>
          <input
            type="range"
            min={MIN * 100}
            max={MAX * 100}
            step={5}
            value={percent}
            onChange={(e) => zoomTo(Number(e.target.value) / 100)}
            aria-label="Zoom level"
            className="h-1 flex-1 cursor-pointer appearance-none rounded-pill bg-white/25 accent-white [&::-moz-range-thumb]:size-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-white [&::-webkit-slider-thumb]:size-5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white"
            style={{ background: `linear-gradient(to right, #fff ${((scale - MIN) / (MAX - MIN)) * 100}%, rgba(255,255,255,.25) 0)` }}
          />
          <button type="button" aria-label="Zoom in" onClick={() => zoomTo(scale + 0.25)} className="text-white/80 hover:text-white">
            <ZoomIn size={20} strokeWidth={1.8} />
          </button>
        </div>
        <div className="mt-5 flex justify-center gap-3">
          {images.map((src, i) => (
            <button
              key={src}
              type="button"
              onClick={() => select(i)}
              aria-label={`Photo ${i + 1}`}
              aria-current={i === index}
              className={cn('size-16 overflow-hidden rounded-lg border-2 transition', i === index ? 'scale-105 border-white' : 'border-transparent opacity-70 hover:opacity-100')}
            >
              <img src={src} alt="" className="size-full object-cover" />
            </button>
          ))}
        </div>
        <p className="mt-4 text-center text-label font-normal text-white/70">Pinch or double-tap to zoom · drag to pan</p>
      </div>
    </div>
  );
}
