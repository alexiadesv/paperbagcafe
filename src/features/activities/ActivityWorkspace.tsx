import {
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";
import { activityInfo, asset, stampAssets, toastAsset, toppingAssets } from "../../data/assets";
import { useCafe } from "../../state/CafeState";
import type {
  ActivityKey,
  Drink,
  TartTopping,
  ToastFilling,
  ToastShape,
} from "../../types";
import { LatteCanvas } from "./LatteCanvas";
import { WatercolorCanvas } from "./WatercolorCanvas";

export function ActivityWorkspace({ activity }: { activity: ActivityKey }) {
  const navigate = useNavigate();
  const info = activityInfo[activity];

  return (
    <section className={`workspace workspace--${activity}`}>
      <header className="workspace-heading">
        <button className="back-button" onClick={() => navigate("/make")}>← back</button>
        <div>
          <p className="kicker">{info.number} / make</p>
          <h1>{info.title}</h1>
        </div>
        <span className="workspace-stamp">made by you</span>
      </header>
      {activity === "latte" && <LatteActivity />}
      {activity === "tart" && <TartActivity />}
      {activity === "toast" && <ToastActivity />}
      {activity === "letter" && <LetterActivity />}
      {activity === "watercolor" && <WatercolorActivity />}
      {activity === "nameTag" && <NameTagActivity />}
    </section>
  );
}

function LatteActivity() {
  const { state, dispatch } = useCafe();
  const navigate = useNavigate();
  const current = state.activities.latte;
  return (
    <LatteCanvas
      drink={current.drink}
      initialFoam={current.foamSnapshot}
      onDrinkChange={(drink: Drink) =>
        dispatch({
          type: "activity",
          key: "latte",
          value: { drink, snapshot: undefined, foamSnapshot: undefined },
        })
      }
      onComplete={(snapshot, foamSnapshot) => {
        dispatch({
          type: "activity",
          key: "latte",
          value: { snapshot, foamSnapshot, completed: true },
        });
        navigate("/make");
      }}
    />
  );
}

function TartActivity() {
  const { state, dispatch } = useCafe();
  const navigate = useNavigate();
  const [toppings, setToppings] = useState<TartTopping[]>(state.activities.tart.toppings);
  const [selected, setSelected] = useState<keyof typeof toppingAssets>("sliced-strawberry");
  const [hoverPoint, setHoverPoint] = useState<{ x: number; y: number } | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  const normalizedPoint = (event: ReactPointerEvent) => {
    const rect = stageRef.current!.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) / rect.width,
      y: (event.clientY - rect.top) / rect.height,
    };
  };

  const place = (event: ReactPointerEvent) => {
    const { x, y } = normalizedPoint(event);
    if (Math.hypot(x - 0.5, y - 0.5) > 0.39) return;
    setToppings((items) => [
      ...items,
      {
        id: crypto.randomUUID(),
        kind: selected,
        x,
        y,
        rotation: (items.length * 37) % 36 - 18,
        scale: selected === "blueberry" ? 0.58 : selected === "whipped-cream" ? 1.15 : 0.85,
      },
    ]);
  };

  return (
    <div className="tart-maker">
      <div
        className="tart-stage"
        ref={stageRef}
        onPointerMove={(event) => setHoverPoint(normalizedPoint(event))}
        onPointerLeave={() => setHoverPoint(null)}
        onPointerDown={place}
      >
        <img className="stage-base" src={asset("tart/plain-custard-tart.png")} alt="Plain custard tart" />
        {toppings.map((topping) => (
          <img
            key={topping.id}
            className="placed-topping"
            src={toppingAssets[topping.kind]}
            alt=""
            style={{
              left: `${topping.x * 100}%`,
              top: `${topping.y * 100}%`,
              transform: `translate(-50%, -50%) rotate(${topping.rotation}deg) scale(${topping.scale})`,
            }}
          />
        ))}
        {hoverPoint && (
          <img
            className="topping-cursor"
            src={toppingAssets[selected]}
            alt=""
            style={{ left: `${hoverPoint.x * 100}%`, top: `${hoverPoint.y * 100}%` }}
          />
        )}
      </div>
      <p className="maker-hint">Choose a topping, then tap the tart to place it.</p>
      <div className="topping-tray">
        {(Object.keys(toppingAssets) as Array<keyof typeof toppingAssets>).map((kind) => (
          <button className={selected === kind ? "topping active" : "topping"} key={kind} onClick={() => setSelected(kind)}>
            <img src={toppingAssets[kind]} alt={kind.replaceAll("-", " ")} />
          </button>
        ))}
      </div>
      <div className="tool-row">
        <button className="text-button" disabled={!toppings.length} onClick={() => setToppings((items) => items.slice(0, -1))}>undo topping</button>
        <button className="text-button" onClick={() => setToppings([])}>clear</button>
      </div>
      <button
        className="primary-button"
        onClick={() => {
          dispatch({ type: "activity", key: "tart", value: { toppings, completed: true } });
          navigate("/make");
        }}
      >
        all done!
      </button>
    </div>
  );
}

