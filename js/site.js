/* HY CORE — الموقع العام: الصفوف، الدروس المجانية، نموذج التسجيل */
(function () {
  "use strict";
  const { html, $, $$, mount, icon, n, toast, modal, formData, emptyBox, dur, errMsg } = HY;
  const API = window.API;
  $("#yr").textContent = new Date().getFullYear();

  async function loadCatalog() {
    let c;
    try { c = await API.catalog(); }
    catch (e) { mount($("#gl"), emptyBox("تعذّر تحميل الصفوف حالياً", "layers")); mount($("#fl"), ""); return; }
    mount($("#gl"), c.grades.map((g) => html`<div class="card"><div class="row"><span class="ico-box dark">${icon("layers", "sm")}</span><div><h3>${g.name}</h3><p class="small mut">${n(g.subjects.length)} مواد · ${n(g.lessons)} درس</p></div></div>
      <p class="small mt desc2">${g.subjects.join("، ")}</p></div>`));
    const sel = $("#rg"); for (const g of c.grades) { const o = document.createElement("option"); o.value = g.id; o.textContent = g.name; sel.appendChild(o); }
    mount($("#fl"), c.free_lessons.length ? c.free_lessons.slice(0, 6).map((l) => html`<button type="button" class="card hov lesson-card" data-l="${l.id}">
      <div class="thumb">${l.thumbnail_url ? html`<img src="${l.thumbnail_url}" alt="" loading="lazy">` : html`<div class="ph">${icon("play")}<span>${l.subject}</span></div>`}${l.duration_sec ? html`<span class="dur">${n(dur(l.duration_sec))}</span>` : ""}</div>
      <div class="body"><span class="small mut">${l.grade} · ${l.subject}</span><h4>${l.title}</h4></div></button>`) : emptyBox("الدروس المجانية تُضاف قريباً", "video"));
    $$("[data-l]").forEach((b) => (b.onclick = () => play(+b.dataset.l, b.querySelector("h4").textContent)));
  }

  async function play(id, title) {
    const m = modal({ title, wide: true, body: html`<div class="player" id="pl"><div class="spin"></div></div><div class="row mt"><a class="btn" href="#register">سجّل لمشاهدة كل الدروس</a></div>` });
    const pl = $("#pl", m.el);
    try {
      const r = await API.video.play(id);
      if (r.demo) { mount(pl, html`<div class="msg">${icon("play", "lg")}<h3 class="on-dark">عرض تجريبي</h3><p>بعد ربط المنصة بخدمة الفيديو يعمل الدرس هنا.</p></div>`); return; }
      const f = document.createElement("iframe"); f.src = r.url; f.allow = "accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture"; f.allowFullscreen = true; f.title = title;
      pl.innerHTML = ""; pl.appendChild(f);
      $$("a[href='#register']", m.el).forEach((a) => (a.onclick = () => m.close()));
    } catch (e) { mount(pl, html`<div class="msg"><p>${errMsg(e)}</p></div>`); }
  }

  const f = $("#rf");
  f.onsubmit = async (e) => {
    e.preventDefault();
    const d = formData(f);
    if (d.student_name.length < 3) return toast("اكتب اسم الطالب الكامل", true);
    if (!/^\+?[0-9]{9,15}$/.test(d.phone.replace(/[\s-]/g, ""))) return toast("رقم الهاتف غير صحيح", true);
    const b = $("button[type=submit]", f); b.disabled = true;
    try {
      const r = await API.register(d);
      mount(f, html`<div class="empty">${icon("check")}<h3>وصلنا طلبك</h3><p>رقم الطلب ${n(r.code)}</p><p class="mut">سنتواصل معك قريباً على الرقم الذي أدخلته.</p></div>`);
    } catch (err) { toast(errMsg(err), true); b.disabled = false; }
  };
  loadCatalog();
})();
