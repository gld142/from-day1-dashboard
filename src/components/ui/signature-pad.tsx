"use client";

/**
 * SignaturePad — zone de signature sur <canvas>, souris / doigt / stylet via
 * les Pointer Events (touch-action: none pour que le doigt dessine au lieu
 * de faire défiler). Densité de pixels respectée, encre en `currentColor`
 * (la classe du parent fixe la couleur, ex. text-brand).
 *
 * Deux façons de signer : tracer, ou taper son nom (`setText`) rendu dans une
 * police cursive du système — l'alternative clavier. `toDataUrl()` renvoie un
 * PNG rogné à l'encre (marge 8 px, hauteur bornée) ou null si rien n'est écrit.
 *
 * Écrit maison : @componentry/signature est un rendu animé d'un texte en
 * tracé SVG (opentype.js + police .otf chargée depuis componentry.fun), pas
 * un pad de saisie.
 */
import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { cn } from "@/lib/utils";

export type SignaturePadHandle = {
  /** Efface tout (tracé et texte). */
  clear: () => void;
  /** Remplace le contenu par le nom tapé, en cursive ; chaîne vide = effacer. */
  setText: (text: string) => void;
  /** PNG rogné à l'encre, ou null si la zone est vide. */
  toDataUrl: () => string | null;
};

const LINE_WIDTH = 2.2;
const CROP_PADDING = 8;
/** Hauteur maximale (pixels) du PNG exporté : borne la taille en localStorage. */
const EXPORT_MAX_HEIGHT = 160;
const SCRIPT_FONT =
  '"Snell Roundhand", "Savoye LET", "Apple Chancery", "Brush Script MT", "Segoe Script", cursive';

export const SignaturePad = forwardRef<
  SignaturePadHandle,
  {
    className?: string;
    /** Texte accessible de la zone (ex. : « Zone de signature »). */
    "aria-label"?: string;
    /** Vrai dès qu'il y a de l'encre, faux après effacement. */
    onInkChange?: (hasInk: boolean) => void;
    /** Appelé au premier point d'un tracé : le parent peut vider son champ « nom tapé ». */
    onDrawStart?: () => void;
  }
>(function SignaturePad({ className, onInkChange, onDrawStart, ...rest }, ref) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const hasInk = useRef(false);
  const typed = useRef("");

  const setInk = useCallback(
    (v: boolean) => {
      if (hasInk.current === v) return;
      hasInk.current = v;
      onInkChange?.(v);
    },
    [onInkChange],
  );

  /** Contexte 2D prêt à tracer (couleur courante, traits ronds). */
  const ctx = useCallback(() => {
    const canvas = canvasRef.current;
    const c = canvas?.getContext("2d");
    if (!canvas || !c) return null;
    const dpr = window.devicePixelRatio || 1;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.lineWidth = LINE_WIDTH;
    c.lineCap = "round";
    c.lineJoin = "round";
    const color = getComputedStyle(canvas).color;
    c.strokeStyle = color;
    c.fillStyle = color;
    return c;
  }, []);

  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const c = ctx();
    if (!canvas || !c) return;
    c.clearRect(0, 0, canvas.width, canvas.height);
  }, [ctx]);

  const drawText = useCallback(
    (text: string) => {
      const canvas = canvasRef.current;
      const c = ctx();
      if (!canvas || !c) return;
      clearCanvas();
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      c.font = `italic 500 ${Math.round(h * 0.34)}px ${SCRIPT_FONT}`;
      c.textAlign = "center";
      c.textBaseline = "middle";
      c.fillText(text, w / 2, h / 2, w - 24);
    },
    [ctx, clearCanvas],
  );

  /* Taille physique = taille CSS × densité ; refaite si la zone change de
     dimensions (redimensionner efface le bitmap : on redessine le texte tapé,
     un tracé à la main est perdu — cas rare, le dialog est de taille fixe). */
  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const fit = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = Math.round(canvas.clientWidth * dpr);
      const h = Math.round(canvas.clientHeight * dpr);
      if (canvas.width === w && canvas.height === h) return;
      canvas.width = w;
      canvas.height = h;
      if (typed.current) drawText(typed.current);
      else setInk(false);
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(canvas);
    return () => ro.disconnect();
  }, [drawText, setInk]);

  useImperativeHandle(
    ref,
    () => ({
      clear: () => {
        typed.current = "";
        clearCanvas();
        setInk(false);
      },
      setText: (text: string) => {
        typed.current = text.trim();
        if (!typed.current) {
          clearCanvas();
          setInk(false);
          return;
        }
        drawText(typed.current);
        setInk(true);
      },
      toDataUrl: () => {
        const canvas = canvasRef.current;
        const c = canvas?.getContext("2d");
        if (!canvas || !c || !hasInk.current) return null;
        /* Boîte englobante de l'encre (canal alpha). */
        const { data } = c.getImageData(0, 0, canvas.width, canvas.height);
        let minX = canvas.width, minY = canvas.height, maxX = -1, maxY = -1;
        for (let y = 0; y < canvas.height; y++) {
          for (let x = 0; x < canvas.width; x++) {
            if (data[(y * canvas.width + x) * 4 + 3] === 0) continue;
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        }
        if (maxX < 0) return null;
        const dpr = window.devicePixelRatio || 1;
        const pad = CROP_PADDING * dpr;
        const sx = Math.max(0, minX - pad);
        const sy = Math.max(0, minY - pad);
        const sw = Math.min(canvas.width, maxX + pad) - sx;
        const sh = Math.min(canvas.height, maxY + pad) - sy;
        const scale = Math.min(1, EXPORT_MAX_HEIGHT / sh);
        const out = document.createElement("canvas");
        out.width = Math.max(1, Math.round(sw * scale));
        out.height = Math.max(1, Math.round(sh * scale));
        out.getContext("2d")?.drawImage(canvas, sx, sy, sw, sh, 0, 0, out.width, out.height);
        return out.toDataURL("image/png");
      },
    }),
    [clearCanvas, drawText, setInk],
  );

  const point = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    const c = ctx();
    if (!c) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    if (typed.current) {
      /* Un tracé remplace le nom tapé. */
      typed.current = "";
      clearCanvas();
      onDrawStart?.();
    }
    drawing.current = true;
    const p = point(e);
    last.current = p;
    /* Un simple tap laisse un point. */
    c.beginPath();
    c.moveTo(p.x, p.y);
    c.lineTo(p.x + 0.1, p.y);
    c.stroke();
    setInk(true);
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current || !last.current) return;
    const c = ctx();
    if (!c) return;
    /* Événements coalescés : le doigt garde un trait lisse même à haute vitesse. */
    const native = e.nativeEvent as globalThis.PointerEvent;
    const events = native.getCoalescedEvents?.() ?? [native];
    const r = e.currentTarget.getBoundingClientRect();
    c.beginPath();
    c.moveTo(last.current.x, last.current.y);
    for (const ev of events.length ? events : [native]) {
      const p = { x: ev.clientX - r.left, y: ev.clientY - r.top };
      c.lineTo(p.x, p.y);
      last.current = p;
    }
    c.stroke();
  };

  const onPointerEnd = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    drawing.current = false;
    last.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };

  return (
    <canvas
      ref={canvasRef}
      role="img"
      {...rest}
      className={cn("block h-full w-full touch-none select-none", className)}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
    />
  );
});
