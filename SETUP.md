# منصة HY CORE — دليل التشغيل خطوة بخطوة

> المنصة شغّالة هلأ كنسخة تجريبية (بيانات وهمية بالمتصفح). لتصير حقيقية لازم 3 حسابات: **Supabase** (قاعدة البيانات والدخول)، **Bunny Stream** (الفيديو)، **GitHub Pages** (استضافة الموقع).

## محتوى المجلد

```
web/                    ← هاد اللي بينرفع على GitHub Pages (ريبو عام)
  index.html            الموقع العام للزوار + نموذج التسجيل
  app.html              المنصة (المدير، الموجّه، الأستاذ، الطالب، ولي الأمر)
  js/config.js          ← الملف الوحيد اللي بتعدّله (رابط Supabase والمفتاح المنشور)
  fonts/                ← حط ملفات خط Cairo هون
supabase/               ← لا ترفعه على ريبو عام
  schema.sql            قاعدة البيانات كاملة مع الصلاحيات
  functions/            4 دوال: hy-admin, hy-video, hy-pay, hy-register
```

---

## 1. Supabase — قاعدة البيانات

1. ادخل supabase.com ← **New project**. اختر Region: **Frankfurt (eu-central-1)**، واحفظ كلمة سر قاعدة البيانات بمكان آمن.
2. من القائمة الجانبية: **SQL Editor** ← **New query** ← الصق محتوى `supabase/schema.sql` كامل ← **Run**.
   - لازم يطلع `Success. No rows returned`. الصفوف من الرابع للتاسع وموادها بتنضاف تلقائياً.
3. **Authentication** ← **Sign In / Providers** ← **Email**:
   - شيل الصح عن **Allow new users to sign up** (الحسابات بتنعمل من المنصة بس).
   - شيل الصح عن **Confirm email**.

### إنشاء حساب المدير الأول
1. **Authentication** ← **Users** ← **Add user** ← **Create new user**:
   - Email: `admin@hycore.local`
   - Password: كلمة سر قوية
   - حط صح على **Auto Confirm User**.
2. انسخ الـ **UID** تبع المستخدم الجديد.
3. **SQL Editor** ← شغّل هالسطر (بدّل UID واسمك):
   ```sql
   insert into public.profiles (id, role, full_name, username)
   values ('الصق-UID-هون', 'admin', 'اسمك', 'admin');
   ```
4. بعدها بتدخل للمنصة باسم المستخدم `admin`، وكل باقي الحسابات بتعملها من جوّا المنصة.

---

## 2. Bunny Stream — الفيديو

1. سجّل بـ bunny.net ← **Stream** ← **Add Video Library** ← الاسم `HY CORE` ← Region: أوروبا.
2. افتح المكتبة ← **API**، وانسخ:
   - **Video Library ID** ← `BUNNY_LIBRARY_ID`
   - **API Key** ← `BUNNY_API_KEY`
   - **CDN Hostname** (متل `vz-xxxx.b-cdn.net`) ← `BUNNY_CDN_HOST`
3. **Security**:
   - فعّل **Embed view token authentication** وانسخ **Token Authentication Key** ← `BUNNY_TOKEN_KEY`
   - فعّل **Block direct url file access**.
   - بـ **Allowed Domains** ضيف `hycore.com`.

> التكلفة تقريبية: تخزين ومشاهدة بحدود دولار لكل 100GB. الطالب ما بيقدر يشغّل الفيديو إلا برابط موقّع صالح 4 ساعات، والرابط بيطلع بس إذا اشتراكه فعّال.

---

## 3. الدوال (Edge Functions)

كرّر هالخطوات للأربع دوال: `hy-admin` و`hy-video` و`hy-pay` و`hy-register`.

