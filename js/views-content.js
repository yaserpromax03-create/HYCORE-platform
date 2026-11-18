/* HY CORE — المحتوى: الدروس ورفع الفيديو، صفحة الدرس، الوظائف، الحضور، التقارير، رئيسية الأستاذ */
(function () {
  "use strict";
  const { html, raw, $, $$, mount, icon, n, toast, fail, modal, confirmBox, formData, loading, emptyBox, options, fmtDate, fmtMonth, ago, dur, today, monthStart,
    ATT, LEVELS, VIDEO, AUD, MONTHS, initials, debounce } = HY;
  const API = window.API;
  const V = HY.views;
  const staffRole = (ctx) => ["admin", "supervisor"].includes(ctx.me.role);

  // المواد المسموحة للمستخدم الحالي (الأستاذ: مواده فقط)
  async function mySubjects(ctx) {
    if (ctx.me.role === "teacher") return (await API.teachers.subjects(ctx.me.id)).map((t) => t.subjects).filter(Boolean);
    return API.subjects.list();
  }
  HY.mySubjects = mySubjects;
  const subjLabel = (s) => `${s.name} — ${s.grades?.name || ""}`;

  HY.thumb = (l, done) => html`<div class="thumb">${l.thumbnail_url ? html`<img src="${l.thumbnail_url}" alt="" loading="lazy">` : html`<div class="ph">${icon(l.video_status === "ready" ? "play" : "video")}<span>${l.subjects?.name || ""}</span></div>`}
    ${l.duration_sec ? html`<span class="dur">${n(dur(l.duration_sec))}</span>` : ""}${done ? html`<span class="done tag blue">${icon("check", "sm")}مكتمل</span>` : ""}</div>`;
  const vTag = (s) => html`<span class="tag ${s === "ready" ? "blue" : s === "failed" ? "danger" : s === "none" ? "line" : ""}">${VIDEO[s]}</span>`;

  // ======================= إدارة الدروس =======================
  V.lessons = async (page, _, ctx) => {
    ctx.title(ctx.me.role === "teacher" ? "دروسي" : "الدروس");
    const alive = ctx.alive;
    const subjects = await mySubjects(ctx);
    const grades = [...new Map(subjects.map((s) => [s.grade_id, s.grades])).entries()].map(([id, g]) => ({ id, name: g?.name })).filter((g) => g.name);
    const st = JSON.parse(sessionStorage.getItem("hy.lf") || "{}");
    mount(page, html`<div class="page-head"><div class="filters">
        <select class="input" id="fg">${options(grades, st.g, { blank: "كل الصفوف" })}</select>
        <select class="input" id="fs"></select>
        <input class="input" id="fq" type="search" placeholder="بحث بعنوان الدرس">
      </div><span class="spacer"></span><button class="btn" id="nl">${icon("plus", "sm")}درس جديد</button></div>
      <div id="ll">${loading()}</div>`);
    const fillS = () => { const g = $("#fg").value; mount($("#fs"), options(subjects.filter((s) => !g || String(s.grade_id) === g).map((s) => ({ id: s.id, name: g ? s.name : subjLabel(s) })), st.s, { blank: "كل المواد" })); };
    fillS();
    let rows = [];
    const draw = () => {
      const q = $("#fq").value.trim();
      const list = rows.filter((l) => !q || l.title.includes(q));
      mount($("#ll"), list.length ? html`<div class="cards">${list.map((l) => html`<div class="card lesson-card">
        <a href="#/lesson/${l.id}">${HY.thumb(l)}</a>
        <div class="body"><h4>${l.title}</h4><p class="small mut desc1">${l.subjects.name} · ${l.subjects.grades?.name}</p>
          <div class="row">${vTag(l.video_status)}${l.published ? html`<span class="tag line">منشور</span>` : html`<span class="tag line">مسودة</span>`}${l.is_free ? html`<span class="tag dark">مجاني</span>` : ""}</div>
          <div class="row mt"><button class="btn ghost sm" data-ed="${l.id}">${icon("edit", "sm")}تعديل</button><button class="btn ghost sm" data-up="${l.id}">${icon("upload", "sm")}${l.video_id ? "استبدال الفيديو" : "رفع فيديو"}</button>
            <span class="spacer"></span><button class="btn ghost sm icon-only" data-del="${l.id}" aria-label="حذف">${icon("trash", "sm")}</button></div></div></div>`)}</div>`
        : emptyBox(subjects.length ? "لا توجد دروس هنا بعد. ابدأ بإضافة أول درس." : "لم تُربط بأي مادة بعد. تواصل مع الإدارة.", "video"));
      $$("[data-ed]", page).forEach((b) => (b.onclick = () => lessonForm(ctx, subjects, rows.find((l) => l.id === +b.dataset.ed), load)));
      $$("[data-up]", page).forEach((b) => (b.onclick = () => uploadModal(rows.find((l) => l.id === +b.dataset.up), load)));
      $$("[data-del]", page).forEach((b) => (b.onclick = async () => {
        const l = rows.find((x) => x.id === +b.dataset.del);
        if (!(await confirmBox("حذف الدرس", `سيُحذف «${l.title}» مع الفيديو الخاص به وتقدّم الطلاب فيه.`, "حذف نهائي", true))) return;
        try { await API.lessons.remove(l); toast("تم حذف الدرس"); load(); } catch (e) { fail(e); }
      }));
    };
    let poll;
    const load = async () => {
      if (!alive()) return;
      const g = $("#fg").value, s = $("#fs").value;
      sessionStorage.setItem("hy.lf", JSON.stringify({ g, s }));
      rows = await API.lessons.list({ grade_id: g || undefined, subject_id: s || undefined, subject_ids: ctx.me.role === "teacher" ? subjects.map((x) => x.id) : undefined });
      draw();
      clearTimeout(poll);
      const pend = rows.filter((l) => ["processing", "uploading"].includes(l.video_status) && l.video_id).map((l) => l.id);
      if (pend.length) poll = setTimeout(async () => {
        if (!alive()) return;
        try { await API.video.status(pend); } catch {}
        load();
      }, 8000);
    };
    $("#fg").onchange = () => { st.s = ""; fillS(); load(); };
    $("#fs").onchange = load;
    $("#fq").oninput = debounce(draw, 150);
    $("#nl").onclick = () => lessonForm(ctx, subjects, null, load);
    await load();
  };

  function lessonForm(ctx, subjects, l, done) {
    const isNew = !l; l = l || { published: true };
    const m = modal({ title: isNew ? "درس جديد" : "تعديل الدرس", wide: true, body: html`<form class="form" id="lf">
      <label class="field"><span>المادة والصف</span><select class="input" name="subject_id" required>${options(subjects.map((s) => ({ id: s.id, name: subjLabel(s) })), l.subject_id || ($("#fs") && $("#fs").value), { blank: "اختر المادة" })}</select></label>
      <label class="field"><span>عنوان الدرس</span><input class="input" name="title" value="${l.title || ""}" maxlength="120" required><small>عنوان قصير وواضح، مثل: «جمع الكسور»</small></label>
      <label class="field"><span>وصف مختصر</span><textarea class="input" name="description" maxlength="400">${l.description || ""}</textarea></label>
      <div class="grid2"><label class="field"><span>الترتيب ضمن المادة</span><input class="input" name="sort" type="number" dir="ltr" value="${l.sort ?? ""}"></label><span></span></div>
      <div class="row"><label class="check"><input type="checkbox" name="published" ${l.published ? raw("checked") : ""}> منشور للطلاب</label>
        <label class="check"><input type="checkbox" name="is_free" ${l.is_free ? raw("checked") : ""}> درس مجاني (يظهر للزوار بالموقع)</label></div>
      ${isNew ? html`<div class="field"><span>الفيديو</span>${uploadBox()}</div>` : ""}
      <div id="prog" class="hidden"><div class="row between small"><span id="pt">جارٍ رفع الفيديو...</span><b id="pp">${n("0%")}</b></div><div class="bar mt"><i id="pb"></i></div><p class="small mut mt">لا تغلق الصفحة حتى يكتمل الرفع.</p></div>
    </form>`, actions: [{ label: isNew ? "حفظ الدرس" : "حفظ التعديلات", onClick: async (mm) => {
      const f = $("#lf", mm.el); const d = formData(f);
      if (!d.subject_id) throw new Error("اختر المادة");
      if (!d.title) throw new Error("اكتب عنوان الدرس");
      const file = f._file;
      const saved = await API.lessons.save({ ...d, id: l.id });
      if (file) {
        $$("footer button", mm.el).forEach((b) => (b.disabled = true));
        await doUpload(saved, file, mm.el);
      }
      toast(isNew ? "تم حفظ الدرس" : "تم الحفظ");
      done && done();
    } }, { label: "إلغاء", cls: "ghost" }] });
    if (isNew) bindUpload(m.el, $("#lf", m.el));
  }

  const uploadBox = () => html`<label class="upload-box" id="ub">${icon("upload")}<b id="ubt">اختر ملف الفيديو أو اسحبه إلى هنا</b><span class="small mut">MP4 أو MOV · يُرفع مباشرة إلى خادم الفيديو</span><input type="file" accept="video/*" class="sr" id="vf"></label>`;
  function bindUpload(root, holder) {
    const box = $("#ub", root), inp = $("#vf", root);
    const set = (file) => {
      if (!file) return;
      if (!/^video\//.test(file.type) && !/\.(mp4|mov|mkv|webm|m4v)$/i.test(file.name)) return toast("يجب أن يكون الملف فيديو", true);
      holder._file = file;
      $("#ubt", root).textContent = `${file.name} — ${(file.size / 1048576).toFixed(1)} MB`;
    };
    inp.onchange = () => set(inp.files[0]);
    ["dragover", "dragenter"].forEach((ev) => box.addEventListener(ev, (e) => { e.preventDefault(); box.classList.add("drag"); }));
    ["dragleave", "drop"].forEach((ev) => box.addEventListener(ev, (e) => { e.preventDefault(); box.classList.remove("drag"); }));
    box.addEventListener("drop", (e) => set(e.dataTransfer.files[0]));
  }
  async function doUpload(lesson, file, root) {
    $("#prog", root).classList.remove("hidden");
    const leave = (e) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", leave);
    try {
      await API.video.upload(lesson.id, file, (p) => { const pc = Math.round(p * 100); $("#pb", root).style.width = pc + "%"; $("#pp", root).textContent = pc + "%"; });
      $("#pt", root).textContent = "اكتمل الرفع. الفيديو قيد المعالجة ويجهز خلال دقائق.";
    } finally { window.removeEventListener("beforeunload", leave); }
  }
  function uploadModal(l, done) {
    const holder = {};
    const m = modal({ title: (l.video_id ? "استبدال فيديو: " : "رفع فيديو: ") + l.title, body: html`<div class="form">${l.video_id ? html`<div class="notice warn"><div class="grow small">سيُحذف الفيديو الحالي ويُستبدل بالجديد.</div></div>` : ""}${uploadBox()}
      <div id="prog" class="hidden"><div class="row between small"><span id="pt">جارٍ رفع الفيديو...</span><b id="pp">0%</b></div><div class="bar mt"><i id="pb"></i></div><p class="small mut mt">لا تغلق الصفحة حتى يكتمل الرفع.</p></div></div>`,
      actions: [{ label: "رفع", onClick: async (mm) => { if (!holder._file) throw new Error("اختر ملف الفيديو"); $$("footer button", mm.el).forEach((b) => (b.disabled = true)); await doUpload(l, holder._file, mm.el); toast("تم رفع الفيديو"); done && done(); } }, { label: "إلغاء", cls: "ghost" }] });
    bindUpload(m.el, holder);
  }

  // ======================= صفحة الدرس =======================
  V.lesson = async (page, id, ctx) => {
    const l = await API.lessons.get(id);
    const role = ctx.me.role, learner = role === "student" || role === "parent";
    if (!l) { ctx.title("الدرس", "#/home"); mount(page, emptyBox("الدرس غير موجود أو غير متاح")); return; }
    ctx.title(l.title, learner ? "#/subject/" + l.subject_id : "#/lessons");
    const [siblings, prog] = await Promise.all([
      API.lessons.list({ subject_id: l.subject_id, published: learner || undefined }),
      role === "student" ? API.progress.list(ctx.me.id) : [],
    ]);
    const done = (lid) => prog.some((p) => p.lesson_id === lid && p.completed);
    const idx = siblings.findIndex((x) => x.id === l.id), next = siblings[idx + 1];
    mount(page, html`<div class="grid-lesson">
      <div><div class="player" id="pl">${loading()}</div>
        <div class="card mt"><div class="row between"><div><h2>${l.title}</h2><p class="mut small">${l.subjects.name} · ${l.subjects.grades?.name}${l.duration_sec ? html` · ${n(dur(l.duration_sec))} دقيقة` : ""}</p></div>
          ${role === "student" ? html`<button class="btn ${done(l.id) ? "ghost" : ""}" id="cm" ${done(l.id) ? raw("disabled") : ""}>${icon("check", "sm")}${done(l.id) ? "أكملت الدرس" : "أنهيت الدرس"}</button>` : ""}
          ${!learner ? html`<div class="row">${vTag(l.video_status)}<a class="btn ghost sm" href="#/lessons">${icon("edit", "sm")}إدارة الدروس</a></div>` : ""}</div>
          ${l.description ? html`<p class="mt">${l.description}</p>` : ""}
          ${next ? html`<a class="btn ghost mt" href="#/lesson/${next.id}">الدرس التالي: ${next.title} ${icon("left", "sm")}</a>` : ""}</div></div>
      <div class="card"><h3>دروس ${l.subjects.name}</h3><div class="list mt">${siblings.map((s, i) => html`<a class="item" href="#/lesson/${s.id}"><span class="ico-box ${s.id === l.id ? "dark" : ""}">${done(s.id) ? icon("check", "sm") : n(i + 1)}</span><span class="grow"><b>${s.title}</b><span>${s.duration_sec ? n(dur(s.duration_sec)) : VIDEO[s.video_status]}</span></span></a>`)}</div></div>
    </div>`);
    const pl = $("#pl");
    try {
      const r = await API.video.play(l.id);
      if (r.demo) mount(pl, html`<div class="msg">${icon("play", "lg")}<h3 class="on-dark">عرض تجريبي</h3><p>بعد ربط المنصة بـ Bunny Stream يعمل الفيديو الحقيقي هنا، محمياً من التنزيل.</p></div>`);
      else { const f = document.createElement("iframe"); f.src = r.url; f.loading = "lazy"; f.allow = "accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture"; f.allowFullscreen = true; f.title = l.title; pl.innerHTML = ""; pl.appendChild(f); }
      if (role === "student") API.progress.mark(l.id, false).catch(() => {});
    } catch (e) {
      const sub = e.code === "no_access";
      mount(pl, html`<div class="msg">${icon(sub ? "lock" : "clock", "lg")}<h3 class="on-dark">${sub ? "الاشتراك غير فعّال" : "الفيديو غير متاح الآن"}</h3><p>${HY.errMsg(e)}</p>${sub ? html`<a class="btn" href="#/subscription">${icon("wallet", "sm")}تجديد الاشتراك</a>` : ""}</div>`);
    }
    const cm = $("#cm");
    if (cm) cm.onclick = async () => { try { await API.progress.mark(l.id, true); toast("أحسنت! تم تسجيل إكمال الدرس"); cm.disabled = true; cm.classList.add("ghost"); mount(cm, html`${icon("check", "sm")}أكملت الدرس`); } catch (e) { fail(e); } };
  };

  // ======================= الوظائف =======================
  V.homework = async (page, _, ctx) => {
    const role = ctx.me.role;
    ctx.title(role === "student" ? "وظائفي" : "الوظائف");
    if (role === "student" || role === "parent") return learnerHomework(page, ctx);
    const subjects = await mySubjects(ctx);
    const list = await API.homework.list({ subject_ids: role === "teacher" ? subjects.map((s) => s.id) : undefined });
    mount(page, html`<div class="card"><h3>وظيفة جديدة</h3><form class="form mt" id="hf">
      <div class="grid2"><label class="field"><span>المادة</span><select class="input" name="subject_id" required>${options(subjects.map((s) => ({ id: s.id, name: subjLabel(s) })), "", { blank: "اختر المادة" })}</select></label>
        <label class="field"><span>آخر موعد للتسليم</span><input class="input" name="due_date" type="date" dir="ltr"></label></div>
      <label class="field"><span>العنوان</span><input class="input" name="title" maxlength="100" required></label>
      <label class="field"><span>التفاصيل</span><textarea class="input" name="details" maxlength="600"></textarea></label>
      <div><button class="btn" type="submit">${icon("task", "sm")}نشر الوظيفة</button></div></form></div>
      <div class="card"><h3>الوظائف المنشورة</h3>${list.length ? html`<div class="list mt">${list.map((h) => html`<div class="item"><span class="ico-box">${icon("task", "sm")}</span><span class="grow"><b>${h.title}</b><span>${h.subjects.name} · ${h.subjects.grades?.name}${h.due_date ? html` · التسليم ${fmtDate(h.due_date)}` : ""}</span></span><button class="btn ghost sm icon-only" data-del="${h.id}" aria-label="حذف">${icon("trash", "sm")}</button></div>`)}</div>` : emptyBox("لا توجد وظائف بعد", "task")}</div>`);
    $("#hf").onsubmit = async (e) => { e.preventDefault(); const d = formData(e.target); if (!d.subject_id) return toast("اختر المادة", true); try { await API.homework.save(d); toast("تم نشر الوظيفة ووصل إشعار للطلاب"); HY.render(); } catch (err) { fail(err); } };
    $$("[data-del]", page).forEach((b) => (b.onclick = async () => { if (await confirmBox("حذف الوظيفة", "ستُحذف الوظيفة.", "حذف", true)) { await API.homework.remove(b.dataset.del).catch(fail); HY.render(); } }));
  };
  async function learnerHomework(page, ctx) {
    const list = await API.homework.list({});
    const t = today();
    const up = list.filter((h) => !h.due_date || h.due_date >= t), past = list.filter((h) => h.due_date && h.due_date < t);
    const item = (h) => html`<div class="card"><div class="row between"><span class="tag">${h.subjects.name}</span>${h.due_date ? html`<span class="small ${h.due_date < t ? "mut" : "bold"}">التسليم ${fmtDate(h.due_date)}</span>` : ""}</div>
      <h4 class="mt">${h.title}</h4>${h.details ? html`<p class="small mt">${h.details}</p>` : ""}${ctx.me.role === "parent" ? html`<p class="small mut mt">${h.subjects.grades?.name}</p>` : ""}</div>`;
    mount(page, html`<h3>الوظائف الحالية</h3>${up.length ? html`<div class="cards">${up.map(item)}</div>` : emptyBox("لا توجد وظائف حالياً", "task")}
      ${past.length ? html`<h3>وظائف سابقة</h3><div class="cards">${past.slice(0, 12).map(item)}</div>` : ""}`);
  }

  // ======================= الحضور =======================
  async function myGrades(ctx) {
    if (ctx.me.role === "teacher") { const s = await mySubjects(ctx); return [...new Map(s.map((x) => [x.grade_id, { id: x.grade_id, name: x.grades.name }])).values()]; }
    return (await API.grades.list()).filter((g) => g.active);
  }
  V.attendance = async (page, _, ctx) => {
    ctx.title("الحضور");
    const grades = await myGrades(ctx);
    if (!grades.length) { mount(page, emptyBox("لا توجد صفوف مرتبطة بحسابك", "check2")); return; }
    const last = sessionStorage.getItem("hy.ag");
    mount(page, html`<div class="page-head"><div class="filters"><select class="input" id="ag">${options(grades, last || grades[0].id)}</select><input class="input" type="date" id="ad" dir="ltr" value="${today()}" max="${today()}"></div>
      <span class="spacer"></span><button class="btn ghost" id="all">${icon("check", "sm")}الكل حاضر</button><button class="btn" id="sv">حفظ الحضور</button></div><div id="al">${loading()}</div>`);
    let students = [], state = {};
    const load = async () => {
      const g = $("#ag").value, d = $("#ad").value; sessionStorage.setItem("hy.ag", g);
      mount($("#al"), loading());
      students = (await API.users.list({ role: "student", grade_id: g })).filter((s) => s.active);
      const recs = await API.attendance.list({ day: d, student_ids: students.map((s) => s.id) });
      state = {}; recs.forEach((r) => (state[r.student_id] = r.status));
      draw();
    };
    const draw = () => {
      mount($("#al"), students.length ? html`<div class="card"><div class="list">${students.map((s) => html`<div class="item"><span class="avatar">${initials(s.full_name)}</span><span class="grow"><b>${s.full_name}</b><span>${state[s.id] ? ATT[state[s.id]] : "لم يُسجّل"}</span></span>
        <div class="att" data-s="${s.id}">${Object.entries(ATT).map(([k, v]) => html`<button type="button" data-v="${k}" class="${state[s.id] === k ? "on " + k : ""}">${v}</button>`)}</div></div>`)}</div></div>
        <p class="small mut">${n(Object.keys(state).length)} من ${n(students.length)} مسجّل</p>` : emptyBox("لا يوجد طلاب في هذا الصف", "users"));
      $$(".att", page).forEach((box) => $$("button", box).forEach((b) => (b.onclick = () => { state[box.dataset.s] = b.dataset.v; draw(); })));
    };
    $("#ag").onchange = load; $("#ad").onchange = load;
    $("#all").onclick = () => { students.forEach((s) => (state[s.id] = state[s.id] || "present")); draw(); };
    $("#sv").onclick = async () => {
      const d = $("#ad").value, rows = Object.entries(state).map(([student_id, status]) => ({ student_id, status, day: d }));
      if (!rows.length) return toast("سجّل حضور طالب واحد على الأقل", true);
      try { await API.attendance.save(rows); toast("تم حفظ الحضور"); } catch (e) { fail(e); }
    };
    await load();
  };

  // ======================= التقارير الشهرية =======================
  V.reports = async (page, _, ctx) => {
    const role = ctx.me.role;
    if (role === "student") return HY.views["student:reports"](page, _, ctx);
    ctx.title("التقارير الشهرية");
    const grades = await myGrades(ctx);
    if (!grades.length) { mount(page, emptyBox("لا توجد صفوف مرتبطة بحسابك", "report")); return; }
    const months = []; for (let i = 0; i < 6; i++) { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - i); months.push({ id: d.toISOString().slice(0, 7) + "-01", name: `${MONTHS[d.getMonth()]} ${d.getFullYear()}` }); }
    mount(page, html`<div class="page-head"><div class="filters"><select class="input" id="rg">${options(grades, sessionStorage.getItem("hy.ag") || grades[0].id)}</select><select class="input" id="rm">${options(months, months[0].id)}</select></div></div>
      <p class="mut small">يصل التقرير إلى ولي الأمر والطالب عند نشره. اكتب بلغة إيجابية: «يحتاج متابعة» بدل «ضعيف».</p><div id="rl">${loading()}</div>`);
    const load = async () => {
      const g = $("#rg").value, mo = $("#rm").value;
      mount($("#rl"), loading());
      const students = (await API.users.list({ role: "student", grade_id: g })).filter((s) => s.active);
      const reps = await API.reports.list({ month: mo, student_ids: students.map((s) => s.id) });
      mount($("#rl"), students.length ? html`<div class="card"><div class="list">${students.map((s) => { const r = reps.find((x) => x.student_id === s.id); return html`<div class="item"><span class="avatar">${initials(s.full_name)}</span><span class="grow"><b>${s.full_name}</b><span>${r ? (r.published ? "منشور" : "مسودة") : "بلا تقرير"}</span></span>${r && r.published ? html`<span class="tag blue">منشور</span>` : ""}<button class="btn ${r ? "ghost" : ""} sm" data-s="${s.id}">${r ? "تعديل" : "كتابة التقرير"}</button></div>`; })}</div></div>` : emptyBox("لا يوجد طلاب في هذا الصف", "users"));
      $$("[data-s]", page).forEach((b) => (b.onclick = () => reportEditor(ctx, students.find((s) => s.id === b.dataset.s), mo, reps.find((x) => x.student_id === b.dataset.s), load)));
    };
    $("#rg").onchange = load; $("#rm").onchange = load;
    await load();
  };
  async function reportEditor(ctx, s, month, rep, done) {
    const end = new Date(month); end.setMonth(end.getMonth() + 1); end.setDate(0);
    const [subjects, att] = await Promise.all([API.subjects.list(s.grade_id), API.attendance.list({ student_id: s.id, from: month, to: end.toISOString().slice(0, 10) })]);
    const pres = att.filter((a) => a.status === "present" || a.status === "late").length;
    const autoRate = att.length ? Math.round((pres / att.length) * 100) : "";
    const ratings = Object.fromEntries((rep?.ratings || []).map((r) => [r.subject_id, r.level]));
    const m = modal({ title: `تقرير ${s.full_name} — ${HY.MONTHS[new Date(month).getMonth()]}`, wide: true, body: html`<form class="form" id="rf">
      <div class="field"><span>تقييم المواد</span><div class="list">${subjects.filter((x) => x.active).map((x) => html`<div class="item"><span class="grow"><b>${x.name}</b></span><div class="levels" data-sub="${x.id}">${LEVELS.map((lv) => html`<button type="button" class="btn ghost sm ${ratings[x.id] === lv ? "on-lv" : ""}" data-lv="${lv}">${lv}</button>`)}</div></div>`)}</div></div>
      <div class="grid2"><label class="field"><span>نسبة الحضور %</span><input class="input" name="attendance_rate" type="number" min="0" max="100" dir="ltr" value="${rep?.attendance_rate ?? autoRate}"><small>محسوبة تلقائياً من سجل الحضور (${n(att.length)} يوم)</small></label>
        <label class="field"><span>نسبة إنجاز الوظائف %</span><input class="input" name="homework_rate" type="number" min="0" max="100" dir="ltr" value="${rep?.homework_rate ?? ""}"></label></div>
      <label class="field"><span>ملاحظات المدرّس</span><textarea class="input" name="teacher_note" maxlength="800" placeholder="نقاط القوة، وما يحتاج متابعة، واقتراح للأهل">${rep?.teacher_note || ""}</textarea></label>
      <label class="check"><input type="checkbox" name="published" ${rep?.published ? raw("checked") : ""}> نشر التقرير للطالب وولي الأمر</label></form>`,
      actions: [{ label: "حفظ التقرير", onClick: async (mm) => {
        const d = formData($("#rf", mm.el));
        await API.reports.save({ student_id: s.id, month, ratings: Object.entries(ratings).map(([subject_id, level]) => ({ subject_id: +subject_id, level })),
          attendance_rate: d.attendance_rate === "" ? null : +d.attendance_rate, homework_rate: d.homework_rate === "" ? null : +d.homework_rate, teacher_note: d.teacher_note || null, published: !!d.published });
        toast(d.published ? "تم نشر التقرير ووصل إشعار للأهل" : "تم حفظ المسودة"); done && done();
      } }, { label: "إلغاء", cls: "ghost" }] });
    $$("[data-sub]", m.el).forEach((box) => $$("[data-lv]", box).forEach((b) => (b.onclick = () => { ratings[box.dataset.sub] = b.dataset.lv; $$("[data-lv]", box).forEach((x) => x.classList.toggle("on-lv", x === b)); })));
  }

  // ======================= رئيسية الأستاذ =======================
  V["teacher:home"] = async (page, _, ctx) => {
    ctx.title("الرئيسية");
    const subjects = await mySubjects(ctx);
    const [lessons, anns, hw] = await Promise.all([API.lessons.list({ subject_ids: subjects.map((s) => s.id) }), API.announcements.list(), API.homework.list({ subject_ids: subjects.map((s) => s.id) })]);
    const hour = new Date().getHours();
    mount(page, html`<div class="page-head"><div><h2>${hour < 12 ? "صباح الخير" : "مساء الخير"}، أ. ${ctx.me.full_name.split(" ")[0]}</h2><p class="mut">${fmtDate(today(), true)}</p></div><span class="spacer"></span>
        <a class="btn" href="#/lessons">${icon("upload", "sm")}رفع درس</a><a class="btn ghost" href="#/attendance">${icon("check2", "sm")}حضور اليوم</a></div>
      <div class="stats"><div class="card stat"><b>${n(subjects.length)}</b><span>مادة</span></div><div class="card stat"><b>${n(lessons.length)}</b><span>درس</span></div>
        <div class="card stat"><b>${n(lessons.filter((l) => l.published && l.video_status === "ready").length)}</b><span>منشور وجاهز</span></div><div class="card stat"><b>${n(hw.length)}</b><span>وظيفة</span></div></div>
      <h3>موادي</h3>
      ${subjects.length ? html`<div class="cards">${subjects.map((s) => { const c = lessons.filter((l) => l.subject_id === s.id).length; return html`<a class="card hov subject-card" href="#/lessons"><span class="ico-box">${icon("book")}</span><div><h4>${s.name}</h4><p class="small mut">${s.grades?.name} · ${n(c)} درس</p></div></a>`; })}</div>` : emptyBox("لم تُربط بأي مادة بعد. تواصل مع الإدارة.", "book")}
      <div class="card"><h3>الإعلانات</h3>${anns.length ? html`<div class="list mt">${anns.slice(0, 4).map((a) => html`<div class="item"><span class="ico-box">${icon("megaphone", "sm")}</span><span class="grow"><b>${a.title}</b><span class="desc1">${a.body || ""}</span></span><span class="small mut nowrap">${ago(a.created_at)}</span></div>`)}</div>` : emptyBox("لا توجد إعلانات")}</div>`);
  };
})();
