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
        <img className="stage-base tart-spin-in" src={asset("tart/plain-custard-tart.png")} alt="Plain custard tart" />
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
  const stageRef = useRef<HTMLDivElement>(null);
  const cursorRef = useRef<HTMLImageElement>(null);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [shape, setShape] = useState<ToastShape>(initial.shape);
  const [filling, setFilling] = useState<ToastFilling>(initial.filling);
  const [toasted, setToasted] = useState(initial.toasted);
  const [toastChosen, setToastChosen] = useState(false);
  const [fillingChosen, setFillingChosen] = useState(false);
  const [shapeStamped, setShapeStamped] = useState(false);
  const [stampShape, setStampShape] = useState<ToastShape | null>(null);
  const [pressing, setPressing] = useState(false);
  const [pressPoint, setPressPoint] = useState<{ x: number; y: number } | null>(null);

  const breadSrc = () => {
    if (step === 1 && !shapeStamped) return asset("bread/plain-white-bread.png");
    const showToasted = step === 3 && toastChosen && toasted;
    return toastAsset(shape, filling, showToasted);
  };

  const moveCursor = (event: ReactPointerEvent) => {
    if (!stampShape || !cursorRef.current || !stageRef.current) return;
    const rect = stageRef.current.getBoundingClientRect();
    cursorRef.current.style.left = `${event.clientX - rect.left}px`;
    cursorRef.current.style.top = `${event.clientY - rect.top}px`;
  };

  const stampBread = (event: ReactPointerEvent) => {
    if (step !== 1 || !stampShape || pressing) return;
    const rect = stageRef.current!.getBoundingClientRect();
    setPressPoint({
      x: ((event.clientX - rect.left) / rect.width) * 100,
      y: ((event.clientY - rect.top) / rect.height) * 100,
    });
    setPressing(true);
    window.setTimeout(() => {
      setShape(stampShape);
      setShapeStamped(true);
      setFilling("none");
      setToasted(false);
      setToastChosen(false);
      setStampShape(null);
      setPressing(false);
      setPressPoint(null);
      setFillingChosen(false);
      setStep(2);
    }, 430);
  };

  const chooseFilling = (value: ToastFilling) => {
    setFilling(value);
    setFillingChosen(true);
  };

  const continueToToast = () => {
    setToastChosen(false);
    setToasted(false);
    setStep(3);
  };

  const chooseToast = (value: boolean) => {
    setToasted(value);
    setToastChosen(true);
  };

  const displayedBread = breadSrc();

  return (
    <div className="toast-maker">
      <div
        className={`toast-stage ${stampShape ? "toast-stage--stamping" : ""}`}
        ref={stageRef}
        onPointerMove={moveCursor}
        onPointerDown={stampBread}
        aria-label={step === 1 ? "Stamp bread" : undefined}
      >
        <img
          key={`${displayedBread}-${step}-${toastChosen ? "chosen" : "preview"}`}
          className="stage-base toast-change"
          src={displayedBread}
          alt={shapeStamped ? `${toasted ? "Toasted" : "Untoasted"} ${shape} bread` : "Plain bread"}
        />
        {pressing && pressPoint && stampShape && (
          <img
            className="pressing-stamp pressing-stamp--point down"
            src={stampAssets[stampShape]}
            alt=""
            style={{ "--press-x": `${pressPoint.x}%`, "--press-y": `${pressPoint.y}%` } as React.CSSProperties}
          />
        )}
        {stampShape && !pressing && (
          <img ref={cursorRef} className="toast-stamp-cursor" src={stampAssets[stampShape]} alt="" />
        )}
      </div>

      {step === 1 && (
        <fieldset>
          <legend>press a shape</legend>
          <div className="choice-row">
            {(["paw", "heart", "star"] as ToastShape[]).map((value) => (
              <button
                className={stampShape === value ? "chip active" : "chip"}
                key={value}
                onClick={() => setStampShape(value)}
              >
                {value}
              </button>
            ))}
          </div>
        </fieldset>
      )}

      {step === 2 && (
        <>
          <fieldset>
            <legend>add something</legend>
            <div className="choice-row">
              {(["none", "egg", "chocolate"] as ToastFilling[]).map((value) => (
                <button
                  className={fillingChosen && filling === value ? "chip active" : "chip"}
                  onClick={() => chooseFilling(value)}
                  key={value}
                >
                  {value === "none" ? "skip" : value}
                </button>
              ))}
            </div>
          </fieldset>
          <button className="primary-button" disabled={!fillingChosen} onClick={continueToToast}>
            next
          </button>
        </>
      )}

      {step === 3 && (
        <>
          <fieldset>
            <legend>how would you like it?</legend>
            <div className="choice-row">
              <button className={toastChosen && toasted ? "chip active" : "chip"} onClick={() => chooseToast(true)}>
                toast
              </button>
              <button className={toastChosen && !toasted ? "chip active" : "chip"} onClick={() => chooseToast(false)}>
                untoasted
              </button>
            </div>
          </fieldset>
          <button
            className="primary-button"
            disabled={!toastChosen}
            onClick={() => {
              dispatch({ type: "activity", key: "toast", value: { shape, filling, toasted, completed: true } });
              navigate("/make");
            }}
          >
            all done!
          </button>
        </>
      )}
    </div>
  );
}

