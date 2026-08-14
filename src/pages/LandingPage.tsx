import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { asset } from "../data/assets";

export function LandingPage() {
  const navigate = useNavigate();
  const [opening, setOpening] = useState(false);

  const begin = () => {
    setOpening(true);
    window.setTimeout(() => navigate("/make"), 1350);
  };

  return (
    <main className={`landing ${opening ? "is-opening" : ""}`}>
      <div className="landing-doodle landing-doodle--cup" aria-hidden="true">
        <img src={asset("cups/pink-coffee.png")} alt="" />
      </div>
      <div className="landing-doodle landing-doodle--tart" aria-hidden="true">
        <img src={asset("tart/plain-custard-tart.png")} alt="" />
      </div>
      <section className="landing-card">
        <p className="kicker">a tiny something for someone</p>
        <h1>Concept Café</h1>
        <p className="landing-script">make your blind box</p>
        <button className="primary-button ribbon-button" onClick={begin}>
          begin making
        </button>
      </section>
      <div className="opening-screen" aria-live="polite">
        <div className="opening-bag">
          <img src={asset("packaging/paper-bag-brown.png")} alt="" />
          <span>opening<span className="loading-dots">...</span></span>
        </div>
      </div>
    </main>
  );
}
