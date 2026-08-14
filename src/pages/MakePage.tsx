import { Navigate, useNavigate, useParams } from "react-router-dom";
import { activityInfo } from "../data/assets";
import { useCafe } from "../state/CafeState";
import { ACTIVITY_KEYS, type ActivityKey } from "../types";
import { ActivityWorkspace } from "../features/activities/ActivityWorkspace";

export function MakePage() {
  const { state, dispatch, selectedComplete } = useCafe();
  const navigate = useNavigate();

  const continueToSeal = () => {
    if (!state.selected.length) return;
    if (!selectedComplete) {
      const next = state.selected.find((key) => !state.activities[key].completed);
      if (next) navigate(`/make/${next}`);
      return;
    }
    navigate("/seal");
  };

  return (
    <section className="make-page">
      <header className="page-heading">
        <p className="kicker">choose one or choose a few</p>
        <h1>Make your blind box</h1>
        <p>Everything you make will be tucked into the bag.</p>
      </header>

      <div className="activity-grid">
        {ACTIVITY_KEYS.map((key) => {
          const selected = state.selected.includes(key);
          const completed = state.activities[key].completed;
          const info = activityInfo[key];
          const showAction = selected || completed;
          return (
            <article
              className={`activity-card ${selected ? "selected" : ""} ${completed ? "completed" : ""}`}
              key={key}
            >
              <button
                className="activity-select"
                onClick={() => dispatch({ type: "toggle", key })}
                aria-pressed={selected}
              >
                <span className="activity-number">{info.number}</span>
                <span className="selection-mark">{selected ? "✓" : "+"}</span>
                <span className="activity-copy">
                  <strong>{info.title}</strong>
                  <small>{info.subtitle}</small>
                </span>
              </button>
              <button
                className="mini-button"
                aria-hidden={!showAction}
                tabIndex={showAction ? 0 : -1}
                onClick={() => {
                  if (completed && key === "latte") {
                    dispatch({
                      type: "activity",
                      key: "latte",
                      value: { snapshot: undefined, foamSnapshot: undefined },
                    });
                  }
                  if (completed && key === "tart") {
                    dispatch({
                      type: "activity",
                      key: "tart",
                      value: { toppings: [], snapshot: undefined },
                    });
                  }
                  navigate(`/make/${key}`);
                }}
              >
                {completed ? "edit" : "make"}
              </button>
            </article>
          );
        })}
      </div>

      {!state.selected.length && (
        <p className="validation-note">Choose at least one treat to continue.</p>
      )}
      <div className="page-actions">
        <button
          className="primary-button"
          disabled={!state.selected.length}
          onClick={continueToSeal}
        >
          {selectedComplete ? "seal" : "finish packing"}
        </button>
      </div>
    </section>
  );
}

export function ActivityPage() {
  const { activity } = useParams();
  const { state } = useCafe();
  if (!ACTIVITY_KEYS.includes(activity as ActivityKey)) return <Navigate to="/make" />;
  const key = activity as ActivityKey;
  if (!state.selected.includes(key) && !state.activities[key].completed) {
    return <Navigate to="/make" />;
  }
  return <ActivityWorkspace activity={key} />;
}
