import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value.trim().toUpperCase());
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const url = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const authorization = req.headers.get("Authorization") ?? "";
  if (!authorization.startsWith("Bearer ")) return json({ error: "Authentication required" }, 401);

  const userClient = createClient(url, anon, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } });
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { data: userData, error: authError } = await userClient.auth.getUser();
  if (authError || !userData.user) return json({ error: "Invalid session" }, 401);
  const actor = userData.user;
  const { data: profile } = await admin.from("profiles").select("platform_role,account_status").eq("id", actor.id).maybeSingle();
  if (!profile || profile.account_status !== "active") return json({ error: "Account is inactive" }, 403);

  try {
    const body = await req.json();
    const action = String(body.action ?? "");

    if (action === "list_activation_codes") {
      if (profile.platform_role !== "super_admin") return json({ error: "Super Admin only" }, 403);
      const { data, error } = await admin.from("activation_codes").select("id,status,expires_at,redeemed_by,redeemed_at,created_at").order("created_at", { ascending: false }).limit(200);
      if (error) throw error;
      return json({ codes: data ?? [] });
    }

    if (action === "create_activation_code") {
      if (profile.platform_role !== "super_admin") return json({ error: "Super Admin only" }, 403);
      const code = "ACO-" + crypto.randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase();
      const expiresAt = body.expires_at ? new Date(body.expires_at).toISOString() : null;
      const { error } = await admin.from("activation_codes").insert({ code_hash: await sha256(code), status: "available", expires_at: expiresAt });
      if (error) throw error;
      return json({ code, message: "Simpan kode ini. Kode hanya ditampilkan satu kali." });
    }

    if (action === "set_subscription") {
      if (profile.platform_role !== "super_admin") return json({ error: "Super Admin only" }, 403);
      const { company_id, package_id } = body;
      const { data: pkg, error: pkgError } = await admin.from("packages").select("id,duration_days,tenant_quota,is_active").eq("id", package_id).single();
      if (pkgError || !pkg?.is_active) return json({ error: "Paket tidak ditemukan atau nonaktif" }, 400);
      const starts = new Date();
      const ends = new Date(starts.getTime() + pkg.duration_days * 86400000);
      const payload = { company_id, package_id, status: "active", starts_at: starts.toISOString(), ends_at: ends.toISOString(), tenant_quota_snapshot: pkg.tenant_quota, updated_at: starts.toISOString() };
      const { data: existing } = await admin.from("company_subscriptions").select("id").eq("company_id", company_id).maybeSingle();
      const result = existing
        ? await admin.from("company_subscriptions").update(payload).eq("id", existing.id).select("id").single()
        : await admin.from("company_subscriptions").insert(payload).select("id").single();
      if (result.error) throw result.error;
      await admin.from("audit_logs").insert({ company_id, actor_id: actor.id, action: "subscription.activated", entity_type: "company_subscription", entity_id: result.data.id, after_data: payload });
      return json({ subscription_id: result.data.id, starts_at: payload.starts_at, ends_at: payload.ends_at });
    }

    if (action === "invite_tenant_member") {
      const { email, display_name, company_id, tenant_id, role, job_title, permissions = [] } = body;
      if (!email || !company_id || !tenant_id || !["manager", "employee"].includes(role)) return json({ error: "Data undangan tidak lengkap" }, 400);
      const { data: company } = await admin.from("companies").select("id,owner_user_id").eq("id", company_id).single();
      const isOwner = company?.owner_user_id === actor.id;
      const { data: membership } = await admin.from("tenant_members").select("id,role,is_active").eq("tenant_id", tenant_id).eq("user_id", actor.id).maybeSingle();
      const { data: permission } = await admin.from("tenant_member_permissions").select("id").eq("tenant_id", tenant_id).eq("user_id", actor.id).eq("permission_key", "employees.manage").eq("granted", true).maybeSingle();
      if (!isOwner && !(membership?.is_active && permission && role === "employee")) return json({ error: "Tidak berwenang mengundang anggota ini" }, 403);
      const { data: tenant } = await admin.from("tenants").select("id,company_id").eq("id", tenant_id).single();
      if (!tenant || tenant.company_id !== company_id) return json({ error: "Tenant tidak cocok dengan Company" }, 400);

      let targetId: string | null = null;
      const { data: listed } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      const existing = listed?.users?.find((u) => u.email?.toLowerCase() === String(email).toLowerCase());
      if (existing) targetId = existing.id;
      else {
        const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(String(email).toLowerCase(), { data: { display_name: display_name ?? "" } });
        if (inviteError) throw inviteError;
        targetId = invited.user?.id ?? null;
      }
      if (!targetId) throw new Error("Gagal membuat undangan akun");
      await admin.from("profiles").upsert({ id: targetId, display_name: display_name ?? "" }, { onConflict: "id" });
      const { data: companyMember } = await admin.from("company_members").select("id,role").eq("company_id", company_id).eq("user_id", targetId).maybeSingle();
      if (companyMember) {
        if (isOwner) await admin.from("company_members").update({ role: role === "manager" ? "manager" : companyMember.role }).eq("id", companyMember.id);
      } else {
        await admin.from("company_members").insert({ company_id, user_id: targetId, role, is_active: true });
      }
      const { data: tenantMember } = await admin.from("tenant_members").select("id").eq("tenant_id", tenant_id).eq("user_id", targetId).maybeSingle();
      if (tenantMember) await admin.from("tenant_members").update({ role, job_title: job_title ?? null, is_active: true }).eq("id", tenantMember.id);
      else await admin.from("tenant_members").insert({ tenant_id, user_id: targetId, role, job_title: job_title ?? null, is_active: true });
      let allowed: string[] = [];
      if (isOwner) {
        allowed = Array.isArray(permissions) ? permissions.filter((p: unknown) => typeof p === "string") : [];
      } else {
        const { data: actorPermissions } = await admin.from("tenant_member_permissions").select("permission_key").eq("tenant_id", tenant_id).eq("user_id", actor.id).eq("granted", true);
        const grantedToActor = new Set((actorPermissions ?? []).map((p) => p.permission_key));
        allowed = Array.isArray(permissions) ? permissions.filter((p: unknown): p is string => typeof p === "string" && grantedToActor.has(p)) : [];
      }
      await admin.from("tenant_member_permissions").delete().eq("tenant_id", tenant_id).eq("user_id", targetId);
      if (allowed.length) await admin.from("tenant_member_permissions").insert(allowed.map((permission_key: string) => ({ tenant_id, user_id: targetId, permission_key, granted: true, granted_by: actor.id })));
      await admin.from("audit_logs").insert({ company_id, tenant_id, actor_id: actor.id, action: "tenant_member.invited", entity_type: "tenant_member", after_data: { email, role, permissions: isOwner ? permissions : [] } });
      return json({ user_id: targetId, invited: !existing, role, tenant_id });
    }

    if (action === "review_payment") {
      if (profile.platform_role !== "super_admin" && profile.platform_role !== "admin_platform") return json({ error: "Admin Platform only" }, 403);
      const { request_id, decision, review_note } = body;
      if (!["approved", "rejected"].includes(decision)) return json({ error: "Keputusan tidak valid" }, 400);
      const { data: request, error: requestError } = await admin.from("subscription_payment_requests").select("id,company_id,package_id,amount,status").eq("id", request_id).single();
      if (requestError || !request || request.status !== "pending") return json({ error: "Permintaan pembayaran tidak ditemukan atau sudah diproses" }, 404);
      const { data: pkg, error: pkgError } = await admin.from("packages").select("id,duration_days,tenant_quota,is_active").eq("id", request.package_id).single();
      if (pkgError || !pkg?.is_active) return json({ error: "Paket sudah tidak aktif" }, 400);
      const reviewedAt = new Date();
      const { error: updateError } = await admin.from("subscription_payment_requests").update({ status: decision, reviewed_by: actor.id, reviewed_at: reviewedAt.toISOString(), review_note: review_note ?? null }).eq("id", request.id).eq("status", "pending");
      if (updateError) throw updateError;
      if (decision === "approved") {
        const starts = reviewedAt;
        const ends = new Date(starts.getTime() + pkg.duration_days * 86400000);
        const payload = { company_id: request.company_id, package_id: pkg.id, status: "active", starts_at: starts.toISOString(), ends_at: ends.toISOString(), tenant_quota_snapshot: pkg.tenant_quota, updated_at: starts.toISOString() };
        const { data: existing } = await admin.from("company_subscriptions").select("id").eq("company_id", request.company_id).maybeSingle();
        const result = existing ? await admin.from("company_subscriptions").update(payload).eq("id", existing.id).select("id").single() : await admin.from("company_subscriptions").insert(payload).select("id").single();
        if (result.error) throw result.error;
      }
      await admin.from("audit_logs").insert({ company_id: request.company_id, actor_id: actor.id, action: "subscription.payment_" + decision, entity_type: "subscription_payment_request", entity_id: request.id, after_data: { decision, review_note: review_note ?? null } });
      return json({ request_id: request.id, status: decision });
    }

    if (action === "set_platform_admin") {
      if (profile.platform_role !== "super_admin") return json({ error: "Super Admin only" }, 403);
      const { email, enabled } = body;
      const { data: listed } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      const target = listed?.users?.find((u) => u.email?.toLowerCase() === String(email).toLowerCase());
      if (!target) return json({ error: "Akun belum terdaftar" }, 404);
      const { error } = await admin.from("profiles").update({ platform_role: enabled ? "admin_platform" : "none", updated_at: new Date().toISOString() }).eq("id", target.id);
      if (error) throw error;
      await admin.from("audit_logs").insert({ actor_id: actor.id, action: "platform_admin.role_changed", entity_type: "profile", entity_id: target.id, after_data: { email, platform_role: enabled ? "admin_platform" : "none" } });
      return json({ user_id: target.id, platform_role: enabled ? "admin_platform" : "none" });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Internal server error" }, 400);
  }
});
