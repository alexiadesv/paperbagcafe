import {
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { cupAssets, cursorAssets } from "../../data/assets";
import type { Drink } from "../../types";

type Tool = "pour" | "pick";

interface LatteCanvasProps {
  drink: Drink;
  initialFoam?: string;
  onDrinkChange: (drink: Drink) => void;
  onComplete: (snapshot: string, foamSnapshot: string) => void;
}

const LIQUID = { cx: 0.43, cy: 0.5, r: 0.33 };
const PICK_RADIUS = 26;
const FOAM_RGB = [255, 253, 248] as const;

const CURSORS = {
  pourIdle: { src: cursorAssets.idle, hot: [0.14, 0.18] as const, tilt: 0 },
  pourHover: { src: cursorAssets.hover, hot: [0.15, 0.21] as const, tilt: 0 },
  pourActive: { src: cursorAssets.pouring, hot: [0.17, 0.78] as const, tilt: 0 },
  pickIdle: { src: cursorAssets.toothpick, hot: [0.1, 0.9] as const, tilt: 0 },
  pickActive: { src: cursorAssets.toothpick, hot: [0.1, 0.9] as const, tilt: -8 },
};

export function LatteCanvas({
  drink,
  initialFoam,
  onDrinkChange,
  onComplete,
}: LatteCanvasProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cursorRef = useRef<HTMLImageElement>(null);
  const lastRef = useRef<{ x: number; y: number } | null>(null);
  const pressedAt = useRef(0);
  const holdTimer = useRef<number | null>(null);
  const [tool, setTool] = useState<Tool>("pour");
  const [drawing, setDrawing] = useState(false);
  const [size, setSize] = useState(34);
  const [entered, setEntered] = useState(false);
  const [hoveringLiquid, setHoveringLiquid] = useState(false);
  const previousDrink = useRef(drink);

  const dpr = () => Math.min(window.devicePixelRatio || 1, 2);

  const resize = useCallback(() => {
    const stage = stageRef.current;
    const canvas = canvasRef.current;
    if (!stage || !canvas) return;
    const rect = stage.getBoundingClientRect();
    const ratio = dpr();
    const old = document.createElement("canvas");
    old.width = canvas.width;
    old.height = canvas.height;
    if (canvas.width) old.getContext("2d")?.drawImage(canvas, 0, 0);
    canvas.width = Math.round(rect.width * ratio);
    canvas.height = Math.round(rect.height * ratio);
    const context = canvas.getContext("2d", { willReadFrequently: true });
    context?.setTransform(ratio, 0, 0, ratio, 0, 0);
    if (old.width) context?.drawImage(old, 0, 0, rect.width, rect.height);
  }, []);

  const clearFoam = () => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    context.save();
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.restore();
  };

  useEffect(() => {
    resize();
    const entranceFrame = window.requestAnimationFrame(() => setEntered(true));
    window.addEventListener("resize", resize);
    return () => {
      window.cancelAnimationFrame(entranceFrame);
      window.removeEventListener("resize", resize);
      if (holdTimer.current !== null) window.clearInterval(holdTimer.current);
    };
  }, [resize]);

  useEffect(() => {
    if (previousDrink.current === drink) return;
    previousDrink.current = drink;
    clearFoam();
  }, [drink]);

  useEffect(() => {
    if (!initialFoam) return;
    const canvas = canvasRef.current;
    const stage = stageRef.current;
    if (!canvas || !stage) return;
    const image = new Image();
    image.onload = () => {
      const context = canvas.getContext("2d");
      if (!context) return;
      const rect = stage.getBoundingClientRect();
      context.clearRect(0, 0, rect.width, rect.height);
      context.drawImage(image, 0, 0, rect.width, rect.height);
    };
    image.src = initialFoam;
  }, [initialFoam]);

  const point = (event: ReactPointerEvent) => {
    const rect = stageRef.current!.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const disc = () => {
    const rect = stageRef.current!.getBoundingClientRect();
    return {
      x: LIQUID.cx * rect.width,
      y: LIQUID.cy * rect.height,
      r: LIQUID.r * Math.min(rect.width, rect.height),
    };
  };

  const insideLiquid = (x: number, y: number) => {
    const liquid = disc();
    return Math.hypot(x - liquid.x, y - liquid.y) <= liquid.r;
  };

  const applyCursor = (key: keyof typeof CURSORS) => {
    const cursor = CURSORS[key];
    const element = cursorRef.current;
    if (!element) return;
    element.src = cursor.src;
    const [hx, hy] = cursor.hot;
    element.style.transformOrigin = `${hx * 100}% ${hy * 100}%`;
    element.style.transform = `translate(${-hx * 100}%, ${-hy * 100}%) rotate(${cursor.tilt}deg)`;
  };

  const refreshCursor = (overLiquid: boolean, active: boolean) => {
    if (tool === "pick") applyCursor(active ? "pickActive" : "pickIdle");
    else if (active) applyCursor("pourActive");
    else applyCursor(overLiquid ? "pourHover" : "pourIdle");
  };

  const stamp = (x: number, y: number, radius: number) => {
    const context = canvasRef.current?.getContext("2d");
    if (!context) return;
    const gradient = context.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, "rgba(255,253,248,.7)");
    gradient.addColorStop(0.65, "rgba(255,250,242,.38)");
    gradient.addColorStop(1, "rgba(255,248,238,0)");
    context.fillStyle = gradient;
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fill();
  };

  const pour = (
    from: { x: number; y: number } | null,
    to: { x: number; y: number },
    pressure: number,
  ) => {
    const context = canvasRef.current?.getContext("2d");
    if (!context) return;
    const liquid = disc();
    const held = Math.min(1, (performance.now() - pressedAt.current) / 850);
    const effectivePressure = pressure > 0 ? pressure : 0.28 + held * 0.72;
    const radius = (size * (0.42 + effectivePressure * 0.78)) / 2;
    context.save();
    context.beginPath();
    context.arc(liquid.x, liquid.y, liquid.r, 0, Math.PI * 2);
    context.clip();
    if (!from) stamp(to.x, to.y, radius);
    else {
      const distance = Math.hypot(to.x - from.x, to.y - from.y);
      const step = Math.max(2, radius * 0.35);
      for (let travel = 0; travel <= distance; travel += step) {
        const t = distance ? travel / distance : 0;
        stamp(from.x + (to.x - from.x) * t, from.y + (to.y - from.y) * t, radius);
      }
    }
    context.restore();
  };

  const warp = (from: { x: number; y: number }, to: { x: number; y: number }) => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d", { willReadFrequently: true });
    if (!canvas || !context) return;

    const scale = dpr();
    const radius = PICK_RADIUS * scale;
    const cx = to.x * scale;
    const cy = to.y * scale;
    let dx = (to.x - from.x) * scale;
    let dy = (to.y - from.y) * scale;
    const travel = Math.hypot(dx, dy);
    if (travel < 0.5) return;

    const maxPull = radius * 0.85;
    if (travel > maxPull) {
      dx = (dx / travel) * maxPull;
      dy = (dy / travel) * maxPull;
    }

    const x = Math.max(0, Math.floor(cx - radius));
    const y = Math.max(0, Math.floor(cy - radius));
    const width = Math.min(canvas.width - x, Math.ceil(radius * 2) + 2);
    const height = Math.min(canvas.height - y, Math.ceil(radius * 2) + 2);
    if (width <= 0 || height <= 0) return;

    let source: ImageData;
    try {
      source = context.getImageData(x, y, width, height);
    } catch {
      return;
    }

    const output = context.createImageData(width, height);
    output.data.set(source.data);

    const alphaAt = (px: number, py: number) => source.data[(py * width + px) * 4 + 3];
    const sampleAlpha = (fx: number, fy: number) => {
      const gx = Math.min(width - 1, Math.max(0, fx));
      const gy = Math.min(height - 1, Math.max(0, fy));
      const ix = Math.floor(gx);
      const iy = Math.floor(gy);
      const ix2 = Math.min(width - 1, ix + 1);
      const iy2 = Math.min(height - 1, iy + 1);
      const tx = gx - ix;
      const ty = gy - iy;
      const top = alphaAt(ix, iy) * (1 - tx) + alphaAt(ix2, iy) * tx;
      const bottom = alphaAt(ix, iy2) * (1 - tx) + alphaAt(ix2, iy2) * tx;
      return top * (1 - ty) + bottom * ty;
    };

    const liquid = disc();
    const lx = liquid.x * scale;
    const ly = liquid.y * scale;
    const lr = liquid.r * scale;

    for (let py = 0; py < height; py += 1) {
      for (let px = 0; px < width; px += 1) {
        const deviceX = x + px;
        const deviceY = y + py;
        const distance = Math.hypot(deviceX - cx, deviceY - cy);
        if (distance > radius) continue;
        if (Math.hypot(deviceX - lx, deviceY - ly) > lr) continue;

        const falloff = (1 - distance / radius) ** 2;
        const offset = (py * width + px) * 4;
        output.data[offset] = FOAM_RGB[0];
        output.data[offset + 1] = FOAM_RGB[1];
        output.data[offset + 2] = FOAM_RGB[2];
        output.data[offset + 3] = sampleAlpha(px - dx * falloff, py - dy * falloff);
      }
    }

    context.putImageData(output, x, y);
  };

  const moveCursor = (event: ReactPointerEvent) => {
    const cursor = cursorRef.current;
    if (!cursor) return;
    const current = point(event);
    cursor.style.left = `${current.x}px`;
    cursor.style.top = `${current.y}px`;
    const overLiquid = insideLiquid(current.x, current.y);
    setHoveringLiquid(overLiquid);

    if (drawing) {
      if (tool === "pour") pour(lastRef.current, current, event.pressure);
      else if (lastRef.current) warp(lastRef.current, current);
      lastRef.current = current;
    }
    refreshCursor(overLiquid, drawing);
  };

  const start = (event: ReactPointerEvent) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    pressedAt.current = performance.now();
    setDrawing(true);
    const current = point(event);
    lastRef.current = current;
    if (tool === "pour") {
      pour(null, current, event.pressure);
      holdTimer.current = window.setInterval(() => {
        if (lastRef.current) pour(null, lastRef.current, 0);
      }, 75);
    }
    refreshCursor(insideLiquid(current.x, current.y), true);
  };

  const stop = () => {
    const overLiquid = lastRef.current
      ? insideLiquid(lastRef.current.x, lastRef.current.y)
      : hoveringLiquid;
    setDrawing(false);
    lastRef.current = null;
    if (holdTimer.current !== null) window.clearInterval(holdTimer.current);
    holdTimer.current = null;
    refreshCursor(overLiquid, false);
  };

  const save = async () => {
    const canvas = canvasRef.current!;
    const foamSnapshot = canvas.toDataURL("image/webp", 0.86);
    const output = document.createElement("canvas");
    output.width = canvas.width;
    output.height = canvas.height;
    const context = output.getContext("2d")!;
    const cup = new Image();
    cup.src = cupAssets[drink];
    await cup.decode();
    context.drawImage(cup, 0, 0, output.width, output.height);
    context.drawImage(canvas, 0, 0);
    onComplete(output.toDataURL("image/webp", 0.86), foamSnapshot);
  };

  return (
    <div className="latte-maker">
      <div className="choice-row" aria-label="Choose a drink">
        {(["espresso", "matcha", "ube"] as Drink[]).map((value) => (
          <button
            className={drink === value ? "chip active" : "chip"}
            onClick={() => {
              if (value !== drink) onDrinkChange(value);
            }}
            key={value}
          >
            {value}
          </button>
        ))}
      </div>
      <div className="latte-stage-center">
        <div
          className={`latte-stage ${entered ? "cup-entered" : ""}`}
          ref={stageRef}
          onPointerMove={moveCursor}
          onPointerDown={start}
          onPointerUp={stop}
          onPointerCancel={stop}
          onPointerLeave={() => {
            setHoveringLiquid(false);
            stop();
          }}
        >
          <img
            className={`stage-base ${entered ? "cup-c-motion" : "cup-awaiting-entry"}`}
            src={cupAssets[drink]}
            alt={`${drink} latte cup`}
          />
          <canvas ref={canvasRef} />
          <img ref={cursorRef} className="custom-cursor" src={cursorAssets.hover} alt="" />
        </div>
      </div>
      <div className="tool-row">
        <button className={tool === "pour" ? "chip active" : "chip"} onClick={() => { setTool("pour"); refreshCursor(hoveringLiquid, false); }}>milk</button>
        <button className={tool === "pick" ? "chip active" : "chip"} onClick={() => { setTool("pick"); refreshCursor(hoveringLiquid, false); }}>toothpick</button>
        {tool === "pour" && (
          <label className="range-control">
            pour size
            <input
              type="range"
              min="16"
              max="64"
              value={size}
              onChange={(event) => setSize(Number(event.target.value))}
            />
          </label>
        )}
        <button className="text-button" onClick={clearFoam}>clear</button>
      </div>
      <button className="primary-button" onClick={save}>all done!</button>
    </div>
  );
}
