/* HY CORE — النسخة التجريبية: بيانات وهمية تعمل بالمتصفح وترجع لحالتها كل يوم */
(function () {
  "use strict";
  if (window.API) return; // في وضع الربط الحقيقي لا نحمّل التجريبي
  const DBK = "hy.demo.db", UK = "hy.demo.user";
  const wait = (ms = 120) => new Promise((r) => setTimeout(r, ms));
  const clone = (x) => JSON.parse(JSON.stringify(x));
  const iso = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  const day = (offset) => { const d = new Date(); d.setDate(d.getDate() + offset); return iso(d); };
  const ts = (offsetDays, h = 10) => { const d = new Date(); d.setDate(d.getDate() + offsetDays); d.setHours(h, 15, 0, 0); return d.toISOString(); };
  const uid = () => "d-" + Math.random().toString(36).slice(2, 10);
  const addMonths = (dateStr, m) => { const d = new Date(dateStr + "T00:00:00"); d.setMonth(d.getMonth() + m); d.setDate(d.getDate() - 1); return iso(d); };
  const ref = (p) => `${p}-${day(0).slice(2).replace(/-/g, "")}-${Math.random().toString(16).slice(2, 6).toUpperCase()}`;

  function seed() {
    const db = { seq: 100, receipt: 6, seededOn: day(0) };
    const id = () => ++db.seq;
    db.settings = {
      academy: { name: "HY CORE TEAM", phone: "+963 981 768 529", whatsapp: "963981768529", instagram: "hycore.team", address: "دمشق — الميدان — الكورنيش", tagline: "صدّقني، رح ترتقي فيك" },
      usd_syp: { rate: 11500 },
      pricing: { monthly_usd: 20, discounts: { 1: 0, 3: 5, 6: 10, 12: 15 } },
      payment_methods: [
        { key: "cash", name: "نقداً في المعهد", needs_receipt: false, details: [{ label: "العنوان", value: "دمشق — الميدان — الكورنيش" }] },
        { key: "shamcash", name: "شام كاش", needs_receipt: true, details: [{ label: "رمز الحساب", value: "HY-2026-0001" }, { label: "اسم المستفيد", value: "HY CORE TEAM" }] },
        { key: "haram", name: "الهرم للحوالات", needs_receipt: true, details: [{ label: "اسم المستلم", value: "مدير المعهد" }, { label: "المدينة", value: "دمشق" }] },
        { key: "fouad", name: "الفؤاد للحوالات", needs_receipt: true, details: [{ label: "اسم المستلم", value: "مدير المعهد" }, { label: "المدينة", value: "دمشق" }] },
      ],
    };
    db.grades = []; db.subjects = [];
    ["الصف الرابع", "الصف الخامس", "الصف السادس", "الصف السابع", "الصف الثامن", "الصف التاسع"].forEach((name, i) => {
      const g = { id: i + 1, name, sort: i + 1, active: true };
      db.grades.push(g);
      const subs = i < 3 ? ["الرياضيات", "العلوم", "اللغة العربية", "اللغة الإنكليزية"] : ["الرياضيات", "الفيزياء والكيمياء", "العلوم", "اللغة العربية", "اللغة الإنكليزية"];
      subs.forEach((s, j) => db.subjects.push({ id: id(), grade_id: g.id, name: s, sort: j + 1, active: true }));
    });
    const sub = (gid, name) => db.subjects.find((s) => s.grade_id === gid && s.name === name).id;

    const P = (o) => ({ phone: null, grade_id: null, access_until: null, active: true, notes: null, created_at: ts(-60), ...o });
    db.users = [
      P({ id: "u-admin", role: "admin", full_name: "مدير المنصة", username: "admin", phone: "0981768529" }),
      P({ id: "u-sup", role: "supervisor", full_name: "رنا الحلبي", username: "rana", phone: "0944000111" }),
      P({ id: "u-t1", role: "teacher", full_name: "أحمد الخطيب", username: "t.ahmad", phone: "0933111222" }),
      P({ id: "u-t2", role: "teacher", full_name: "سارة حداد", username: "t.sara", phone: "0955222333" }),
      P({ id: "u-s1", role: "student", full_name: "عمر خالد العمر", username: "s.omar", grade_id: 4, access_until: day(45) }),
      P({ id: "u-s2", role: "student", full_name: "لينا خالد العمر", username: "s.lina", grade_id: 2, access_until: day(-3) }),
      P({ id: "u-s3", role: "student", full_name: "يوسف ديب", username: "s.yousef", grade_id: 4, access_until: day(20) }),
      P({ id: "u-s4", role: "student", full_name: "ريم سلوم", username: "s.reem", grade_id: 6, access_until: day(5) }),
      P({ id: "u-s5", role: "student", full_name: "كريم النابلسي", username: "s.karim", grade_id: 4, access_until: day(70) }),
      P({ id: "u-s6", role: "student", full_name: "جود المصري", username: "s.joud", grade_id: 5, access_until: day(12) }),
      P({ id: "u-s7", role: "student", full_name: "مايا الشامي", username: "s.maya", grade_id: 1, access_until: day(33) }),
      P({ id: "u-s8", role: "student", full_name: "حسن الأيوبي", username: "s.hasan", grade_id: 4, access_until: null }),
      P({ id: "u-p1", role: "parent", full_name: "خالد العمر", username: "p.khaled", phone: "0988777666" }),
      P({ id: "u-p2", role: "parent", full_name: "منى ديب", username: "p.mona", phone: "0966555444" }),
    ];
    db.teacher_subjects = [
      ...[4, 5, 6].map((g) => ({ teacher_id: "u-t1", subject_id: sub(g, "الرياضيات") })),
      ...[4, 5, 6].map((g) => ({ teacher_id: "u-t1", subject_id: sub(g, "الفيزياء والكيمياء") })),
      ...[1, 2, 3, 4, 5, 6].map((g) => ({ teacher_id: "u-t2", subject_id: sub(g, "اللغة الإنكليزية") })),
    ];
    db.parent_students = [
      { parent_id: "u-p1", student_id: "u-s1" }, { parent_id: "u-p1", student_id: "u-s2" }, { parent_id: "u-p2", student_id: "u-s3" },
    ];
    const L = (sid, title, description, o = {}) => db.lessons.push({
      id: id(), subject_id: sid, title, description, video_id: "demo", video_status: "ready", duration_sec: 420 + Math.floor(Math.random() * 600),
      thumbnail_url: null, sort: db.lessons.length, published: true, is_free: false, created_by: "u-t1", created_at: ts(-30 + db.lessons.length), updated_at: ts(-2), ...o,
    });
    db.lessons = [];
    const m7 = sub(4, "الرياضيات"), e7 = sub(4, "اللغة الإنكليزية"), p7 = sub(4, "الفيزياء والكيمياء");
    L(m7, "الأعداد الصحيحة وخواصها", "نتعرّف على الأعداد الصحيحة الموجبة والسالبة وترتيبها على مستقيم الأعداد.", { is_free: true });
    L(m7, "جمع وطرح الأعداد الصحيحة", "قواعد الإشارات في الجمع والطرح مع تمارين محلولة خطوة بخطوة.");
    L(m7, "ضرب وقسمة الأعداد الصحيحة", "قاعدة الإشارات في الضرب والقسمة وأخطاء شائعة يجب تجنّبها.");
    L(m7, "الكسور العادية والعمليات عليها", "توحيد المقامات وجمع الكسور وطرحها بطريقة سهلة وسريعة.");
    L(m7, "مراجعة الوحدة الأولى", "حل نماذج أسئلة امتحانية على الوحدة الأولى كاملة.", { video_status: "processing", duration_sec: null, published: false });
    L(e7, "Unit 1: Meeting People", "تعلّم التعارف وتقديم النفس بجمل بسيطة مع النطق الصحيح.", { created_by: "u-t2", is_free: true });
    L(e7, "Present Simple", "استخدام المضارع البسيط مع أمثلة من الحياة اليومية.", { created_by: "u-t2" });
    L(p7, "المادة وخواصها", "حالات المادة الثلاث والتحوّل بينها مع تجارب منزلية بسيطة.");
    L(sub(2, "العلوم"), "أجزاء النبات ووظائفها", "الجذر والساق والورقة ودور كل جزء في حياة النبات.");
    L(sub(2, "الرياضيات"), "القسمة الطويلة", "خطوات القسمة الطويلة بطريقة منظمة مع تمارين متدرّجة.", { is_free: true });
    L(sub(2, "اللغة الإنكليزية"), "My Family", "مفردات العائلة وجمل الوصف البسيطة.", { created_by: "u-t2" });
    L(sub(6, "الرياضيات"), "المعادلات من الدرجة الأولى", "حل المعادلات خطوة بخطوة مع التحقق من الحل.");
    L(sub(6, "الفيزياء والكيمياء"), "قوانين نيوتن", "شرح القوانين الثلاثة مع أمثلة محلولة من أسئلة الدورات.");

    const omarLessons = db.lessons.filter((l) => l.subject_id === m7 || l.subject_id === e7).slice(0, 4);
    db.progress = omarLessons.map((l, i) => ({ student_id: "u-s1", lesson_id: l.id, views: 1 + i, completed: i < 3, first_viewed_at: ts(-10 + i), last_viewed_at: ts(-3 + i), completed_at: i < 3 ? ts(-3 + i) : null }));
    db.progress.push({ student_id: "u-s3", lesson_id: omarLessons[0].id, views: 2, completed: true, first_viewed_at: ts(-6), last_viewed_at: ts(-1), completed_at: ts(-1) });

    db.homework = [
      { id: id(), subject_id: m7, lesson_id: null, title: "تمارين الصفحة 24", details: "حل التمارين من 1 إلى 8 على الدفتر.", due_date: day(2), created_by: "u-t1", created_at: ts(-1) },
      { id: id(), subject_id: e7, lesson_id: null, title: "Write about yourself", details: "اكتب 5 جمل عن نفسك باستخدام المضارع البسيط.", due_date: day(4), created_by: "u-t2", created_at: ts(-2) },
      { id: id(), subject_id: sub(2, "العلوم"), lesson_id: null, title: "رسم أجزاء النبات", details: "ارسم نبتة وحدّد أجزاءها.", due_date: day(3), created_by: "u-admin", created_at: ts(-1) },
    ];

    db.attendance = [];
    const sts = db.users.filter((u) => u.role === "student" && u.grade_id === 4);
    for (let i = 1; i <= 24; i++) {
      const d = new Date(); d.setDate(d.getDate() - i);
      if (d.getDay() === 5) continue; // الجمعة عطلة
      sts.forEach((s, k) => {
        const r = (i * 7 + k * 3) % 17;
        db.attendance.push({ id: id(), student_id: s.id, day: iso(d), status: r === 0 ? "absent" : r === 5 ? "late" : r === 9 ? "excused" : "present", note: null, recorded_by: "u-t1", created_at: ts(-i) });
      });
    }

    const prevMonth = (() => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 1); return iso(d); })();
    db.reports = [
      { id: id(), student_id: "u-s1", month: prevMonth, ratings: [{ subject_id: m7, level: "ممتاز" }, { subject_id: e7, level: "جيد جداً" }, { subject_id: p7, level: "يحتاج متابعة" }, { subject_id: sub(4, "العلوم"), level: "جيد" }],
        attendance_rate: 92, homework_rate: 85, teacher_note: "عمر ملتزم ومجتهد، ويحتاج متابعة بسيطة بالفيزياء والكيمياء. نقترح مراجعة درس المادة وخواصها بالبيت.", published: true, created_by: "u-t1", created_at: ts(-12), updated_at: ts(-12) },
    ];

    const pay = (o) => db.payments.push({ id: id(), ref: ref("PY"), receipt_no: null, usd_syp: 11500, amount_syp: null, period_from: null, period_to: null, payer_name: null, note: null,
      status: "confirmed", receipt_path: null, submitted_by: "u-admin", confirmed_by: "u-admin", confirmed_at: null, cancel_reason: null, created_at: ts(-20), ...o });
    db.payments = [];
    pay({ receipt_no: "HY-000001", student_id: "u-s1", months: 3, amount_usd: 57, amount_syp: 655500, period_from: day(-45), period_to: day(45), method: "cash", payer_name: "خالد العمر", created_at: ts(-45), confirmed_at: ts(-45) });
    pay({ receipt_no: "HY-000002", student_id: "u-s2", months: 1, amount_usd: 20, amount_syp: 230000, period_from: day(-33), period_to: day(-3), method: "cash", payer_name: "خالد العمر", created_at: ts(-33), confirmed_at: ts(-33) });
    pay({ receipt_no: "HY-000003", student_id: "u-s3", months: 1, amount_usd: 20, amount_syp: 230000, period_from: day(-10), period_to: day(20), method: "shamcash", payer_name: "منى ديب", created_at: ts(-10), confirmed_at: ts(-10) });
    pay({ receipt_no: "HY-000004", student_id: "u-s4", months: 1, amount_usd: 20, amount_syp: 230000, period_from: day(-25), period_to: day(5), method: "cash", created_at: ts(-25), confirmed_at: ts(-25) });
    pay({ receipt_no: "HY-000005", student_id: "u-s5", months: 3, amount_usd: 57, amount_syp: 655500, period_from: day(-20), period_to: day(70), method: "haram", created_at: ts(-4), confirmed_at: ts(-4) });
    pay({ receipt_no: "HY-000006", student_id: "u-s6", months: 1, amount_usd: 20, amount_syp: 230000, period_from: day(-18), period_to: day(12), method: "cash", created_at: ts(-2), confirmed_at: ts(-2) });
    pay({ student_id: "u-s2", months: 3, amount_usd: 57, amount_syp: 655500, method: "shamcash", payer_name: "خالد العمر", status: "pending", receipt_path: "demo", submitted_by: "u-p1", confirmed_by: null, created_at: ts(0, 9) });

    db.requests = [
      { id: id(), code: ref("RQ"), student_name: "سامر القباني", parent_name: "أبو سامر", phone: "0991234567", grade_id: 5, notes: "بدنا متابعة رياضيات بالأخص", status: "new", student_id: null, created_at: ts(0, 8) },
      { id: id(), code: ref("RQ"), student_name: "تالا الحمصي", parent_name: "أم تالا", phone: "0947654321", grade_id: 6, notes: "تحضير للتاسع", status: "new", student_id: null, created_at: ts(-1, 18) },
      { id: id(), code: ref("RQ"), student_name: "زين العابدين", parent_name: "", phone: "0932221110", grade_id: 1, notes: "", status: "contacted", student_id: null, created_at: ts(-3) },
    ];
    db.announcements = [
      { id: id(), title: "بدء مراجعات امتحانات الفصل الأول", body: "تبدأ جلسات المراجعة المكثّفة لكل الصفوف من أول كانون الثاني. التفاصيل مع الموجّهين.", audience: "all", grade_id: null, created_by: "u-admin", created_at: ts(-2) },
      { id: id(), title: "اختبار الرياضيات الشهري", body: "اختبار الرياضيات للصف السابع يوم الخميس القادم على الوحدة الأولى.", audience: "students", grade_id: 4, created_by: "u-t1", created_at: ts(-1) },
    ];
    db.notifications = [
      { id: id(), user_id: "u-admin", title: "دفعة بانتظار التأكيد", body: "لينا خالد العمر · 3 شهر · $57", link: "#/finance", read: false, created_at: ts(0, 9) },
      { id: id(), user_id: "u-admin", title: "طلب تسجيل جديد", body: "سامر القباني · 0991234567", link: "#/requests", read: false, created_at: ts(0, 8) },
      { id: id(), user_id: "u-sup", title: "طلب تسجيل جديد", body: "سامر القباني · 0991234567", link: "#/requests", read: false, created_at: ts(0, 8) },
      { id: id(), user_id: "u-s1", title: "وظيفة جديدة: الرياضيات", body: "تمارين الصفحة 24", link: "#/homework", read: false, created_at: ts(-1) },
      { id: id(), user_id: "u-s1", title: "تقرير المتابعة الشهري", body: "تقرير الشهر الماضي جاهز", link: "#/reports", read: true, created_at: ts(-12) },
      { id: id(), user_id: "u-p1", title: "تقرير عمر خالد العمر", body: "تقرير الشهر الماضي جاهز", link: "#/child/u-s1", read: false, created_at: ts(-12) },
      { id: id(), user_id: "u-t1", title: "بدء مراجعات امتحانات الفصل الأول", body: "تبدأ جلسات المراجعة المكثّفة...", link: "#/home", read: false, created_at: ts(-2) },
    ];
    db.activity = [
      { id: id(), actor: "u-p1", action: "insert:pending", entity: "payment", details: "دفعة لينا خالد العمر · $57", created_at: ts(0, 9) },
      { id: id(), actor: "u-admin", action: "insert", entity: "lessons", details: "ضرب وقسمة الأعداد الصحيحة", created_at: ts(-2) },
      { id: id(), actor: "u-admin", action: "update:confirmed", entity: "payment", details: "HY-000006 · جود المصري · $20", created_at: ts(-2) },
    ];
    return db;
  }

  let db;
  function load() {
    try { db = JSON.parse(localStorage.getItem(DBK) || "null"); } catch { db = null; }
    if (!db || db.seededOn !== day(0)) { db = seed(); persist(); }
  }
  function persist() { try { localStorage.setItem(DBK, JSON.stringify(db)); } catch {} }
  load();

  let me = null;
  try { const id = localStorage.getItem(UK); me = id ? db.users.find((u) => u.id === id) || null : null; } catch {}
  const need = () => { if (!me) throw new Error("سجّل الدخول من جديد"); return me; };
  const isAdmin = () => me && me.role === "admin";
  const isStaff = () => me && (me.role === "admin" || me.role === "supervisor");

  const G = (id) => db.grades.find((g) => g.id === +id) || null;
  const S = (id) => db.subjects.find((s) => s.id === +id) || null;
  const U = (id) => db.users.find((u) => u.id === id) || null;
  const pOut = (p) => p && { ...p, grades: G(p.grade_id) ? { id: p.grade_id, name: G(p.grade_id).name } : null };
  const sOut = (s) => s && { ...s, grades: { id: s.grade_id, name: G(s.grade_id)?.name } };
  const lOut = (l) => ({ ...l, subjects: sOut(S(l.subject_id)) });
  const kidsOf = (pid) => db.parent_students.filter((r) => r.parent_id === pid).map((r) => r.student_id);
  const myGrades = () => {
    if (!me) return [];
    if (me.role === "student") return [me.grade_id];
    if (me.role === "parent") return kidsOf(me.id).map((s) => U(s)?.grade_id);
    if (me.role === "teacher") return db.teacher_subjects.filter((t) => t.teacher_id === me.id).map((t) => S(t.subject_id)?.grade_id);
    return db.grades.map((g) => g.id);
  };
  const notify = (user_id, title, body, link) => db.notifications.push({ id: ++db.seq, user_id, title, body, link, read: false, created_at: new Date().toISOString() });
  const log = (action, entity, details) => db.activity.push({ id: ++db.seq, actor: me?.id || null, action, entity, details, created_at: new Date().toISOString() });
  const rate = () => Number(db.settings.usd_syp?.rate) || null;
  function priceFor(months) {
    const p = db.settings.pricing; const d = Number(p.discounts?.[months] || 0);
    return Math.round(p.monthly_usd * months * (100 - d)) / 100;
  }
  function recalc(studentId) {
    const ds = db.payments.filter((p) => p.student_id === studentId && p.status === "confirmed").map((p) => p.period_to).sort();
    U(studentId).access_until = ds.length ? ds[ds.length - 1] : null;
  }
  function apply(p) {
    const st = U(p.student_id);
    const cur = st.access_until;
    const start = cur && cur >= day(0) ? (() => { const d = new Date(cur + "T00:00:00"); d.setDate(d.getDate() + 1); return iso(d); })() : day(0);
    Object.assign(p, { status: "confirmed", period_from: start, period_to: addMonths(start, p.months), receipt_no: p.receipt_no || "HY-" + String(++db.receipt).padStart(6, "0"),
      usd_syp: p.usd_syp || rate(), amount_syp: p.amount_syp || (rate() ? Math.round(p.amount_usd * rate()) : null), confirmed_by: me.id, confirmed_at: new Date().toISOString() });
    recalc(p.student_id);
    notify(p.student_id, "تم تأكيد الاشتراك", "اشتراكك فعّال حتى " + p.period_to, "#/subscription");
    kidsParents(p.student_id).forEach((pid) => notify(pid, "تم تأكيد اشتراك " + st.full_name, "فعّال حتى " + p.period_to, "#/subscription"));
    log("update:confirmed", "payment", `${p.receipt_no} · ${st.full_name} · $${p.amount_usd}`);
  }
  const kidsParents = (sid) => db.parent_students.filter((r) => r.student_id === sid).map((r) => r.parent_id);
  const out = async (v) => { persist(); await wait(); return clone(v); };
  const guard = (ok, msg = "ليس لديك صلاحية لهذه العملية") => { if (!ok) throw new Error(msg); };

  const API = {
    mode: "demo",
    hasSession: () => !!me,
    userId: () => me && me.id,
    demoAccounts: [
      { u: "admin", role: "admin", label: "المدير" }, { u: "rana", role: "supervisor", label: "موجّهة" },
      { u: "t.ahmad", role: "teacher", label: "أستاذ" }, { u: "s.omar", role: "student", label: "طالب" },
      { u: "s.lina", role: "student", label: "طالبة (اشتراك منتهي)" }, { u: "p.khaled", role: "parent", label: "ولي أمر" },
    ],
    resetDemo() { db = seed(); persist(); },

    async signIn(username, password) {
      await wait(300);
      const u = db.users.find((x) => x.username === String(username).trim().toLowerCase());
      if (!u || password !== "1234") throw new Error("اسم المستخدم أو كلمة السر غير صحيحة");
      me = u; localStorage.setItem(UK, u.id);
      return clone(pOut(u));
    },
    async signOut() { me = null; localStorage.removeItem(UK); },
    async me() { return clone(pOut(need())); },
    async changePassword() { await wait(); },

    settings: {
      async all() { return out(db.settings); },
      async set(key, value) { guard(isAdmin()); db.settings[key] = value; return out(value); },
    },
    grades: {
      async list() { return out([...db.grades].sort((a, b) => a.sort - b.sort || a.id - b.id)); },
      async save(g) {
        guard(isStaff());
        if (g.id) Object.assign(G(g.id), { name: g.name, sort: +g.sort || 0, active: g.active !== false });
        else db.grades.push({ id: ++db.seq, name: g.name, sort: +g.sort || db.grades.length + 1, active: true });
        log(g.id ? "update" : "insert", "grades", g.name); return out(true);
      },
      async remove(id) { guard(isStaff()); db.grades = db.grades.filter((g) => g.id !== +id); db.subjects = db.subjects.filter((s) => s.grade_id !== +id); return out(true); },
    },
    subjects: {
      async list(gradeId) { return out(db.subjects.filter((s) => !gradeId || s.grade_id === +gradeId).sort((a, b) => a.sort - b.sort || a.id - b.id).map(sOut)); },
      async save(s) {
        guard(isStaff());
        if (s.id) Object.assign(S(s.id), { name: s.name, sort: +s.sort || 0, active: s.active !== false });
        else db.subjects.push({ id: ++db.seq, grade_id: +s.grade_id, name: s.name, sort: +s.sort || 99, active: true });
        return out(true);
      },
      async remove(id) { guard(isStaff()); db.subjects = db.subjects.filter((s) => s.id !== +id); db.lessons = db.lessons.filter((l) => l.subject_id !== +id); return out(true); },
    },
    lessons: {
      async list({ grade_id, subject_id, subject_ids, published } = {}) {
        need();
        let r = db.lessons.filter((l) => {
          const s = S(l.subject_id); if (!s) return false;
          if (grade_id && s.grade_id !== +grade_id) return false;
          if (subject_id && l.subject_id !== +subject_id) return false;
          if (subject_ids && !subject_ids.map(Number).includes(l.subject_id)) return false;
          if (published && !l.published) return false;
          if (["student", "parent"].includes(me.role) && (!l.published || !myGrades().includes(s.grade_id))) return false;
          return true;
        });
        return out(r.sort((a, b) => a.sort - b.sort || a.id - b.id).map(lOut));
      },
      async get(id) { const l = db.lessons.find((x) => x.id === +id); return out(l ? lOut(l) : null); },
      async save(l) {
        const teach = me.role === "teacher" && db.teacher_subjects.some((t) => t.teacher_id === me.id && t.subject_id === +l.subject_id);
        guard(isStaff() || teach);
        const body = { title: l.title, description: l.description || null, subject_id: +l.subject_id, sort: +l.sort || 0, published: !!l.published, is_free: !!l.is_free };
        let row;
        if (l.id) { row = db.lessons.find((x) => x.id === +l.id); const was = row.published; Object.assign(row, body, { updated_at: new Date().toISOString() }); if (!was && row.published) announceLesson(row); }
        else { row = { id: ++db.seq, ...body, video_id: null, video_status: "none", duration_sec: null, thumbnail_url: null, created_by: me.id, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }; db.lessons.push(row); if (row.published) announceLesson(row); }
        log(l.id ? "update" : "insert", "lessons", row.title);
        return out(row);
      },
      async remove(l) { db.lessons = db.lessons.filter((x) => x.id !== +l.id); log("delete", "lessons", l.title); return out(true); },
    },
    video: {
      async upload(lessonId, file, onProgress) {
        const l = db.lessons.find((x) => x.id === +lessonId);
        l.video_status = "uploading"; persist();
        const steps = 24;
        for (let i = 1; i <= steps; i++) { await wait(110); onProgress && onProgress(i / steps); }
        Object.assign(l, { video_id: "demo-" + Date.now(), video_status: "processing", duration_sec: null, uploaded_at: Date.now() });
        return out(l);
      },
      async status(ids) {
        const res = ids.map((id) => {
          const l = db.lessons.find((x) => x.id === +id); if (!l) return null;
          if (l.video_status === "processing" && (!l.uploaded_at || Date.now() - l.uploaded_at > 6000)) Object.assign(l, { video_status: "ready", duration_sec: 300 + Math.floor(Math.random() * 900) });
          return l;
        }).filter(Boolean);
        return out(res);
      },
      async play(lessonId) {
        await wait(200);
        const l = db.lessons.find((x) => x.id === +lessonId);
        if (!l || l.video_status !== "ready") throw new Error("الفيديو قيد التجهيز، جرّب بعد قليل");
        if (me && me.role === "student" && !l.is_free && (!me.access_until || me.access_until < day(0))) { const e = new Error("اشتراكك غير فعّال. جدّد الاشتراك لتشاهد الدرس"); e.code = "no_access"; throw e; }
        if (me && me.role === "parent" && !l.is_free) {
          const ok = kidsOf(me.id).map(U).some((k) => k.grade_id === S(l.subject_id).grade_id && k.access_until >= day(0));
          if (!ok) { const e = new Error("اشتراك الطالب غير فعّال"); e.code = "no_access"; throw e; }
        }
        if (!me && !l.is_free) throw new Error("سجّل الدخول لمشاهدة الدرس");
        return { demo: true };
      },
      async remove(lessonId) { Object.assign(db.lessons.find((x) => x.id === +lessonId), { video_id: null, video_status: "none", duration_sec: null }); return out(true); },
    },
    users: {
      async list({ role, grade_id, grade_ids } = {}) {
        need();
        let r = db.users.filter((u) => (!role || (Array.isArray(role) ? role.includes(u.role) : u.role === role)) && (!grade_id || u.grade_id === +grade_id) && (!grade_ids || grade_ids.map(Number).includes(u.grade_id)));
        if (me.role === "teacher") r = r.filter((u) => u.role !== "student" || myGrades().includes(u.grade_id));
        return out(r.sort((a, b) => a.full_name.localeCompare(b.full_name, "ar")).map(pOut));
      },
      async get(id) { return out(pOut(U(id))); },
      async create(p) {
        guard(isStaff());
        if (me.role === "supervisor") guard(["teacher", "student", "parent"].includes(p.role), "ليس لديك صلاحية إنشاء هذا النوع من الحسابات");
        const mk = (x) => {
          const username = String(x.username || "").trim().toLowerCase();
          if (!/^[a-z0-9._-]{3,30}$/.test(username)) throw new Error("اسم المستخدم: 3 إلى 30 حرفاً إنكليزياً أو أرقاماً بلا مسافات");
          if (db.users.some((u) => u.username === username)) throw new Error("اسم المستخدم مستخدم من قبل");
          if (String(x.password || "").length < 6) throw new Error("كلمة السر 6 أحرف على الأقل");
          if (x.role === "student" && !x.grade_id) throw new Error("اختر صف الطالب");
          const u = { id: uid(), role: x.role, full_name: x.full_name, username, phone: x.phone || null, grade_id: x.role === "student" ? +x.grade_id : null, access_until: null, active: true, notes: x.notes || null, created_at: new Date().toISOString() };
          db.users.push(u); log("insert", "profiles", `${u.full_name} (${u.role})`); return u;
        };
        const u = mk(p);
        if (u.role === "teacher") (p.subject_ids || []).forEach((s) => db.teacher_subjects.push({ teacher_id: u.id, subject_id: +s }));
        if (u.role === "parent") (p.student_ids || []).forEach((s) => db.parent_students.push({ parent_id: u.id, student_id: s }));
        let parent = null;
        if (u.role === "student" && p.parent && p.parent.username) {
          parent = db.users.find((x) => x.username === p.parent.username.toLowerCase() && x.role === "parent") || mk({ ...p.parent, role: "parent" });
          db.parent_students.push({ parent_id: parent.id, student_id: u.id });
        }
        if (p.request_id) Object.assign(db.requests.find((r) => r.id === +p.request_id) || {}, { status: "converted", student_id: u.id });
        return out({ ok: true, profile: pOut(u), parent });
      },
      async update(id, patch) {
        guard(isStaff());
        const u = U(id);
        if (!isAdmin() && ("access_until" in patch || "role" in patch)) throw new Error("تعديل الاشتراك مسموح للمدير فقط");
        Object.assign(u, patch); return out(pOut(u));
      },
      async resetPassword() { guard(isStaff()); await wait(300); return { ok: true }; },
      async remove(id) {
        guard(isAdmin(), "الحذف للمدير فقط");
        if (db.payments.some((p) => p.student_id === id)) throw new Error("لهذا الطالب دفعات مسجّلة. أوقف الحساب بدل حذفه حتى تبقى الوصولات محفوظة");
        db.users = db.users.filter((u) => u.id !== id);
        db.parent_students = db.parent_students.filter((r) => r.parent_id !== id && r.student_id !== id);
        db.teacher_subjects = db.teacher_subjects.filter((r) => r.teacher_id !== id);
        return out(true);
      },
    },
    teachers: {
      async subjects(teacherId) { return out(db.teacher_subjects.filter((t) => !teacherId || t.teacher_id === teacherId).map((t) => ({ ...t, subjects: sOut(S(t.subject_id)) })).filter((t) => t.subjects)); },
      async setSubjects(teacherId, ids) { guard(isStaff()); db.teacher_subjects = db.teacher_subjects.filter((t) => t.teacher_id !== teacherId).concat(ids.map((s) => ({ teacher_id: teacherId, subject_id: +s }))); return out(true); },
    },
    parents: {
      async children(pid) { return out(kidsOf(pid).map(U).filter(Boolean).map(pOut)); },
      async ofStudent(sid) { return out(kidsParents(sid).map(U).filter(Boolean)); },
      async link(pid, sid) { guard(isStaff()); if (!db.parent_students.some((r) => r.parent_id === pid && r.student_id === sid)) db.parent_students.push({ parent_id: pid, student_id: sid }); return out(true); },
      async unlink(pid, sid) { guard(isStaff()); db.parent_students = db.parent_students.filter((r) => !(r.parent_id === pid && r.student_id === sid)); return out(true); },
    },
    progress: {
      async list(sid) { return out(db.progress.filter((p) => p.student_id === sid)); },
      async mark(lessonId, completed) {
        if (!me || me.role !== "student") return;
        let p = db.progress.find((x) => x.student_id === me.id && x.lesson_id === +lessonId);
        if (!p) { p = { student_id: me.id, lesson_id: +lessonId, views: 0, completed: false, first_viewed_at: new Date().toISOString(), completed_at: null }; db.progress.push(p); }
        if (!completed) p.views++;
        p.last_viewed_at = new Date().toISOString();
        if (completed && !p.completed) { p.completed = true; p.completed_at = new Date().toISOString(); }
        return out(true);
      },
    },
    homework: {
      async list({ grade_id, subject_ids } = {}) {
        need();
        let r = db.homework.filter((h) => { const s = S(h.subject_id); return s && (!grade_id || s.grade_id === +grade_id) && (!subject_ids || subject_ids.map(Number).includes(h.subject_id)) && (!["student", "parent"].includes(me.role) || myGrades().includes(s.grade_id)); });
        return out(r.sort((a, b) => b.created_at.localeCompare(a.created_at)).map((h) => ({ ...h, subjects: sOut(S(h.subject_id)) })));
      },
      async save(h) {
        const body = { subject_id: +h.subject_id, title: h.title, details: h.details || null, due_date: h.due_date || null };
        if (h.id) Object.assign(db.homework.find((x) => x.id === +h.id), body);
        else {
          db.homework.push({ id: ++db.seq, ...body, lesson_id: null, created_by: me.id, created_at: new Date().toISOString() });
          db.users.filter((u) => u.role === "student" && u.grade_id === S(body.subject_id).grade_id).forEach((u) => notify(u.id, "وظيفة جديدة: " + S(body.subject_id).name, body.title, "#/homework"));
        }
        return out(true);
      },
      async remove(id) { db.homework = db.homework.filter((h) => h.id !== +id); return out(true); },
    },
    attendance: {
      async list({ student_id, student_ids, day: d, from, to } = {}) {
        return out(db.attendance.filter((a) => (!student_id || a.student_id === student_id) && (!student_ids || student_ids.includes(a.student_id)) && (!d || a.day === d) && (!from || a.day >= from) && (!to || a.day <= to)).sort((a, b) => b.day.localeCompare(a.day)));
      },
      async save(rows) {
        guard(isStaff() || me.role === "teacher");
        rows.forEach((r) => {
          const ex = db.attendance.find((a) => a.student_id === r.student_id && a.day === r.day);
          if (ex) Object.assign(ex, r, { recorded_by: me.id }); else db.attendance.push({ id: ++db.seq, ...r, recorded_by: me.id, created_at: new Date().toISOString() });
        });
        return out(true);
      },
    },
    reports: {
      async list({ student_id, student_ids, month } = {}) {
        need();
        let r = db.reports.filter((x) => (!student_id || x.student_id === student_id) && (!student_ids || student_ids.includes(x.student_id)) && (!month || x.month === month));
        if (["student", "parent"].includes(me.role)) r = r.filter((x) => x.published);
        return out(r.sort((a, b) => b.month.localeCompare(a.month)));
      },
      async save(rep) {
        guard(isStaff() || me.role === "teacher");
        let ex = db.reports.find((x) => x.student_id === rep.student_id && x.month === rep.month);
        const was = ex && ex.published;
        if (ex) Object.assign(ex, rep, { updated_at: new Date().toISOString() });
        else { ex = { id: ++db.seq, ...rep, created_by: me.id, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }; db.reports.push(ex); }
        if (ex.published && !was) {
          notify(ex.student_id, "تقرير المتابعة الشهري", "تقرير شهر " + ex.month.slice(0, 7) + " جاهز", "#/reports");
          kidsParents(ex.student_id).forEach((p) => notify(p, "تقرير " + U(ex.student_id).full_name, "تقرير شهر " + ex.month.slice(0, 7) + " جاهز", "#/child/" + ex.student_id));
        }
        return out([ex]);
      },
    },
    payments: {
      async list({ student_id, student_ids, status } = {}) {
        need();
        let r = db.payments.filter((p) => (!student_id || p.student_id === student_id) && (!student_ids || student_ids.includes(p.student_id)) && (!status || p.status === status));
        if (me.role === "student") r = r.filter((p) => p.student_id === me.id);
        else if (me.role === "parent") r = r.filter((p) => kidsOf(me.id).includes(p.student_id));
        else guard(isAdmin(), "المالية للمدير فقط");
        return out(r.sort((a, b) => b.created_at.localeCompare(a.created_at)).map((p) => ({ ...p, profiles: pOut(U(p.student_id)) })));
      },
      async get(id) { const p = db.payments.find((x) => x.id === +id); return out(p ? { ...p, profiles: pOut(U(p.student_id)) } : null); },
      async record(x) {
        guard(isAdmin(), "هذه العملية للمدير فقط");
        const p = { id: ++db.seq, ref: ref("PY"), receipt_no: null, student_id: x.student_id, months: +x.months, amount_usd: x.amount === "" || x.amount == null ? priceFor(+x.months) : +x.amount,
          usd_syp: null, amount_syp: null, method: x.method || "cash", payer_name: x.payer_name || null, note: x.note || null, status: "pending", receipt_path: null, submitted_by: me.id, created_at: new Date().toISOString() };
        db.payments.push(p); apply(p); return out(p);
      },
      async confirm(id) { guard(isAdmin()); const p = db.payments.find((x) => x.id === +id); if (p.status !== "pending") throw new Error("الدفعة ليست بانتظار التأكيد"); apply(p); return out(p); },
      async reject(id, reason) { guard(isAdmin()); const p = db.payments.find((x) => x.id === +id); Object.assign(p, { status: "rejected", cancel_reason: reason }); notify(p.submitted_by || p.student_id, "لم يتم قبول الدفعة", reason, "#/subscription"); return out(true); },
      async cancel(id, reason) { guard(isAdmin()); const p = db.payments.find((x) => x.id === +id); if (p.status !== "confirmed") throw new Error("لا يمكن إلغاء هذه الدفعة"); Object.assign(p, { status: "cancelled", cancel_reason: reason }); recalc(p.student_id); log("update:cancelled", "payment", p.receipt_no); return out(true); },
      async submit(x) {
        need(); await wait(500);
        const sid = me.role === "parent" ? x.student_id : me.id;
        if (me.role === "parent") guard(kidsOf(me.id).includes(sid), "هذا الطالب غير مرتبط بحسابك");
        const m = db.settings.payment_methods.find((k) => k.key === x.method);
        if (!m) throw new Error("اختر طريقة الدفع");
        if (![1, 3, 6, 12].includes(+x.months)) throw new Error("اختر مدة الاشتراك");
        if (m.needs_receipt && !x.file) throw new Error("ارفع صورة الوصل أو ملف PDF");
        if (db.payments.filter((p) => p.student_id === sid && p.status === "pending").length >= 2) throw new Error("لديك طلب دفع بانتظار التأكيد، انتظر رد الإدارة");
        const amount = priceFor(+x.months);
        const p = { id: ++db.seq, ref: ref("PY"), receipt_no: null, student_id: sid, months: +x.months, amount_usd: amount, usd_syp: rate(), amount_syp: rate() ? Math.round(amount * rate()) : null,
          method: m.key, payer_name: x.payer_name || me.full_name, note: x.note || null, status: "pending", receipt_path: m.needs_receipt ? "demo" : null, submitted_by: me.id, created_at: new Date().toISOString() };
        db.payments.push(p);
        db.users.filter((u) => u.role === "admin").forEach((a) => notify(a.id, "دفعة بانتظار التأكيد", `${U(sid).full_name} · ${p.months} شهر · $${amount}`, "#/finance"));
        log("insert:pending", "payment", `${p.ref} · ${U(sid).full_name} · $${amount}`);
        return out({ ok: true, ref: p.ref, amount_usd: amount, amount_syp: p.amount_syp });
      },
      async receiptUrl() { await wait(); return "img/demo-receipt.svg"; },
    },
    requests: {
      async list(status) { guard(isStaff()); return out(db.requests.filter((r) => !status || r.status === status).sort((a, b) => b.created_at.localeCompare(a.created_at)).map((r) => ({ ...r, grades: G(r.grade_id) }))); },
      async update(id, p) { guard(isStaff()); Object.assign(db.requests.find((r) => r.id === +id), p); return out(true); },
      async remove(id) { guard(isStaff()); db.requests = db.requests.filter((r) => r.id !== +id); return out(true); },
    },
    announcements: {
      async list() {
        need();
        const role = me.role; const gs = myGrades();
        const r = db.announcements.filter((a) => isStaff() || ((a.audience === "all" || (a.audience === "students" && role === "student") || (a.audience === "parents" && role === "parent") || (a.audience === "teachers" && role === "teacher")) && (!a.grade_id || gs.includes(a.grade_id))));
        return out(r.sort((a, b) => b.created_at.localeCompare(a.created_at)).map((a) => ({ ...a, grades: G(a.grade_id) })));
      },
      async save(a) {
        guard(isStaff());
        const row = { id: ++db.seq, title: a.title, body: a.body || null, audience: a.audience || "all", grade_id: a.grade_id ? +a.grade_id : null, created_by: me.id, created_at: new Date().toISOString() };
        db.announcements.push(row);
        db.users.filter((u) => u.id !== me.id && (row.audience === "all" || (row.audience === "students" && u.role === "student") || (row.audience === "parents" && u.role === "parent") || (row.audience === "teachers" && u.role === "teacher") || (row.audience === "staff" && ["admin", "supervisor"].includes(u.role))))
          .forEach((u) => notify(u.id, row.title, (row.body || "").slice(0, 140), "#/home"));
        return out(row);
      },
      async remove(id) { guard(isStaff()); db.announcements = db.announcements.filter((a) => a.id !== +id); return out(true); },
    },
    notifications: {
      async list() { need(); return out(db.notifications.filter((x) => x.user_id === me.id).sort((a, b) => b.created_at.localeCompare(a.created_at))); },
      async unread() { if (!me) return 0; return db.notifications.filter((x) => x.user_id === me.id && !x.read).length; },
      async readAll() { db.notifications.forEach((x) => { if (x.user_id === me.id) x.read = true; }); return out(true); },
      async read(id) { const x = db.notifications.find((k) => k.id === +id); if (x) x.read = true; return out(true); },
    },
    activity: { async list() { guard(isAdmin()); return out([...db.activity].sort((a, b) => b.id - a.id).map((a) => ({ ...a, profiles: U(a.actor) ? { full_name: U(a.actor).full_name } : null }))); } },
    stats: {
      async dashboard() {
        guard(isStaff());
        const st = db.users.filter((u) => u.role === "student" && u.active), t = day(0), w = day(7);
        return out({
          students: st.length, active_subs: st.filter((u) => u.access_until >= t).length, expiring: st.filter((u) => u.access_until >= t && u.access_until <= w).length,
          teachers: db.users.filter((u) => u.role === "teacher" && u.active).length, parents: db.users.filter((u) => u.role === "parent").length,
          lessons: db.lessons.length, lessons_ready: db.lessons.filter((l) => l.published && l.video_status === "ready").length,
          new_requests: db.requests.filter((r) => r.status === "new").length,
          pending_payments: isAdmin() ? db.payments.filter((p) => p.status === "pending").length : null,
          month_income_usd: isAdmin() ? db.payments.filter((p) => p.status === "confirmed" && (p.confirmed_at || "").slice(0, 7) === t.slice(0, 7)).reduce((a, p) => a + p.amount_usd, 0) : null,
          views_week: db.progress.filter((p) => p.last_viewed_at >= ts(-7)).length,
        });
      },
    },
    async catalog() {
      await wait();
      return clone({
        grades: db.grades.filter((g) => g.active).map((g) => ({ id: g.id, name: g.name, subjects: db.subjects.filter((s) => s.grade_id === g.id).map((s) => s.name), lessons: db.lessons.filter((l) => l.published && S(l.subject_id)?.grade_id === g.id).length })),
        free_lessons: db.lessons.filter((l) => l.published && l.is_free && l.video_status === "ready").map((l) => ({ id: l.id, title: l.title, subject: S(l.subject_id).name, grade: G(S(l.subject_id).grade_id).name, thumbnail_url: null, duration_sec: l.duration_sec })),
        pricing: db.settings.pricing, academy: db.settings.academy,
      });
    },
    async register(p) {
      await wait(400);
      if (p.website) return { ok: true, code: ref("RQ") };
      if (String(p.student_name || "").trim().length < 3) throw new Error("اكتب اسم الطالب الكامل");
      if (!/^\+?[0-9]{9,15}$/.test(String(p.phone || "").replace(/[\s-]/g, ""))) throw new Error("رقم الهاتف غير صحيح");
      const r = { id: ++db.seq, code: ref("RQ"), student_name: p.student_name, parent_name: p.parent_name || "", phone: p.phone, grade_id: +p.grade_id || null, notes: p.notes || "", status: "new", student_id: null, created_at: new Date().toISOString() };
      db.requests.push(r);
      db.users.filter((u) => ["admin", "supervisor"].includes(u.role)).forEach((u) => notify(u.id, "طلب تسجيل جديد", `${r.student_name} · ${r.phone}`, "#/requests"));
      persist();
      return { ok: true, code: r.code };
    },
  };
  function announceLesson(l) {
    const s = S(l.subject_id);
    db.users.filter((u) => u.role === "student" && u.grade_id === s.grade_id).forEach((u) => notify(u.id, "درس جديد: " + s.name, l.title, "#/lesson/" + l.id));
  }
  window.API = API;
})();
