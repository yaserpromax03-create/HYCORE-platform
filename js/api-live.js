/* HY CORE — الاتصال الحقيقي بـ Supabase (بدون مكتبات) */
(function () {
  "use strict";
  const C = window.HY_CONFIG || {};
  if (!C.supabaseUrl) return;
  const SB = C.supabaseUrl.replace(/\/$/, "");
  const KEY = C.publishableKey;
  const DOMAIN = C.loginDomain || "hycore.local";
  const SKEY = "hy.session";

  let session = null;
  try { session = JSON.parse(localStorage.getItem(SKEY) || "null"); } catch { session = null; }
  const save = (s) => { session = s; try { s ? localStorage.setItem(SKEY, JSON.stringify(s)) : localStorage.removeItem(SKEY); } catch {} };

  async function authFetch(path, body, method = "POST", token) {
    const headers = { apikey: KEY, "Content-Type": "application/json" };
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(`${SB}/auth/v1/${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error_description || data.msg || data.message || "auth " + res.status);
    return data;
  }
  function keep(d) { save({ access_token: d.access_token, refresh_token: d.refresh_token, expires_at: d.expires_at || Math.floor(Date.now() / 1000) + d.expires_in, user_id: d.user.id }); }

  let refreshing = null;
  async function token() {
    if (!session) return null;
    if (session.expires_at * 1000 - 60000 > Date.now()) return session.access_token;
    if (!refreshing) {
      refreshing = authFetch("token?grant_type=refresh_token", { refresh_token: session.refresh_token })
        .then(keep).catch((e) => { save(null); throw new Error("انتهت الجلسة، سجّل الدخول من جديد"); })
        .finally(() => { refreshing = null; });
    }
    await refreshing;
    return session && session.access_token;
  }

  async function req(path, { method = "GET", body, prefer, headers = {} } = {}) {
    const t = await token();
    const h = { apikey: KEY, "Content-Type": "application/json", ...headers };
    if (t) h.Authorization = `Bearer ${t}`;
    if (prefer) h.Prefer = prefer;
    else if (method !== "GET") h.Prefer = "return=representation";
    const res = await fetch(`${SB}/rest/v1/${path}`, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) });
    const text = await res.text();
    let data = null; try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    if (!res.ok) {
      if (res.status === 401) { save(null); location.hash = "#/login"; }
      throw new Error((data && (data.message || data.hint)) || `HTTP ${res.status}`);
    }
    return data;
  }
  const get = (p) => req(p);
  const post = (p, body, prefer) => req(p, { method: "POST", body, prefer });
  const patch = (p, body) => req(p, { method: "PATCH", body });
  const del = (p) => req(p, { method: "DELETE", prefer: "return=minimal" });
  const rpc = (fn, args = {}) => post(`rpc/${fn}`, args);
  const one = async (p) => (await get(p))[0] || null;
  const ids = (a) => `(${a.map((x) => (typeof x === "string" ? `"${x}"` : x)).join(",")})`;

  async function fn(name, body, isForm) {
    const t = await token();
    const h = { apikey: KEY };
    if (t) h.Authorization = `Bearer ${t}`;
    if (!isForm) h["Content-Type"] = "application/json";
    const res = await fetch(`${SB}/functions/v1/${name}`, { method: "POST", headers: h, body: isForm ? body : JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { const e = new Error(data.error || `تعذّر تنفيذ العملية (${res.status})`); e.code = data.code; e.status = res.status; throw e; }
    return data;
  }

  // رفع مباشر إلى Bunny Stream ببروتوكول TUS (قابل للاستئناف)
  async function tusUpload(file, sig, onProgress) {
    const meta = `filetype ${btoa(unescape(encodeURIComponent(file.type || "video/mp4")))},title ${btoa(unescape(encodeURIComponent(file.name)))}`;
    const base = {
      "Tus-Resumable": "1.0.0", AuthorizationSignature: sig.signature, AuthorizationExpire: String(sig.expire),
      VideoId: sig.video_id, LibraryId: String(sig.library_id),
    };
    const create = await fetch(sig.endpoint, { method: "POST", headers: { ...base, "Upload-Length": String(file.size), "Upload-Metadata": meta } });
    if (!create.ok) throw new Error("تعذّر بدء رفع الفيديو");
    let loc = create.headers.get("Location");
    if (!loc) throw new Error("تعذّر بدء رفع الفيديو");
    if (loc.startsWith("/")) loc = new URL(loc, sig.endpoint).href;
    const CHUNK = 8 * 1024 * 1024;
    let offset = 0, tries = 0;
    while (offset < file.size) {
      const chunk = file.slice(offset, offset + CHUNK);
      try {
        const res = await fetch(loc, {
          method: "PATCH",
          headers: { ...base, "Upload-Offset": String(offset), "Content-Type": "application/offset+octet-stream" },
          body: chunk,
        });
        if (!res.ok) throw new Error("chunk " + res.status);
        offset = Number(res.headers.get("Upload-Offset")) || offset + chunk.size;
        tries = 0;
        onProgress && onProgress(offset / file.size);
      } catch (e) {
        if (++tries > 5) throw new Error("انقطع رفع الفيديو. تأكد من الإنترنت وحاول مرة ثانية");
        await new Promise((r) => setTimeout(r, 1500 * tries));
        const head = await fetch(loc, { method: "HEAD", headers: base }).catch(() => null);
        if (head && head.ok) offset = Number(head.headers.get("Upload-Offset")) || offset;
      }
    }
  }

  const L_SEL = "*,subjects!inner(id,name,grade_id,grades(id,name))";
  const P_SEL = "*,grades(id,name)";

  const API = {
    mode: "live",
    hasSession: () => !!session,
    userId: () => session && session.user_id,

    async signIn(username, password) {
      const u = String(username || "").trim().toLowerCase();
      const d = await authFetch("token?grant_type=password", { email: u.includes("@") ? u : `${u}@${DOMAIN}`, password });
      keep(d);
      return API.me();
    },
    async signOut() { try { const t = await token(); if (t) await authFetch("logout", null, "POST", t); } catch {} save(null); },
    async me() { return one(`profiles?id=eq.${session.user_id}&select=${P_SEL}`); },
    async changePassword(password) { const t = await token(); await authFetch("user", { password }, "PUT", t); },

    settings: {
      async all() { const rows = await get("app_settings?select=key,value"); return Object.fromEntries(rows.map((r) => [r.key, r.value])); },
      set: (key, value) => post("app_settings?on_conflict=key", { key, value, updated_at: new Date().toISOString() }, "resolution=merge-duplicates,return=representation"),
    },

    grades: {
      list: () => get("grades?select=*&order=sort,id"),
      save: (g) => (g.id ? patch(`grades?id=eq.${g.id}`, { name: g.name, sort: +g.sort || 0, active: g.active !== false }) : post("grades", { name: g.name, sort: +g.sort || 0 })),
      remove: (id) => del(`grades?id=eq.${id}`),
    },
    subjects: {
      list: (gradeId) => get(`subjects?select=*,grades(id,name)&order=sort,id${gradeId ? `&grade_id=eq.${gradeId}` : ""}`),
      save: (s) => (s.id ? patch(`subjects?id=eq.${s.id}`, { name: s.name, sort: +s.sort || 0, active: s.active !== false }) : post("subjects", { grade_id: +s.grade_id, name: s.name, sort: +s.sort || 0 })),
      remove: (id) => del(`subjects?id=eq.${id}`),
    },

    lessons: {
      list({ grade_id, subject_id, subject_ids, published } = {}) {
        let q = `lessons?select=${L_SEL}&order=sort,created_at`;
        if (grade_id) q += `&subjects.grade_id=eq.${grade_id}`;
        if (subject_id) q += `&subject_id=eq.${subject_id}`;
        if (subject_ids) q += `&subject_id=in.${ids(subject_ids.length ? subject_ids : [0])}`;
        if (published) q += `&published=eq.true`;
        return get(q);
      },
      get: (id) => one(`lessons?id=eq.${id}&select=${L_SEL}`),
      async save(l) {
        const body = { title: l.title, description: l.description || null, subject_id: +l.subject_id, sort: +l.sort || 0, published: !!l.published, is_free: !!l.is_free };
        if (l.id) return (await patch(`lessons?id=eq.${l.id}`, body))[0];
        return (await post("lessons", { ...body, created_by: session.user_id }))[0];
      },
      async remove(l) { if (l.video_id) await fn("hy-video", { action: "delete_video", lesson_id: l.id }).catch(() => {}); return del(`lessons?id=eq.${l.id}`); },
    },

    video: {
      async upload(lessonId, file, onProgress) {
        const sig = await fn("hy-video", { action: "create_upload", lesson_id: lessonId });
        await tusUpload(file, sig, onProgress);
        return (await fn("hy-video", { action: "upload_done", lesson_id: lessonId })).lesson;
      },
      status: async (lessonIds) => (await fn("hy-video", { action: "status", lesson_ids: lessonIds })).lessons,
      play: (lessonId) => fn("hy-video", { action: "play", lesson_id: lessonId }),
      remove: (lessonId) => fn("hy-video", { action: "delete_video", lesson_id: lessonId }),
    },

    users: {
      list({ role, grade_id, grade_ids } = {}) {
        let q = `profiles?select=${P_SEL}&order=full_name`;
        if (role) q += `&role=${Array.isArray(role) ? "in." + ids(role) : "eq." + role}`;
        if (grade_id) q += `&grade_id=eq.${grade_id}`;
        if (grade_ids) q += `&grade_id=in.${ids(grade_ids.length ? grade_ids : [0])}`;
        return get(q);
      },
      get: (id) => one(`profiles?id=eq.${id}&select=${P_SEL}`),
      create: (payload) => fn("hy-admin", { action: "create_user", ...payload }),
      update: async (id, p) => (await patch(`profiles?id=eq.${id}`, p))[0],
      resetPassword: (id, password) => fn("hy-admin", { action: "reset_password", id, password }),
      remove: (id) => fn("hy-admin", { action: "delete_user", id }),
    },

    teachers: {
      subjects: (teacherId) => get(`teacher_subjects?select=teacher_id,subject_id,subjects(id,name,grade_id,grades(id,name))${teacherId ? `&teacher_id=eq.${teacherId}` : ""}`),
      async setSubjects(teacherId, subjectIds) {
        await del(`teacher_subjects?teacher_id=eq.${teacherId}`);
        if (subjectIds.length) await post("teacher_subjects", subjectIds.map((s) => ({ teacher_id: teacherId, subject_id: +s })), "return=minimal");
      },
    },

    parents: {
      children: async (parentId) => (await get(`parent_students?parent_id=eq.${parentId}&select=student_id,profiles!parent_students_student_id_fkey(${P_SEL})`)).map((r) => r.profiles).filter(Boolean),
      ofStudent: async (studentId) => (await get(`parent_students?student_id=eq.${studentId}&select=parent_id,profiles!parent_students_parent_id_fkey(id,full_name,phone,username)`)).map((r) => r.profiles).filter(Boolean),
      link: (parentId, studentId) => post("parent_students", { parent_id: parentId, student_id: studentId }, "resolution=ignore-duplicates,return=minimal"),
      unlink: (parentId, studentId) => del(`parent_students?parent_id=eq.${parentId}&student_id=eq.${studentId}`),
    },

    progress: {
      list: (studentId) => get(`lesson_progress?student_id=eq.${studentId}&select=*`),
      mark: (lessonId, completed) => rpc("mark_progress", { p_lesson: lessonId, p_completed: !!completed }),
    },

    homework: {
      list({ grade_id, subject_ids } = {}) {
        let q = "homework?select=*,subjects!inner(id,name,grade_id,grades(id,name))&order=created_at.desc&limit=100";
        if (grade_id) q += `&subjects.grade_id=eq.${grade_id}`;
        if (subject_ids) q += `&subject_id=in.${ids(subject_ids.length ? subject_ids : [0])}`;
        return get(q);
      },
      save: (h) => {
        const body = { subject_id: +h.subject_id, title: h.title, details: h.details || null, due_date: h.due_date || null };
        return h.id ? patch(`homework?id=eq.${h.id}`, body) : post("homework", { ...body, created_by: session.user_id });
      },
      remove: (id) => del(`homework?id=eq.${id}`),
    },

    attendance: {
      list({ student_id, student_ids, day, from, to } = {}) {
        let q = "attendance?select=*&order=day.desc";
        if (student_id) q += `&student_id=eq.${student_id}`;
        if (student_ids) q += `&student_id=in.${ids(student_ids.length ? student_ids : ["00000000-0000-0000-0000-000000000000"])}`;
        if (day) q += `&day=eq.${day}`;
        if (from) q += `&day=gte.${from}`;
        if (to) q += `&day=lte.${to}`;
        return get(q);
      },
      save: (rows) => post("attendance?on_conflict=student_id,day", rows.map((r) => ({ ...r, recorded_by: session.user_id })), "resolution=merge-duplicates,return=minimal"),
    },

    reports: {
      list({ student_id, student_ids, month } = {}) {
        let q = "reports?select=*&order=month.desc";
        if (student_id) q += `&student_id=eq.${student_id}`;
        if (student_ids) q += `&student_id=in.${ids(student_ids.length ? student_ids : ["00000000-0000-0000-0000-000000000000"])}`;
        if (month) q += `&month=eq.${month}`;
        return get(q);
      },
      save: (r) => post("reports?on_conflict=student_id,month", { ...r, created_by: session.user_id }, "resolution=merge-duplicates,return=representation"),
    },

    payments: {
      list({ student_id, student_ids, status } = {}) {
        let q = "payments?select=*,profiles!payments_student_id_fkey(id,full_name,username,grade_id,grades(name))&order=created_at.desc&limit=300";
        if (student_id) q += `&student_id=eq.${student_id}`;
        if (student_ids) q += `&student_id=in.${ids(student_ids.length ? student_ids : ["00000000-0000-0000-0000-000000000000"])}`;
        if (status) q += `&status=eq.${status}`;
        return get(q);
      },
      get: (id) => one(`payments?id=eq.${id}&select=*,profiles!payments_student_id_fkey(id,full_name,username,phone,grade_id,grades(name))`),
      record: (p) => rpc("record_payment", { p_student: p.student_id, p_months: +p.months, p_amount: p.amount === "" || p.amount == null ? null : +p.amount, p_method: p.method, p_payer: p.payer_name || null, p_note: p.note || null }),
      confirm: (id) => rpc("confirm_payment", { p_id: id }),
      reject: (id, reason) => rpc("reject_payment", { p_id: id, p_reason: reason }),
      cancel: (id, reason) => rpc("cancel_payment", { p_id: id, p_reason: reason }),
      submit(p) {
        const f = new FormData();
        Object.entries(p).forEach(([k, v]) => { if (v != null && v !== "") f.append(k, v); });
        return fn("hy-pay", f, true);
      },
      receiptUrl: async (id) => (await fn("hy-pay", { action: "receipt_url", payment_id: id })).url,
    },

    requests: {
      list: (status) => get(`registration_requests?select=*,grades(id,name)&order=created_at.desc&limit=200${status ? `&status=eq.${status}` : ""}`),
      update: (id, p) => patch(`registration_requests?id=eq.${id}`, p),
      remove: (id) => del(`registration_requests?id=eq.${id}`),
    },

    announcements: {
      list: () => get("announcements?select=*,grades(name)&order=created_at.desc&limit=50"),
      save: (a) => post("announcements", { title: a.title, body: a.body || null, audience: a.audience || "all", grade_id: a.grade_id ? +a.grade_id : null, created_by: session.user_id }),
      remove: (id) => del(`announcements?id=eq.${id}`),
    },

    notifications: {
      list: () => get(`notifications?user_id=eq.${session.user_id}&select=*&order=created_at.desc&limit=60`),
      unread: async () => (await get(`notifications?user_id=eq.${session.user_id}&read=eq.false&select=id&limit=99`)).length,
      readAll: () => req(`notifications?user_id=eq.${session.user_id}&read=eq.false`, { method: "PATCH", body: { read: true }, prefer: "return=minimal" }),
      read: (id) => req(`notifications?id=eq.${id}`, { method: "PATCH", body: { read: true }, prefer: "return=minimal" }),
    },

    activity: { list: () => get("activity_log?select=*,profiles(full_name)&order=id.desc&limit=200") },
    stats: { dashboard: () => rpc("dashboard_stats") },
    catalog: () => rpc("public_catalog"),
    register: (p) => fn("hy-register", p),
  };

  window.API = API;
})();
