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
// HY CORE — hy-pay: طلب دفع اشتراك مع رفع الوصل، وعرض الوصل للمدير برابط مؤقت
// الإعداد: Verify JWT = OFF (التحقق داخل الكود)
const MAX_FILE = 5 * 1024 * 1024;

function sniff(bytes: Uint8Array): { ext: string; mime: string } | null {
  const b = bytes;
  if (b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46) return { ext: "pdf", mime: "application/pdf" };
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return { ext: "png", mime: "image/png" };
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { ext: "jpg", mime: "image/jpeg" };
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
      b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return { ext: "webp", mime: "image/webp" };
  return null;
}

async function setting(key: string): Promise<any> {
  const r = await rest(`app_settings?key=eq.${key}&select=value`);
  return r[0]?.value ?? null;
}

serve(async (req) => {
  const me = (await getMe(req))!;
  const type = req.headers.get("content-type") || "";

  if (type.includes("application/json")) {
    const b = await req.json().catch(() => ({}));
    if (b.action === "receipt_url") {
      if (me.role !== "admin") throw new HttpError(403, "عرض الوصولات للمدير فقط");
      const [p] = await rest(`payments?id=eq.${Number(b.payment_id)}&select=receipt_path`);
      if (!p?.receipt_path) throw new HttpError(404, "لا يوجد وصل مرفق");
      const res = await fetch(`${SB_URL}/storage/v1/object/sign/receipts/${p.receipt_path}`, {
        method: "POST", headers: serviceHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ expiresIn: 300 }),
      });
      const d = await res.json();
      if (!res.ok) { console.error("SIGN", d); throw new HttpError(500, "تعذّر فتح الوصل"); }
      const signed = d.signedURL || d.signedUrl;
      return json(req, { url: `${SB_URL}/storage/v1${signed.startsWith("/") ? "" : "/"}${signed}` });
    }
    throw new HttpError(400, "عملية غير معروفة");
  }

  // طلب دفع جديد (multipart/form-data)
  if (!["student", "parent"].includes(me.role)) throw new HttpError(403, "الدفع من حساب الطالب أو ولي الأمر");
  const form = await req.formData();
  let studentId = me.id;
  if (me.role === "parent") {
    studentId = str(form.get("student_id"), 40);
    const link = await rest(`parent_students?parent_id=eq.${me.id}&student_id=eq.${studentId}&select=student_id`);
    if (!link.length) throw new HttpError(403, "هذا الطالب غير مرتبط بحسابك");
  }

  const months = Number(form.get("months"));
  if (![1, 3, 6, 12].includes(months)) throw new HttpError(400, "اختر مدة الاشتراك");
  const methods = (await setting("payment_methods")) || [];
  const method = methods.find((m: any) => m.key === str(form.get("method"), 30));
  if (!method) throw new HttpError(400, "اختر طريقة الدفع");

  const pending = await rest(`payments?student_id=eq.${studentId}&status=eq.pending&select=id`);
  if (pending.length >= 2) throw new HttpError(429, "لديك طلب دفع بانتظار التأكيد، انتظر رد الإدارة");

  // السعر من الخادم دائماً
  const amount = Number(await rpc("price_for", { p_months: months }));
  const rate = Number((await setting("usd_syp"))?.rate) || null;

  let receipt_path: string | null = null;
  const ref = newRef("PY");
  const file = form.get("file");
  if (method.needs_receipt) {
    if (!(file instanceof File) || file.size === 0) throw new HttpError(400, "ارفع صورة الوصل أو ملف PDF");
    if (file.size > MAX_FILE) throw new HttpError(400, "حجم الوصل أكبر من 5MB");
    const bytes = new Uint8Array(await file.arrayBuffer());
    const kind = sniff(bytes);
    if (!kind) throw new HttpError(400, "يجب أن يكون الملف صورة (JPG أو PNG أو WEBP) أو PDF");
    receipt_path = `${studentId}/${ref}.${kind.ext}`;
    const up = await fetch(`${SB_URL}/storage/v1/object/receipts/${receipt_path}`, {
      method: "POST", headers: serviceHeaders({ "Content-Type": kind.mime, "x-upsert": "false" }), body: bytes,
    });
    if (!up.ok) { console.error("UPLOAD", await up.text()); throw new HttpError(500, "تعذّر رفع الوصل، حاول مرة ثانية"); }
  }

  const [payment] = await rest("payments", {
    method: "POST",
    body: JSON.stringify({
      ref, student_id: studentId, months, amount_usd: amount,
      usd_syp: rate, amount_syp: rate ? Math.round(amount * rate) : null,
      method: method.key, payer_name: str(form.get("payer_name"), 80) || me.full_name,
      note: str(form.get("note"), 300) || null, status: "pending", receipt_path, submitted_by: me.id,
    }),
  });
  return json(req, { ok: true, ref: payment.ref, amount_usd: payment.amount_usd, amount_syp: payment.amount_syp });
});
