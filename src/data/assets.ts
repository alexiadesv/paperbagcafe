import type { ActivityKey, Drink, ToastFilling, ToastShape } from "../types";

const ROOT = "/watercolor-assets";

export const asset = (path: string) => `${ROOT}/${path}`;

export const activityInfo: Record<
  ActivityKey,
  { title: string; subtitle: string; number: string }
> = {
  latte: { title: "Latte art", subtitle: "Pour a tiny cloud", number: "01" },
  tart: { title: "Decorate tart", subtitle: "Pick something sweet", number: "02" },
  toast: { title: "Pressed toast", subtitle: "Stamp, fill & toast", number: "03" },
  letter: { title: "Typed letter", subtitle: "Leave a little note", number: "04" },
  watercolor: { title: "Watercolor", subtitle: "Paint a soft memory", number: "05" },
  nameTag: { title: "Name tag", subtitle: "Write it by hand", number: "06" },
};

export const cupAssets: Record<Drink, string> = {
  espresso: asset("cups/pink-coffee.png"),
  matcha: asset("cups/pink-matcha.png"),
  ube: asset("cups/pink-ube.png"),
};

export const cursorAssets = {
  idle: asset("cursors/pourer-idle.png"),
  hover: asset("cursors/pourer-hover.png"),
  pouring: asset("cursors/pourer-pouring.png"),
  toothpick: asset("cursors/latte-toothpick.png"),
};

export const toppingAssets = {
  "whipped-cream": asset("tart-toppings/whipped-cream.png"),
  "sliced-strawberry": asset("tart-toppings/sliced-strawberry.png"),
  blueberry: asset("tart-toppings/blueberry.png"),
  "sliced-mango": asset("tart-toppings/sliced-mango.png"),
  "mandarin-segment": asset("tart-toppings/mandarin-segment.png"),
} as const;

export function toastAsset(
  shape: ToastShape,
  filling: ToastFilling,
  toasted: boolean,
) {
  if (filling === "egg") return asset(`bread/egg-${shape}.png`);
  if (filling === "chocolate") {
    return asset(`bread/${toasted ? "toasted" : "untoasted"}-chocolate-${shape}.png`);
  }
  return asset(`bread/${toasted ? "toasted" : "untoasted"}-${shape}-pressed.png`);
}

export const stampAssets: Record<ToastShape, string> = {
  paw: asset("bread-stamps/paw.png"),
  heart: asset("bread-stamps/heart.png"),
  star: asset("bread-stamps/star.png"),
};
