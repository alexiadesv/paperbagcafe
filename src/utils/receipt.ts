import { activityInfo } from "../data/assets";
import type { CafePackage, Receipt } from "../types";

export function formatDuration(seconds: number) {
  const minutes = Math.max(1, Math.round(seconds / 60));
  return minutes === 1 ? "1 minute" : `${minutes} minutes`;
}

export function makeReceipt(state: CafePackage, now = new Date()): Receipt {
  return {
    lines: state.selected.map((key) => {
      if (key === "latte") return `${activityInfo[key].title} · ${state.activities.latte.drink}`;
      if (key === "toast") {
        const toast = state.activities.toast;
        return `${toast.toasted ? "Toasted" : "Untoasted"} ${toast.shape} toast${toast.filling === "none" ? "" : ` · ${toast.filling}`}`;
      }
      return activityInfo[key].title;
    }),
    to: state.bag.to.trim(),
    from: state.bag.from.trim(),
    timeSpentSeconds: state.activeSeconds,
    sentAt: now.toISOString(),
  };
}