const ENVELOPE_STOCKS = [
  {
    swatch: "#dbe6e2",
    back: "linear-gradient(160deg, #e4ede9, #cfdcd8)",
    front: "linear-gradient(160deg, #dfeae6, #c7d6d1)",
    flap: "linear-gradient(180deg, #d8e4e0, #e7efec)",
  },
  {
    swatch: "#f2e3e7",
    back: "linear-gradient(160deg, #f7e9ed, #e8d3d9)",
    front: "linear-gradient(160deg, #f3e5ea, #e0c9d0)",
    flap: "linear-gradient(180deg, #ecdbe0, #f8ecef)",
  },
  {
    swatch: "#eee6d5",
    back: "linear-gradient(160deg, #f5eddd, #e4d8c2)",
    front: "linear-gradient(160deg, #f1e8d7, #ddceb6)",
    flap: "linear-gradient(180deg, #ebe1cd, #f6efe1)",
  },
  {
    swatch: "#e2e6ec",
    back: "linear-gradient(160deg, #eaeef3, #d5dbe4)",
    front: "linear-gradient(160deg, #e5eaf0, #ccd4de)",
    flap: "linear-gradient(180deg, #dee4eb, #edf1f5)",
  },
  {
    swatch: "#e6e3e0",
    back: "linear-gradient(160deg, #eeebe7, #dad5d0)",
    front: "linear-gradient(160deg, #e9e6e1, #d1cbc5)",
    flap: "linear-gradient(180deg, #e2ded9, #f0edea)",
  },
];

function LetterActivity() {
  const { state, dispatch } = useCafe();
  const navigate = useNavigate();
  const [body, setBody] = useState(state.activities.letter.body);
  const [open, setOpen] = useState(true);
  const [stock, setStock] = useState(1);
  const [folding, setFolding] = useState(false);
  const paper = ENVELOPE_STOCKS[stock];

  const fold = () => {
    if (!body.trim() || folding) return;
    setFolding(true);
    setOpen(false);
    window.setTimeout(() => {
      dispatch({ type: "activity", key: "letter", value: { body, completed: true, sealed: false } });
      navigate("/make");
    }, 1400);
  };

  return (
    <div className={`letter-maker ${open ? "is-open" : "is-shut"} ${folding ? "is-folding" : ""}`}>
      <p className="letter-hint">click the envelope to open or shut it</p>
      <div className="css-letter-stage">
        <div className="css-letter-scale">
          <div className="css-envelope">
            <button
              className="css-env-back"
              style={{ background: paper.back }}
              aria-label={open ? "Shut envelope" : "Open envelope"}
              onClick={() => !folding && setOpen((value) => !value)}
            />
            <div className="css-letter-slot">
              <div className="css-letter-sheet">
                <textarea
                  maxLength={300}
                  rows={10}
                  value={body}
                  onChange={(event) => setBody(event.target.value)}
                  placeholder="I saw something today that reminded me of you..."
                  aria-label="Your letter"
                  disabled={folding || !open}
                />
              </div>
            </div>
            <button
              className="css-env-front"
              style={{ background: paper.front }}
              tabIndex={-1}
              aria-hidden="true"
              onClick={() => !folding && setOpen((value) => !value)}
            />
            <button
              className="css-env-flap"
              style={{ background: paper.flap }}
              tabIndex={-1}
              aria-hidden="true"
              onClick={() => !folding && setOpen((value) => !value)}
            />
          </div>
        </div>
      </div>
      <div className="envelope-stocks" aria-label="Envelope color">
        <span>envelope</span>
        {ENVELOPE_STOCKS.map((option, index) => (
          <button
            key={option.swatch}
            className={stock === index ? "stock active" : "stock"}
            style={{ background: option.swatch }}
            aria-label={`Envelope color ${index + 1}`}
            aria-pressed={stock === index}
            onClick={() => setStock(index)}
          />
        ))}
      </div>
      <button className="primary-button" disabled={!body.trim() || folding} onClick={fold}>
        {folding ? "folding..." : "fold this letter"}
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
