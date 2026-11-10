import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const body = await req.json();
    const token = typeof body.token === "string" ? body.token.trim() : "";
    if (token.length < 32 || token.length > 200) return json({ error: "Invalid pairing token" }, 401);

    const url = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !serviceKey) return json({ error: "Display service is not configured" }, 503);

    const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
    const tokenHash = await sha256(token);
    const { data: device, error: deviceError } = await admin
      .from("customer_display_devices")
      .select("id,tenant_id,register_id,is_active")
      .eq("pairing_token_hash", tokenHash)
      .eq("is_active", true)
      .maybeSingle();
    if (deviceError) throw deviceError;
    if (!device) return json({ error: "Perangkat display tidak ditemukan atau sudah dinonaktifkan" }, 404);

    const now = new Date().toISOString();
    const { data: tenant, error: tenantError } = await admin
      .from("tenants").select("id,name,company_id,status").eq("id", device.tenant_id).maybeSingle();
    if (tenantError) throw tenantError;
    if (!tenant || tenant.status !== "active") return json({ error: "Tenant tidak aktif" }, 403);

    const { data: company, error: companyError } = await admin
      .from("companies").select("id,status").eq("id", tenant.company_id).maybeSingle();
    if (companyError) throw companyError;
    if (!company || company.status !== "active") return json({ error: "Company tidak aktif" }, 403);

    const { data: subscription, error: subscriptionError } = await admin
      .from("company_subscriptions").select("id")
      .eq("company_id", company.id).eq("status", "active")
      .lte("starts_at", now).gt("ends_at", now).maybeSingle();
    if (subscriptionError) throw subscriptionError;
    if (!subscription) return json({ error: "Langganan Company tidak aktif" }, 403);

    const [{ data: stateRow, error: stateError }, { error: seenError }] = await Promise.all([
      admin.from("customer_display_state").select("state").eq("register_id", device.register_id).eq("tenant_id", device.tenant_id).maybeSingle(),
      admin.from("customer_display_devices").update({ last_seen_at: now }).eq("id", device.id),
    ]);
    if (stateError) throw stateError;
    if (seenError) throw seenError;

    const raw = stateRow?.state ?? {};
    const items = Array.isArray(raw.items) ? raw.items.slice(0, 80).map((item: Record<string, unknown>) => ({
      name: String(item.name ?? "").slice(0, 120),
      quantity: Math.max(0, Number(item.quantity) || 0),
      price: Math.max(0, Number(item.price) || 0),
      note: typeof item.note === "string" ? item.note.slice(0, 180) : "",
    })) : [];
    const safeState = {
      status: raw.status === "cart" || raw.status === "completed" ? raw.status : "idle",
      items,
      total: Math.max(0, Number(raw.total) || 0),
      order_note: typeof raw.order_note === "string" ? raw.order_note.slice(0, 240) : "",
      payment_method: typeof raw.payment_method === "string" ? raw.payment_method.slice(0, 30) : "",
      cash_received: Math.max(0, Number(raw.cash_received) || 0),
      change_due: Math.max(0, Number(raw.change_due) || 0),
    };
    return json({ tenant_name: tenant.name, state: safeState, server_time: now });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Internal server error" }, 400);
  }
});
