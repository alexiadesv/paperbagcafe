import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { asset } from "../data/assets";
import { BagPreview, PackagePreview } from "../components/PackagePreview";
import { sealPackage } from "../services/packageService";
import { useCafe } from "../state/CafeState";
import type { BagColor } from "../types";

export function SealPage() {
  const { state, dispatch, selectedComplete } = useCafe();
  const navigate = useNavigate();
  const [sealing, setSealing] = useState(false);
  const [error, setError] = useState("");

  if (!state.selected.length || !selectedComplete) return <Navigate to="/make" />;

  const ready = state.bag.to.trim() && state.bag.from.trim();

  const seal = async () => {
    if (!ready || sealing) return;
    setError("");
    setSealing(true);
    if (state.selected.includes("letter")) {
      dispatch({ type: "activity", key: "letter", value: { sealed: true } });
    }
    try {
      await new Promise((resolve) => window.setTimeout(resolve, 1550));
      const result = await sealPackage({
        ...state,
        activities: {
          ...state.activities,
          letter: { ...state.activities.letter, sealed: state.selected.includes("letter") },
        },
      });
      dispatch({ type: "remote", packageId: result.packageId });
      dispatch({ type: "status", value: "sealed" });
      navigate("/sent");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The bag would not seal. Try again.");
      setSealing(false);
    }
  };

  return (
    <section className={`seal-page ${sealing ? "is-sealing" : ""}`}>
      <header className="page-heading">
        <p className="kicker">everything looks lovely</p>
        <h1>Seal your blind box</h1>
        <p>Choose the wrapping, add the names, then tuck it all inside.</p>
      </header>

      <div className="seal-layout">
        <div className="seal-visual">
          <BagPreview state={state} packed={sealing} />
          {state.selected.includes("letter") && (
            <div className="letter-seal-animation" aria-label="Letter being sealed">
              <div className="folding-letter">{state.activities.letter.body.slice(0, 72)}</div>
              <img src={asset("stationery/open-pink-envelope.png")} alt="Pink envelope" />
              <img className="closed-envelope" src={asset("stationery/letter-in-envelope.png")} alt="" />
            </div>
          )}
        </div>
        <div className="seal-controls">
          <fieldset>
            <legend>bag color</legend>
            <div className="bag-swatches">
              {(["brown", "pink", "green", "blue"] as BagColor[]).map((color) => (
                <button
                  aria-label={`${color} bag`}
                  aria-pressed={state.bag.color === color}
                  className={`bag-swatch ${state.bag.color === color ? "active" : ""}`}
                  style={{ backgroundColor: { brown: "#c79562", pink: "#efb7bd", green: "#b9cba9", blue: "#afcad9" }[color] }}
                  key={color}
                  onClick={() => dispatch({ type: "bag", value: { color } })}
                />
              ))}
            </div>
          </fieldset>
          <label>to<input maxLength={80} value={state.bag.to} onChange={(event) => dispatch({ type: "bag", value: { to: event.target.value } })} /></label>
          <label>from<input maxLength={80} value={state.bag.from} onChange={(event) => dispatch({ type: "bag", value: { from: event.target.value } })} /></label>
          <button className="primary-button" disabled={!ready || sealing} onClick={seal}>
            {sealing ? "sealing..." : "seal it"}
          </button>
          {error && <p className="error-note">{error}</p>}
        </div>
      </div>
      <details className="package-details">
        <summary>peek at everything inside</summary>
        <PackagePreview selected={state.selected} activities={state.activities} compact />
      </details>
    </section>
  );
}
