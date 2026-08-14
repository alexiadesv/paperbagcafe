import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405, headers: corsHeaders });
  }

  try {
    const { slug } = await request.json();
    if (typeof slug !== "string" || !/^[a-f0-9]{36}$/.test(slug)) {
      return Response.json({ error: "Invalid blind box link" }, { status: 400, headers: corsHeaders });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const { data: packageRow, error } = await admin
      .from("packages")
      .select("id,status,selected_activities,activities,bag,receipt,opened_at")
      .eq("public_slug", slug)
      .in("status", ["sent", "opened"])
      .single();

    if (error || !packageRow) {
      return Response.json({ error: "This blind box could not be found." }, { status: 404, headers: corsHeaders });
    }

    const media: Record<string, string> = {};
    const activities = structuredClone(packageRow.activities);
    for (const [key, value] of Object.entries(activities as Record<string, Record<string, unknown>>)) {
      const path = value?.media_path;
      if (typeof path !== "string") continue;
      const { data } = await admin.storage.from("package-media").createSignedUrl(path, 3600);
      if (data?.signedUrl) media[key] = data.signedUrl;
      delete value.media_path;
    }

    if (!packageRow.opened_at) {
      await admin
        .from("packages")
        .update({ status: "opened", opened_at: new Date().toISOString() })
        .eq("id", packageRow.id)
        .is("opened_at", null);
    }

    return Response.json(
      {
        selected: packageRow.selected_activities,
        activities,
        bag: packageRow.bag,
        receipt: packageRow.receipt,
        status: "opened",
        media,
      },
      { headers: { ...corsHeaders, "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json({ error: "Unable to open this blind box." }, { status: 500, headers: corsHeaders });
  }
});
