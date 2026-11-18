/* HY CORE — أدوات مشتركة */
(function () {
  "use strict";
  const HY = (window.HY = window.HY || {});

  // ---------- قوالب HTML آمنة ----------
  class Safe { constructor(s) { this.s = s; } toString() { return this.s; } }
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const raw = (s) => new Safe(String(s ?? ""));
  const val = (v) => (v instanceof Safe ? v.s : Array.isArray(v) ? v.map(val).join("") : v === false || v == null ? "" : esc(v));
  function html(strings, ...vals) {
    let out = strings[0];
    vals.forEach((v, i) => { out += val(v) + strings[i + 1]; });
    return new Safe(out);
  }
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  function mount(el, content) { el.innerHTML = val(content); return el; }
  function on(root, sel, ev, fn) {
    root.addEventListener(ev, (e) => {
      const t = e.target.closest(sel);
      if (t && root.contains(t)) fn(e, t);
    });
  }

  // ---------- الأيقونات (خط 2px، أطراف مدوّرة) ----------
  const P = {
    home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M10 21v-6h4v6"/>',
    book: '<path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H20v15H5.5A1.5 1.5 0 0 0 4 19.5v-15Z"/><path d="M4 19.5A1.5 1.5 0 0 0 5.5 21H20"/><path d="M9 7h7"/>',
    video: '<rect x="3" y="5" width="13" height="14" rx="2"/><path d="m16 10 5-3v10l-5-3"/>',
    play: '<path d="M7 4.5v15l12-7.5-12-7.5Z"/>',
    upload: '<path d="M12 16V4"/><path d="m7 9 5-5 5 5"/><path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8"/><path d="M18 14a6.5 6.5 0 0 1 3.5 6"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    layers: '<path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 13 9 5 9-5"/>',
    inbox: '<path d="M3 13h5l1.5 3h5L16 13h5"/><path d="M5.5 5h13L21 13v6H3v-6l2.5-8Z"/>',
    wallet: '<rect x="3" y="6" width="18" height="14" rx="2"/><path d="M3 10h18"/><path d="M16 15h2"/><path d="M6 6V4.5h11V6"/>',
    chart: '<path d="M4 20V4"/><path d="M4 20h16"/><path d="M8 16v-5"/><path d="M12 16V8"/><path d="M16 16v-3"/>',
    check2: '<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18"/><path d="M8 2v4M16 2v4"/><path d="m9 15 2 2 4-4"/>',
    report: '<path d="M6 3h9l4 4v14H6V3Z"/><path d="M14 3v5h5"/><path d="M9 13h7M9 17h5"/>',
    task: '<rect x="4" y="4" width="16" height="17" rx="2"/><path d="M9 2.5h6v3H9z"/><path d="m8.5 13 2.5 2.5 4.5-4.5"/>',
    bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4l2-2Z"/><path d="M10 21h4"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>',
    list: '<path d="M9 6h11M9 12h11M9 18h11"/><path d="M4 6h.01M4 12h.01M4 18h.01"/>',
    logout: '<path d="M15 4h4v16h-4"/><path d="M10 16 6 12l4-4"/><path d="M6 12h10"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16v4Z"/><path d="m13.5 6.5 4 4"/>',
    trash: '<path d="M4 7h16"/><path d="M9 7V4h6v3"/><path d="M6 7l1 14h10l1-14"/>',
    eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
    check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
    x: '<path d="M6 6l12 12M18 6 6 18"/>',
    left: '<path d="m15 5-7 7 7 7"/>',
    right: '<path d="m9 5 7 7-7 7"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
    lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
    phone: '<path d="M5 3h4l2 5-2.5 1.5a11 11 0 0 0 6 6L16 13l5 2v4a2 2 0 0 1-2 2A17 17 0 0 1 3 5a2 2 0 0 1 2-2Z"/>',
    chat: '<path d="M4 20l1.5-4A8 8 0 1 1 9 19.5L4 20Z"/>',
    camera: '<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><path d="M17.5 6.5h.01"/>',
    pin: '<path d="M12 21s7-6.2 7-12a7 7 0 0 0-14 0c0 5.8 7 12 7 12Z"/><circle cx="12" cy="9" r="2.5"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    megaphone: '<path d="M3 10v4h4l9 5V5L7 10H3Z"/><path d="M19 9a4 4 0 0 1 0 6"/>',
    receipt: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Z"/><path d="M9 8h6M9 12h6"/>',
    print: '<path d="M7 8V3h10v5"/><rect x="3" y="8" width="18" height="9" rx="2"/><path d="M7 14h10v7H7z"/>',
    key: '<circle cx="8" cy="15" r="4"/><path d="m11 12 9-9"/><path d="m17 6 3 3"/>',
    link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
    refresh: '<path d="M20 11a8 8 0 0 0-14.5-4.5L3 9"/><path d="M3 4v5h5"/><path d="M4 13a8 8 0 0 0 14.5 4.5L21 15"/><path d="M21 20v-5h-5"/>',
    more: '<circle cx="5" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="19" cy="12" r="1.2"/>',
    back: '<path d="M5 12h14"/><path d="m13 6 6 6-6 6"/>',
    star: '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9L12 3Z"/>',
    shield: '<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6l-8-3Z"/><path d="m9 12 2 2 4-4"/>',
    image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 17-5-5-9 8"/>',
    copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
    heart: '<path d="M12 20s-8-4.7-8-10.5A4.5 4.5 0 0 1 12 7a4.5 4.5 0 0 1 8 2.5C20 15.3 12 20 12 20Z"/>',
    spark: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8"/>',
    code: '<path d="m8 8-5 4 5 4"/><path d="m16 8 5 4-5 4"/><path d="m14 4-4 16"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3a14 14 0 0 1 0 18a14 14 0 0 1 0-18"/>',
  };
  const icon = (name, cls = "") => raw(`<svg class="icon ${cls}" viewBox="0 0 24 24" aria-hidden="true">${P[name] || ""}</svg>`);

  // ---------- الأرقام والتواريخ والعملة ----------
  const n = (v) => raw(`<bdi dir="ltr">${esc(v)}</bdi>`);
  const MONTHS = ["كانون الثاني", "شباط", "آذار", "نيسان", "أيار", "حزيران", "تموز", "آب", "أيلول", "تشرين الأول", "تشرين الثاني", "كانون الأول"];
  const DAYS = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
  function toDate(d) { if (!d) return null; if (d instanceof Date) return d; const s = String(d); return new Date(s.length === 10 ? s + "T00:00:00" : s); }
  function fmtDate(d, withDay) {
    const x = toDate(d); if (!x || isNaN(x)) return raw("—");
    return raw(`${withDay ? DAYS[x.getDay()] + " " : ""}<bdi dir="ltr">${x.getDate()}</bdi> ${MONTHS[x.getMonth()]} <bdi dir="ltr">${x.getFullYear()}</bdi>`);
  }
  function fmtMonth(d) { const x = toDate(d); return raw(`${MONTHS[x.getMonth()]} <bdi dir="ltr">${x.getFullYear()}</bdi>`); }
  function fmtTime(d) {
    const x = toDate(d); if (!x) return "";
    return raw(`<bdi dir="ltr">${String(x.getHours()).padStart(2, "0")}:${String(x.getMinutes()).padStart(2, "0")}</bdi>`);
  }
  function ago(d) {
    const s = (Date.now() - toDate(d).getTime()) / 1000;
    if (s < 60) return "الآن";
    if (s < 3600) return raw(`قبل <bdi dir="ltr">${Math.floor(s / 60)}</bdi> د`);
    if (s < 86400) return raw(`قبل <bdi dir="ltr">${Math.floor(s / 3600)}</bdi> س`);
    if (s < 86400 * 7) return raw(`قبل <bdi dir="ltr">${Math.floor(s / 86400)}</bdi> يوم`);
    return fmtDate(d);
  }
  const today = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  const monthStart = (d = today()) => String(d).slice(0, 7) + "-01";
  const fmtNum = (x) => Number(x || 0).toLocaleString("en-US", { maximumFractionDigits: 2 });
  const usd = (x) => n("$" + fmtNum(x));
  function syp(usdAmount, rate) { if (!rate) return ""; return raw(`<bdi dir="ltr">${fmtNum(Math.round(usdAmount * rate))}</bdi> ل.س`); }
  function dur(sec) { if (!sec) return ""; const m = Math.floor(sec / 60), s = Math.round(sec % 60); return `${m}:${String(s).padStart(2, "0")}`; }
  function daysLeft(d) { if (!d) return null; return Math.round((toDate(d) - toDate(today())) / 86400000); }

  // تفقيط: المبلغ كتابةً بالعربية (أعداد صحيحة)
  function tafqit(num) {
    num = Math.floor(Number(num) || 0);
    if (num === 0) return "صفر";
    const ones = ["", "واحد", "اثنان", "ثلاثة", "أربعة", "خمسة", "ستة", "سبعة", "ثمانية", "تسعة", "عشرة", "أحد عشر", "اثنا عشر", "ثلاثة عشر", "أربعة عشر", "خمسة عشر", "ستة عشر", "سبعة عشر", "ثمانية عشر", "تسعة عشر"];
    const tens = ["", "", "عشرون", "ثلاثون", "أربعون", "خمسون", "ستون", "سبعون", "ثمانون", "تسعون"];
    const hundreds = ["", "مئة", "مئتان", "ثلاثمئة", "أربعمئة", "خمسمئة", "ستمئة", "سبعمئة", "ثمانمئة", "تسعمئة"];
    function under1000(x) {
      const h = Math.floor(x / 100), r = x % 100, parts = [];
      if (h) parts.push(hundreds[h]);
      if (r) { if (r < 20) parts.push(ones[r]); else { const o = r % 10, t = Math.floor(r / 10); parts.push(o ? `${ones[o]} و${tens[t]}` : tens[t]); } }
      return parts.join(" و");
    }
    function scale(x, one, two, few, many) {
      if (x === 1) return one; if (x === 2) return two;
      if (x >= 3 && x <= 10) return `${under1000(x)} ${few}`;
      return `${under1000(x)} ${many}`;
    }
    const parts = [];
    const mil = Math.floor(num / 1e6), th = Math.floor((num % 1e6) / 1000), rest = num % 1000;
    if (mil) parts.push(scale(mil, "مليون", "مليونان", "ملايين", "مليون"));
    if (th) parts.push(scale(th, "ألف", "ألفان", "آلاف", "ألف"));
    if (rest) parts.push(under1000(rest));
    return parts.join(" و");
  }

  // ---------- الأسماء ----------
  const ROLE = { admin: "مدير", supervisor: "موجّه", teacher: "أستاذ", student: "طالب", parent: "ولي أمر" };
  const ROLE_PL = { admin: "الإدارة", supervisor: "الموجّهون", teacher: "الأساتذة", student: "الطلاب", parent: "الأهل" };
  const PAY_STATUS = { pending: "بانتظار التأكيد", confirmed: "مؤكدة", rejected: "مرفوضة", cancelled: "ملغاة" };
  const REQ_STATUS = { new: "جديد", contacted: "تم التواصل", converted: "تم التسجيل", rejected: "مرفوض" };
  const ATT = { present: "حاضر", late: "متأخر", excused: "بعذر", absent: "غائب" };
  const LEVELS = ["ممتاز", "جيد جداً", "جيد", "يحتاج متابعة"];
  const VIDEO = { none: "بلا فيديو", uploading: "قيد الرفع", processing: "قيد المعالجة", ready: "جاهز", failed: "فشل" };
  const AUD = { all: "الجميع", students: "الطلاب", parents: "الأهل", teachers: "الأساتذة", staff: "الإدارة" };
  const initials = (name) => String(name || "?").trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join(" ");

  // ---------- الرسائل ----------
  function errMsg(e) {
    const m = (e && (e.message || e.error)) || String(e || "");
    if (/[؀-ۿ]/.test(m)) return m;
    if (/Failed to fetch|NetworkError|Load failed/i.test(m)) return "تعذّر الاتصال بالخادم. تأكد من الإنترنت وحاول مرة ثانية";
    if (/Invalid login/i.test(m)) return "اسم المستخدم أو كلمة السر غير صحيحة";
    if (/JWT|expired|401/i.test(m)) return "انتهت الجلسة، سجّل الدخول من جديد";
    if (/permission|42501|row-level/i.test(m)) return "ليس لديك صلاحية لهذه العملية";
    if (/duplicate|23505/i.test(m)) return "هذه القيمة مستخدمة من قبل";
    if (/23503|foreign key/i.test(m)) return "لا يمكن الحذف لوجود بيانات مرتبطة";
    return "حدث خطأ غير متوقع، حاول مرة ثانية";
  }
  function toast(msg, err) {
    let box = $(".toasts");
    if (!box) { box = document.createElement("div"); box.className = "toasts"; document.body.appendChild(box); }
    const t = document.createElement("div");
    t.className = "toast" + (err ? " err" : "");
    t.setAttribute("role", "status");
    mount(t, html`${icon(err ? "x" : "check", "sm")}<span>${msg}</span>`);
    box.appendChild(t);
    requestAnimationFrame(() => t.classList.add("show"));
    setTimeout(() => { t.classList.remove("show"); setTimeout(() => t.remove(), 500); }, err ? 5000 : 3000);
  }
  const fail = (e) => { console.error(e); toast(errMsg(e), true); };

  // ---------- النوافذ ----------
  function modal({ title, body, actions = [], wide = false, onOpen }) {
    const bg = document.createElement("div");
    bg.className = "modal-bg";
    mount(bg, html`<div class="modal ${wide ? "wide" : ""}" role="dialog" aria-modal="true">
      <header><h3>${title}</h3><button class="x" data-close aria-label="إغلاق">${icon("x")}</button></header>
      <div class="mbody">${body}</div>
      ${actions.length ? html`<footer>${actions.map((a, i) => html`<button class="btn ${a.cls || ""}" data-i="${i}">${a.label}</button>`)}</footer>` : ""}
    </div>`);
    document.body.appendChild(bg);
    requestAnimationFrame(() => bg.classList.add("show"));
    const m = { el: bg, body: $(".mbody", bg), close() { bg.classList.remove("show"); setTimeout(() => bg.remove(), 450); document.removeEventListener("keydown", esc_); } };
    const esc_ = (e) => { if (e.key === "Escape") m.close(); };
    document.addEventListener("keydown", esc_);
    bg.addEventListener("mousedown", (e) => { if (e.target === bg) m.close(); });
    $("[data-close]", bg).onclick = m.close;
    $$("footer [data-i]", bg).forEach((b) => {
      b.onclick = async () => {
        const a = actions[+b.dataset.i];
        if (!a.onClick) return m.close();
        b.disabled = true;
        try { const r = await a.onClick(m); if (r !== false) m.close(); }
        catch (e) { fail(e); }
        finally { b.disabled = false; }
      };
    });
    if (onOpen) onOpen(m);
    const first = $("input,select,textarea", m.body); if (first && window.innerWidth > 900) setTimeout(() => first.focus(), 60);
    return m;
  }
  function confirmBox(title, text, okLabel = "تأكيد", danger = false) {
    return new Promise((resolve) => {
      let done = false;
      const m = modal({
        title, body: html`<p>${text}</p>`,
        actions: [
          { label: okLabel, cls: danger ? "danger" : "", onClick: () => { done = true; resolve(true); } },
          { label: "إلغاء", cls: "ghost" },
        ],
      });
      const obs = new MutationObserver(() => { if (!document.body.contains(m.el)) { obs.disconnect(); if (!done) resolve(false); } });
      obs.observe(document.body, { childList: true });
    });
  }
  function promptBox(title, label, { value = "", type = "text", okLabel = "حفظ", required = true, textarea = false } = {}) {
    return new Promise((resolve) => {
      let done = false;
      const m = modal({
        title,
        body: html`<label class="field"><span>${label}</span>${textarea ? html`<textarea class="input" id="pv">${value}</textarea>` : html`<input class="input" id="pv" type="${type}" value="${value}">`}</label>`,
        actions: [
          { label: okLabel, onClick: () => { const v = $("#pv", m.el).value.trim(); if (required && !v) { toast("هذا الحقل مطلوب", true); return false; } done = true; resolve(v); } },
          { label: "إلغاء", cls: "ghost" },
        ],
      });
      const obs = new MutationObserver(() => { if (!document.body.contains(m.el)) { obs.disconnect(); if (!done) resolve(null); } });
      obs.observe(document.body, { childList: true });
    });
  }

  function formData(form) {
    const o = {};
    $$("[name]", form).forEach((el) => {
      if (el.type === "checkbox") { if (el.dataset.multi) { (o[el.name] = o[el.name] || []); if (el.checked) o[el.name].push(el.value); } else o[el.name] = el.checked; }
      else if (el.type === "radio") { if (el.checked) o[el.name] = el.value; }
      else if (el.type !== "file") o[el.name] = el.value.trim();
    });
    return o;
  }
  const loading = () => html`<div class="loading"><div class="spin" aria-label="جارٍ التحميل"></div></div>`;
  const emptyBox = (text, ic = "inbox") => html`<div class="empty">${icon(ic)}<p>${text}</p></div>`;
  const options = (list, sel, { key = "id", label = "name", blank } = {}) =>
    html`${blank ? html`<option value="">${blank}</option>` : ""}${list.map((x) => html`<option value="${x[key]}" ${String(x[key]) === String(sel ?? "") ? raw("selected") : ""}>${x[label]}</option>`)}`;
  function debounce(fn, ms = 300) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }
  async function copyText(t) { try { await navigator.clipboard.writeText(t); toast("تم النسخ"); } catch { toast("تعذّر النسخ", true); } }

  // يقرأ أول بايتات الملف للتأكد من نوعه الحقيقي
  async function sniffFile(file) {
    const b = new Uint8Array(await file.slice(0, 12).arrayBuffer());
    if (b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46) return "pdf";
    if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "png";
    if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpg";
    if (b[0] === 0x52 && b[1] === 0x49 && b[8] === 0x57 && b[9] === 0x45) return "webp";
    return null;
  }

  Object.assign(HY, {
    esc, raw, html, $, $$, mount, on, icon, n, fmtDate, fmtMonth, fmtTime, ago, today, monthStart, fmtNum, usd, syp, dur, daysLeft, tafqit,
    ROLE, ROLE_PL, PAY_STATUS, REQ_STATUS, ATT, LEVELS, VIDEO, AUD, MONTHS, initials,
    errMsg, toast, fail, modal, confirmBox, promptBox, formData, loading, emptyBox, options, debounce, copyText, sniffFile, toDate,
  });
})();
