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
// HY CORE — hy-video: رفع الفيديو إلى Bunny Stream وتشغيله برابط موقّع
// الإعداد: Verify JWT = OFF (الدروس المجانية يشاهدها الزوار، والباقي يُتحقق منه داخل الكود)
const LIB = Deno.env.get("BUNNY_LIBRARY_ID") || "";
const BUNNY_KEY = Deno.env.get("BUNNY_API_KEY") || "";
const TOKEN_KEY = Deno.env.get("BUNNY_TOKEN_KEY") || "";
const CDN_HOST = Deno.env.get("BUNNY_CDN_HOST") || "";
const PLAY_TTL = 4 * 3600; // صلاحية رابط المشاهدة: 4 ساعات

async function bunny(path: string, init: RequestInit = {}): Promise<any> {
  if (!LIB || !BUNNY_KEY) throw new HttpError(500, "إعدادات Bunny ناقصة في Secrets");
  const res = await fetch(`https://video.bunnycdn.com/library/${LIB}/${path}`, {
    ...init, headers: { AccessKey: BUNNY_KEY, "Content-Type": "application/json", Accept: "application/json" },
  });
  const text = await res.text();
  if (!res.ok) {
    console.error("BUNNY", path, res.status, text);
    if (res.status === 404) return null;
    throw new HttpError(502, "خدمة الفيديو لم تستجب، حاول بعد قليل");
  }
  return text ? JSON.parse(text) : null;
}

async function loadLesson(id: unknown): Promise<any> {
  const rows = await rest(`lessons?id=eq.${Number(id)}&select=*,subjects(id,grade_id,name)`);
  if (!rows[0]) throw new HttpError(404, "الدرس غير موجود");
  return rows[0];
}

async function canEdit(me: Me, lesson: any): Promise<boolean> {
  if (["admin", "supervisor"].includes(me.role)) return true;
  if (me.role !== "teacher") return false;
  const r = await rest(`teacher_subjects?teacher_id=eq.${me.id}&subject_id=eq.${lesson.subject_id}&select=subject_id`);
  return r.length > 0;
}

function mapStatus(s: number): string {
  if (s === 4) return "ready";
  if (s === 5 || s === 6) return "failed";
  if (s === 0) return "uploading";
  return "processing";
}

async function syncLesson(lesson: any): Promise<any> {
  if (!lesson.video_id) return lesson;
  const v = await bunny(`videos/${lesson.video_id}`);
  if (!v) {
    const [u] = await rest(`lessons?id=eq.${lesson.id}`, { method: "PATCH", body: JSON.stringify({ video_status: "failed" }) });
    return u;
  }
  const patch: Record<string, unknown> = { video_status: mapStatus(v.status) };
  if (v.length) patch.duration_sec = Math.round(v.length);
  if (CDN_HOST && v.thumbnailFileName) patch.thumbnail_url = `https://${CDN_HOST}/${v.guid}/${v.thumbnailFileName}`;
  const [u] = await rest(`lessons?id=eq.${lesson.id}`, { method: "PATCH", body: JSON.stringify(patch) });
  return u;
}

