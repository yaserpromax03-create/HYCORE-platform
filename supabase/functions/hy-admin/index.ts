// ---- مشترك بين كل دوال HY CORE (منسوخ داخل كل دالة عمداً لسهولة النشر من لوحة Supabase) ----
const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SECRET = Deno.env.get("SB_SECRET") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ALLOWED = (Deno.env.get("ALLOWED_ORIGINS") || "").split(",").map((s) => s.trim()).filter(Boolean);

function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") || "";
  const ok = ALLOWED.includes(origin);
  return {
    "Access-Control-Allow-Origin": ok ? origin : (ALLOWED[0] || "null"),
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

function originAllowed(req: Request): boolean {
  const origin = req.headers.get("origin") || "";
  return ALLOWED.length === 0 || ALLOWED.includes(origin);
}

class HttpError extends Error {
  status: number; code?: string;
  constructor(status: number, message: string, code?: string) { super(message); this.status = status; this.code = code; }
}

function json(req: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders(req), "Content-Type": "application/json; charset=utf-8" },
  });
}

function serviceHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const h: Record<string, string> = { apikey: SECRET, ...extra };
  if (SECRET.startsWith("eyJ")) h.Authorization = `Bearer ${SECRET}`;
  return h;
}

// طلب إلى قاعدة البيانات بصلاحية الخادم
async function rest(path: string, init: RequestInit = {}): Promise<any> {
  const res = await fetch(`${SB_URL}/rest/v1/${path}`, {
    ...init,
    headers: serviceHeaders({
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(init.headers as Record<string, string> || {}),
    }),
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    console.error("REST", path, res.status, text);
    const msg = data?.message || "";
    if (/[؀-ۿ]/.test(msg)) throw new HttpError(400, msg);
    if (data?.code === "23505") throw new HttpError(409, "القيمة مستخدمة من قبل");
    if (data?.code === "23503") throw new HttpError(409, "لا يمكن الحذف لوجود بيانات مرتبطة");
    throw new HttpError(500, "خطأ في قاعدة البيانات، حاول مرة ثانية");
  }
  return data;
}

async function rpc(fn: string, args: Record<string, unknown>): Promise<any> {
  return rest(`rpc/${fn}`, { method: "POST", body: JSON.stringify(args) });
}

type Me = { id: string; role: string; full_name: string; grade_id: number | null; active: boolean; access_until: string | null };

// يتحقق من المستخدم من التوكن، ويعيد ملفه
async function getMe(req: Request, required = true): Promise<Me | null> {
  const auth = req.headers.get("authorization") || "";
  const token = auth.replace(/^Bearer\s+/i, "");
  if (!token || !token.startsWith("eyJ") || token.split(".").length !== 3 || token === SECRET) {
    if (required) throw new HttpError(401, "سجّل الدخول من جديد");
    return null;
  }
  const res = await fetch(`${SB_URL}/auth/v1/user`, { headers: { apikey: SECRET, Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    if (required) throw new HttpError(401, "انتهت الجلسة، سجّل الدخول من جديد");
    return null;
  }
  const user = await res.json();
  const rows = await rest(`profiles?id=eq.${user.id}&select=id,role,full_name,grade_id,active,access_until`);
  const me = rows?.[0];
  if (!me || !me.active) {
    if (required) throw new HttpError(403, "الحساب موقوف، تواصل مع الإدارة");
    return null;
  }
  return me;
}

async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function newRef(prefix: string): string {
  const d = new Date(Date.now() + 3 * 3600 * 1000); // توقيت دمشق
  const ymd = d.toISOString().slice(2, 10).replace(/-/g, "");
  const rnd = [...crypto.getRandomValues(new Uint8Array(2))].map((b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
  return `${prefix}-${ymd}-${rnd}`;
}

function str(v: unknown, max = 200): string {
  return String(v ?? "").trim().slice(0, max);
}

function serve(handler: (req: Request) => Promise<Response>) {
  Deno.serve(async (req) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(req) });
    if (req.method !== "POST") return json(req, { error: "طريقة غير مسموحة" }, 405);
    if (!originAllowed(req)) return json(req, { error: "مصدر الطلب غير مسموح" }, 403);
    try {
      return await handler(req);
    } catch (e) {
      if (e instanceof HttpError) return json(req, { error: e.message, code: e.code }, e.status);
      console.error(e);
      return json(req, { error: "حدث خطأ غير متوقع، حاول مرة ثانية" }, 500);
    }
  });
}
// ---- نهاية المشترك ----
// HY CORE — hy-admin: إنشاء الحسابات وتغيير كلمات السر والحذف
// الإعداد: Verify JWT = OFF (التحقق داخل الكود)
const LOGIN_DOMAIN = Deno.env.get("LOGIN_DOMAIN") || "hycore.local";
const ROLES = ["admin", "supervisor", "teacher", "student", "parent"];

function canManage(me: Me, role: string): boolean {
  if (me.role === "admin") return true;
  if (me.role === "supervisor") return ["teacher", "student", "parent"].includes(role);
  return false;
}

function cleanUsername(u: unknown): string {
  const v = str(u, 40).toLowerCase();
  if (!/^[a-z0-9._-]{3,30}$/.test(v)) throw new HttpError(400, "اسم المستخدم: 3 إلى 30 حرفاً إنكليزياً أو أرقاماً بلا مسافات");
  return v;
}

function cleanPassword(p: unknown): string {
  const v = String(p ?? "");
  if (v.length < 6 || v.length > 72) throw new HttpError(400, "كلمة السر 6 أحرف على الأقل");
  return v;
}

async function authAdmin(path: string, init: RequestInit): Promise<any> {
  const res = await fetch(`${SB_URL}/auth/v1/admin/${path}`, {
    ...init, headers: serviceHeaders({ "Content-Type": "application/json" }),
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    console.error("AUTH", path, res.status, text);
    if (res.status === 422 || /already/i.test(text)) throw new HttpError(409, "اسم المستخدم مستخدم من قبل");
    throw new HttpError(500, "تعذّر تنفيذ العملية على الحساب");
  }
  return data;
}

async function createOne(me: Me, b: any): Promise<any> {
  const role = str(b.role, 20);
  if (!ROLES.includes(role)) throw new HttpError(400, "الدور غير صحيح");
  if (!canManage(me, role)) throw new HttpError(403, "ليس لديك صلاحية إنشاء هذا النوع من الحسابات");
  const full_name = str(b.full_name, 80);
  if (full_name.length < 2) throw new HttpError(400, "اكتب الاسم الكامل");
  const username = cleanUsername(b.username);
  const password = cleanPassword(b.password);
  const grade_id = role === "student" ? Number(b.grade_id) || null : null;
  if (role === "student" && !grade_id) throw new HttpError(400, "اختر صف الطالب");

  const exists = await rest(`profiles?username=eq.${encodeURIComponent(username)}&select=id`);
  if (exists.length) throw new HttpError(409, "اسم المستخدم مستخدم من قبل");

  const user = await authAdmin("users", {
    method: "POST",
    body: JSON.stringify({
      email: `${username}@${LOGIN_DOMAIN}`, password, email_confirm: true,
      user_metadata: { username, full_name, role },
    }),
  });
  try {
    const [profile] = await rest("profiles", {
      method: "POST",
      body: JSON.stringify({
        id: user.id, role, full_name, username, grade_id,
        phone: str(b.phone, 30) || null, notes: str(b.notes, 500) || null,
      }),
    });
    return profile;
  } catch (e) {
    await authAdmin(`users/${user.id}`, { method: "DELETE" }).catch(() => {});
    throw e;
  }
}

serve(async (req) => {
  const me = (await getMe(req))!;
  if (!["admin", "supervisor"].includes(me.role)) throw new HttpError(403, "هذه الصفحة للإدارة فقط");
  const b = await req.json().catch(() => ({}));

  switch (b.action) {
    case "create_user": {
      const profile = await createOne(me, b);
      if (profile.role === "teacher" && Array.isArray(b.subject_ids) && b.subject_ids.length) {
        await rest("teacher_subjects", {
          method: "POST",
          body: JSON.stringify(b.subject_ids.map((s: number) => ({ teacher_id: profile.id, subject_id: Number(s) }))),
        });
      }
      if (profile.role === "parent" && Array.isArray(b.student_ids) && b.student_ids.length) {
        await rest("parent_students", {
          method: "POST",
          body: JSON.stringify(b.student_ids.map((s: string) => ({ parent_id: profile.id, student_id: str(s, 40) }))),
        });
      }
      let parent = null;
      if (profile.role === "student" && b.parent && b.parent.username) {
        const existing = await rest(`profiles?username=eq.${encodeURIComponent(str(b.parent.username, 40).toLowerCase())}&role=eq.parent&select=*`);
        parent = existing[0] || await createOne(me, { ...b.parent, role: "parent" });
        await rest("parent_students", {
          method: "POST", headers: { Prefer: "resolution=ignore-duplicates,return=minimal" },
          body: JSON.stringify({ parent_id: parent.id, student_id: profile.id }),
        });
      }
      if (b.request_id) {
        await rest(`registration_requests?id=eq.${Number(b.request_id)}`, {
          method: "PATCH",
          body: JSON.stringify({ status: "converted", student_id: profile.id, handled_by: me.id }),
        });
      }
      return json(req, { ok: true, profile, parent });
    }

    case "reset_password": {
      const id = str(b.id, 40);
      const [target] = await rest(`profiles?id=eq.${id}&select=id,role`);
      if (!target) throw new HttpError(404, "الحساب غير موجود");
      if (!canManage(me, target.role)) throw new HttpError(403, "ليس لديك صلاحية على هذا الحساب");
      await authAdmin(`users/${id}`, { method: "PUT", body: JSON.stringify({ password: cleanPassword(b.password) }) });
      return json(req, { ok: true });
    }

    case "delete_user": {
      if (me.role !== "admin") throw new HttpError(403, "الحذف للمدير فقط");
      const id = str(b.id, 40);
      if (id === me.id) throw new HttpError(400, "لا يمكنك حذف حسابك");
      const pays = await rest(`payments?student_id=eq.${id}&select=id&limit=1`);
      if (pays.length) throw new HttpError(409, "لهذا الطالب دفعات مسجّلة. أوقف الحساب بدل حذفه حتى تبقى الوصولات محفوظة");
      await authAdmin(`users/${id}`, { method: "DELETE" });
      return json(req, { ok: true });
    }

    default:
      throw new HttpError(400, "عملية غير معروفة");
  }
});
