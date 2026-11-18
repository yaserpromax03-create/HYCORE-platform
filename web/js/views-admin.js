/* HY CORE — صفحات الإدارة: لوحة التحكم، الصفوف، المستخدمون، الطلبات، المالية، الإعدادات */
(function () {
  "use strict";
  const { html, raw, $, $$, mount, icon, n, toast, fail, modal, confirmBox, promptBox, formData, loading, emptyBox, options, fmtDate, fmtMonth, ago, usd, syp, fmtNum, daysLeft, today, tafqit,
    ROLE, ROLE_PL, PAY_STATUS, REQ_STATUS, AUD, ATT, initials, debounce, copyText } = HY;
  const API = window.API;
  const V = HY.views;

  HY.bars = (root) => $$("[data-w]", root).forEach((el) => requestAnimationFrame(() => (el.style.width = Math.max(0, Math.min(100, +el.dataset.w)) + "%")));
  const isAdmin = (ctx) => ctx.me.role === "admin";

  // حالة الاشتراك كوسم
  HY.subTag = (u) => {
    const d = daysLeft(u.access_until);
    if (d === null) return html`<span class="tag line">غير مفعّل</span>`;
    if (d < 0) return html`<span class="tag danger">منتهي</span>`;
    if (d <= 7) return html`<span class="tag">ينتهي بعد ${n(d)} يوم</span>`;
    return html`<span class="tag blue">فعّال</span>`;
  };
  const payTag = (s) => html`<span class="tag ${s === "confirmed" ? "blue" : s === "pending" ? "" : s === "rejected" || s === "cancelled" ? "danger" : "line"}">${PAY_STATUS[s]}</span>`;
  HY.payTag = payTag;
  const methodName = (ctx, k) => ((ctx.settings.payment_methods || []).find((m) => m.key === k) || {}).name || k;
  HY.methodName = methodName;
  const money = (ctx, amount, rate) => html`<b>${usd(amount)}</b>${(rate || ctx.rate()) ? html`<div class="small mut">${syp(amount, rate || ctx.rate())}</div>` : ""}`;
  HY.money = money;
  function genPass() { const c = "abcdefghjkmnpqrstuvwxyz23456789"; return Array.from(crypto.getRandomValues(new Uint8Array(8))).map((b) => c[b % c.length]).join(""); }
  function priceFor(ctx, months) { const p = ctx.settings.pricing || { monthly_usd: 0, discounts: {} }; const d = Number((p.discounts || {})[months] || 0); return Math.round(p.monthly_usd * months * (100 - d)) / 100; }
  HY.priceFor = priceFor;

  // ======================= لوحة التحكم =======================
  V["admin:home"] = V["supervisor:home"] = async (page, _, ctx) => {
    ctx.title("لوحة التحكم");
    const admin = isAdmin(ctx);
    const [s, reqs, pend, students, anns] = await Promise.all([
      API.stats.dashboard(), API.requests.list("new"), admin ? API.payments.list({ status: "pending" }) : [],
      API.users.list({ role: "student" }), API.announcements.list(),
    ]);
    ctx.badge("requests", s.new_requests); ctx.badge("finance", s.pending_payments);
    const expiring = students.filter((u) => { const d = daysLeft(u.access_until); return d !== null && d >= -7 && d <= 7; }).sort((a, b) => a.access_until.localeCompare(b.access_until));
    const hour = new Date().getHours();
    mount(page, html`
      <div class="page-head"><div><h2>${hour < 12 ? "صباح الخير" : "مساء الخير"}، ${ctx.me.full_name.split(" ")[0]}</h2><p class="mut">${fmtDate(today(), true)}</p></div>
        <span class="spacer"></span>
        <button class="btn" id="q-st">${icon("plus", "sm")}طالب جديد</button>
        <a class="btn ghost" href="#/lessons">${icon("upload", "sm")}رفع درس</a>
        ${admin ? html`<button class="btn ghost" id="q-pay">${icon("receipt", "sm")}تسجيل دفعة</button>` : ""}
      </div>
      <div class="stats">
        <div class="card stat"><b>${n(s.students)}</b><span>طالب مسجّل</span></div>
        <div class="card stat"><b>${n(s.active_subs)}</b><span>اشتراك فعّال</span></div>
        <div class="card stat"><b>${n(s.expiring)}</b><span>ينتهي خلال 7 أيام</span></div>
        <div class="card stat"><b>${n(s.lessons_ready)}</b><span>درس منشور وجاهز</span></div>
        ${admin ? html`<div class="card stat"><b>${usd(s.month_income_usd)}</b><span>دخل هذا الشهر</span></div>` : html`<div class="card stat"><b>${n(s.teachers)}</b><span>أستاذ</span></div>`}
        <div class="card stat"><b>${n(s.views_week)}</b><span>مشاهدة هذا الأسبوع</span></div>
      </div>
      <div class="grid2">
        ${admin ? html`<div class="card"><div class="row between"><h3>دفعات بانتظار التأكيد</h3><a href="#/finance" class="small">المالية</a></div>
          ${pend.length ? html`<div class="list mt">${pend.slice(0, 5).map((p) => html`<a class="item" href="#/finance"><span class="ico-box">${icon("wallet", "sm")}</span><span class="grow"><b>${p.profiles?.full_name}</b><span>${n(p.months)} شهر · ${methodName(ctx, p.method)}</span></span><b>${usd(p.amount_usd)}</b></a>`)}</div>` : emptyBox("لا توجد دفعات معلّقة", "check")}</div>` : ""}
        <div class="card"><div class="row between"><h3>طلبات تسجيل جديدة</h3><a href="#/requests" class="small">كل الطلبات</a></div>
          ${reqs.length ? html`<div class="list mt">${reqs.slice(0, 5).map((r) => html`<a class="item" href="#/requests"><span class="ico-box">${icon("inbox", "sm")}</span><span class="grow"><b>${r.student_name}</b><span>${r.grades?.name || "بدون صف"} · ${n(r.phone)}</span></span><span class="small mut nowrap">${ago(r.created_at)}</span></a>`)}</div>` : emptyBox("لا توجد طلبات جديدة", "inbox")}</div>
        <div class="card"><h3>اشتراكات تحتاج متابعة</h3>
          ${expiring.length ? html`<div class="list mt">${expiring.slice(0, 6).map((u) => html`<a class="item" href="#/user/${u.id}"><span class="avatar">${initials(u.full_name)}</span><span class="grow"><b>${u.full_name}</b><span>${u.grades?.name || ""} · حتى ${fmtDate(u.access_until)}</span></span>${HY.subTag(u)}</a>`)}</div>` : emptyBox("كل الاشتراكات بخير", "shield")}</div>
        <div class="card"><div class="row between"><h3>آخر الإعلانات</h3><a href="#/announcements" class="small">الإعلانات</a></div>
          ${anns.length ? html`<div class="list mt">${anns.slice(0, 4).map((a) => html`<div class="item"><span class="ico-box">${icon("megaphone", "sm")}</span><span class="grow"><b>${a.title}</b><span>${AUD[a.audience]}${a.grades ? html` · ${a.grades.name}` : ""}</span></span><span class="small mut nowrap">${ago(a.created_at)}</span></div>`)}</div>` : emptyBox("لا توجد إعلانات")}</div>
      </div>`);
    $("#q-st").onclick = () => HY.createUser(ctx, "student", () => HY.render());
    if (admin) $("#q-pay").onclick = () => HY.recordPayment(ctx, null, () => HY.render());
  };

  // ======================= الصفوف والمواد =======================
  V.grades = async (page, _, ctx) => {
    ctx.title("الصفوف والمواد");
    const [grades, subjects, ts, teachers] = await Promise.all([API.grades.list(), API.subjects.list(), API.teachers.subjects(), API.users.list({ role: "teacher" })]);
    const tName = (id) => (teachers.find((t) => t.id === id) || {}).full_name;
    mount(page, html`<div class="page-head"><p class="mut">كل طالب مرتبط بصف، ويرى دروس مواد صفّه فقط.</p><span class="spacer"></span><button class="btn" id="ag">${icon("plus", "sm")}إضافة صف</button></div>
      ${grades.map((g) => {
        const subs = subjects.filter((s) => s.grade_id === g.id);
        return html`<div class="card">
          <div class="row"><span class="ico-box dark">${icon("layers", "sm")}</span><div class="grow"><h3>${g.name}</h3><p class="small mut">${n(subs.length)} مواد${g.active ? "" : " · مخفي"}</p></div>
            <span class="spacer"></span>
            <button class="btn ghost sm" data-as="${g.id}">${icon("plus", "sm")}مادة</button>
            <button class="btn ghost sm icon-only" data-eg="${g.id}" aria-label="تعديل الصف">${icon("edit", "sm")}</button>
          </div>
          ${subs.length ? html`<div class="table-wrap mt"><table class="t"><thead><tr><th>المادة</th><th>الأساتذة</th><th class="hide-m">الحالة</th><th></th></tr></thead><tbody>
            ${subs.map((s) => html`<tr><td class="bold">${s.name}</td><td class="small">${ts.filter((t) => t.subject_id === s.id).map((t) => tName(t.teacher_id)).filter(Boolean).join("، ") || html`<span class="mut">بدون أستاذ</span>`}</td>
              <td class="hide-m">${s.active ? html`<span class="tag blue">ظاهرة</span>` : html`<span class="tag line">مخفية</span>`}</td>
              <td class="act"><button class="btn ghost sm icon-only" data-es="${s.id}" aria-label="تعديل">${icon("edit", "sm")}</button></td></tr>`)}
          </tbody></table></div>` : html`<p class="mut small mt">لا توجد مواد بعد.</p>`}
        </div>`;
      })}`);
    const gradeForm = (g = {}) => html`<form class="form"><label class="field"><span>اسم الصف</span><input class="input" name="name" value="${g.name || ""}" placeholder="مثال: الصف العاشر" required></label>
      <label class="field"><span>الترتيب</span><input class="input" name="sort" type="number" value="${g.sort ?? grades.length + 1}" dir="ltr"></label>
      ${g.id ? html`<label class="check"><input type="checkbox" name="active" ${g.active ? raw("checked") : ""}> ظاهر للطلاب والزوار</label>` : ""}</form>`;
    $("#ag").onclick = () => modal({ title: "إضافة صف", body: gradeForm(), actions: [{ label: "إضافة", onClick: async (m) => { const d = formData($("form", m.el)); if (!d.name) throw new Error("اكتب اسم الصف"); await API.grades.save(d); toast("تمت إضافة الصف"); HY.render(); } }, { label: "إلغاء", cls: "ghost" }] });
    $$("[data-eg]", page).forEach((b) => (b.onclick = () => {
      const g = grades.find((x) => x.id === +b.dataset.eg);
      modal({ title: "تعديل " + g.name, body: gradeForm(g), actions: [
        { label: "حفظ", onClick: async (m) => { await API.grades.save({ ...formData($("form", m.el)), id: g.id }); toast("تم الحفظ"); HY.render(); } },
        { label: "حذف الصف", cls: "danger", onClick: async () => { if (!(await confirmBox("حذف " + g.name, "ستُحذف كل مواد هذا الصف ودروسها، ويبقى الطلاب بلا صف. هل أنت متأكد؟", "حذف نهائي", true))) return false; await API.grades.remove(g.id); toast("تم الحذف"); HY.render(); } },
      ] });
    }));
    const subjForm = (s = {}) => html`<form class="form"><label class="field"><span>اسم المادة</span><input class="input" name="name" value="${s.name || ""}" required></label>
      <label class="field"><span>الترتيب</span><input class="input" name="sort" type="number" value="${s.sort ?? ""}" dir="ltr"></label>
      ${s.id ? html`<label class="check"><input type="checkbox" name="active" ${s.active ? raw("checked") : ""}> ظاهرة للطلاب</label>` : ""}</form>`;
    $$("[data-as]", page).forEach((b) => (b.onclick = () => modal({ title: "إضافة مادة", body: subjForm(), actions: [{ label: "إضافة", onClick: async (m) => { const d = formData($("form", m.el)); if (!d.name) throw new Error("اكتب اسم المادة"); await API.subjects.save({ ...d, grade_id: +b.dataset.as }); toast("تمت إضافة المادة"); HY.render(); } }, { label: "إلغاء", cls: "ghost" }] })));
    $$("[data-es]", page).forEach((b) => (b.onclick = () => {
      const s = subjects.find((x) => x.id === +b.dataset.es);
      modal({ title: "تعديل " + s.name, body: subjForm(s), actions: [
        { label: "حفظ", onClick: async (m) => { await API.subjects.save({ ...formData($("form", m.el)), id: s.id }); toast("تم الحفظ"); HY.render(); } },
        { label: "حذف المادة", cls: "danger", onClick: async () => { if (!(await confirmBox("حذف " + s.name, "ستُحذف كل دروس هذه المادة ووظائفها. هل أنت متأكد؟", "حذف نهائي", true))) return false; await API.subjects.remove(s.id); toast("تم الحذف"); HY.render(); } },
      ] });
    }));
  };

  // ======================= المستخدمون =======================
  V.users = async (page, _, ctx) => {
    ctx.title("المستخدمون");
    const tabs = isAdmin(ctx) ? ["student", "teacher", "parent", "staff"] : ["student", "teacher", "parent"];
    let tab = sessionStorage.getItem("hy.utab") || "student"; if (!tabs.includes(tab)) tab = "student";
    const grades = await API.grades.list();
    mount(page, html`<div class="tabs" id="tabs">${tabs.map((t) => html`<button data-t="${t}" class="${t === tab ? "on" : ""}">${t === "staff" ? "الإدارة" : ROLE_PL[t]}</button>`)}</div>
      <div class="page-head"><div class="filters">
        <input class="input" id="q" placeholder="بحث بالاسم أو اسم المستخدم" type="search">
        <select class="input" id="g"><option value="">كل الصفوف</option>${options(grades)}</select>
      </div><span class="spacer"></span><button class="btn" id="add">${icon("plus", "sm")}<span id="addl"></span></button></div>
      <div id="ul">${loading()}</div>`);
    let rows = [];
    const draw = () => {
      const q = $("#q").value.trim().toLowerCase(), g = $("#g").value;
      const list = rows.filter((u) => (!q || u.full_name.toLowerCase().includes(q) || u.username.includes(q)) && (!g || String(u.grade_id) === g));
      mount($("#ul"), list.length ? html`<div class="table-wrap"><table class="t"><thead><tr><th>الاسم</th><th class="hide-m">اسم المستخدم</th>
        ${tab === "student" ? html`<th>الصف</th><th>الاشتراك</th>` : tab === "staff" ? html`<th>الدور</th>` : html`<th class="hide-m">الهاتف</th>`}<th class="hide-m">الحساب</th></tr></thead><tbody>
        ${list.map((u) => html`<tr class="click" data-id="${u.id}"><td><div class="row nowrap"><span class="avatar">${initials(u.full_name)}</span><b>${u.full_name}</b></div></td><td class="hide-m">${n(u.username)}</td>
          ${tab === "student" ? html`<td class="nowrap">${u.grades?.name || "—"}</td><td>${HY.subTag(u)}</td>` : tab === "staff" ? html`<td>${ROLE[u.role]}</td>` : html`<td class="hide-m">${u.phone ? n(u.phone) : "—"}</td>`}
          <td class="hide-m">${u.active ? html`<span class="tag line">فعّال</span>` : html`<span class="tag danger">موقوف</span>`}</td></tr>`)}
        </tbody></table></div><p class="small mut mt">${n(list.length)} حساب</p>` : emptyBox("لا توجد حسابات هنا بعد", "users"));
      $$("[data-id]", $("#ul")).forEach((tr) => (tr.onclick = () => ctx.go("#/user/" + tr.dataset.id)));
    };
    const load = async () => {
      $("#g").classList.toggle("hidden", tab !== "student");
      $("#addl").textContent = { student: "طالب جديد", teacher: "أستاذ جديد", parent: "ولي أمر جديد", staff: "حساب إداري" }[tab];
      mount($("#ul"), loading());
      rows = await API.users.list({ role: tab === "staff" ? ["admin", "supervisor"] : tab });
      draw();
    };
    $$("#tabs button").forEach((b) => (b.onclick = () => { tab = b.dataset.t; sessionStorage.setItem("hy.utab", tab); $$("#tabs button").forEach((x) => x.classList.toggle("on", x === b)); load(); }));
    $("#q").oninput = debounce(draw, 150); $("#g").onchange = draw;
    $("#add").onclick = () => HY.createUser(ctx, tab === "staff" ? "supervisor" : tab, load);
    await load();
  };
  V["teacher:students"] = async (page, _, ctx) => {
    ctx.title("طلابي");
    const ts = await API.teachers.subjects(ctx.me.id);
    const gids = [...new Set(ts.map((t) => t.subjects.grade_id))];
    const students = await API.users.list({ role: "student", grade_ids: gids });
    const byG = gids.map((g) => ({ g, name: ts.find((t) => t.subjects.grade_id === g).subjects.grades.name, list: students.filter((s) => s.grade_id === g) }));
    mount(page, byG.length ? byG.map((x) => html`<div class="card"><h3>${x.name} <span class="mut small">(${n(x.list.length)} طالب)</span></h3>
      ${x.list.length ? html`<div class="list mt">${x.list.map((s) => html`<a class="item" href="#/user/${s.id}"><span class="avatar">${initials(s.full_name)}</span><span class="grow"><b>${s.full_name}</b><span>${n(s.username)}</span></span>${icon("left", "sm")}</a>`)}</div>` : html`<p class="mut small mt">لا يوجد طلاب في هذا الصف بعد.</p>`}</div>`)
      : emptyBox("لم تُربط بأي مادة بعد. تواصل مع الإدارة.", "users"));
  };

  // نافذة إنشاء حساب
  HY.createUser = async (ctx, role, done, prefill = {}) => {
    const [grades, subjects, students, parents] = await Promise.all([
      API.grades.list(), role === "teacher" ? API.subjects.list() : [], role === "parent" ? API.users.list({ role: "student" }) : [], role === "student" ? API.users.list({ role: "parent" }) : [],
    ]);
    const roleSel = role === "supervisor" || role === "admin";
    const pw = genPass();
    const body = html`<form class="form" id="cu" autocomplete="off">
      ${roleSel ? html`<label class="field"><span>نوع الحساب</span><select class="input" name="role"><option value="supervisor">موجّه</option><option value="admin">مدير</option></select></label>` : ""}
      <label class="field"><span>الاسم الكامل</span><input class="input" name="full_name" value="${prefill.full_name || ""}" required></label>
      <div class="grid2">
        <label class="field"><span>اسم المستخدم</span><input class="input" name="username" dir="ltr" placeholder="${role === "student" ? "s.ahmad" : role === "teacher" ? "t.ahmad" : role === "parent" ? "p.khaled" : "admin2"}" autocapitalize="none" spellcheck="false" required><small>أحرف إنكليزية وأرقام بلا مسافات</small></label>
        <label class="field"><span>كلمة السر</span><div class="row"><input class="input grow-in" name="password" dir="ltr" value="${pw}" required><button type="button" class="btn ghost icon-only" id="gp" aria-label="توليد كلمة سر">${icon("refresh", "sm")}</button></div></label>
      </div>
      <div class="grid2">
        <label class="field"><span>رقم الهاتف</span><input class="input" name="phone" dir="ltr" inputmode="tel" value="${prefill.phone || ""}"></label>
        ${role === "student" ? html`<label class="field"><span>الصف</span><select class="input" name="grade_id" required>${options(grades.filter((g) => g.active), prefill.grade_id, { blank: "اختر الصف" })}</select></label>` : html`<span></span>`}
      </div>
      ${role === "teacher" ? html`<div class="field"><span>المواد التي يدرّسها</span><div class="card mt0">${grades.map((g) => { const ss = subjects.filter((s) => s.grade_id === g.id); return ss.length ? html`<p class="small bold">${g.name}</p><div class="row">${ss.map((s) => html`<label class="check"><input type="checkbox" name="subject_ids" data-multi="1" value="${s.id}"> ${s.name}</label>`)}</div>` : ""; })}</div></div>` : ""}
      ${role === "parent" ? html`<label class="field"><span>الأبناء</span><select class="input" name="kid" id="kid">${options(students.map((s) => ({ id: s.id, name: `${s.full_name} — ${s.grades?.name || ""}` })), "", { blank: "اختر طالباً لإضافته" })}</select></label><div class="row" id="kids"></div>` : ""}
      ${role === "student" ? html`<div class="card mt0"><label class="check"><input type="checkbox" id="wp" ${prefill.parent_name ? raw("checked") : ""}> ربط الطالب بحساب ولي أمر</label>
        <div id="pbox" class="form mt ${prefill.parent_name ? "" : "hidden"}">
          <div class="seg" id="pmode"><button type="button" class="on" data-m="new">حساب جديد</button><button type="button" data-m="old">حساب موجود</button></div>
          <div id="pnew" class="form"><div class="grid2"><label class="field"><span>اسم ولي الأمر</span><input class="input" name="p_full_name" value="${prefill.parent_name || ""}"></label><label class="field"><span>هاتف ولي الأمر</span><input class="input" name="p_phone" dir="ltr" value="${prefill.phone || ""}"></label></div>
            <div class="grid2"><label class="field"><span>اسم مستخدم ولي الأمر</span><input class="input" name="p_username" dir="ltr" placeholder="p.khaled" autocapitalize="none"></label><label class="field"><span>كلمة سر ولي الأمر</span><input class="input" name="p_password" dir="ltr" value="${genPass()}"></label></div></div>
          <div id="pold" class="hidden"><select class="input" name="p_existing">${options(parents.map((p) => ({ id: p.username, name: `${p.full_name} (${p.username})` })), "", { blank: "اختر ولي الأمر" })}</select></div>
        </div></div>` : ""}
      <label class="field"><span>ملاحظات</span><input class="input" name="notes"></label>
    </form>`;
    const kids = [];
    const m = modal({
      title: { student: "طالب جديد", teacher: "أستاذ جديد", parent: "ولي أمر جديد" }[role] || "حساب إداري جديد", body, wide: role !== "parent",
      actions: [{ label: "إنشاء الحساب", onClick: async (mm) => {
        const d = formData($("#cu", mm.el));
        const payload = { role: d.role || role, full_name: d.full_name, username: d.username, password: d.password, phone: d.phone, grade_id: d.grade_id, notes: d.notes, request_id: prefill.request_id };
        if (role === "teacher") payload.subject_ids = d.subject_ids || [];
        if (role === "parent") payload.student_ids = kids.map((k) => k.id);
        if (role === "student" && $("#wp", mm.el).checked) {
          const mode = $("#pmode .on", mm.el).dataset.m;
          if (mode === "old") { if (!d.p_existing) throw new Error("اختر ولي الأمر"); payload.parent = { username: d.p_existing }; }
          else { if (!d.p_full_name || !d.p_username) throw new Error("اكتب اسم ولي الأمر واسم المستخدم الخاص به"); payload.parent = { full_name: d.p_full_name, username: d.p_username, password: d.p_password, phone: d.p_phone }; }
        }
        const res = await API.users.create(payload);
        toast("تم إنشاء الحساب");
        showCredentials(ctx, [{ name: payload.full_name, username: payload.username.toLowerCase(), password: payload.password, role: payload.role },
          ...(payload.parent && payload.parent.password ? [{ name: payload.parent.full_name, username: payload.parent.username.toLowerCase(), password: payload.parent.password, role: "parent" }] : [])]);
        done && done(res);
      } }, { label: "إلغاء", cls: "ghost" }],
    });
    $("#gp", m.el).onclick = () => { $("[name=password]", m.el).value = genPass(); };
    const wp = $("#wp", m.el);
    if (wp) {
      wp.onchange = () => $("#pbox", m.el).classList.toggle("hidden", !wp.checked);
      $$("#pmode button", m.el).forEach((b) => (b.onclick = () => { $$("#pmode button", m.el).forEach((x) => x.classList.toggle("on", x === b)); $("#pnew", m.el).classList.toggle("hidden", b.dataset.m !== "new"); $("#pold", m.el).classList.toggle("hidden", b.dataset.m !== "old"); }));
    }
    const kidSel = $("#kid", m.el);
    if (kidSel) kidSel.onchange = () => {
      const s = students.find((x) => x.id === kidSel.value); kidSel.value = "";
      if (s && !kids.some((k) => k.id === s.id)) kids.push(s);
      mount($("#kids", m.el), kids.map((k) => html`<span class="tag">${k.full_name}<button type="button" class="x" data-rm="${k.id}" aria-label="إزالة">${icon("x", "sm")}</button></span>`));
      $$("[data-rm]", m.el).forEach((b) => (b.onclick = () => { kids.splice(kids.findIndex((k) => k.id === b.dataset.rm), 1); kidSel.onchange(); }));
    };
  };

  function showCredentials(ctx, list) {
    const site = location.origin + location.pathname;
    const text = list.map((c) => `${c.name}\nاسم المستخدم: ${c.username}\nكلمة السر: ${c.password}`).join("\n\n") + `\n\nرابط المنصة: ${site}`;
    const m = modal({
      title: "بيانات الدخول",
      body: html`<div class="form"><p class="mut">احفظ هذه البيانات وأعطها لصاحب الحساب. لن تظهر كلمة السر مرة أخرى.</p>
        ${list.map((c) => html`<div class="card"><div class="row between"><b>${c.name}</b><span class="tag">${ROLE[c.role]}</span></div>
          <dl class="kv mt"><dt>اسم المستخدم</dt><dd>${n(c.username)}</dd><dt>كلمة السر</dt><dd>${n(c.password)}</dd></dl></div>`)}</div>`,
      actions: [{ label: "نسخ البيانات", onClick: () => { copyText(text); return false; } },
        { label: "مشاركة عبر واتساب", cls: "ghost", onClick: () => { window.open("https://wa.me/?text=" + encodeURIComponent(text), "_blank", "noopener"); return false; } },
        { label: "تم", cls: "ghost" }],
    });
    return m;
  }

  // ======================= صفحة مستخدم =======================
  V.user = async (page, id, ctx) => {
    const u = await API.users.get(id);
    if (!u) { ctx.title("غير موجود", "#/users"); mount(page, emptyBox("الحساب غير موجود")); return; }
    const staff = ["admin", "supervisor"].includes(ctx.me.role), admin = isAdmin(ctx);
    ctx.title(u.full_name, ctx.me.role === "teacher" ? "#/students" : "#/users");
    const canEdit = staff && (admin || !["admin", "supervisor"].includes(u.role));
    mount(page, html`<div class="card"><div class="row"><span class="avatar lg">${initials(u.full_name)}</span>
        <div class="grow"><h2>${u.full_name}</h2><p class="mut">${ROLE[u.role]}${u.grades ? html` · ${u.grades.name}` : ""} · ${n(u.username)}</p></div>
        <span class="spacer"></span>${u.active ? "" : html`<span class="tag danger">موقوف</span>`}
        ${canEdit ? html`<div class="row"><button class="btn ghost sm" id="ed">${icon("edit", "sm")}تعديل</button><button class="btn ghost sm" id="pw">${icon("key", "sm")}كلمة السر</button>
          <button class="btn ghost sm" id="act">${u.active ? "إيقاف الحساب" : "تفعيل الحساب"}</button>${admin && u.id !== ctx.me.id ? html`<button class="btn danger sm icon-only" id="del" aria-label="حذف">${icon("trash", "sm")}</button>` : ""}</div>` : ""}
      </div>
      <dl class="kv mt"><dt>الهاتف</dt><dd>${u.phone ? html`<a href="tel:${u.phone}">${n(u.phone)}</a>` : "—"}</dd><dt>تاريخ الإنشاء</dt><dd>${fmtDate(u.created_at)}</dd>${u.notes ? html`<dt>ملاحظات</dt><dd>${u.notes}</dd>` : ""}</dl></div>
      <div id="extra">${loading()}</div>`);
    if (canEdit) {
      $("#ed").onclick = async () => {
        const grades = await API.grades.list();
        modal({ title: "تعديل " + u.full_name, body: html`<form class="form"><label class="field"><span>الاسم الكامل</span><input class="input" name="full_name" value="${u.full_name}"></label>
          <label class="field"><span>الهاتف</span><input class="input" name="phone" dir="ltr" value="${u.phone || ""}"></label>
          ${u.role === "student" ? html`<label class="field"><span>الصف</span><select class="input" name="grade_id">${options(grades, u.grade_id)}</select></label>` : ""}
          <label class="field"><span>ملاحظات</span><textarea class="input" name="notes">${u.notes || ""}</textarea></label></form>`,
          actions: [{ label: "حفظ", onClick: async (m) => { const d = formData($("form", m.el)); const p = { full_name: d.full_name, phone: d.phone || null, notes: d.notes || null }; if (u.role === "student") p.grade_id = +d.grade_id; await API.users.update(u.id, p); toast("تم الحفظ"); HY.render(); } }, { label: "إلغاء", cls: "ghost" }] });
      };
      $("#pw").onclick = async () => { const p = await promptBox("كلمة سر جديدة لـ " + u.full_name, "كلمة السر الجديدة", { value: genPass() }); if (!p) return; try { await API.users.resetPassword(u.id, p); showCredentials(ctx, [{ name: u.full_name, username: u.username, password: p, role: u.role }]); } catch (e) { fail(e); } };
      $("#act").onclick = async () => { if (u.active && !(await confirmBox("إيقاف الحساب", `${u.full_name} لن يتمكن من الدخول إلى المنصة حتى تعيد تفعيله.`, "إيقاف", true))) return; try { await API.users.update(u.id, { active: !u.active }); toast(u.active ? "تم إيقاف الحساب" : "تم تفعيل الحساب"); HY.render(); } catch (e) { fail(e); } };
      const del = $("#del"); if (del) del.onclick = async () => { if (!(await confirmBox("حذف الحساب", `سيُحذف حساب ${u.full_name} وكل بياناته (التقدّم، الحضور، التقارير). إذا كانت عليه دفعات، أوقفه بدل الحذف.`, "حذف نهائي", true))) return; try { await API.users.remove(u.id); toast("تم حذف الحساب"); ctx.go("#/users"); } catch (e) { fail(e); } };
    }
    const ex = $("#extra");
    if (u.role === "student") await studentExtra(ex, u, ctx);
    else if (u.role === "teacher") await teacherExtra(ex, u, ctx);
    else if (u.role === "parent") await parentExtra(ex, u, ctx);
    else mount(ex, "");
  };

  async function studentExtra(ex, u, ctx) {
    const admin = isAdmin(ctx), staff = ["admin", "supervisor"].includes(ctx.me.role);
    const from = new Date(); from.setDate(from.getDate() - 30);
    const [lessons, prog, att, reps, pays, parents] = await Promise.all([
      API.lessons.list({ grade_id: u.grade_id, published: true }), API.progress.list(u.id), API.attendance.list({ student_id: u.id, from: from.toISOString().slice(0, 10) }),
      API.reports.list({ student_id: u.id }), admin ? API.payments.list({ student_id: u.id }) : [], staff ? API.parents.ofStudent(u.id) : [],
    ]);
    const subs = {}; lessons.forEach((l) => { const k = l.subjects.name; subs[k] = subs[k] || { t: 0, d: 0 }; subs[k].t++; if (prog.some((p) => p.lesson_id === l.id && p.completed)) subs[k].d++; });
    const cnt = (s) => att.filter((a) => a.status === s).length;
    mount(ex, html`<div class="grid2">
      <div class="card"><div class="row between"><h3>الاشتراك</h3>${HY.subTag(u)}</div>
        <p class="mt">${u.access_until ? html`فعّال حتى <b>${fmtDate(u.access_until)}</b>` : "لا يوجد اشتراك مفعّل"}</p>
        ${admin ? html`<div class="row mt"><button class="btn sm" id="rp">${icon("receipt", "sm")}تسجيل دفعة</button><button class="btn ghost sm" id="adj">تعديل التاريخ يدوياً</button></div>` : ""}</div>
      <div class="card"><h3>الحضور آخر 30 يوم</h3><div class="stats mt">
        <div class="stat"><b>${n(cnt("present"))}</b><span>حاضر</span></div><div class="stat"><b>${n(cnt("late"))}</b><span>متأخر</span></div>
        <div class="stat"><b>${n(cnt("absent"))}</b><span>غائب</span></div><div class="stat"><b>${n(cnt("excused"))}</b><span>بعذر</span></div></div></div>
    </div>
    <div class="card"><h3>التقدّم بالدروس</h3>${Object.keys(subs).length ? html`<div class="list mt">${Object.entries(subs).map(([k, v]) => html`<div class="item"><span class="grow"><b>${k}</b><span>${n(v.d)} من ${n(v.t)} درس</span><div class="bar mt"><i data-w="${v.t ? (v.d / v.t) * 100 : 0}"></i></div></span></div>`)}</div>` : html`<p class="mut small mt">لا توجد دروس منشورة لصفّه بعد.</p>`}</div>
    ${staff ? html`<div class="card"><div class="row between"><h3>أولياء الأمور</h3><button class="btn ghost sm" id="lp">${icon("link", "sm")}ربط ولي أمر</button></div>
      ${parents.length ? html`<div class="list mt">${parents.map((p) => html`<div class="item"><span class="avatar">${initials(p.full_name)}</span><a class="grow" href="#/user/${p.id}"><b>${p.full_name}</b><span>${p.phone ? n(p.phone) : n(p.username)}</span></a><button class="btn ghost sm" data-ul="${p.id}">فك الربط</button></div>`)}</div>` : html`<p class="mut small mt">غير مربوط بأي ولي أمر.</p>`}</div>` : ""}
    <div class="card"><div class="row between"><h3>التقارير الشهرية</h3><a class="btn ghost sm" href="#/reports">${icon("plus", "sm")}تقرير</a></div>
      ${reps.length ? html`<div class="list mt">${reps.map((r) => html`<div class="item"><span class="ico-box">${icon("report", "sm")}</span><span class="grow"><b>${fmtMonth(r.month)}</b><span>${r.published ? "منشور للأهل" : "مسودة"}</span></span></div>`)}</div>` : html`<p class="mut small mt">لا توجد تقارير بعد.</p>`}</div>
    ${admin ? html`<div class="card"><h3>الدفعات</h3>${pays.length ? html`<div class="table-wrap mt"><table class="t"><thead><tr><th>الرقم</th><th>المدة</th><th>المبلغ</th><th>الحالة</th><th></th></tr></thead><tbody>${pays.map((p) => html`<tr><td>${n(p.receipt_no || p.ref)}</td><td>${n(p.months)} شهر</td><td>${usd(p.amount_usd)}</td><td>${payTag(p.status)}</td><td class="act">${p.status === "confirmed" || p.status === "cancelled" ? html`<a class="btn ghost sm" href="#/receipt/${p.id}">${icon("print", "sm")}الوصل</a>` : ""}</td></tr>`)}</tbody></table></div>` : html`<p class="mut small mt">لا توجد دفعات.</p>`}</div>` : ""}`);
    HY.bars(ex);
    if (admin) {
      $("#rp").onclick = () => HY.recordPayment(ctx, u, () => HY.render());
      $("#adj").onclick = async () => { const v = await promptBox("تاريخ انتهاء الاشتراك", "فعّال حتى تاريخ", { type: "date", value: u.access_until || today(), required: false }); if (v === null) return; try { await API.users.update(u.id, { access_until: v || null }); toast("تم التعديل"); HY.render(); } catch (e) { fail(e); } };
    }
    if (staff) {
      $("#lp").onclick = async () => {
        const ps = await API.users.list({ role: "parent" });
        modal({ title: "ربط ولي أمر", body: html`<label class="field"><span>ولي الأمر</span><select class="input" id="ps">${options(ps.map((p) => ({ id: p.id, name: `${p.full_name} (${p.username})` })), "", { blank: "اختر" })}</select><small>إذا لم يكن موجوداً، أنشئ حسابه من «المستخدمون» ثم اربطه.</small></label>`,
          actions: [{ label: "ربط", onClick: async (m) => { const v = $("#ps", m.el).value; if (!v) throw new Error("اختر ولي الأمر"); await API.parents.link(v, u.id); toast("تم الربط"); HY.render(); } }, { label: "إلغاء", cls: "ghost" }] });
      };
      $$("[data-ul]", ex).forEach((b) => (b.onclick = async () => { if (!(await confirmBox("فك الربط", "لن يرى ولي الأمر بيانات هذا الطالب بعد الآن.", "فك الربط", true))) return; await API.parents.unlink(b.dataset.ul, u.id).catch(fail); HY.render(); }));
    }
  }

  async function teacherExtra(ex, u, ctx) {
    const [ts, subjects, grades] = await Promise.all([API.teachers.subjects(u.id), API.subjects.list(), API.grades.list()]);
    const staff = ["admin", "supervisor"].includes(ctx.me.role);
    mount(ex, html`<div class="card"><div class="row between"><h3>المواد</h3>${staff ? html`<button class="btn ghost sm" id="es">${icon("edit", "sm")}تعديل المواد</button>` : ""}</div>
      ${ts.length ? html`<div class="row mt">${ts.map((t) => html`<span class="tag">${t.subjects.name} · ${t.subjects.grades.name}</span>`)}</div>` : html`<p class="mut small mt">غير مربوط بأي مادة.</p>`}</div>`);
    if (staff) $("#es").onclick = () => modal({ title: "مواد " + u.full_name, wide: true,
      body: html`<form class="form">${grades.map((g) => { const ss = subjects.filter((s) => s.grade_id === g.id); return ss.length ? html`<div><p class="small bold">${g.name}</p><div class="row">${ss.map((s) => html`<label class="check"><input type="checkbox" name="s" data-multi="1" value="${s.id}" ${ts.some((t) => t.subject_id === s.id) ? raw("checked") : ""}> ${s.name}</label>`)}</div></div>` : ""; })}</form>`,
      actions: [{ label: "حفظ", onClick: async (m) => { await API.teachers.setSubjects(u.id, formData($("form", m.el)).s || []); toast("تم الحفظ"); HY.render(); } }, { label: "إلغاء", cls: "ghost" }] });
  }

  async function parentExtra(ex, u, ctx) {
    const kids = await API.parents.children(u.id);
    const staff = ["admin", "supervisor"].includes(ctx.me.role);
    mount(ex, html`<div class="card"><div class="row between"><h3>الأبناء</h3>${staff ? html`<button class="btn ghost sm" id="lk">${icon("link", "sm")}ربط طالب</button>` : ""}</div>
      ${kids.length ? html`<div class="list mt">${kids.map((k) => html`<div class="item"><span class="avatar">${initials(k.full_name)}</span><a class="grow" href="#/user/${k.id}"><b>${k.full_name}</b><span>${k.grades?.name || ""}</span></a>${HY.subTag(k)}${staff ? html`<button class="btn ghost sm" data-ul="${k.id}">فك الربط</button>` : ""}</div>`)}</div>` : html`<p class="mut small mt">غير مربوط بأي طالب.</p>`}</div>`);
    if (!staff) return;
    $("#lk").onclick = async () => {
      const st = await API.users.list({ role: "student" });
      modal({ title: "ربط طالب", body: html`<select class="input" id="ss">${options(st.map((s) => ({ id: s.id, name: `${s.full_name} — ${s.grades?.name || ""}` })), "", { blank: "اختر الطالب" })}</select>`,
        actions: [{ label: "ربط", onClick: async (m) => { const v = $("#ss", m.el).value; if (!v) throw new Error("اختر الطالب"); await API.parents.link(u.id, v); toast("تم الربط"); HY.render(); } }, { label: "إلغاء", cls: "ghost" }] });
    };
    $$("[data-ul]", ex).forEach((b) => (b.onclick = async () => { await API.parents.unlink(u.id, b.dataset.ul).catch(fail); HY.render(); }));
  }

  // ======================= طلبات التسجيل =======================
  V.requests = async (page, _, ctx) => {
    ctx.title("طلبات التسجيل");
    let tab = "new";
    mount(page, html`<div class="tabs" id="tabs">${["new", "contacted", "converted", "rejected"].map((t) => html`<button data-t="${t}" class="${t === tab ? "on" : ""}">${REQ_STATUS[t]}</button>`)}</div><div id="rl"></div>`);
    const load = async () => {
      mount($("#rl"), loading());
      const list = await API.requests.list(tab);
      if (tab === "new") ctx.badge("requests", list.length);
      mount($("#rl"), list.length ? html`<div class="cards">${list.map((r) => html`<div class="card">
        <div class="row between"><b class="desc1">${r.student_name}</b><span class="small mut nowrap">${ago(r.created_at)}</span></div>
        <dl class="kv mt"><dt>الصف</dt><dd>${r.grades?.name || "—"}</dd><dt>ولي الأمر</dt><dd>${r.parent_name || "—"}</dd><dt>الهاتف</dt><dd><a href="tel:${r.phone}">${n(r.phone)}</a></dd><dt>رقم الطلب</dt><dd>${n(r.code)}</dd></dl>
        ${r.notes ? html`<p class="small mt">${r.notes}</p>` : ""}
        <div class="row mt">
          ${r.status !== "converted" ? html`<button class="btn sm" data-cv="${r.id}">${icon("user", "sm")}تسجيل كطالب</button>` : html`<a class="btn ghost sm" href="#/user/${r.student_id}">فتح حساب الطالب</a>`}
          ${r.status === "new" ? html`<button class="btn ghost sm" data-st="${r.id}" data-v="contacted">تم التواصل</button>` : ""}
          <a class="btn ghost sm icon-only" href="https://wa.me/${String(r.phone).replace(/^0/, "963").replace(/\D/g, "")}" target="_blank" rel="noopener" aria-label="واتساب">${icon("chat", "sm")}</a>
          ${r.status !== "converted" && r.status !== "rejected" ? html`<button class="btn ghost sm" data-st="${r.id}" data-v="rejected">رفض</button>` : ""}
          <button class="btn ghost sm icon-only" data-del="${r.id}" aria-label="حذف">${icon("trash", "sm")}</button>
        </div></div>`)}</div>` : emptyBox("لا توجد طلبات هنا", "inbox"));
      $$("[data-st]", page).forEach((b) => (b.onclick = async () => { await API.requests.update(b.dataset.st, { status: b.dataset.v }).catch(fail); load(); }));
      $$("[data-del]", page).forEach((b) => (b.onclick = async () => { if (await confirmBox("حذف الطلب", "سيُحذف الطلب نهائياً.", "حذف", true)) { await API.requests.remove(b.dataset.del).catch(fail); load(); } }));
      $$("[data-cv]", page).forEach((b) => (b.onclick = () => { const r = list.find((x) => x.id === +b.dataset.cv); HY.createUser(ctx, "student", load, { full_name: r.student_name, phone: r.phone, grade_id: r.grade_id, parent_name: r.parent_name, request_id: r.id }); }));
    };
    $$("#tabs button").forEach((b) => (b.onclick = () => { tab = b.dataset.t; $$("#tabs button").forEach((x) => x.classList.toggle("on", x === b)); load(); }));
    await load();
  };

  // ======================= المالية =======================
  HY.recordPayment = async (ctx, student, done) => {
    const students = student ? [student] : await API.users.list({ role: "student" });
    const methods = ctx.settings.payment_methods || [{ key: "cash", name: "نقداً" }];
    let months = 1;
    const m = modal({ title: "تسجيل دفعة", body: html`<form class="form" id="rpf">
      <label class="field"><span>الطالب</span><select class="input" name="student_id" ${student ? raw("disabled") : ""}>${options(students.map((s) => ({ id: s.id, name: `${s.full_name} — ${s.grades?.name || ""}` })), student && student.id, { blank: student ? null : "اختر الطالب" })}</select></label>
      <div class="field"><span>مدة الاشتراك</span><div class="seg" id="mm">${[1, 3, 6, 12].map((x) => html`<button type="button" data-m="${x}" class="${x === 1 ? "on" : ""}">${n(x)} ${x === 1 ? "شهر" : x <= 10 ? "أشهر" : "شهر"}</button>`)}</div></div>
      <div class="grid2"><label class="field"><span>المبلغ بالدولار</span><input class="input" name="amount" type="number" step="0.01" min="0" dir="ltr" value="${priceFor(ctx, 1)}"><small id="sy"></small></label>
        <label class="field"><span>طريقة الدفع</span><select class="input" name="method">${options(methods, "cash", { key: "key" })}</select></label></div>
      <div class="grid2"><label class="field"><span>اسم الدافع</span><input class="input" name="payer_name"></label><label class="field"><span>ملاحظة</span><input class="input" name="note"></label></div>
      <p class="small mut">يبدأ الاشتراك من اليوم، أو بعد انتهاء الاشتراك الحالي إن كان فعّالاً.</p></form>`,
      actions: [{ label: "تأكيد وإصدار وصل", onClick: async (mm) => {
        const d = formData($("#rpf", mm.el)); const sid = student ? student.id : d.student_id;
        if (!sid) throw new Error("اختر الطالب");
        const p = await API.payments.record({ ...d, student_id: sid, months });
        toast("تم تسجيل الدفعة " + (p.receipt_no || ""));
        done && done(p);
        setTimeout(async () => { if (await confirmBox("طباعة الوصل", "هل تريد طباعة وصل الاستلام الآن؟", "طباعة")) ctx.go("#/receipt/" + p.id); }, 500);
      } }, { label: "إلغاء", cls: "ghost" }] });
    const sy = () => { const r = ctx.rate(); $("#sy", m.el).innerHTML = r ? String(html`يعادل ${syp(+$("[name=amount]", m.el).value || 0, r)}`) : ""; };
    $$("#mm button", m.el).forEach((b) => (b.onclick = () => { months = +b.dataset.m; $$("#mm button", m.el).forEach((x) => x.classList.toggle("on", x === b)); $("[name=amount]", m.el).value = priceFor(ctx, months); sy(); }));
    $("[name=amount]", m.el).oninput = sy; sy();
  };

  V.finance = async (page, _, ctx) => {
    ctx.title("المالية");
    let tab = "pending";
    const s = await API.stats.dashboard();
    mount(page, html`<div class="stats">
        <div class="card stat"><b>${usd(s.month_income_usd)}</b><span>دخل ${HY.MONTHS[new Date().getMonth()]}</span></div>
        <div class="card stat"><b>${n(s.pending_payments)}</b><span>بانتظار التأكيد</span></div>
        <div class="card stat"><b>${n(s.active_subs)}</b><span>اشتراك فعّال</span></div>
        <div class="card stat"><b>${ctx.rate() ? n(fmtNum(ctx.rate())) : "—"}</b><span>سعر الصرف (ل.س)</span></div></div>
      <div class="page-head"><div class="tabs" id="tabs">${[["pending", "بانتظار التأكيد"], ["confirmed", "المؤكدة"], ["", "كل الدفعات"]].map(([k, l]) => html`<button data-t="${k}" class="${k === tab ? "on" : ""}">${l}</button>`)}</div><span class="spacer"></span><button class="btn" id="rp">${icon("plus", "sm")}تسجيل دفعة</button></div>
      <div id="pl"></div>`);
    const load = async () => {
      mount($("#pl"), loading());
      const list = await API.payments.list({ status: tab || undefined });
      mount($("#pl"), list.length ? html`<div class="table-wrap"><table class="t"><thead><tr><th>الرقم</th><th>الطالب</th><th>المدة</th><th>المبلغ</th><th class="hide-m">الطريقة</th><th class="hide-m">التاريخ</th><th>الحالة</th><th></th></tr></thead><tbody>
        ${list.map((p) => html`<tr><td class="nowrap">${n(p.receipt_no || p.ref)}</td><td><a href="#/user/${p.student_id}" class="bold nowrap">${p.profiles?.full_name}</a><div class="small mut">${p.profiles?.grades?.name || ""}</div></td>
          <td class="nowrap">${n(p.months)} شهر</td><td class="nowrap">${money(ctx, p.amount_usd, p.usd_syp)}</td><td class="hide-m nowrap">${methodName(ctx, p.method)}</td><td class="hide-m nowrap small">${fmtDate(p.created_at)}</td><td>${payTag(p.status)}</td>
          <td class="act">${p.receipt_path ? html`<button class="btn ghost sm" data-rc="${p.id}">${icon("eye", "sm")}الوصل</button>` : ""}
            ${p.status === "pending" ? html`<button class="btn sm" data-ok="${p.id}">${icon("check", "sm")}تأكيد</button><button class="btn ghost sm" data-no="${p.id}">رفض</button>` : ""}
            ${p.status === "confirmed" || p.status === "cancelled" ? html`<a class="btn ghost sm icon-only" href="#/receipt/${p.id}" aria-label="طباعة">${icon("print", "sm")}</a>` : ""}
            ${p.status === "confirmed" ? html`<button class="btn ghost sm icon-only" data-cx="${p.id}" aria-label="إلغاء">${icon("x", "sm")}</button>` : ""}</td></tr>`)}
        </tbody></table></div>` : emptyBox(tab === "pending" ? "لا توجد دفعات بانتظار التأكيد" : "لا توجد دفعات", "wallet"));
      $$("[data-rc]", page).forEach((b) => (b.onclick = async () => { try { const url = await API.payments.receiptUrl(+b.dataset.rc); modal({ title: "الوصل المرفق", wide: true, body: html`<p class="small mut">الرابط صالح 5 دقائق فقط.</p><p class="mt"><a class="btn" href="${url}" target="_blank" rel="noopener">${icon("eye", "sm")}فتح الوصل</a></p>${/\.(png|jpe?g|webp|svg)(\?|$)/i.test(url) ? html`<img class="mt" src="${url}" alt="الوصل">` : ""}` }); } catch (e) { fail(e); } }));
      $$("[data-ok]", page).forEach((b) => (b.onclick = async () => {
        const p = list.find((x) => x.id === +b.dataset.ok);
        if (!(await confirmBox("تأكيد الدفع وتفعيل الاشتراك", html`سيتفعّل اشتراك ${p.profiles?.full_name} لمدة ${n(p.months)} شهر، ويصدر وصل برقم رسمي.`, "تأكيد الدفع"))) return;
        try { await API.payments.confirm(p.id); toast("تم التأكيد وتفعيل الاشتراك"); load(); } catch (e) { fail(e); }
      }));
      $$("[data-no]", page).forEach((b) => (b.onclick = async () => { const r = await promptBox("رفض الدفعة", "السبب (يصل إلى الطالب أو ولي الأمر)", { okLabel: "رفض" }); if (!r) return; try { await API.payments.reject(+b.dataset.no, r); toast("تم الرفض"); load(); } catch (e) { fail(e); } }));
      $$("[data-cx]", page).forEach((b) => (b.onclick = async () => { const r = await promptBox("إلغاء الوصل", "سبب الإلغاء (الوصل الرسمي لا يُحذف، بل يُلغى)", { okLabel: "إلغاء الوصل" }); if (!r) return; try { await API.payments.cancel(+b.dataset.cx, r); toast("تم إلغاء الوصل وتحديث الاشتراك"); load(); } catch (e) { fail(e); } }));
    };
    $$("#tabs button").forEach((b) => (b.onclick = () => { tab = b.dataset.t; $$("#tabs button").forEach((x) => x.classList.toggle("on", x === b)); load(); }));
    $("#rp").onclick = () => HY.recordPayment(ctx, null, load);
    await load();
  };

  V.receipt = async (page, id, ctx) => {
    const p = await API.payments.get(id);
    const adm = isAdmin(ctx);
    ctx.title("وصل استلام مبلغ", adm ? "#/finance" : "#/subscription");
    if (!p || !p.receipt_no) { mount(page, emptyBox("الوصل غير موجود")); return; }
    const a = ctx.settings.academy || {};
    const rate = p.usd_syp;
    mount(page, html`<div class="row no-print"><button class="btn" id="pr">${icon("print", "sm")}طباعة</button>${adm ? html`<a class="btn ghost" href="#/user/${p.student_id}">ملف الطالب</a>` : ""}</div>
      <div class="receipt">
        <div class="rhead"><img src="img/logo-light.png" alt="HY CORE TEAM" width="77" height="74"><div><h2>وصل استلام مبلغ</h2><p class="small mut">${a.address || ""} · ${n(a.phone || "")}</p></div><div class="rno"><span class="small mut">رقم الوصل</span><br><b>${n(p.receipt_no)}</b></div></div>
        <div class="rbody">
          <div class="rline"><span>اسم الطالب</span><b>${p.profiles?.full_name}</b></div>
          <div class="rline"><span>الصف</span><b>${p.profiles?.grades?.name || "—"}</b></div>
          <div class="rline"><span>استلمنا من</span><b>${p.payer_name || p.profiles?.full_name}</b></div>
          <div class="rline"><span>تاريخ الاستلام</span><b>${fmtDate(p.confirmed_at || p.created_at)}</b></div>
          <div class="ramount"><div><span class="small mut">المبلغ</span><br><b>${usd(p.amount_usd)}</b>${rate ? html` <span class="mut">(${syp(p.amount_usd, rate)})</span>` : ""}</div><div class="small">فقط ${tafqit(p.amount_usd)} دولاراً أمريكياً لا غير${rate ? html`<br>بسعر صرف ${n(fmtNum(rate))} ل.س` : ""}</div></div>
          <div class="rline"><span>بدل</span><b>اشتراك المتابعة الدراسية لمدة ${n(p.months)} شهر</b></div>
          <div class="rline"><span>الفترة</span><b>من ${fmtDate(p.period_from)} إلى ${fmtDate(p.period_to)}</b></div>
          <div class="rline"><span>طريقة الدفع</span><b>${methodName(ctx, p.method)}</b></div>
          <div class="rline"><span>ملاحظة</span><b>${p.note || "—"}</b></div>
        </div>
        <div class="rfoot"><div>توقيع المستلم</div><div>الختم</div></div>
        ${p.status === "cancelled" ? html`<div class="stamp-cancel">ملغى</div>` : ""}
        <div class="rbars"><i></i><i></i></div>
      </div>`);
    $("#pr").onclick = () => window.print();
  };

  // ======================= الإعلانات =======================
  V.announcements = async (page, _, ctx) => {
    ctx.title("الإعلانات");
    const [list, grades] = await Promise.all([API.announcements.list(), API.grades.list()]);
    mount(page, html`<div class="card"><h3>إعلان جديد</h3><form class="form mt" id="af">
      <label class="field"><span>العنوان</span><input class="input" name="title" maxlength="90" required></label>
      <label class="field"><span>النص</span><textarea class="input" name="body" maxlength="600"></textarea></label>
      <div class="grid2"><label class="field"><span>لمين</span><select class="input" name="audience">${Object.entries(AUD).map(([k, v]) => html`<option value="${k}">${v}</option>`)}</select></label>
        <label class="field"><span>صف محدد</span><select class="input" name="grade_id">${options(grades, "", { blank: "كل الصفوف" })}</select></label></div>
      <div><button class="btn" type="submit">${icon("megaphone", "sm")}نشر الإعلان</button></div></form></div>
      <div class="card"><h3>الإعلانات المنشورة</h3>${list.length ? html`<div class="list mt">${list.map((a) => html`<div class="item"><span class="ico-box">${icon("megaphone", "sm")}</span><span class="grow"><b>${a.title}</b><span>${AUD[a.audience]}${a.grades ? html` · ${a.grades.name}` : ""} · ${ago(a.created_at)}</span></span><button class="btn ghost sm icon-only" data-del="${a.id}" aria-label="حذف">${icon("trash", "sm")}</button></div>`)}</div>` : emptyBox("لا توجد إعلانات")}</div>`);
    $("#af").onsubmit = async (e) => { e.preventDefault(); try { await API.announcements.save(formData(e.target)); toast("تم نشر الإعلان ووصل إشعار للمعنيين"); HY.render(); } catch (err) { fail(err); } };
    $$("[data-del]", page).forEach((b) => (b.onclick = async () => { if (await confirmBox("حذف الإعلان", "سيُحذف الإعلان.", "حذف", true)) { await API.announcements.remove(b.dataset.del).catch(fail); HY.render(); } }));
  };

  // ======================= الإعدادات =======================
  V.settings = async (page, _, ctx) => {
    ctx.title("الإعدادات");
    const s = await API.settings.all(); ctx.settings = s;
    const a = s.academy || {}, pr = s.pricing || { monthly_usd: 0, discounts: {} };
    let methods = JSON.parse(JSON.stringify(s.payment_methods || []));
    mount(page, html`
      <div class="card"><h3>سعر الصرف</h3><p class="small mut">يُستخدم لحساب ما يعادل الدولار بالليرة السورية في كل المنصة. حدّثه كلما تغيّر السعر.</p>
        <form class="row mt" id="rf"><input class="input grow-in" name="rate" type="number" step="0.01" min="0" dir="ltr" value="${s.usd_syp?.rate || ""}" placeholder="مثال: 11500"><span class="mut nowrap">ل.س لكل دولار</span><button class="btn" type="submit">حفظ</button></form></div>
      <div class="card"><h3>أسعار الاشتراك</h3><form class="form mt" id="pf">
        <label class="field"><span>سعر الشهر بالدولار</span><input class="input" name="monthly_usd" type="number" step="0.01" min="0" dir="ltr" value="${pr.monthly_usd}"></label>
        <div class="grid3">${[3, 6, 12].map((m) => html`<label class="field"><span>خصم ${n(m)} أشهر (%)</span><input class="input" name="d${m}" type="number" min="0" max="90" dir="ltr" value="${(pr.discounts || {})[m] || 0}"></label>`)}</div>
        <div><button class="btn" type="submit">حفظ الأسعار</button></div></form></div>
      <div class="card"><div class="row between"><h3>طرق الدفع</h3><button class="btn ghost sm" id="am">${icon("plus", "sm")}طريقة جديدة</button></div><div id="ml" class="form mt"></div><div class="mt"><button class="btn" id="sm">حفظ طرق الدفع</button></div></div>
      <div class="card"><h3>معلومات المعهد</h3><form class="form mt" id="inf"><div class="grid2">
        <label class="field"><span>الاسم</span><input class="input" name="name" value="${a.name || ""}"></label>
        <label class="field"><span>الهاتف</span><input class="input" name="phone" dir="ltr" value="${a.phone || ""}"></label>
        <label class="field"><span>رقم واتساب (دولي بدون +)</span><input class="input" name="whatsapp" dir="ltr" value="${a.whatsapp || ""}"></label>
        <label class="field"><span>إنستغرام</span><input class="input" name="instagram" dir="ltr" value="${a.instagram || ""}"></label></div>
        <label class="field"><span>العنوان</span><input class="input" name="address" value="${a.address || ""}"></label>
        <div><button class="btn" type="submit">حفظ المعلومات</button></div></form></div>
      <div class="card"><h3>الشروط وسياسة الاسترجاع</h3><p class="small mut">تظهر للطالب وولي الأمر قبل الدفع. كل سطر بند مستقل.</p><form class="form mt" id="tf"><textarea class="input" name="text" rows="6">${(s.terms && s.terms.text) || ""}</textarea><div><button class="btn" type="submit">حفظ الشروط</button></div></form></div>
      ${API.mode === "demo" ? html`<div class="card"><div class="row between"><div><h3>النسخة التجريبية</h3><p class="small mut">البيانات وهمية وتعود إلى حالتها الأصلية كل يوم تلقائياً.</p></div><button class="btn ghost" id="rst">${icon("refresh", "sm")}إعادة البيانات الآن</button></div></div>` : ""}`);
    const save = async (k, v, msg = "تم الحفظ") => { try { await API.settings.set(k, v); ctx.settings[k] = v; toast(msg); } catch (e) { fail(e); } };
    $("#rf").onsubmit = (e) => { e.preventDefault(); const r = +formData(e.target).rate; save("usd_syp", { rate: r > 0 ? r : null }); };
    $("#pf").onsubmit = (e) => { e.preventDefault(); const d = formData(e.target); save("pricing", { monthly_usd: +d.monthly_usd || 0, discounts: { 1: 0, 3: +d.d3 || 0, 6: +d.d6 || 0, 12: +d.d12 || 0 } }); };
    $("#inf").onsubmit = (e) => { e.preventDefault(); save("academy", { ...a, ...formData(e.target) }); };
    $("#tf").onsubmit = (e) => { e.preventDefault(); save("terms", { text: formData(e.target).text }); };
    const drawM = () => {
      mount($("#ml"), methods.map((m, i) => html`<div class="card mt0" data-i="${i}"><div class="grid2"><label class="field"><span>اسم الطريقة</span><input class="input" data-k="name" value="${m.name}"></label>
        <label class="field"><span>الرمز (إنكليزي)</span><input class="input" data-k="key" dir="ltr" value="${m.key}"></label></div>
        <label class="check mt"><input type="checkbox" data-k="needs_receipt" ${m.needs_receipt ? raw("checked") : ""}> تحتاج رفع وصل</label>
        <div class="form mt">${(m.details || []).map((d, j) => html`<div class="row" data-j="${j}"><input class="input grow-in" data-d="label" value="${d.label}" placeholder="العنوان (مثل: رمز الحساب)"><input class="input grow-in" data-d="value" value="${d.value}" placeholder="القيمة"><button class="btn ghost sm icon-only" data-rd="${j}" aria-label="حذف">${icon("x", "sm")}</button></div>`)}</div>
        <div class="row mt"><button class="btn ghost sm" data-ad>${icon("plus", "sm")}تفصيل</button><span class="spacer"></span><button class="btn danger sm" data-rm>حذف الطريقة</button></div></div>`));
      $$("#ml [data-i]").forEach((card) => {
        const i = +card.dataset.i;
        $$("[data-k]", card).forEach((inp) => (inp.oninput = inp.onchange = () => { methods[i][inp.dataset.k] = inp.type === "checkbox" ? inp.checked : inp.value.trim(); }));
        $$("[data-j]", card).forEach((row) => $$("[data-d]", row).forEach((inp) => (inp.oninput = () => { methods[i].details[+row.dataset.j][inp.dataset.d] = inp.value; })));
        $$("[data-rd]", card).forEach((b) => (b.onclick = () => { methods[i].details.splice(+b.dataset.rd, 1); drawM(); }));
        $("[data-ad]", card).onclick = () => { (methods[i].details = methods[i].details || []).push({ label: "", value: "" }); drawM(); };
        $("[data-rm]", card).onclick = () => { methods.splice(i, 1); drawM(); };
      });
    };
    drawM();
    $("#am").onclick = () => { methods.push({ key: "method" + (methods.length + 1), name: "طريقة جديدة", needs_receipt: true, details: [] }); drawM(); };
    $("#sm").onclick = () => { if (methods.some((m) => !/^[a-z0-9_]+$/.test(m.key) || !m.name)) return toast("يجب أن يكون لكل طريقة اسم ورمز بأحرف إنكليزية صغيرة", true); save("payment_methods", methods); };
    const rst = $("#rst"); if (rst) rst.onclick = async () => { if (await confirmBox("إعادة البيانات", "ستعود كل البيانات التجريبية إلى حالتها الأصلية.", "إعادة")) { API.resetDemo(); location.reload(); } };
  };

  // ======================= سجل النشاط =======================
  V.log = async (page, _, ctx) => {
    ctx.title("سجل النشاط");
    const list = await API.activity.list();
    const ent = { payment: "دفعة", lessons: "درس", grades: "صف", subjects: "مادة", profiles: "حساب", registration_requests: "طلب تسجيل" };
    const act = (a) => (a.startsWith("insert") ? "إضافة" : a.startsWith("update") ? "تعديل" : a.startsWith("delete") ? "حذف" : a) + (a.includes(":") ? " · " + (PAY_STATUS[a.split(":")[1]] || "") : "");
    mount(page, list.length ? html`<div class="table-wrap"><table class="t"><thead><tr><th>الوقت</th><th>من</th><th>العملية</th><th>التفاصيل</th></tr></thead><tbody>
      ${list.map((a) => html`<tr><td class="nowrap small">${fmtDate(a.created_at)} ${HY.fmtTime(a.created_at)}</td><td class="nowrap">${a.profiles?.full_name || "النظام"}</td><td class="nowrap">${act(a.action)} ${ent[a.entity] || a.entity}</td><td class="small">${a.details}</td></tr>`)}
    </tbody></table></div>` : emptyBox("السجل فاضي", "list"));
  };
})();
