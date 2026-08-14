import { describe, expect, it } from "vitest";
import { cafeReducer, createInitialPackage } from "./CafeState";

describe("cafeReducer", () => {
  it("supports selecting more than one activity", () => {
    let state = createInitialPackage();
    state = cafeReducer(state, { type: "toggle", key: "latte" });
    state = cafeReducer(state, { type: "toggle", key: "letter" });
    expect(state.selected).toEqual(["latte", "letter"]);
  });

  it("removes a selected activity without losing its work", () => {
    let state = createInitialPackage();
    state = cafeReducer(state, { type: "toggle", key: "toast" });
    state = cafeReducer(state, {
      type: "activity",
      key: "toast",
      value: { shape: "star", completed: true },
    });
    state = cafeReducer(state, { type: "toggle", key: "toast" });
    expect(state.selected).toEqual([]);
    expect(state.activities.toast).toMatchObject({ shape: "star", completed: true });
  });

  it("preserves immutable state when completing an activity", () => {
    const state = createInitialPackage();
    const next = cafeReducer(state, {
      type: "activity",
      key: "latte",
      value: { drink: "ube", completed: true },
    });
    expect(next).not.toBe(state);
    expect(next.activities.latte).toEqual({ drink: "ube", completed: true });
    expect(state.activities.latte.completed).toBe(false);
  });
});