serve(async (req) => {
  const b = await req.json().catch(() => ({}));

  // تشغيل: الزائر يقدر يشغّل الدروس المجانية فقط
  if (b.action === "play") {
    const me = await getMe(req, false);
    const lesson = await loadLesson(b.lesson_id);
    if (!lesson.video_id || lesson.video_status !== "ready") throw new HttpError(409, "الفيديو قيد التجهيز، جرّب بعد قليل");
    const grade = lesson.subjects.grade_id;
    let allowed = lesson.published && lesson.is_free;
    if (!allowed && me) {
      if (await canEdit(me, lesson)) allowed = true;
      else if (me.role === "student" && lesson.published && me.grade_id === grade) {
        if (!me.access_until || me.access_until < new Date().toISOString().slice(0, 10)) {
          throw new HttpError(402, "اشتراكك غير فعّال. جدّد الاشتراك لتشاهد الدرس", "no_access");
        }
        allowed = true;
      } else if (me.role === "parent" && lesson.published) {
        const kids = await rest(`parent_students?parent_id=eq.${me.id}&select=profiles!parent_students_student_id_fkey(grade_id,access_until,active)`);
        const today = new Date().toISOString().slice(0, 10);
        allowed = kids.some((k: any) => k.profiles && k.profiles.active && k.profiles.grade_id === grade && k.profiles.access_until >= today);
        if (!allowed) throw new HttpError(402, "اشتراك الطالب غير فعّال", "no_access");
      }
    }
    if (!allowed) throw new HttpError(me ? 403 : 401, me ? "هذا الدرس ليس من صفك" : "سجّل الدخول لمشاهدة الدرس");
    if (!TOKEN_KEY) throw new HttpError(500, "مفتاح حماية الفيديو ناقص في Secrets");
    const expires = Math.floor(Date.now() / 1000) + PLAY_TTL;
    const token = await sha256Hex(TOKEN_KEY + lesson.video_id + expires);
    const url = `https://iframe.mediadelivery.net/embed/${LIB}/${lesson.video_id}?token=${token}&expires=${expires}&autoplay=false&preload=true&responsive=true`;
    return json(req, { url, expires });
  }

  const me = (await getMe(req))!;

  switch (b.action) {
    // ينشئ فيديو فارغ على Bunny ويعطي المتصفح توقيع الرفع المباشر (TUS)
    case "create_upload": {
      const lesson = await loadLesson(b.lesson_id);
      if (!(await canEdit(me, lesson))) throw new HttpError(403, "ليس لديك صلاحية على هذا الدرس");
      if (lesson.video_id) await bunny(`videos/${lesson.video_id}`, { method: "DELETE" }).catch(() => {});
      const v = await bunny("videos", { method: "POST", body: JSON.stringify({ title: `${lesson.subjects.name} — ${lesson.title}`.slice(0, 200) }) });
      await rest(`lessons?id=eq.${lesson.id}`, {
        method: "PATCH",
        body: JSON.stringify({ video_id: v.guid, video_status: "uploading", duration_sec: null, thumbnail_url: null }),
      });
      const expire = Math.floor(Date.now() / 1000) + 6 * 3600;
      const signature = await sha256Hex(LIB + BUNNY_KEY + expire + v.guid);
      return json(req, { endpoint: "https://video.bunnycdn.com/tusupload", library_id: LIB, video_id: v.guid, expire, signature });
    }

    case "upload_done": {
      const lesson = await loadLesson(b.lesson_id);
      if (!(await canEdit(me, lesson))) throw new HttpError(403, "ليس لديك صلاحية على هذا الدرس");
      const [u] = await rest(`lessons?id=eq.${lesson.id}`, { method: "PATCH", body: JSON.stringify({ video_status: "processing" }) });
      return json(req, { ok: true, lesson: u });
    }

    // يحدّث حالة المعالجة والمدة والصورة المصغّرة من Bunny
    case "status": {
      const ids = (Array.isArray(b.lesson_ids) ? b.lesson_ids : [b.lesson_id]).slice(0, 30).map(Number).filter(Boolean);
      const out = [];
      for (const id of ids) {
        const lesson = await loadLesson(id);
        if (!(await canEdit(me, lesson))) continue;
        out.push(await syncLesson(lesson));
      }
      return json(req, { lessons: out });
    }

    case "delete_video": {
      const lesson = await loadLesson(b.lesson_id);
      if (!(await canEdit(me, lesson))) throw new HttpError(403, "ليس لديك صلاحية على هذا الدرس");
      if (lesson.video_id) await bunny(`videos/${lesson.video_id}`, { method: "DELETE" }).catch(() => {});
      await rest(`lessons?id=eq.${lesson.id}`, {
        method: "PATCH",
        body: JSON.stringify({ video_id: null, video_status: "none", duration_sec: null, thumbnail_url: null }),
      });
      return json(req, { ok: true });
    }

    default:
      throw new HttpError(400, "عملية غير معروفة");
  }
});
