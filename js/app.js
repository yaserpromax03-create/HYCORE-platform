/* HY CORE — هيكل التطبيق: الدخول، التنقّل، الإشعارات */
(function () {
  "use strict";
  const { html, raw, $, $$, mount, icon, n, toast, fail, modal, formData, loading, emptyBox, ago, ROLE, initials, errMsg } = HY;
  const API = window.API;
  HY.views = HY.views || {};

  // صفحات كل دور: [المسار، الاسم، الأيقونة، يظهر بشريط الموبايل]
  const NAV = {
    admin: [["home", "لوحة التحكم", "home", 1], ["lessons", "الدروس", "video", 1], ["users", "المستخدمون", "users", 1], ["finance", "المالية", "wallet", 1],
      ["requests", "طلبات التسجيل", "inbox"], ["grades", "الصفوف والمواد", "layers"], ["attendance", "الحضور", "check2"], ["reports", "التقارير الشهرية", "report"],
      ["homework", "الوظائف", "task"], ["announcements", "الإعلانات", "megaphone"], "-", ["settings", "الإعدادات", "settings"], ["log", "سجل النشاط", "list"]],
    supervisor: [["home", "لوحة التحكم", "home", 1], ["users", "المستخدمون", "users", 1], ["requests", "طلبات التسجيل", "inbox", 1], ["lessons", "الدروس", "video", 1],
      ["grades", "الصفوف والمواد", "layers"], ["attendance", "الحضور", "check2"], ["reports", "التقارير الشهرية", "report"], ["homework", "الوظائف", "task"], ["announcements", "الإعلانات", "megaphone"]],
    teacher: [["home", "الرئيسية", "home", 1], ["lessons", "دروسي", "video", 1], ["attendance", "الحضور", "check2", 1], ["students", "طلابي", "users", 1],
      ["reports", "التقارير الشهرية", "report"], ["homework", "الوظائف", "task"]],
    student: [["home", "الرئيسية", "home", 1], ["subjects", "موادي", "book", 1], ["homework", "وظائفي", "task", 1], ["subscription", "اشتراكي", "wallet", 1], ["reports", "تقاريري", "report"]],
    parent: [["home", "أبنائي", "users", 1], ["subscription", "الاشتراكات", "wallet", 1], ["homework", "الوظائف", "task", 1]],
  };
  const EXTRA = { // صفحات بلا رابط في القائمة
    all: ["notifications", "profile", "lesson"],
    admin: ["user", "receipt"], supervisor: ["user"], teacher: ["user"], student: ["subject", "pay", "receipt"], parent: ["child", "pay", "subject", "receipt"],
  };

  const ctx = { me: null, settings: {}, unread: 0, children: [] };
  HY.ctx = ctx;
  const app = $("#app");

  function allowed(route) {
    const r = ctx.me.role;
    return NAV[r].some((x) => x !== "-" && x[0] === route) || EXTRA.all.includes(route) || (EXTRA[r] || []).includes(route);
  }

  // ---------- الدخول ----------
  function renderLogin() {
    document.title = "الدخول — HY CORE";
    const demo = API.mode === "demo";
    mount(app, html`<div class="auth">
      <div class="art">
        <div>
          <a href="./" class="dframe" aria-label="الصفحة الرئيسية"><img src="img/logo-dark.png" alt="HY CORE TEAM" width="220" height="211"></a>
          <h2>منصة HY CORE التعليمية</h2>
          <p>دروس صفك، ووظائفك، ومتابعتك الشهرية في مكان واحد.</p>
        </div>
        <div class="art-foot"><div class="skew"><i></i><i></i></div><p class="small">صدّقني، رح ترتقي فيك</p></div>
        <img class="bg-mark" src="img/mark.png" alt="">
      </div>
      <div class="panel">
        <form id="lf" class="form" autocomplete="on">
          <div><h1>تسجيل الدخول</h1><p class="mut">ادخل باسم المستخدم وكلمة السر التي أعطتك إياها الإدارة.</p></div>
          <label class="field"><span>اسم المستخدم</span><input class="input" name="u" dir="ltr" autocomplete="username" autocapitalize="none" spellcheck="false" required></label>
          <label class="field"><span>كلمة السر</span><input class="input" name="p" type="password" dir="ltr" autocomplete="current-password" required></label>
          <button class="btn block" type="submit">${icon("lock", "sm")}دخول</button>
          <p class="small mut">نسيت كلمة السر؟ تواصل مع الإدارة على <a href="https://wa.me/963981768529" rel="noopener">${n("+963 981 768 529")}</a></p>
          ${demo ? html`<div class="demo-box">
            <div class="row between"><b class="small">نسخة تجريبية — اختر حساباً للدخول</b><span class="tag line">كلمة السر ${n("1234")}</span></div>
            <div class="demo-grid">${API.demoAccounts.map((a) => html`<button type="button" class="btn ghost sm" data-u="${a.u}">${a.label}</button>`)}</div>
          </div>` : ""}
        </form>
      </div>
    </div>`);
    const f = $("#lf");
    f.onsubmit = async (e) => {
      e.preventDefault();
      const b = $("button[type=submit]", f); b.disabled = true;
      try { const d = formData(f); ctx.me = await API.signIn(d.u, d.p); await boot(); if (!location.hash || location.hash === "#/login") location.hash = "#/home"; else render(); }
      catch (err) { toast(errMsg(err), true); }
      finally { b.disabled = false; }
    };
    $$("[data-u]", f).forEach((b) => (b.onclick = () => { f.u.value = b.dataset.u; f.p.value = "1234"; f.requestSubmit(); }));
  }

  // ---------- الهيكل ----------
  function renderShell() {
    const me = ctx.me, items = NAV[me.role];
    const mob = items.filter((x) => x !== "-" && x[3]);
    mount(app, html`<div class="shell">
      <aside class="side">
        <div class="logo"><a href="#/home"><img src="img/logo-dark.png" alt="HY CORE TEAM" width="65" height="62"></a></div>
        <nav class="nav" id="nav">${items.map((x) => (x === "-" ? html`<div class="sep"></div>` : html`<a href="#/${x[0]}" data-r="${x[0]}">${icon(x[2])}<span>${x[1]}</span><b class="count hidden" data-count="${x[0]}"></b></a>`))}</nav>
        <div class="me">
          <a href="#/profile" class="avatar" title="حسابي">${initials(me.full_name)}</a>
          <a href="#/profile" class="who"><b>${me.full_name}</b><span>${ROLE[me.role]}</span></a>
          <button id="lo" title="تسجيل الخروج" aria-label="تسجيل الخروج">${icon("logout")}</button>
        </div>
      </aside>
      <div class="main">
        <header class="top">
          <a class="btn ghost sm icon-only back" id="back" href="#/home" aria-label="رجوع">${icon("back")}</a>
          <img class="top-logo" src="img/mark.png" alt="HY CORE" width="48" height="34">
          <h1 id="title"></h1>
          <span class="spacer"></span>
          ${API.mode === "demo" ? html`<span class="tag line hide-m">نسخة تجريبية</span>` : ""}
          <a href="#/notifications" class="btn ghost icon-only bell" aria-label="الإشعارات">${icon("bell")}<span class="dot hidden" id="bdot"></span></a>
          <a href="#/profile" class="avatar hide-d" aria-label="حسابي">${initials(me.full_name)}</a>
        </header>
        <main class="page" id="page"></main>
      </div>
      <nav class="bottom-nav" id="bnav">
        ${mob.map((x) => html`<a href="#/${x[0]}" data-r="${x[0]}">${icon(x[2])}<span>${x[1]}</span></a>`)}
        ${items.length > mob.length ? html`<button id="more">${icon("more")}<span>المزيد</span></button>` : html`<a href="#/profile" data-r="profile">${icon("user")}<span>حسابي</span></a>`}
      </nav>
    </div>`);
    $("#lo").onclick = logout;
    const more = $("#more");
    if (more) more.onclick = () => {
      const rest = items.filter((x) => x !== "-" && !x[3]);
      const m = modal({ title: "المزيد", body: html`<div class="sheet-nav">${rest.map((x) => html`<a href="#/${x[0]}">${icon(x[2], "lg")}<span>${x[1]}</span></a>`)}<a href="#/profile">${icon("user", "lg")}<span>حسابي</span></a><a href="#" id="lo2">${icon("logout", "lg")}<span>خروج</span></a></div>` });
      $$(".sheet-nav a", m.el).forEach((a) => (a.onclick = () => m.close()));
      $("#lo2", m.el).onclick = (e) => { e.preventDefault(); logout(); };
    };
  }

  async function logout() { await API.signOut(); ctx.me = null; location.hash = "#/login"; render(); }

  ctx.title = (t, back) => {
    $("#title").textContent = t;
    document.title = `${t} — HY CORE`;
    const b = $("#back");
    if (back) { b.href = back; b.classList.add("show"); } else b.classList.remove("show");
  };
  ctx.go = (h) => { location.hash = h; };
  ctx.badge = (route, count) => { const el = $(`[data-count="${route}"]`); if (!el) return; el.textContent = count || ""; el.classList.toggle("hidden", !count); };
  ctx.refreshBell = async () => {
    try {
      ctx.unread = await API.notifications.unread();
      const d = $("#bdot"); if (d) { d.textContent = ctx.unread > 9 ? "9+" : ctx.unread; d.classList.toggle("hidden", !ctx.unread); }
    } catch {}
  };
  ctx.rate = () => Number(ctx.settings.usd_syp && ctx.settings.usd_syp.rate) || null;

  async function boot() {
    ctx.settings = await API.settings.all().catch(() => ({}));
    if (ctx.me.role === "parent") ctx.children = await API.parents.children(ctx.me.id).catch(() => []);
    renderShell();
    ctx.refreshBell();
    if (["admin", "supervisor"].includes(ctx.me.role)) API.stats.dashboard().then((s) => { ctx.badge("requests", s.new_requests); ctx.badge("finance", s.pending_payments); }).catch(() => {});
    clearInterval(ctx.timer);
    ctx.timer = setInterval(ctx.refreshBell, 60000);
  }

  let seq = 0;
  async function render() {
    const parts = (location.hash || "#/home").replace(/^#\/?/, "").split("/");
    const route = parts[0] || "home", param = decodeURIComponent(parts[1] || "");
    if (!API.hasSession()) { renderLogin(); return; }
    if (!ctx.me) {
      mount(app, loading());
      try { ctx.me = await API.me(); if (!ctx.me) throw new Error("no profile"); await boot(); }
      catch (e) { await API.signOut(); renderLogin(); return; }
    }
    if (!$("#page")) renderShell();
    if (route === "login") { location.hash = "#/home"; return; }
    if (!ctx.me.active) { ctx.title("الحساب موقوف"); mount($("#page"), html`<div class="notice warn"><div class="grow"><h4>حسابك موقوف حالياً</h4><p>تواصل مع إدارة HY CORE على ${n("+963 981 768 529")} لإعادة تفعيله.</p></div></div>`); return; }
    const key = allowed(route) ? route : "home";
    $$("#nav a, #bnav a").forEach((a) => a.classList.toggle("on", a.dataset.r === key || (key === "user" && a.dataset.r === "users") || (key === "receipt" && a.dataset.r === "finance") || (key === "child" && a.dataset.r === "home") || (key === "subject" && a.dataset.r === "subjects")));
    const page = $("#page");
    const my = ++seq;
    mount(page, loading());
    window.scrollTo(0, 0);
    const view = HY.views[`${ctx.me.role}:${key}`] || HY.views[key];
    if (!view) { mount(page, emptyBox("الصفحة غير موجودة")); return; }
    try {
      ctx.alive = () => my === seq;
      await view(page, param, ctx);
    } catch (e) {
      if (my !== seq) return;
      console.error(e);
      mount(page, html`<div class="notice warn"><div class="grow"><h4>تعذّر تحميل الصفحة</h4><p>${errMsg(e)}</p></div><button class="btn ghost sm" id="retry">${icon("refresh", "sm")}إعادة المحاولة</button></div>`);
      $("#retry").onclick = render;
    }
  }
  HY.render = render;

  // ---------- صفحات مشتركة ----------
  HY.views.notifications = async (page) => {
    ctx.title("الإشعارات");
    const list = await API.notifications.list();
    mount(page, html`<div class="page-head"><h2>الإشعارات</h2><span class="spacer"></span>${list.some((x) => !x.read) ? html`<button class="btn ghost sm" id="ra">${icon("check", "sm")}تعليم الكل كمقروء</button>` : ""}</div>
      <div class="card">${list.length ? html`<div class="list">${list.map((x) => html`<a class="item" href="${x.link || "#/home"}" data-id="${x.id}">
        <span class="ico-box ${x.read ? "" : "dark"}">${icon("bell", "sm")}</span>
        <span class="grow"><b>${x.title}</b><span class="desc1">${x.body || ""}</span></span>
        <span class="small mut nowrap">${ago(x.created_at)}</span></a>`)}</div>` : emptyBox("لا توجد إشعارات حالياً", "bell")}</div>`);
    const ra = $("#ra"); if (ra) ra.onclick = async () => { await API.notifications.readAll(); ctx.refreshBell(); render(); };
    $$("[data-id]", page).forEach((a) => a.addEventListener("click", () => { API.notifications.read(a.dataset.id).then(ctx.refreshBell); }));
  };

  HY.views.profile = async (page) => {
    ctx.title("حسابي");
    const me = ctx.me;
    mount(page, html`<div class="card"><div class="row"><span class="avatar lg">${initials(me.full_name)}</span><div><h2>${me.full_name}</h2><p class="mut">${ROLE[me.role]}${me.grades ? html` · ${me.grades.name}` : ""}</p></div></div>
      <dl class="kv mt">
        <dt>اسم المستخدم</dt><dd>${n(me.username)}</dd>
        ${me.phone ? html`<dt>الهاتف</dt><dd>${n(me.phone)}</dd>` : ""}
        ${me.role === "student" ? html`<dt>الاشتراك</dt><dd>${me.access_until ? html`حتى ${HY.fmtDate(me.access_until)}` : "غير مفعّل"}</dd>` : ""}
      </dl></div>
      <div class="card"><h3>تغيير كلمة السر</h3>
        <form id="pf" class="form mt"><div class="grid2">
          <label class="field"><span>كلمة السر الجديدة</span><input class="input" name="p1" type="password" dir="ltr" autocomplete="new-password" minlength="6" required></label>
          <label class="field"><span>أعد كتابتها</span><input class="input" name="p2" type="password" dir="ltr" autocomplete="new-password" required></label>
        </div><div><button class="btn" type="submit">حفظ كلمة السر</button></div></form></div>
      <div class="card"><div class="row between"><div><h3>تثبيت التطبيق</h3><p class="mut small">ثبّت المنصة على شاشتك الرئيسية لتفتحها مثل أي تطبيق.</p></div><button class="btn ghost" id="inst">${icon("upload", "sm")}تثبيت</button></div></div>
      <button class="btn danger" id="lo3">${icon("logout", "sm")}تسجيل الخروج</button>`);
    $("#pf").onsubmit = async (e) => {
      e.preventDefault(); const d = formData(e.target);
      if (d.p1.length < 6) return toast("كلمة السر 6 أحرف على الأقل", true);
      if (d.p1 !== d.p2) return toast("كلمتا السر غير متطابقتين", true);
      try { await API.changePassword(d.p1); toast("تم تغيير كلمة السر"); e.target.reset(); } catch (err) { fail(err); }
    };
    $("#lo3").onclick = logout;
    $("#inst").onclick = async () => {
      if (HY.installPrompt) { HY.installPrompt.prompt(); HY.installPrompt = null; }
      else modal({ title: "تثبيت التطبيق", body: html`<div class="form"><p><b>على آيفون:</b> افتح المنصة من Safari، اضغط زر المشاركة، ثم «إضافة إلى الشاشة الرئيسية».</p><p><b>على أندرويد:</b> من قائمة Chrome (النقاط الثلاث) اختر «تثبيت التطبيق».</p></div>` });
    };
  };

  window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); HY.installPrompt = e; });
  window.addEventListener("hashchange", render);
  if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(() => {});
  document.addEventListener("DOMContentLoaded", render);
})();
