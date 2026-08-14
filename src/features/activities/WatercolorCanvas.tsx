import {
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

const COLORS = ["#ff99c8", "#fcf6bd", "#d0f4de", "#a9def9", "#e4c1f9"];
const PAINT_OPACITY = 0.5;

type Rgb = [number, number, number];

function rgbOf(hex: string): Rgb {
  return [
    Number.parseInt(hex.slice(1, 3), 16),
    Number.parseInt(hex.slice(3, 5), 16),
    Number.parseInt(hex.slice(5, 7), 16),
  ];
}

function toCss([r, g, b]: Rgb) {
  return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
}

function lighten([r, g, b]: Rgb, amount: number): Rgb {
  return [r + (255 - r) * amount, g + (255 - g) * amount, b + (255 - b) * amount];
}

function darken([r, g, b]: Rgb, amount: number): Rgb {
  return [r * (1 - amount), g * (1 - amount), b * (1 - amount)];
}

/** Stable pseudo-random value so a dab keeps the same shape between repaints. */
function jitter(x: number, y: number, seed: number) {
  const value = Math.sin(x * 12.9898 + y * 78.233 + seed * 37.719) * 43758.5453;
  return value - Math.floor(value);
}

function createGrain() {
  const grain = document.createElement("canvas");
  grain.width = 128;
  grain.height = 128;
  const ctx = grain.getContext("2d")!;
  for (let index = 0; index < 2200; index += 1) {
    const x = jitter(index, 3.1, 1) * 128;
    const y = jitter(index, 7.7, 2) * 128;
    const radius = 0.4 + jitter(index, 5.3, 3) * 1.1;
    ctx.fillStyle = `rgba(72, 54, 46, ${0.05 + jitter(index, 9.4, 4) * 0.16})`;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }
  return grain;
}

interface WatercolorCanvasProps {
  initialSnapshot?: string;
  onComplete: (snapshot: string) => void;
}

export function WatercolorCanvas({
  initialSnapshot,
  onComplete,
}: WatercolorCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const strokeRef = useRef<HTMLCanvasElement>(null);
  const maskRef = useRef<HTMLCanvasElement | null>(null);
  const rimRef = useRef<HTMLCanvasElement | null>(null);
  const grainRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const history = useRef<ImageData[]>([]);
  const pickup = useRef<Rgb | null>(null);
  const wetBuffers = useRef<{ source: HTMLCanvasElement; soft: HTMLCanvasElement } | null>(null);
  const repaintQueued = useRef(false);
  const [color, setColor] = useState(COLORS[0]);
  const [size, setSize] = useState(28);
  const [tool, setTool] = useState<"paint" | "blend">("paint");
  const [canUndo, setCanUndo] = useState(false);
  const settings = useRef({ color, size, tool });

  useEffect(() => {
    settings.current = { color, size, tool };
  }, [color, size, tool]);

  const context = () => canvasRef.current?.getContext("2d", { willReadFrequently: true });
  const ratio = () => Math.min(window.devicePixelRatio || 1, 2);

  const buffers = useCallback(() => {
    if (!maskRef.current) maskRef.current = document.createElement("canvas");
    if (!rimRef.current) rimRef.current = document.createElement("canvas");
    if (!grainRef.current) grainRef.current = createGrain();
    return { mask: maskRef.current, rim: rimRef.current, grain: grainRef.current };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const stroke = strokeRef.current!;
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.round(rect.width * dpr);
      const height = Math.round(rect.height * dpr);
      const old = document.createElement("canvas");
      old.width = canvas.width;
      old.height = canvas.height;
      old.getContext("2d")?.drawImage(canvas, 0, 0);

      const { mask, rim } = buffers();
      for (const layer of [canvas, stroke, mask, rim]) {
        layer.width = width;
        layer.height = height;
        layer.getContext("2d")!.setTransform(dpr, 0, 0, dpr, 0, 0);
      }

      const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
      if (old.width) ctx.drawImage(old, 0, 0, rect.width, rect.height);
      else {
        ctx.fillStyle = "#fffefb";
        ctx.fillRect(0, 0, rect.width, rect.height);
      }
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [buffers]);

  useEffect(() => {
    if (!initialSnapshot) return;
    const image = new Image();
    image.onload = () => {
      const canvas = canvasRef.current;
      if (canvas) context()?.drawImage(image, 0, 0, canvas.clientWidth, canvas.clientHeight);
    };
    image.src = initialSnapshot;
  }, [initialSnapshot]);

  const position = (event: ReactPointerEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const remember = () => {
    const canvas = canvasRef.current!;
    const ctx = context()!;
    history.current.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
    if (history.current.length > 15) history.current.shift();
    setCanUndo(true);
  };

  const clearLayer = (layer: HTMLCanvasElement) => {
    const ctx = layer.getContext("2d")!;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, layer.width, layer.height);
    ctx.restore();
  };

  /** Lays down the wet footprint of one dab as coverage in the mask layer. */
  const maskDab = (x: number, y: number) => {
    const { mask } = buffers();
    const ctx = mask.getContext("2d")!;
    const brush = settings.current.size * 0.5;
    for (let index = 0; index < 4; index += 1) {
      const angle = jitter(x, y, index) * Math.PI * 2;
      const drift = jitter(x, y, index + 11) * brush * 0.24;
      const radius = brush * (0.7 + jitter(x, y, index + 23) * 0.34);
      const cx = x + Math.cos(angle) * drift;
      const cy = y + Math.sin(angle) * drift;
      const gradient = ctx.createRadialGradient(cx, cy, radius * 0.62, cx, cy, radius);
      gradient.addColorStop(0, "rgba(0, 0, 0, 1)");
      gradient.addColorStop(0.72, "rgba(0, 0, 0, .88)");
      gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  /**
   * Turns the accumulated mask into pigment: a pale wash in the middle with a
   * darker rim where the water pooled at the edge, finished with paper grain.
   */
  const renderStroke = useCallback(() => {
    const stroke = strokeRef.current;
    if (!stroke) return;
    const { mask, rim, grain } = buffers();
    const pigment = rgbOf(settings.current.color);
    const blur = Math.max(2, settings.current.size * 0.22) * ratio();

    const rimCtx = rim.getContext("2d")!;
    rimCtx.save();
    rimCtx.setTransform(1, 0, 0, 1, 0, 0);
    rimCtx.clearRect(0, 0, rim.width, rim.height);
    rimCtx.drawImage(mask, 0, 0);
    rimCtx.globalCompositeOperation = "destination-out";
    rimCtx.filter = `blur(${blur}px)`;
    rimCtx.drawImage(mask, 0, 0);
    rimCtx.filter = "none";
    rimCtx.globalCompositeOperation = "source-in";
    rimCtx.fillStyle = toCss(darken(pigment, 0.22));
    rimCtx.fillRect(0, 0, rim.width, rim.height);
    rimCtx.restore();

    const ctx = stroke.getContext("2d")!;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, stroke.width, stroke.height);
    ctx.drawImage(mask, 0, 0);
    ctx.globalCompositeOperation = "source-in";
    ctx.fillStyle = toCss(lighten(pigment, 0.52));
    ctx.fillRect(0, 0, stroke.width, stroke.height);
    ctx.globalCompositeOperation = "source-over";
    ctx.drawImage(rim, 0, 0);
    ctx.globalCompositeOperation = "source-atop";
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = ctx.createPattern(grain, "repeat")!;
    ctx.fillRect(0, 0, stroke.width, stroke.height);
    ctx.restore();
  }, [buffers]);

  const queueRender = useCallback(() => {
    if (repaintQueued.current) return;
    repaintQueued.current = true;
    requestAnimationFrame(() => {
      repaintQueued.current = false;
      renderStroke();
    });
  }, [renderStroke]);

  /**
   * Spreads pigment the way water does: every pixel drifts toward the average of
   * its neighbours, so a wash bleeds outward into bare paper and two colours meet
   * in the middle. A little of the colour picked up earlier in the stroke rides
   * along so the brush can pull pigment across the page.
   */
  const blendDab = (x: number, y: number) => {
    const canvas = canvasRef.current!;
    const ctx = context()!;
    const scale = canvas.width / canvas.clientWidth;
    const radius = Math.max(6, (settings.current.size / 2) * scale);
    // The reach of the blur is what makes colours actually travel and mix. It
    // stays wide while the per-pass strength stays low, so blending is obvious
    // but gradual rather than a single harsh smear.
    const blur = Math.min(22, Math.max(3, radius * 0.5));
    const margin = Math.ceil(blur * 2);
    const span = Math.ceil(radius + margin);
    const cx = Math.round(x * scale);
    const cy = Math.round(y * scale);
    const sx = Math.max(0, cx - span);
    const sy = Math.max(0, cy - span);
    const width = Math.min(canvas.width - sx, span * 2);
    const height = Math.min(canvas.height - sy, span * 2);
    if (width < 4 || height < 4) return;

    if (!wetBuffers.current) {
      wetBuffers.current = {
        source: document.createElement("canvas"),
        soft: document.createElement("canvas"),
      };
    }
    const { source, soft } = wetBuffers.current;
    if (source.width !== width || source.height !== height) {
      source.width = width;
      source.height = height;
      soft.width = width;
      soft.height = height;
    }

    const sourceCtx = source.getContext("2d", { willReadFrequently: true })!;
    const softCtx = soft.getContext("2d", { willReadFrequently: true })!;
    sourceCtx.clearRect(0, 0, width, height);
    sourceCtx.drawImage(canvas, sx, sy, width, height, 0, 0, width, height);
    softCtx.clearRect(0, 0, width, height);
    softCtx.filter = `blur(${blur}px)`;
    softCtx.drawImage(source, 0, 0);
    softCtx.filter = "none";

    const patch = sourceCtx.getImageData(0, 0, width, height);
    const data = patch.data;
    const diffused = softCtx.getImageData(0, 0, width, height).data;
    const localCx = cx - sx;
    const localCy = cy - sy;

    const top = Math.max(0, Math.floor(localCy - radius));
    const bottom = Math.min(height - 1, Math.ceil(localCy + radius));
    const left = Math.max(0, Math.floor(localCx - radius));
    const right = Math.min(width - 1, Math.ceil(localCx + radius));

    let meanR = 0;
    let meanG = 0;
    let meanB = 0;
    let counted = 0;
    for (let py = top; py <= bottom; py += 1) {
      for (let px = left; px <= right; px += 1) {
        if (Math.hypot(px - localCx, py - localCy) > radius) continue;
        const index = (py * width + px) * 4;
        meanR += data[index];
        meanG += data[index + 1];
        meanB += data[index + 2];
        counted += 1;
      }
    }
    if (!counted) return;
    const mean: Rgb = [meanR / counted, meanG / counted, meanB / counted];

    const carried = pickup.current;
    if (!carried) pickup.current = mean;
    else {
      const rate = 0.3;
      carried[0] += (mean[0] - carried[0]) * rate;
      carried[1] += (mean[1] - carried[1]) * rate;
      carried[2] += (mean[2] - carried[2]) * rate;
    }
    const load = pickup.current!;

    for (let py = top; py <= bottom; py += 1) {
      for (let px = left; px <= right; px += 1) {
        const distance = Math.hypot(px - localCx, py - localCy);
        if (distance > radius) continue;
        const index = (py * width + px) * 4;
        // Near the paper border the blur samples past the buffer and its colour
        // is unreliable, so those pixels are left untouched.
        if (diffused[index + 3] < 250) continue;
        const falloff = (1 - (distance / radius) ** 2) ** 1.4;
        const strength = 0.22 * falloff;
        for (let channel = 0; channel < 3; channel += 1) {
          const target = diffused[index + channel] * 0.72 + load[channel] * 0.28;
          data[index + channel] += (target - data[index + channel]) * strength;
        }
      }
    }
    ctx.putImageData(patch, sx, sy);
  };

  const draw = (event: ReactPointerEvent) => {
    if (!drawing.current) return;
    const current = position(event);
    const previous = last.current ?? current;
    const distance = Math.hypot(current.x - previous.x, current.y - previous.y);
    const step = tool === "blend" ? Math.max(3, size * 0.28) : Math.max(2, size * 0.14);
    for (let traveled = 0; traveled <= distance; traveled += step) {
      const t = distance ? traveled / distance : 0;
      const x = previous.x + (current.x - previous.x) * t;
      const y = previous.y + (current.y - previous.y) * t;
      if (tool === "paint") maskDab(x, y);
      else blendDab(x, y);
    }
    if (tool === "paint") queueRender();
    last.current = current;
  };

  const start = (event: ReactPointerEvent) => {
    remember();
    drawing.current = true;
    last.current = null;
    pickup.current = null;
    event.currentTarget.setPointerCapture(event.pointerId);
    draw(event);
  };

  const commitStroke = () => {
    const canvas = canvasRef.current;
    const stroke = strokeRef.current;
    if (!canvas || !stroke) return;
    renderStroke();
    const ctx = context()!;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = PAINT_OPACITY;
    ctx.drawImage(stroke, 0, 0);
    ctx.restore();
    clearLayer(stroke);
    clearLayer(buffers().mask);
  };

  const stop = () => {
    if (!drawing.current) return;
    drawing.current = false;
    last.current = null;
    pickup.current = null;
    if (tool === "paint") commitStroke();
  };

  const undo = () => {
    const previous = history.current.pop();
    if (previous) context()?.putImageData(previous, 0, 0);
    setCanUndo(history.current.length > 0);
  };

  const clear = () => {
    remember();
    const canvas = canvasRef.current!;
    const ctx = context()!;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = "#fffefb";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
    clearLayer(strokeRef.current!);
    clearLayer(buffers().mask);
  };

  return (
    <div className="watercolor-maker">
      <div
        className="watercolor-paper"
        onPointerDown={start}
        onPointerMove={draw}
        onPointerUp={stop}
        onPointerCancel={stop}
      >
        <canvas ref={canvasRef} />
        <canvas className="watercolor-stroke" ref={strokeRef} />
      </div>
      <div className="paint-toolbar">
        <div className="paint-swatches" aria-label="Watercolor palette">
          {COLORS.map((value) => (
            <button
              key={value}
              className={color === value && tool === "paint" ? "paint-swatch active" : "paint-swatch"}
              style={{ backgroundColor: value }}
              aria-label={`Paint ${value}`}
              onClick={() => {
                setColor(value);
                setTool("paint");
              }}
            />
          ))}
          <button className={tool === "blend" ? "blend-button active" : "blend-button"} onClick={() => setTool("blend")}>water blend</button>
        </div>
        <label className="range-control">brush<input type="range" min="12" max="64" value={size} onChange={(event) => setSize(Number(event.target.value))} /></label>
        <button className="text-button" disabled={!canUndo} onClick={undo}>undo</button>
        <button className="text-button" onClick={clear}>clear</button>
      </div>
      <button className="primary-button" onClick={() => onComplete(canvasRef.current!.toDataURL("image/webp", 0.86))}>all done!</button>
    </div>
  );
}
