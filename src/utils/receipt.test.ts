import { describe, expect, it } from "vitest";
import { createInitialPackage } from "../state/CafeState";
import { formatDuration, makeReceipt } from "./receipt";

describe("receipt helpers", () => {
  it("describes selected configurable treats", () => {
    const state = createInitialPackage();
    state.selected = ["latte", "toast"];
    state.activities.latte.drink = "matcha";
    state.activities.toast = {
      shape: "paw",
      filling: "chocolate",
      toasted: true,
      completed: true,
    };
    state.bag = { color: "pink", to: "Alex", from: "Sam" };
    state.activeSeconds = 125;
    const receipt = makeReceipt(state, new Date("2026-08-13T12:00:00Z"));
    expect(receipt.lines).toEqual([
      "Latte art · matcha",
      "Toasted paw toast · chocolate",
    ]);
    expect(receipt.to).toBe("Alex");
    expect(receipt.sentAt).toBe("2026-08-13T12:00:00.000Z");
  });

  it("formats a friendly minimum duration", () => {
    expect(formatDuration(0)).toBe("1 minute");
    expect(formatDuration(121)).toBe("2 minutes");
  });
});
