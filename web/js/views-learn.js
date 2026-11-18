/* HY CORE — صفحات الطالب وولي الأمر: الرئيسية، المواد، التقارير، الاشتراك والدفع */
(function () {
  "use strict";
  const { html, raw, $, $$, mount, icon, n, toast, fail, modal, formData, loading, emptyBox, fmtDate, fmtMonth, ago, dur, today, daysLeft, usd, syp, fmtNum,
    ATT, AUD, initials, copyText, sniffFile } = HY;
  const API = window.API;
  const V = HY.views;

  const SUBJ_ICON = (name) => (/رياض/.test(name) ? "chart" : /إنكليز|English/i.test(name) ? "globe" : /فيزياء|كيمياء/.test(name) ? "spark" : /علوم/.test(name) ? "target" : /برمج/.test(name) ? "code" : "book");

  function subNotice(u, payHref) {
    const d = daysLeft(u.access_until);
    if (d !== null && d > 7) return "";
    const expired = d === null || d < 0;
    return html`<div class="notice ${expired ? "dark" : ""}"><span class="ico-box ${expired ? "" : "dark"}">${icon(expired ? "lock" : "clock", "sm")}</span><div class="grow">
      <h4>${expired ? (d === null ? "الاشتراك غير مفعّل" : "انتهى الاشتراك") : html`ينتهي الاشتراك بعد ${n(d)} يوم`}</h4>
      <p class="small">${expired ? "الدروس المجانية متاحة، وتُفتح باقي الدروس بعد تفعيل الاشتراك." : html`فعّال حتى ${fmtDate(u.access_until)}. جدّده الآن لتبقى الدروس مفتوحة.`}</p></div>
      <a class="btn ${expired ? "" : "ghost"} sm" href="${payHref}">${icon("wallet", "sm")}${expired ? "فعّل الاشتراك" : "تجديد"}</a></div>`;
  }

  // ======================= الطالب =======================
  V["student:home"] = async (page, _, ctx) => {
    ctx.title("الرئيسية");
    const me = ctx.me = (await API.me()) || ctx.me;
    const [lessons, prog, hw, anns] = await Promise.all([API.lessons.list({ grade_id: me.grade_id, published: true }), API.progress.list(me.id), API.homework.list({}), API.announcements.list()]);
    const done = new Set(prog.filter((p) => p.completed).map((p) => p.lesson_id));
    const ready = lessons.filter((l) => l.video_status === "ready");
    const nextL = ready.find((l) => !done.has(l.id));
    const pct = ready.length ? Math.round((ready.filter((l) => done.has(l.id)).length / ready.length) * 100) : 0;
    const subs = [...new Map(lessons.map((l) => [l.subject_id, l.subjects])).values()];
    const up = hw.filter((h) => !h.due_date || h.due_date >= today()).slice(0, 3);
    const hour = new Date().getHours();
    mount(page, html`<div class="page-head"><div><h2>${hour < 12 ? "صباح الخير" : "مساء الخير"} يا ${me.full_name.split(" ")[0]}</h2><p class="mut">${me.grades?.name || ""} · صدّقني، رح ترتقي فيك</p></div></div>
      ${subNotice(me, "#/pay")}
      <div class="grid2">
        <div class="card"><h3>تابع من حيث توقفت</h3>${nextL ? html`<a class="item mt list-like" href="#/lesson/${nextL.id}"><div class="lesson-mini">${HY.thumb(nextL)}</div><div class="grow"><b>${nextL.title}</b><span class="small mut">${nextL.subjects.name}</span></div></a>` : html`<p class="mut mt">${ready.length ? "أكملت كل الدروس المتاحة. ممتاز!" : "تُضاف الدروس قريباً."}</p>`}</div>
        <div class="card"><h3>تقدّمك</h3><div class="row between mt"><span class="mut small">${n(ready.filter((l) => done.has(l.id)).length)} من ${n(ready.length)} درس</span><b>${n(pct + "%")}</b></div><div class="bar mt"><i data-w="${pct}"></i></div>
          <div class="row mt"><a class="btn ghost sm" href="#/subjects">${icon("book", "sm")}موادي</a><a class="btn ghost sm" href="#/reports">${icon("report", "sm")}تقاريري</a></div></div>
      </div>
      <h3>موادي</h3>
      ${subs.length ? html`<div class="cards">${subs.map((s) => { const ls = ready.filter((l) => l.subject_id === s.id), d = ls.filter((l) => done.has(l.id)).length; return html`<a class="card hov subject-card" href="#/subject/${s.id}"><span class="ico-box">${icon(SUBJ_ICON(s.name))}</span><div><h4>${s.name}</h4><p class="small mut">${n(ls.length)} درس · أكملت ${n(d)}</p></div><div class="bar"><i data-w="${ls.length ? (d / ls.length) * 100 : 0}"></i></div></a>`; })}</div>` : emptyBox("تُضاف الدروس قريباً", "book")}
      <div class="grid2">
        <div class="card"><div class="row between"><h3>وظائف قريبة</h3><a class="small" href="#/homework">الكل</a></div>${up.length ? html`<div class="list mt">${up.map((h) => html`<div class="item"><span class="ico-box">${icon("task", "sm")}</span><span class="grow"><b>${h.title}</b><span>${h.subjects.name}${h.due_date ? html` · ${fmtDate(h.due_date)}` : ""}</span></span></div>`)}</div>` : emptyBox("لا توجد وظائف حالياً", "task")}</div>
        <div class="card"><h3>الإعلانات</h3>${anns.length ? html`<div class="list mt">${anns.slice(0, 3).map((a) => html`<div class="item"><span class="ico-box">${icon("megaphone", "sm")}</span><span class="grow"><b>${a.title}</b><span class="desc1">${a.body || ""}</span></span></div>`)}</div>` : emptyBox("لا توجد إعلانات")}</div>
      </div>`);
    HY.bars(page);
  };

  V["student:subjects"] = async (page, _, ctx) => {
    ctx.title("موادي");
    const me = ctx.me;
    const [subjects, lessons, prog] = await Promise.all([API.subjects.list(me.grade_id), API.lessons.list({ grade_id: me.grade_id, published: true }), API.progress.list(me.id)]);
    const done = new Set(prog.filter((p) => p.completed).map((p) => p.lesson_id));
    mount(page, html`<p class="mut">${me.grades?.name || ""}</p>${subjects.filter((s) => s.active).length ? html`<div class="cards">${subjects.filter((s) => s.active).map((s) => { const ls = lessons.filter((l) => l.subject_id === s.id), d = ls.filter((l) => done.has(l.id)).length; return html`<a class="card hov subject-card" href="#/subject/${s.id}"><span class="ico-box">${icon(SUBJ_ICON(s.name))}</span><div><h4>${s.name}</h4><p class="small mut">${n(ls.length)} درس · أكملت ${n(d)}</p></div><div class="bar"><i data-w="${ls.length ? (d / ls.length) * 100 : 0}"></i></div></a>`; })}</div>` : emptyBox("لا توجد مواد لصفّك بعد", "book")}`);
    HY.bars(page);
  };

  V.subject = async (page, id, ctx) => {
    const [lessons, prog] = await Promise.all([API.lessons.list({ subject_id: id, published: true }), ctx.me.role === "student" ? API.progress.list(ctx.me.id) : []]);
    const name = lessons[0]?.subjects.name || "المادة";
    ctx.title(name, ctx.me.role === "student" ? "#/subjects" : "#/home");
    const done = new Set(prog.filter((p) => p.completed).map((p) => p.lesson_id));
    mount(page, lessons.length ? html`<div class="cards">${lessons.map((l, i) => html`<a class="card hov lesson-card" href="#/lesson/${l.id}">${HY.thumb(l, done.has(l.id))}<div class="body"><span class="small mut">الدرس ${n(i + 1)}${l.is_free ? " · مجاني" : ""}</span><h4>${l.title}</h4><p class="small mut desc2">${l.description || ""}</p></div></a>`)}</div>` : emptyBox("لا توجد دروس منشورة في هذه المادة بعد", "video"));
  };

  function reportCard(r, subjects) {
    const sName = (sid) => (subjects.find((s) => s.id === +sid) || {}).name || "مادة";
    return html`<div class="card"><div class="row between"><h3>تقرير ${fmtMonth(r.month)}</h3><span class="tag blue">منشور</span></div>
      <div class="stats mt"><div class="stat"><b>${r.attendance_rate != null ? n(r.attendance_rate + "%") : "—"}</b><span>الحضور</span></div><div class="stat"><b>${r.homework_rate != null ? n(r.homework_rate + "%") : "—"}</b><span>إنجاز الوظائف</span></div></div>
      ${r.ratings?.length ? html`<div class="table-wrap mt"><table class="t"><thead><tr><th>المادة</th><th>التقييم</th></tr></thead><tbody>${r.ratings.map((x) => html`<tr><td class="bold">${sName(x.subject_id)}</td><td><span class="tag ${x.level === "ممتاز" ? "blue" : x.level === "يحتاج متابعة" ? "line" : ""}">${x.level}</span></td></tr>`)}</tbody></table></div>` : ""}
      ${r.teacher_note ? html`<div class="notice mt"><div class="grow"><h4>ملاحظات المدرّس</h4><p>${r.teacher_note}</p></div></div>` : ""}</div>`;
  }
  HY.reportCard = reportCard;

  V["student:reports"] = async (page, _, ctx) => {
    ctx.title("تقاريري");
    const [reps, subjects] = await Promise.all([API.reports.list({ student_id: ctx.me.id }), API.subjects.list(ctx.me.grade_id)]);
    mount(page, reps.length ? reps.map((r) => reportCard(r, subjects)) : emptyBox("يظهر التقرير الشهري هنا عندما ينشره المدرّس", "report"));
  };

  // ======================= الاشتراك =======================
  function payHistory(ctx, pays, showName) {
    return pays.length ? html`<div class="table-wrap"><table class="t"><thead><tr><th>الرقم</th>${showName ? html`<th>الطالب</th>` : ""}<th>المدة</th><th>المبلغ</th><th>الحالة</th><th></th></tr></thead><tbody>
      ${pays.map((p) => html`<tr><td class="nowrap">${n(p.receipt_no || p.ref)}</td>${showName ? html`<td class="nowrap">${p.profiles?.full_name}</td>` : ""}<td class="nowrap">${n(p.months)} شهر</td><td class="nowrap">${usd(p.amount_usd)}</td>
        <td>${HY.payTag(p.status)}${p.status === "rejected" && p.cancel_reason ? html`<div class="small mut">${p.cancel_reason}</div>` : ""}</td><td class="act">${p.status === "confirmed" ? html`<a class="btn ghost sm" href="#/receipt/${p.id}">${icon("receipt", "sm")}الوصل</a>` : ""}</td></tr>`)}
    </tbody></table></div>` : emptyBox("لا توجد دفعات بعد", "wallet");
  }

  V.subscription = async (page, _, ctx) => {
    ctx.title(ctx.me.role === "parent" ? "الاشتراكات" : "اشتراكي");
    if (ctx.me.role === "student") {
      const me = ctx.me = (await API.me()) || ctx.me;
      const pays = await API.payments.list({ student_id: me.id });
      const d = daysLeft(me.access_until);
      mount(page, html`<div class="card"><div class="row between"><div><h3>حالة الاشتراك</h3><p class="mt">${me.access_until ? html`${d >= 0 ? "فعّال حتى" : "انتهى بتاريخ"} <b>${fmtDate(me.access_until)}</b>` : "لا يوجد اشتراك مفعّل"}</p></div>${HY.subTag(me)}</div>
        <div class="row mt"><a class="btn" href="#/pay">${icon("wallet", "sm")}${d !== null && d >= 0 ? "تجديد الاشتراك" : "فعّل الاشتراك"}</a></div></div>
        <h3>الدفعات</h3>${payHistory(ctx, pays)}`);
      return;
    }
    const kids = ctx.children = await API.parents.children(ctx.me.id);
    const pays = await API.payments.list({ student_ids: kids.map((k) => k.id) });
    mount(page, html`${kids.length ? html`<div class="cards">${kids.map((k) => html`<div class="card"><div class="row"><span class="avatar">${initials(k.full_name)}</span><div class="grow"><b>${k.full_name}</b><p class="small mut">${k.grades?.name || ""}</p></div>${HY.subTag(k)}</div>
      <p class="small mt">${k.access_until ? html`حتى ${fmtDate(k.access_until)}` : "غير مفعّل"}</p><a class="btn sm mt" href="#/pay/${k.id}">${icon("wallet", "sm")}دفع الاشتراك</a></div>`)}</div>` : emptyBox("لا يوجد أبناء مرتبطون بحسابك. تواصل مع الإدارة.", "users")}
      <h3>سجل الدفعات</h3>${payHistory(ctx, pays, true)}`);
  };

  const DEFAULT_TERMS = "الاشتراك شخصي لطالب واحد ولا يجوز مشاركة حساب الدخول.\nيبدأ الاشتراك من تاريخ تأكيد الدفع من الإدارة، أو من بعد انتهاء الاشتراك الحالي.\nيمكن طلب استرجاع المبلغ خلال 3 أيام من التفعيل إذا لم يُستخدم الحساب، وبعدها لا يُسترجع المبلغ.\nتتم مراجعة الوصل خلال يوم عمل واحد، ويصلك إشعار بالنتيجة.\nللاستفسار: +963 981 768 529";

  V.pay = async (page, sid, ctx) => {
    const isParent = ctx.me.role === "parent";
    ctx.title("دفع الاشتراك", "#/subscription");
    let student = ctx.me;
    if (isParent) {
      const kids = ctx.children = await API.parents.children(ctx.me.id);
      student = kids.find((k) => k.id === sid) || kids[0];
      if (!student) { mount(page, emptyBox("لا يوجد أبناء مرتبطون بحسابك", "users")); return; }
    }
    const s = ctx.settings = await API.settings.all();
    const methods = s.payment_methods || [], rate = Number(s.usd_syp?.rate) || null, pr = s.pricing || { monthly_usd: 0, discounts: {} };
    const plans = [1, 3, 6, 12].map((m) => ({ m, price: HY.priceFor(ctx, m), full: pr.monthly_usd * m, disc: Number((pr.discounts || {})[m] || 0) }));
    let months = 3, method = null, file = null;
    mount(page, html`<div class="card"><div class="row"><span class="avatar">${initials(student.full_name)}</span><div class="grow"><b>${student.full_name}</b><p class="small mut">${student.grades?.name || ""}</p></div>${HY.subTag(student)}</div></div>
      <div class="card"><h3>${n(1)}. اختر مدة الاشتراك</h3><div class="cards mt" id="plans">${plans.map((p) => html`<button type="button" class="card hov plan ${p.m === months ? "sel" : ""}" data-m="${p.m}">
        <span class="small mut">${n(p.m)} ${p.m === 1 ? "شهر" : p.m <= 10 ? "أشهر" : "شهر"}${p.disc ? html` · خصم ${n(p.disc + "%")}` : ""}</span>
        <span class="price">${usd(p.price)}${p.disc ? html`<s>${usd(p.full)}</s>` : ""}</span><span class="small mut">${rate ? syp(p.price, rate) : html`&nbsp;`}</span></button>`)}</div></div>
      <div class="card"><h3>${n(2)}. اختر طريقة الدفع</h3><div class="cards mt" id="methods">${methods.map((m) => html`<button type="button" class="card hov plan" data-k="${m.key}"><b>${m.name}</b><span class="small mut">${m.needs_receipt ? "تحويل ورفع وصل" : "بدون وصل"}</span></button>`)}</div><div id="md" class="mt"></div></div>
      <form class="card form" id="payf"><h3>${n(3)}. أكّد الطلب</h3>
        <div id="rbox" class="hidden"><div class="field"><span>صورة الوصل أو PDF</span><label class="upload-box" id="ub">${icon("image")}<b id="ubt">اختر صورة الوصل</b><span class="small mut">JPG أو PNG أو PDF · حتى 5MB</span><input type="file" class="sr" id="rf" accept="image/jpeg,image/png,image/webp,application/pdf"></label></div></div>
        <div class="grid2"><label class="field"><span>اسم الدافع</span><input class="input" name="payer_name" value="${ctx.me.full_name}"></label><label class="field"><span>ملاحظة (اختياري)</span><input class="input" name="note" placeholder="مثل: رقم الحوالة"></label></div>
        <label class="check"><input type="checkbox" name="agree" id="ag"> قرأت <a href="#" id="terms">الشروط وسياسة الاسترجاع</a> وأوافق عليها</label>
        <div class="row between"><div><span class="small mut">المبلغ المطلوب</span><div class="price" id="tot"></div></div><button class="btn" type="submit" id="sb">${icon("check", "sm")}إرسال طلب الدفع</button></div>
        <p class="small mut">يُحسب المبلغ في الخادم، وبعد تأكيد الإدارة للدفع يتفعّل الاشتراك تلقائياً.</p>
      </form>`);
    const total = () => { const p = plans.find((x) => x.m === months); mount($("#tot"), html`${usd(p.price)}${rate ? html` <span class="small mut">${syp(p.price, rate)}</span>` : ""}`); };
    total();
    $$("#plans [data-m]").forEach((b) => (b.onclick = () => { months = +b.dataset.m; $$("#plans [data-m]").forEach((x) => x.classList.toggle("sel", x === b)); total(); }));
    $$("#methods [data-k]").forEach((b) => (b.onclick = () => {
      method = methods.find((m) => m.key === b.dataset.k);
      $$("#methods [data-k]").forEach((x) => x.classList.toggle("sel", x === b));
      mount($("#md"), method.details?.length ? html`<div class="card mt0">${method.details.map((d) => html`<div class="copy-row"><span class="small mut">${d.label}</span><b dir="auto">${d.value}</b><button type="button" class="btn ghost sm icon-only" data-cp="${d.value}" aria-label="نسخ">${icon("copy", "sm")}</button></div>`)}</div>` : "");
      $$("[data-cp]", $("#md")).forEach((c) => (c.onclick = () => copyText(c.dataset.cp)));
      $("#rbox").classList.toggle("hidden", !method.needs_receipt);
    }));
    $("#rf").onchange = async () => {
      const f = $("#rf").files[0]; if (!f) return;
      if (f.size > 5 * 1024 * 1024) { toast("حجم الوصل أكبر من 5MB", true); $("#rf").value = ""; return; }
      const kind = await sniffFile(f);
      if (!kind) { toast("يجب أن يكون الملف صورة أو PDF", true); $("#rf").value = ""; return; }
      file = f; $("#ubt").textContent = f.name;
    };
    $("#terms").onclick = (e) => { e.preventDefault(); modal({ title: "الشروط وسياسة الاسترجاع", body: html`<div class="form">${String((s.terms && s.terms.text) || DEFAULT_TERMS).split("\n").filter(Boolean).map((t) => html`<p>${t}</p>`)}</div>` }); };
    $("#payf").onsubmit = async (e) => {
      e.preventDefault();
      if (!method) return toast("اختر طريقة الدفع", true);
      if (method.needs_receipt && !file) return toast("ارفع صورة الوصل", true);
      if (!$("#ag").checked) return toast("يجب الموافقة على الشروط", true);
      const d = formData(e.target); const b = $("#sb"); b.disabled = true;
      try {
        const r = await API.payments.submit({ student_id: student.id, months, method: method.key, payer_name: d.payer_name, note: d.note, file });
        mount(page, html`<div class="card"><div class="empty">${icon("check")}<h2>وصل طلبك</h2><p>رقم الطلب <b>${n(r.ref)}</b></p><p class="mut">ستراجع الإدارة الدفع وتفعّل الاشتراك، ويصلك إشعار بذلك.</p><a class="btn mt" href="#/subscription">العودة إلى الاشتراك</a></div></div>`);
      } catch (err) { fail(err); b.disabled = false; }
    };
  };

  // ======================= ولي الأمر =======================
  V["parent:home"] = async (page, _, ctx) => {
    ctx.title("أبنائي");
    const kids = ctx.children = await API.parents.children(ctx.me.id);
    if (!kids.length) { mount(page, emptyBox("لا يوجد أبناء مرتبطون بحسابك. تواصل مع الإدارة.", "users")); return; }
    const from = HY.monthStart();
    const data = await Promise.all(kids.map(async (k) => {
      const [ls, pr, at, rp] = await Promise.all([API.lessons.list({ grade_id: k.grade_id, published: true }), API.progress.list(k.id), API.attendance.list({ student_id: k.id, from }), API.reports.list({ student_id: k.id })]);
      const ready = ls.filter((l) => l.video_status === "ready"), done = ready.filter((l) => pr.some((p) => p.lesson_id === l.id && p.completed)).length;
      const att = at.length ? Math.round((at.filter((a) => a.status === "present" || a.status === "late").length / at.length) * 100) : null;
      return { k, pct: ready.length ? Math.round((done / ready.length) * 100) : 0, done, total: ready.length, att, rep: rp[0] };
    }));
    const anns = await API.announcements.list();
    mount(page, html`<div><h2>أهلاً ${ctx.me.full_name.split(" ")[0]}</h2><p class="mut">ابنك في أيدٍ أمينة، وتعرف مستواه كل شهر.</p></div>
      ${kids.map((k) => subNotice(k, "#/pay/" + k.id))}
      <div class="cards">${data.map((x) => html`<a class="card hov" href="#/child/${x.k.id}"><div class="row"><span class="avatar lg">${initials(x.k.full_name)}</span><div class="grow"><h3>${x.k.full_name}</h3><p class="small mut">${x.k.grades?.name || ""}</p></div></div>
        <div class="row between mt small"><span>الدروس المكتملة</span><b>${n(x.done)} / ${n(x.total)}</b></div><div class="bar mt"><i data-w="${x.pct}"></i></div>
        <div class="row between mt small"><span>حضور هذا الشهر</span><b>${x.att == null ? "—" : n(x.att + "%")}</b></div>
        <div class="row between mt small"><span>آخر تقرير</span><b>${x.rep ? fmtMonth(x.rep.month) : "—"}</b></div>
        <div class="row between mt">${HY.subTag(x.k)}<span class="small bold">التفاصيل ${icon("left", "sm")}</span></div></a>`)}</div>
      <div class="card"><h3>الإعلانات</h3>${anns.length ? html`<div class="list mt">${anns.slice(0, 4).map((a) => html`<div class="item"><span class="ico-box">${icon("megaphone", "sm")}</span><span class="grow"><b>${a.title}</b><span class="desc1">${a.body || ""}</span></span><span class="small mut nowrap">${ago(a.created_at)}</span></div>`)}</div>` : emptyBox("لا توجد إعلانات")}</div>`);
    HY.bars(page);
  };

  V.child = async (page, id, ctx) => {
    const kids = ctx.children.length ? ctx.children : (ctx.children = await API.parents.children(ctx.me.id));
    const k = kids.find((x) => x.id === id);
    if (!k) { ctx.title("غير موجود", "#/home"); mount(page, emptyBox("الطالب غير مرتبط بحسابك")); return; }
    ctx.title(k.full_name, "#/home");
    const from = new Date(); from.setDate(from.getDate() - 30);
    const [lessons, prog, att, reps, subjects] = await Promise.all([API.lessons.list({ grade_id: k.grade_id, published: true }), API.progress.list(k.id), API.attendance.list({ student_id: k.id, from: from.toISOString().slice(0, 10) }), API.reports.list({ student_id: k.id }), API.subjects.list(k.grade_id)]);
    const done = new Set(prog.filter((p) => p.completed).map((p) => p.lesson_id));
    const subs = subjects.filter((s) => s.active).map((s) => { const ls = lessons.filter((l) => l.subject_id === s.id && l.video_status === "ready"); return { s, t: ls.length, d: ls.filter((l) => done.has(l.id)).length }; });
    const last = prog.filter((p) => p.last_viewed_at).sort((a, b) => b.last_viewed_at.localeCompare(a.last_viewed_at))[0];
    const lastL = last && lessons.find((l) => l.id === last.lesson_id);
    const cnt = (s) => att.filter((a) => a.status === s).length;
    mount(page, html`${subNotice(k, "#/pay/" + k.id)}
      <div class="card"><div class="row"><span class="avatar lg">${initials(k.full_name)}</span><div class="grow"><h2>${k.full_name}</h2><p class="mut">${k.grades?.name || ""}</p></div>${HY.subTag(k)}</div>
        ${lastL ? html`<p class="small mt">آخر درس شاهده: <b>${lastL.title}</b> · ${ago(last.last_viewed_at)}</p>` : ""}</div>
      <div class="grid2">
        <div class="card"><h3>التقدّم بالمواد</h3>${subs.length ? html`<div class="list mt">${subs.map((x) => html`<a class="item" href="#/subject/${x.s.id}"><span class="grow"><b>${x.s.name}</b><span>${n(x.d)} من ${n(x.t)} درس</span><div class="bar mt"><i data-w="${x.t ? (x.d / x.t) * 100 : 0}"></i></div></span></a>`)}</div>` : emptyBox("لا توجد مواد بعد")}</div>
        <div class="card"><h3>الحضور آخر 30 يوم</h3><div class="stats mt"><div class="stat"><b>${n(cnt("present"))}</b><span>حاضر</span></div><div class="stat"><b>${n(cnt("late"))}</b><span>متأخر</span></div><div class="stat"><b>${n(cnt("absent"))}</b><span>غائب</span></div><div class="stat"><b>${n(cnt("excused"))}</b><span>بعذر</span></div></div>
          ${att.length ? html`<div class="list mt">${att.slice(0, 6).map((a) => html`<div class="item"><span class="grow"><b>${fmtDate(a.day, true)}</b></span><span class="tag ${a.status === "absent" ? "dark" : a.status === "present" ? "blue" : ""}">${ATT[a.status]}</span></div>`)}</div>` : ""}</div>
      </div>
      <h3>التقارير الشهرية</h3>${reps.length ? reps.map((r) => reportCard(r, subjects)) : emptyBox("يظهر التقرير الشهري هنا عندما ينشره المدرّس", "report")}`);
    HY.bars(page);
  };
})();
