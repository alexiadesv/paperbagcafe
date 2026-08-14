import { ensureAnonymousSession, hasSupabase, supabase } from "../lib/supabase";
import type { ActivityKey, CafePackage, PublicPackage, Receipt } from "../types";
import { dataUrlToWebp } from "./canvasExport";

const LOCAL_PREFIX = "concept-cafe-public-";

function publicPayload(state: CafePackage, receipt: Receipt): PublicPackage {
  return {
    selected: state.selected,
    activities: state.activities,
    bag: state.bag,
    receipt,
    status: "sent",
  };
}

function randomSlug() {
  return `${crypto.randomUUID().replaceAll("-", "")}${Date.now().toString(36)}`;
}

function metadataActivities(state: CafePackage) {
  const activities = structuredClone(state.activities) as unknown as Record<
    string,
    Record<string, unknown>
  >;
  for (const value of Object.values(activities)) delete value.snapshot;
  return activities;
}

async function uploadSnapshots(packageId: string, state: CafePackage) {
  const session = await ensureAnonymousSession();
  if (!supabase || !session) return {};
  const media: Partial<Record<ActivityKey, string>> = {};

  for (const key of state.selected) {
    const snapshot =
      key === "latte" || key === "watercolor" || key === "nameTag"
        ? state.activities[key].snapshot
        : undefined;
    if (!snapshot) continue;
    const blob = await dataUrlToWebp(snapshot);
    const path = `${session.user.id}/${packageId}/${key}.webp`;
    const { error } = await supabase.storage
      .from("package-media")
      .upload(path, blob, { contentType: "image/webp", upsert: true });
    if (error) throw error;
    media[key] = path;
  }
  return media;
}

export async function sealPackage(state: CafePackage) {
  if (!hasSupabase || !supabase) {
    return { packageId: state.packageId ?? crypto.randomUUID() };
  }
  const session = await ensureAnonymousSession();
  if (!session) throw new Error("Could not start an anonymous café session.");

  const row = {
    owner_id: session.user.id,
    selected_activities: state.selected,
    activities: metadataActivities(state),
    letter: state.activities.letter,
    bag: state.bag,
    active_seconds: state.activeSeconds,
    status: "sealed",
    sealed_at: new Date().toISOString(),
  };

  if (state.packageId) {
    const { error } = await supabase.from("packages").update(row).eq("id", state.packageId);
    if (error) throw error;
    return { packageId: state.packageId };
  }
  const { data, error } = await supabase.from("packages").insert(row).select("id").single();
  if (error) throw error;
  return { packageId: data.id as string };
}

export async function sendPackage(
  state: CafePackage,
  packageId: string,
  receipt: Receipt,
) {
  if (!hasSupabase || !supabase) {
    const publicSlug = randomSlug();
    localStorage.setItem(
      `${LOCAL_PREFIX}${publicSlug}`,
      JSON.stringify(publicPayload(state, receipt)),
    );
    return { publicSlug };
  }

  const media = await uploadSnapshots(packageId, state);
  const activities = metadataActivities(state) as Record<string, unknown>;
  Object.entries(media).forEach(([key, path]) => {
    activities[key] = { ...(activities[key] as object), media_path: path };
  });
  const { data, error } = await supabase.rpc("send_package", {
    p_package_id: packageId,
    p_activities: activities,
    p_receipt: receipt,
    p_active_seconds: state.activeSeconds,
  });
  if (error) throw error;
  const result = Array.isArray(data) ? data[0] : data;
  if (!result?.public_slug) throw new Error("Supabase did not return a share link.");
  return { publicSlug: result.public_slug as string };
}

export async function openPackage(publicSlug: string): Promise<PublicPackage> {
  if (!hasSupabase || !supabase) {
    const stored = localStorage.getItem(`${LOCAL_PREFIX}${publicSlug}`);
    if (!stored) throw new Error("This blind box could not be found.");
    const result = JSON.parse(stored) as PublicPackage;
    result.status = "opened";
    return result;
  }
  const { data, error } = await supabase.functions.invoke("open-package", {
    body: { slug: publicSlug },
  });
  if (error) throw error;
  return data as PublicPackage;
}
