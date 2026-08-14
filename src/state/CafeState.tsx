import {
  createContext,
  type Dispatch,
  type PropsWithChildren,
  useContext,
  useEffect,
  useMemo,
  useReducer,
} from "react";
import type {
  ActivityKey,
  BagDetails,
  CafePackage,
  PackageActivities,
  Receipt,
  WorkflowStatus,
} from "../types";

const STORAGE_KEY = "concept-cafe-draft-v1";

export const createInitialPackage = (): CafePackage => ({
  selected: [],
  status: "draft",
  startedAt: new Date().toISOString(),
  activeSeconds: 0,
  bag: { color: "brown", to: "", from: "" },
  activities: {
    latte: { drink: "espresso", completed: false },
    tart: { toppings: [], completed: false },
    toast: { shape: "heart", filling: "none", toasted: false, completed: false },
    letter: { body: "", sealed: false, completed: false },
    watercolor: { completed: false },
    nameTag: { style: "pink", completed: false },
  },
});

type Action =
  | { type: "toggle"; key: ActivityKey }
  | {
      type: "activity";
      key: ActivityKey;
      value: Partial<PackageActivities[ActivityKey]>;
    }
  | { type: "bag"; value: Partial<BagDetails> }
  | { type: "status"; value: WorkflowStatus }
  | { type: "tick"; seconds: number }
  | { type: "remote"; packageId: string; publicSlug?: string }
  | { type: "receipt"; value: Receipt }
  | { type: "reset" };

export function cafeReducer(state: CafePackage, action: Action): CafePackage {
  switch (action.type) {
    case "toggle": {
      const selected = state.selected.includes(action.key)
        ? state.selected.filter((key) => key !== action.key)
        : [...state.selected, action.key];
      return { ...state, selected };
    }
    case "activity":
      return {
        ...state,
        activities: {
          ...state.activities,
          [action.key]: {
            ...state.activities[action.key],
            ...action.value,
          },
        } as PackageActivities,
      };
    case "bag":
      return { ...state, bag: { ...state.bag, ...action.value } };
    case "status":
      return { ...state, status: action.value };
    case "tick":
      return { ...state, activeSeconds: state.activeSeconds + action.seconds };
    case "remote":
      return { ...state, packageId: action.packageId, publicSlug: action.publicSlug };
    case "receipt":
      return { ...state, receipt: action.value };
    case "reset":
      return createInitialPackage();
  }
}

interface CafeContextValue {
  state: CafePackage;
  dispatch: Dispatch<Action>;
  selectedComplete: boolean;
}

const CafeContext = createContext<CafeContextValue | null>(null);

function loadDraft(): CafePackage {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return { ...createInitialPackage(), ...JSON.parse(stored) };
  } catch {
    // A corrupt or unavailable local store should not block the café.
  }
  return createInitialPackage();
}

export function CafeProvider({ children }: PropsWithChildren) {
  const [state, dispatch] = useReducer(cafeReducer, undefined, loadDraft);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  useEffect(() => {
    let focusedAt = document.visibilityState === "visible" ? Date.now() : 0;
    const sync = () => {
      if (focusedAt) {
        const seconds = Math.floor((Date.now() - focusedAt) / 1000);
        if (seconds > 0) dispatch({ type: "tick", seconds: Math.min(seconds, 300) });
      }
      focusedAt = document.visibilityState === "visible" ? Date.now() : 0;
    };
    document.addEventListener("visibilitychange", sync);
    const timer = window.setInterval(sync, 30_000);
    return () => {
      document.removeEventListener("visibilitychange", sync);
      window.clearInterval(timer);
    };
  }, []);

  const selectedComplete =
    state.selected.length > 0 &&
    state.selected.every((key) => state.activities[key].completed);
  const value = useMemo(
    () => ({ state, dispatch, selectedComplete }),
    [state, selectedComplete],
  );
  return <CafeContext.Provider value={value}>{children}</CafeContext.Provider>;
}

export function useCafe() {
  const context = useContext(CafeContext);
  if (!context) throw new Error("useCafe must be used inside CafeProvider");
  return context;
}