function ToastActivity() {
  const { state, dispatch } = useCafe();
  const navigate = useNavigate();
  const initial = state.activities.toast;
  const [shape, setShape] = useState<ToastShape>(initial.shape);
  const [filling, setFilling] = useState<ToastFilling>(initial.filling);
  const [toasted, setToasted] = useState(initial.toasted);
  const [pressing, setPressing] = useState(false);

  const chooseShape = (value: ToastShape) => {
    setPressing(true);
    window.setTimeout(() => {
      setShape(value);
      setPressing(false);
    }, 430);
  };

  return (
    <div className="toast-maker">
      <div className="toast-stage">
        <img
          className={`stage-base ${filling === "egg" && toasted ? "toasted-egg" : ""}`}
          src={toastAsset(shape, filling, toasted)}
          alt={`${toasted ? "Toasted" : "Untoasted"} ${shape} bread`}
        />
        <img className={`pressing-stamp ${pressing ? "down" : ""}`} src={stampAssets[shape]} alt="" />
      </div>
      <fieldset>
        <legend>press a shape</legend>
        <div className="choice-row">
          {(["paw", "heart", "star"] as ToastShape[]).map((value) => <button className={shape === value ? "chip active" : "chip"} onClick={() => chooseShape(value)} key={value}>{value}</button>)}
        </div>
      </fieldset>
      <fieldset>
        <legend>add something</legend>
        <div className="choice-row">
          {(["none", "egg", "chocolate"] as ToastFilling[]).map((value) => <button className={filling === value ? "chip active" : "chip"} onClick={() => setFilling(value)} key={value}>{value === "none" ? "skip" : value}</button>)}
        </div>
      </fieldset>
      <fieldset>
        <legend>how would you like it?</legend>
        <div className="choice-row">
          <button className={!toasted ? "chip active" : "chip"} onClick={() => setToasted(false)}>untoasted</button>
          <button className={toasted ? "chip active" : "chip"} onClick={() => setToasted(true)}>toast it</button>
        </div>
      </fieldset>
      <button
        className="primary-button"
        onClick={() => {
          dispatch({ type: "activity", key: "toast", value: { shape, filling, toasted, completed: true } });
          navigate("/make");
        }}
      >
        {toasted ? "toast & finish" : "leave untoasted"}
      </button>
    </div>
  );
}

function LetterActivity() {
  const { state, dispatch } = useCafe();
  const navigate = useNavigate();
  const [body, setBody] = useState(state.activities.letter.body);
  return (
    <div className="letter-maker">
      <div className="ruled-paper">
        <textarea
          maxLength={4000}
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder={"Dear you,\n\nToday I thought of..."}
          aria-label="Your letter"
        />
      </div>
      <div className="character-count">{body.length} / 4000</div>
      <button
        className="primary-button"
        disabled={!body.trim()}
        onClick={() => {
          dispatch({ type: "activity", key: "letter", value: { body, completed: true, sealed: false } });
          navigate("/make");
        }}
      >
        fold this letter
      </button>
    </div>
  );
}

function WatercolorActivity() {
  const { state, dispatch } = useCafe();
  const navigate = useNavigate();
  return (
    <WatercolorCanvas
      initialSnapshot={state.activities.watercolor.snapshot}
      onComplete={(snapshot) => {
        dispatch({ type: "activity", key: "watercolor", value: { snapshot, completed: true } });
        navigate("/make");
      }}
    />
  );
}

function NameTagActivity() {
  const { state, dispatch } = useCafe();
  const navigate = useNavigate();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const previous = useRef<{ x: number; y: number } | null>(null);
  const [style, setStyle] = useState(state.activities.nameTag.style);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.getContext("2d")?.scale(dpr, dpr);
    if (state.activities.nameTag.snapshot) {
      const image = new Image();
      image.onload = () => canvas.getContext("2d")?.drawImage(image, 0, 0, rect.width, rect.height);
      image.src = state.activities.nameTag.snapshot;
    }
  }, [state.activities.nameTag.snapshot]);

  const point = (event: ReactPointerEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };
  const draw = (event: ReactPointerEvent) => {
    if (!drawing.current) return;
    const current = point(event);
    const ctx = canvasRef.current!.getContext("2d")!;
    ctx.strokeStyle = "#5a4642";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(previous.current?.x ?? current.x, previous.current?.y ?? current.y);
    ctx.lineTo(current.x, current.y);
    ctx.stroke();
    previous.current = current;
  };

  return (
    <div className="name-tag-maker">
      <div className="choice-row">
        {(["pink", "green", "blue"] as const).map((value) => <button className={style === value ? "chip active" : "chip"} key={value} onClick={() => setStyle(value)}>{value} tag</button>)}
      </div>
      <div className={`hand-tag hand-tag--${style}`}>
        <span>for:</span>
        <canvas
          ref={canvasRef}
          onPointerDown={(event) => {
            drawing.current = true;
            previous.current = null;
            event.currentTarget.setPointerCapture(event.pointerId);
            draw(event);
          }}
          onPointerMove={draw}
          onPointerUp={() => {
            drawing.current = false;
            previous.current = null;
          }}
        />
      </div>
      <p className="maker-hint">Write inside the border with your finger or mouse.</p>
      <button className="text-button" onClick={() => canvasRef.current?.getContext("2d")?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height)}>clear</button>
      <button
        className="primary-button"
        onClick={() => {
          dispatch({ type: "activity", key: "nameTag", value: { style, snapshot: canvasRef.current!.toDataURL("image/webp", 0.9), completed: true } });
          navigate("/make");
        }}
      >
        stick it on the bag
      </button>
    </div>
  );
}
