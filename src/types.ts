export const ACTIVITY_KEYS = [
  "latte",
  "tart",
  "toast",
  "letter",
  "watercolor",
  "nameTag",
] as const;

export type ActivityKey = (typeof ACTIVITY_KEYS)[number];
export type WorkflowStatus = "draft" | "sealed" | "sent" | "opened";
export type Drink = "espresso" | "matcha" | "ube";
export type ToastShape = "paw" | "heart" | "star";
export type ToastFilling = "none" | "egg" | "chocolate";
export type BagColor = "brown" | "pink" | "green" | "blue";

export interface Point {
  x: number;
  y: number;
  rotation?: number;
  scale?: number;
}

export interface TartTopping extends Point {
  id: string;
  kind: "whipped-cream" | "sliced-strawberry" | "blueberry" | "sliced-mango" | "mandarin-segment";
}

export interface PackageActivities {
  latte: { drink: Drink; snapshot?: string; foamSnapshot?: string; completed: boolean };
  tart: { toppings: TartTopping[]; snapshot?: string; completed: boolean };
  toast: {
    shape: ToastShape;
    filling: ToastFilling;
    toasted: boolean;
    completed: boolean;
  };
  letter: { body: string; sealed: boolean; completed: boolean };
  watercolor: { snapshot?: string; completed: boolean };
  nameTag: {
    style: "pink" | "green" | "blue";
    snapshot?: string;
    completed: boolean;
  };
}

export interface BagDetails {
  color: BagColor;
  to: string;
  from: string;
}

export interface Receipt {
  lines: string[];
  to: string;
  from: string;
  timeSpentSeconds: number;
  sentAt: string;
}

export interface CafePackage {
  selected: ActivityKey[];
  activities: PackageActivities;
  bag: BagDetails;
  status: WorkflowStatus;
  startedAt: string;
  activeSeconds: number;
  packageId?: string;
  publicSlug?: string;
  receipt?: Receipt;
}

export interface PublicPackage {
  selected: ActivityKey[];
  activities: PackageActivities;
  bag: BagDetails;
  receipt: Receipt;
  status: "sent" | "opened";
  media?: Partial<Record<ActivityKey, string>>;
}