1. **Edge Functions** ← **Deploy a new function** ← **Via Editor**.
2. **أهم خطوة:** Supabase بيعطي اسم عشوائي (متل `bright-task`). **غيّره للاسم الصحيح قبل Deploy**، لأن الاسم بيصير رابط الدالة للأبد.
3. امسح الكود الموجود، والصق محتوى `supabase/functions/<الاسم>/index.ts` ← **Deploy**.
4. افتح الدالة ← **Details** ← طفّي **Verify JWT** (التحقق موجود داخل الكود).

### الأسرار (Secrets)
**Edge Functions** ← **Secrets** ← أضف:

| الاسم | القيمة |
|---|---|
| `ALLOWED_ORIGINS` | `https://hycore.com,https://www.hycore.com` (وأي رابط GitHub Pages عم تجرّب عليه) |
| `BUNNY_LIBRARY_ID` | من Bunny |
| `BUNNY_API_KEY` | من Bunny |
| `BUNNY_TOKEN_KEY` | من Bunny |
| `BUNNY_CDN_HOST` | من Bunny |
| `RATE_SALT` | أي كلام عشوائي طويل |
| `LOGIN_DOMAIN` | `hycore.local` |
| `SB_SECRET` | المفتاح السري `sb_secret_...` من **Project Settings ← API Keys** (إذا مشروعك بالمفاتيح الجديدة) |

> المفتاح السري بيضل بالـ Secrets بس. ما بينحط بالكود ولا بالريبو ولا بلقطة شاشة.

---

## 4. الخط

نزّل خط Cairo بصيغة woff2 (من gwfh.mranftl.com/fonts/cairo، اختر arabic وlatin والأوزان 400 و700 و900) وحطه بـ `web/fonts/` بهالأسماء:
`Cairo-Regular.woff2` و`Cairo-Bold.woff2` و`Cairo-Black.woff2`.

---

## 5. ربط الواجهة

افتح `web/js/config.js` وعبّي:
```js
supabaseUrl: "https://xxxx.supabase.co",        // Project Settings ← Data API
publishableKey: "sb_publishable_...",           // Project Settings ← API Keys
```
أول ما تعبّيهم، المنصة بتشتغل على البيانات الحقيقية وبتختفي النسخة التجريبية.

---

## 6. النشر على GitHub Pages

1. ريبو جديد **عام** باسم `hycore-site` ← ارفع **محتوى مجلد `web` بس** (مو مجلد supabase).
2. **Settings** ← **Pages** ← Source: **Deploy from a branch** ← `main` / `root` ← Save.
3. **Custom domain**: `hycore.com`، وبالـ DNS عند Dynadot ضيف سجلات GitHub Pages.
4. فعّل **Enforce HTTPS** (إلزامي، بدونه كلمات السر بتنبعت بلا تشفير).
5. ضيف رابط الموقع النهائي على `ALLOWED_ORIGINS` بالخطوة 3.

### بكل تحديث
ارفع رقم النسخة بـ `?v=1` ← `?v=2` بـ `index.html` و`app.html`، وارفع `CACHE` بـ `sw.js` (`hycore-shell-v2`)، وإلا المستخدمين بيضلوا على النسخة القديمة.

---

## 7. جرّب قبل ما تسلّم

- [ ] دخول المدير ← إضافة أستاذ ومواده ← إضافة طالب مع ولي أمر.
- [ ] الأستاذ: إضافة درس ورفع فيديو ← استنى «جاهز» ← نشر.
- [ ] الطالب بلا اشتراك: الدرس بيطلب تجديد الاشتراك.
- [ ] ولي الأمر: دفع برفع وصل ← المدير: «عرض الوصل» ← «تأكيد» ← الطالب صار يشوف الدروس.
- [ ] طباعة وصل الاستلام.
- [ ] نموذج التسجيل بالموقع العام ← بيوصل لطلبات التسجيل ← «تسجيل كطالب».
- [ ] تقرير شهري ← نشر ← بيوصل إشعار لولي الأمر.
- [ ] الموبايل بعرض 390px: كل الصفحات بلا سكرول أفقي.
