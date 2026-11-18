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
// HY CORE — hy-register: طلب تسجيل من زوار الموقع
// الإعداد: Verify JWT = OFF (للزوار)، والحماية: origin + honeypot + 5 طلبات بالساعة لكل جهاز
const SALT = Deno.env.get("RATE_SALT") || "hycore";

serve(async (req) => {
  const b = await req.json().catch(() => ({}));
  if (str(b.website)) return json(req, { ok: true, code: newRef("RQ") }); // فخ الروبوتات

  const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || req.headers.get("cf-connecting-ip") || "unknown";
  const key = await sha256Hex(ip + SALT);
  const since = new Date(Date.now() - 3600 * 1000).toISOString();
  const recent = await rest(`rate_limits?key=eq.${key}&created_at=gt.${encodeURIComponent(since)}&select=key`);
  if (recent.length >= 5) throw new HttpError(429, "وصلتنا طلبات كثيرة من جهازك، حاول بعد ساعة أو اتصل بنا");
  await rest("rate_limits", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ key }) });

  const student_name = str(b.student_name, 80);
  const phone = str(b.phone, 20).replace(/[\s-]/g, "");
  if (student_name.length < 3) throw new HttpError(400, "اكتب اسم الطالب الكامل");
  if (!/^\+?[0-9]{9,15}$/.test(phone)) throw new HttpError(400, "رقم الهاتف غير صحيح");
  const grade_id = Number(b.grade_id) || null;
  if (grade_id) {
    const g = await rest(`grades?id=eq.${grade_id}&active=eq.true&select=id`);
    if (!g.length) throw new HttpError(400, "اختر الصف");
  }

  const code = newRef("RQ");
  await rest("registration_requests", {
    method: "POST", headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      code, student_name, phone, grade_id,
      parent_name: str(b.parent_name, 80) || null, notes: str(b.notes, 500) || null, ip_hash: key,
    }),
  });
  // تنظيف السجلات القديمة
  const old = new Date(Date.now() - 2 * 86400 * 1000).toISOString();
  await rest(`rate_limits?created_at=lt.${encodeURIComponent(old)}`, { method: "DELETE", headers: { Prefer: "return=minimal" } }).catch(() => {});
  return json(req, { ok: true, code });
});
