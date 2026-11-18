-- =====================================================================
-- HY CORE — منصة تعليمية
-- قاعدة البيانات الكاملة: الجداول + الصلاحيات (RLS) + الدوال + الإشعارات
-- شغّل هذا الملف مرة واحدة من: Supabase > SQL Editor > New query > Run
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- 1) الجداول
-- ---------------------------------------------------------------------

create table if not exists public.app_settings (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.grades (
  id         bigint generated always as identity primary key,
  name       text not null,
  sort       int  not null default 0,
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.subjects (
  id         bigint generated always as identity primary key,
  grade_id   bigint not null references public.grades(id) on delete cascade,
  name       text not null,
  sort       int  not null default 0,
  active     boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists subjects_grade_idx on public.subjects(grade_id);

create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  role         text not null check (role in ('admin','supervisor','teacher','student','parent')),
  full_name    text not null,
  username     text not null unique,
  phone        text,
  grade_id     bigint references public.grades(id) on delete set null,
  access_until date,
  active       boolean not null default true,
  notes        text,
  created_at   timestamptz not null default now()
);
create index if not exists profiles_role_idx  on public.profiles(role);
create index if not exists profiles_grade_idx on public.profiles(grade_id);

create table if not exists public.teacher_subjects (
  teacher_id uuid   not null references public.profiles(id) on delete cascade,
  subject_id bigint not null references public.subjects(id) on delete cascade,
  primary key (teacher_id, subject_id)
);

create table if not exists public.parent_students (
  parent_id  uuid not null references public.profiles(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  primary key (parent_id, student_id)
);

create table if not exists public.lessons (
  id            bigint generated always as identity primary key,
  subject_id    bigint not null references public.subjects(id) on delete cascade,
  title         text not null,
  description   text,
  video_id      text,
  video_status  text not null default 'none'
                check (video_status in ('none','uploading','processing','ready','failed')),
  duration_sec  int,
  thumbnail_url text,
  sort          int not null default 0,
  published     boolean not null default false,
  is_free       boolean not null default false,
  created_by    uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists lessons_subject_idx on public.lessons(subject_id);

create table if not exists public.lesson_progress (
  student_id      uuid   not null references public.profiles(id) on delete cascade,
  lesson_id       bigint not null references public.lessons(id)  on delete cascade,
  views           int not null default 1,
  completed       boolean not null default false,
  first_viewed_at timestamptz not null default now(),
  last_viewed_at  timestamptz not null default now(),
  completed_at    timestamptz,
  primary key (student_id, lesson_id)
);

create table if not exists public.homework (
  id         bigint generated always as identity primary key,
  subject_id bigint not null references public.subjects(id) on delete cascade,
  lesson_id  bigint references public.lessons(id) on delete set null,
  title      text not null,
  details    text,
  due_date   date,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists homework_subject_idx on public.homework(subject_id);

create table if not exists public.attendance (
  id          bigint generated always as identity primary key,
  student_id  uuid not null references public.profiles(id) on delete cascade,
  day         date not null,
  status      text not null check (status in ('present','absent','late','excused')),
  note        text,
  recorded_by uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  unique (student_id, day)
);

create table if not exists public.reports (
  id              bigint generated always as identity primary key,
  student_id      uuid not null references public.profiles(id) on delete cascade,
  month           date not null,
  ratings         jsonb not null default '[]'::jsonb,
  attendance_rate int,
  homework_rate   int check (homework_rate between 0 and 100),
  teacher_note    text,
  published       boolean not null default false,
  created_by      uuid references public.profiles(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (student_id, month)
);

create sequence if not exists public.receipt_seq start 1;

create table if not exists public.payments (
  id            bigint generated always as identity primary key,
  ref           text not null unique,
  receipt_no    text unique,
  student_id    uuid not null references public.profiles(id) on delete restrict,
  months        int  not null check (months between 1 and 24),
  amount_usd    numeric(10,2) not null check (amount_usd >= 0),
  usd_syp       numeric(14,2),
  amount_syp    numeric(16,0),
  period_from   date,
  period_to     date,
  method        text not null,
  payer_name    text,
  note          text,
  status        text not null default 'pending'
                check (status in ('pending','confirmed','rejected','cancelled')),
  receipt_path  text,
  submitted_by  uuid references public.profiles(id) on delete set null,
  confirmed_by  uuid references public.profiles(id) on delete set null,
  confirmed_at  timestamptz,
  cancel_reason text,
  created_at    timestamptz not null default now()
);
create index if not exists payments_student_idx on public.payments(student_id);
create index if not exists payments_status_idx  on public.payments(status);

create table if not exists public.registration_requests (
  id           bigint generated always as identity primary key,
  code         text not null unique,
  student_name text not null,
  parent_name  text,
  phone        text not null,
  grade_id     bigint references public.grades(id) on delete set null,
  notes        text,
  status       text not null default 'new'
               check (status in ('new','contacted','converted','rejected')),
  student_id   uuid references public.profiles(id) on delete set null,
  handled_by   uuid references public.profiles(id) on delete set null,
  ip_hash      text,
  created_at   timestamptz not null default now()
);

create table if not exists public.announcements (
  id         bigint generated always as identity primary key,
  title      text not null,
  body       text,
  audience   text not null default 'all'
             check (audience in ('all','students','parents','teachers','staff')),
  grade_id   bigint references public.grades(id) on delete cascade,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  title      text not null,
  body       text,
  link       text,
  read       boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_idx on public.notifications(user_id, read, created_at desc);

create table if not exists public.activity_log (
  id         bigint generated always as identity primary key,
  actor      uuid references public.profiles(id) on delete set null,
  action     text not null,
  entity     text not null,
  details    text,
  created_at timestamptz not null default now()
);

create table if not exists public.rate_limits (
  key        text not null,
  created_at timestamptz not null default now()
);
create index if not exists rate_limits_idx on public.rate_limits(key, created_at);

-- ---------------------------------------------------------------------
-- 2) دوال مساعدة للصلاحيات
-- ---------------------------------------------------------------------

create or replace function public.my_role() returns text
language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid() and active
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select role = 'admin' from profiles where id = auth.uid() and active), false)
$$;

create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select role in ('admin','supervisor') from profiles where id = auth.uid() and active), false)
$$;

create or replace function public.teaches_subject(p_subject bigint) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from teacher_subjects ts join profiles p on p.id = ts.teacher_id
    where ts.teacher_id = auth.uid() and ts.subject_id = p_subject and p.active)
$$;

create or replace function public.teacher_grade_ids() returns setof bigint
language sql stable security definer set search_path = public as $$
  select distinct s.grade_id from teacher_subjects ts
  join subjects s on s.id = ts.subject_id
  join profiles p on p.id = ts.teacher_id
  where ts.teacher_id = auth.uid() and p.active
$$;

create or replace function public.is_parent_of(p_student uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from parent_students ps join profiles p on p.id = ps.parent_id
                 where ps.parent_id = auth.uid() and ps.student_id = p_student and p.active)
$$;

create or replace function public.can_see_student(p_student uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_staff()
      or p_student = auth.uid()
      or public.is_parent_of(p_student)
      or exists (select 1 from profiles st
                 where st.id = p_student and st.role = 'student'
                   and st.grade_id in (select public.teacher_grade_ids()))
$$;

-- هل يرى المستخدم الحالي محتوى صف معيّن (دروس، وظائف)؟
create or replace function public.can_see_grade(p_grade bigint) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_staff()
      or p_grade in (select public.teacher_grade_ids())
      or exists (select 1 from profiles where id = auth.uid() and active and role = 'student' and grade_id = p_grade)
      or exists (select 1 from parent_students ps join profiles st on st.id = ps.student_id
                 join profiles me on me.id = ps.parent_id
                 where ps.parent_id = auth.uid() and me.active and st.grade_id = p_grade)
$$;

create or replace function public.subject_grade(p_subject bigint) returns bigint
language sql stable security definer set search_path = public as $$
  select grade_id from subjects where id = p_subject
$$;

-- هل اشتراك الطالب فعّال؟
create or replace function public.student_has_access(p_student uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select active and role = 'student' and access_until is not null and access_until >= current_date
                   from profiles where id = p_student), false)
$$;

-- ---------------------------------------------------------------------
-- 3) تفعيل RLS وكتابة السياسات
-- ---------------------------------------------------------------------

alter table public.app_settings          enable row level security;
alter table public.grades                enable row level security;
alter table public.subjects              enable row level security;
alter table public.profiles              enable row level security;
alter table public.teacher_subjects      enable row level security;
alter table public.parent_students       enable row level security;
alter table public.lessons               enable row level security;
alter table public.lesson_progress       enable row level security;
alter table public.homework              enable row level security;
alter table public.attendance            enable row level security;
alter table public.reports               enable row level security;
alter table public.payments              enable row level security;
alter table public.registration_requests enable row level security;
alter table public.announcements         enable row level security;
alter table public.notifications         enable row level security;
alter table public.activity_log          enable row level security;
alter table public.rate_limits           enable row level security;

-- الإعدادات: الكل يقرأ، المدير يعدّل
create policy settings_read  on public.app_settings for select to authenticated using (true);
create policy settings_admin on public.app_settings for all    to authenticated using (public.is_admin()) with check (public.is_admin());

-- الصفوف والمواد
create policy grades_read   on public.grades   for select to authenticated using (true);
create policy grades_staff  on public.grades   for all    to authenticated using (public.is_staff()) with check (public.is_staff());
create policy subjects_read on public.subjects for select to authenticated using (true);
create policy subjects_staff on public.subjects for all   to authenticated using (public.is_staff()) with check (public.is_staff());

-- الملفات الشخصية
create policy profiles_read on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_staff()
         or (role = 'student' and public.can_see_student(id))
         or (role = 'teacher')  -- أسماء الأساتذة ظاهرة للكل داخل المنصة
         or (role = 'parent' and exists (select 1 from parent_students ps where ps.parent_id = profiles.id and public.can_see_student(ps.student_id))));
create policy profiles_staff_update on public.profiles for update to authenticated
  using (public.is_staff()) with check (public.is_staff());
create policy profiles_admin_delete on public.profiles for delete to authenticated using (public.is_admin());

-- منع المشرف من رفع الصلاحيات أو تعديل الاشتراكات (المدير فقط)
create or replace function public.guard_profile_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return new; end if;            -- service_role
  if not public.is_admin() then
    if new.role is distinct from old.role then
      raise exception 'تغيير الدور مسموح للمدير فقط';
    end if;
    if new.access_until is distinct from old.access_until then
      raise exception 'تعديل الاشتراك مسموح للمدير فقط';
    end if;
    if old.role in ('admin','supervisor') then
      raise exception 'لا يمكنك تعديل حساب إداري';
    end if;
  end if;
  if new.username is distinct from old.username then
    raise exception 'اسم المستخدم لا يتغيّر بعد الإنشاء';
  end if;
  return new;
end $$;
drop trigger if exists profiles_guard on public.profiles;
create trigger profiles_guard before update on public.profiles
  for each row execute function public.guard_profile_update();

-- الأساتذة والمواد
create policy ts_read  on public.teacher_subjects for select to authenticated using (true);
create policy ts_staff on public.teacher_subjects for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- الأهل والأبناء
create policy ps_read  on public.parent_students for select to authenticated
  using (public.is_staff() or parent_id = auth.uid() or student_id = auth.uid());
create policy ps_staff on public.parent_students for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- الدروس
create policy lessons_read on public.lessons for select to authenticated
  using (public.is_staff() or public.teaches_subject(subject_id)
         or (published and public.can_see_grade(public.subject_grade(subject_id))));
create policy lessons_insert on public.lessons for insert to authenticated
  with check (public.is_staff() or public.teaches_subject(subject_id));
create policy lessons_update on public.lessons for update to authenticated
  using (public.is_staff() or public.teaches_subject(subject_id))
  with check (public.is_staff() or public.teaches_subject(subject_id));
create policy lessons_delete on public.lessons for delete to authenticated
  using (public.is_staff() or public.teaches_subject(subject_id));

-- تقدّم المشاهدة (الكتابة عبر الدالة mark_progress فقط)
create policy progress_read on public.lesson_progress for select to authenticated
  using (public.can_see_student(student_id));

-- الوظائف
create policy homework_read on public.homework for select to authenticated
  using (public.can_see_grade(public.subject_grade(subject_id)));
create policy homework_write on public.homework for all to authenticated
  using (public.is_staff() or public.teaches_subject(subject_id))
  with check (public.is_staff() or public.teaches_subject(subject_id));

-- الحضور
create policy attendance_read on public.attendance for select to authenticated
  using (public.can_see_student(student_id));
create policy attendance_write on public.attendance for all to authenticated
  using (public.is_staff() or (public.my_role() = 'teacher' and public.can_see_student(student_id)))
  with check (public.is_staff() or (public.my_role() = 'teacher' and public.can_see_student(student_id)));

-- التقارير الشهرية
create policy reports_read on public.reports for select to authenticated
  using (public.is_staff()
         or (public.my_role() = 'teacher' and public.can_see_student(student_id))
         or (published and (student_id = auth.uid() or public.is_parent_of(student_id))));
create policy reports_write on public.reports for all to authenticated
  using (public.is_staff() or (public.my_role() = 'teacher' and public.can_see_student(student_id)))
  with check (public.is_staff() or (public.my_role() = 'teacher' and public.can_see_student(student_id)));

-- الدفعات: القراءة فقط، والكتابة عبر الدوال
create policy payments_read on public.payments for select to authenticated
  using (public.is_admin() or student_id = auth.uid() or public.is_parent_of(student_id));

-- طلبات التسجيل
create policy reg_staff on public.registration_requests for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

-- الإعلانات
create policy ann_read on public.announcements for select to authenticated
  using (public.is_staff()
         or ((audience = 'all'
              or (audience = 'students' and public.my_role() = 'student')
              or (audience = 'parents'  and public.my_role() = 'parent')
              or (audience = 'teachers' and public.my_role() = 'teacher'))
             and (grade_id is null or public.can_see_grade(grade_id))));
create policy ann_staff on public.announcements for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

-- الإشعارات: كل واحد إشعاراته
create policy notif_read   on public.notifications for select to authenticated using (user_id = auth.uid());
create policy notif_update on public.notifications for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy notif_delete on public.notifications for delete to authenticated using (user_id = auth.uid());

-- سجل النشاط: المدير فقط
create policy log_admin on public.activity_log for select to authenticated using (public.is_admin());

-- rate_limits: بلا أي سياسة (للخادم فقط)

-- ---------------------------------------------------------------------
-- 4) دوال العمل (RPC)
-- ---------------------------------------------------------------------

create or replace function public.setting(p_key text) returns jsonb
language sql stable security definer set search_path = public as $$
  select value from app_settings where key = p_key
$$;

-- سعر الاشتراك لعدد أشهر (يُحسب في الخادم دائماً)
create or replace function public.price_for(p_months int) returns numeric
language plpgsql stable security definer set search_path = public as $$
declare v jsonb := public.setting('pricing'); monthly numeric; disc numeric;
begin
  if p_months is null or p_months < 1 or p_months > 24 then
    raise exception 'مدة غير صحيحة';
  end if;
  monthly := coalesce((v->>'monthly_usd')::numeric, 0);
  disc    := coalesce((v->'discounts'->>p_months::text)::numeric, 0);
  return round(monthly * p_months * (100 - disc) / 100, 2);
end $$;

create or replace function public.new_ref(p_prefix text) returns text
language sql volatile as $$
  select p_prefix || '-' || to_char(now() at time zone 'Asia/Damascus', 'YYMMDD') || '-'
         || upper(substr(encode(gen_random_bytes(3), 'hex'), 1, 4))
$$;

create or replace function public.notify(p_user uuid, p_title text, p_body text, p_link text) returns void
language sql security definer set search_path = public as $$
  insert into notifications(user_id, title, body, link) values (p_user, p_title, p_body, p_link)
$$;

create or replace function public.log_activity(p_action text, p_entity text, p_details text) returns void
language sql security definer set search_path = public as $$
  insert into activity_log(actor, action, entity, details) values (auth.uid(), p_action, p_entity, p_details)
$$;

-- يعيد حساب تاريخ انتهاء الاشتراك من الدفعات المؤكدة
create or replace function public.recalc_access(p_student uuid) returns date
language plpgsql security definer set search_path = public as $$
declare d date;
begin
  select max(period_to) into d from payments where student_id = p_student and status = 'confirmed';
  update profiles set access_until = d where id = p_student;
  return d;
end $$;

-- يثبّت الدفعة: يحسب المدة ويعطي رقم وصل رسمي ويمدّد الاشتراك
create or replace function public.apply_payment(p_id bigint, p_from date) returns payments
language plpgsql security definer set search_path = public as $$
declare p payments; cur date; f date; rate numeric;
begin
  select * into p from payments where id = p_id for update;
  select access_until into cur from profiles where id = p.student_id;
  f := coalesce(p_from, greatest(coalesce(cur + 1, current_date), current_date));
  rate := nullif((public.setting('usd_syp')->>'rate')::numeric, 0);
  update payments set
    status       = 'confirmed',
    period_from  = f,
    period_to    = (f + make_interval(months => p.months) - interval '1 day')::date,
    receipt_no   = coalesce(receipt_no, 'HY-' || lpad(nextval('receipt_seq')::text, 6, '0')),
    usd_syp      = coalesce(usd_syp, rate),
    amount_syp   = coalesce(amount_syp, round(p.amount_usd * rate)),
    confirmed_by = auth.uid(),
    confirmed_at = now()
  where id = p_id returning * into p;
  perform public.recalc_access(p.student_id);
  return p;
end $$;

-- دفعة نقدية يسجّلها المدير مباشرة (مؤكدة فوراً)
create or replace function public.record_payment(p_student uuid, p_months int, p_amount numeric,
  p_method text, p_payer text, p_note text, p_from date default null) returns payments
language plpgsql security definer set search_path = public as $$
declare p payments;
begin
  if not public.is_admin() then raise exception 'هذه العملية للمدير فقط'; end if;
  if not exists (select 1 from profiles where id = p_student and role = 'student') then
    raise exception 'الطالب غير موجود';
  end if;
  insert into payments(ref, student_id, months, amount_usd, method, payer_name, note, status, submitted_by)
  values (public.new_ref('PY'), p_student, p_months, coalesce(p_amount, public.price_for(p_months)),
          coalesce(nullif(p_method,''), 'cash'), p_payer, p_note, 'pending', auth.uid())
  returning * into p;
  return public.apply_payment(p.id, p_from);
end $$;

create or replace function public.confirm_payment(p_id bigint, p_from date default null) returns payments
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'هذه العملية للمدير فقط'; end if;
  if not exists (select 1 from payments where id = p_id and status = 'pending') then
    raise exception 'الدفعة ليست بانتظار التأكيد';
  end if;
  return public.apply_payment(p_id, p_from);
end $$;

create or replace function public.reject_payment(p_id bigint, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'هذه العملية للمدير فقط'; end if;
  update payments set status = 'rejected', cancel_reason = p_reason
  where id = p_id and status = 'pending';
  if not found then raise exception 'الدفعة ليست بانتظار التأكيد'; end if;
end $$;

-- الوصل الرسمي لا يُحذف، يُلغى مع ذكر السبب
create or replace function public.cancel_payment(p_id bigint, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare s uuid;
begin
  if not public.is_admin() then raise exception 'هذه العملية للمدير فقط'; end if;
  if coalesce(trim(p_reason), '') = '' then raise exception 'اكتب سبب الإلغاء'; end if;
  update payments set status = 'cancelled', cancel_reason = p_reason
  where id = p_id and status = 'confirmed' returning student_id into s;
  if s is null then raise exception 'لا يمكن إلغاء هذه الدفعة'; end if;
  perform public.recalc_access(s);
end $$;

-- تسجيل مشاهدة درس أو إتمامه (للطالب فقط)
create or replace function public.mark_progress(p_lesson bigint, p_completed boolean default false) returns void
language plpgsql security definer set search_path = public as $$
begin
  if public.my_role() is distinct from 'student' then return; end if;
  if not exists (select 1 from lessons l join subjects s on s.id = l.subject_id
                 join profiles me on me.id = auth.uid()
                 where l.id = p_lesson and l.published and s.grade_id = me.grade_id) then
    raise exception 'الدرس غير متاح';
  end if;
  insert into lesson_progress(student_id, lesson_id, completed, completed_at)
  values (auth.uid(), p_lesson, p_completed, case when p_completed then now() end)
  on conflict (student_id, lesson_id) do update set
    views          = lesson_progress.views + case when p_completed then 0 else 1 end,
    last_viewed_at = now(),
    completed      = lesson_progress.completed or excluded.completed,
    completed_at   = coalesce(lesson_progress.completed_at, excluded.completed_at);
end $$;

-- أرقام لوحة التحكم
create or replace function public.dashboard_stats() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare r jsonb;
begin
  if not public.is_staff() then raise exception 'غير مسموح'; end if;
  select jsonb_build_object(
    'students',        (select count(*) from profiles where role = 'student' and active),
    'active_subs',     (select count(*) from profiles where role = 'student' and active and access_until >= current_date),
    'expiring',        (select count(*) from profiles where role = 'student' and active and access_until between current_date and current_date + 7),
    'teachers',        (select count(*) from profiles where role = 'teacher' and active),
    'parents',         (select count(*) from profiles where role = 'parent' and active),
    'lessons',         (select count(*) from lessons),
    'lessons_ready',   (select count(*) from lessons where published and video_status = 'ready'),
    'new_requests',    (select count(*) from registration_requests where status = 'new'),
    'pending_payments', case when public.is_admin() then (select count(*) from payments where status = 'pending') end,
    'month_income_usd', case when public.is_admin() then (select coalesce(sum(amount_usd),0) from payments
                          where status = 'confirmed' and confirmed_at >= date_trunc('month', now())) end,
    'views_week',      (select count(*) from lesson_progress where last_viewed_at >= now() - interval '7 days')
  ) into r;
  return r;
end $$;

-- كتالوج عام للزوار (الصفحة الرئيسية): الصفوف والمواد والدروس المجانية والأسعار
create or replace function public.public_catalog() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'grades', coalesce((select jsonb_agg(jsonb_build_object(
                 'id', g.id, 'name', g.name,
                 'subjects', coalesce((select jsonb_agg(s.name order by s.sort, s.id) from subjects s where s.grade_id = g.id and s.active), '[]'::jsonb),
                 'lessons', (select count(*) from lessons l join subjects s on s.id = l.subject_id where s.grade_id = g.id and l.published))
               order by g.sort, g.id) from grades g where g.active), '[]'::jsonb),
    'free_lessons', coalesce((select jsonb_agg(jsonb_build_object(
                 'id', l.id, 'title', l.title, 'subject', s.name, 'grade', g.name,
                 'thumbnail_url', l.thumbnail_url, 'duration_sec', l.duration_sec) order by l.created_at desc)
               from lessons l join subjects s on s.id = l.subject_id join grades g on g.id = s.grade_id
               where l.published and l.is_free and l.video_status = 'ready'), '[]'::jsonb),
    'pricing', public.setting('pricing'),
    'academy', public.setting('academy')
  )
$$;

-- ---------------------------------------------------------------------
-- 5) الإشعارات التلقائية وسجل النشاط (Triggers)
-- ---------------------------------------------------------------------

create or replace function public.trg_lesson_published() returns trigger
language plpgsql security definer set search_path = public as $$
declare g bigint; sname text; u record;
begin
  new.updated_at := now();
  if new.published and (tg_op = 'INSERT' or not old.published) then
    select s.grade_id, s.name into g, sname from subjects s where s.id = new.subject_id;
    for u in select id from profiles where role = 'student' and active and grade_id = g loop
      perform public.notify(u.id, 'درس جديد: ' || sname, new.title, '#/lesson/' || new.id);
    end loop;
  end if;
  return new;
end $$;
drop trigger if exists lessons_publish on public.lessons;
create trigger lessons_publish before insert or update on public.lessons
  for each row execute function public.trg_lesson_published();

create or replace function public.trg_homework_new() returns trigger
language plpgsql security definer set search_path = public as $$
declare g bigint; sname text; u record;
begin
  select s.grade_id, s.name into g, sname from subjects s where s.id = new.subject_id;
  for u in select id from profiles where role = 'student' and active and grade_id = g loop
    perform public.notify(u.id, 'وظيفة جديدة: ' || sname, new.title, '#/homework');
  end loop;
  return new;
end $$;
drop trigger if exists homework_new on public.homework;
create trigger homework_new after insert on public.homework
  for each row execute function public.trg_homework_new();

create or replace function public.trg_payment_events() returns trigger
language plpgsql security definer set search_path = public as $$
declare sname text; u record;
begin
  select full_name into sname from profiles where id = new.student_id;
  if tg_op = 'INSERT' and new.status = 'pending' and new.submitted_by is distinct from (select id from profiles where id = auth.uid() and role = 'admin') then
    for u in select id from profiles where role = 'admin' and active loop
      perform public.notify(u.id, 'دفعة بانتظار التأكيد',
        sname || ' · ' || new.months || ' شهر · $' || new.amount_usd, '#/finance');
    end loop;
  end if;
  if new.status = 'confirmed' and (tg_op = 'INSERT' or old.status <> 'confirmed') then
    perform public.notify(new.student_id, 'تم تأكيد الاشتراك',
      'اشتراكك فعّال حتى ' || to_char(new.period_to, 'YYYY-MM-DD'), '#/subscription');
    for u in select parent_id as id from parent_students where student_id = new.student_id loop
      perform public.notify(u.id, 'تم تأكيد اشتراك ' || sname,
        'فعّال حتى ' || to_char(new.period_to, 'YYYY-MM-DD'), '#/subscription');
    end loop;
  end if;
  if new.status = 'rejected' and tg_op = 'UPDATE' and old.status = 'pending' then
    perform public.notify(coalesce(new.submitted_by, new.student_id), 'لم يتم قبول الدفعة',
      coalesce(new.cancel_reason, 'تواصل مع الإدارة'), '#/subscription');
  end if;
  perform public.log_activity(lower(tg_op) || ':' || new.status, 'payment',
    coalesce(new.receipt_no, new.ref) || ' · ' || sname || ' · $' || new.amount_usd);
  return new;
end $$;
drop trigger if exists payments_events on public.payments;
create trigger payments_events after insert or update on public.payments
  for each row execute function public.trg_payment_events();

create or replace function public.trg_report_published() returns trigger
language plpgsql security definer set search_path = public as $$
declare sname text; u record; m text;
begin
  new.updated_at := now();
  if new.published and (tg_op = 'INSERT' or not old.published) then
    select full_name into sname from profiles where id = new.student_id;
    m := to_char(new.month, 'YYYY-MM');
    perform public.notify(new.student_id, 'تقرير المتابعة الشهري', 'تقرير شهر ' || m || ' جاهز', '#/reports');
    for u in select parent_id as id from parent_students where student_id = new.student_id loop
      perform public.notify(u.id, 'تقرير ' || sname, 'تقرير شهر ' || m || ' جاهز', '#/child/' || new.student_id);
    end loop;
  end if;
  return new;
end $$;
drop trigger if exists reports_publish on public.reports;
create trigger reports_publish before insert or update on public.reports
  for each row execute function public.trg_report_published();

create or replace function public.trg_registration_new() returns trigger
language plpgsql security definer set search_path = public as $$
declare u record;
begin
  for u in select id from profiles where role in ('admin','supervisor') and active loop
    perform public.notify(u.id, 'طلب تسجيل جديد', new.student_name || ' · ' || new.phone, '#/requests');
  end loop;
  return new;
end $$;
drop trigger if exists registration_new on public.registration_requests;
create trigger registration_new after insert on public.registration_requests
  for each row execute function public.trg_registration_new();

create or replace function public.trg_announcement_new() returns trigger
language plpgsql security definer set search_path = public as $$
declare u record;
begin
  for u in select p.id from profiles p where p.active and p.id <> coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid)
    and (new.audience = 'all'
      or (new.audience = 'students' and p.role = 'student')
      or (new.audience = 'parents'  and p.role = 'parent')
      or (new.audience = 'teachers' and p.role = 'teacher')
      or (new.audience = 'staff'    and p.role in ('admin','supervisor')))
    and (new.grade_id is null
      or (p.role = 'student' and p.grade_id = new.grade_id)
      or (p.role = 'parent' and exists (select 1 from parent_students ps join profiles st on st.id = ps.student_id
                                        where ps.parent_id = p.id and st.grade_id = new.grade_id))
      or p.role in ('admin','supervisor','teacher'))
  loop
    perform public.notify(u.id, new.title, left(coalesce(new.body, ''), 140), '#/home');
  end loop;
  return new;
end $$;
drop trigger if exists announcements_new on public.announcements;
create trigger announcements_new after insert on public.announcements
  for each row execute function public.trg_announcement_new();

-- سجل نشاط عام
create or replace function public.trg_log() returns trigger
language plpgsql security definer set search_path = public as $$
declare label text; r jsonb;
begin
  r := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  label := case tg_table_name
    when 'lessons'  then r->>'title'
    when 'grades'   then r->>'name'
    when 'subjects' then r->>'name'
    when 'profiles' then (r->>'full_name') || ' (' || (r->>'role') || ')'
    when 'registration_requests' then (r->>'student_name') || ' · ' || (r->>'status')
    else '' end;
  perform public.log_activity(lower(tg_op), tg_table_name, label);
  return coalesce(new, old);
end $$;

do $$ declare t text; begin
  foreach t in array array['lessons','grades','subjects','profiles','registration_requests'] loop
    execute format('drop trigger if exists %I_log on public.%I', t, t);
    execute format('create trigger %I_log after insert or update or delete on public.%I for each row execute function public.trg_log()', t, t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 6) الصلاحيات على مستوى قاعدة البيانات
-- ---------------------------------------------------------------------

revoke all on all tables    in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke execute on all functions in schema public from public, anon;

grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage on all sequences in schema public to authenticated;
grant execute on all functions in schema public to authenticated;
-- دوال داخلية لا يستدعيها المستخدم مباشرة
revoke execute on function public.apply_payment(bigint, date)  from authenticated;
revoke execute on function public.recalc_access(uuid)          from authenticated;
revoke execute on function public.notify(uuid, text, text, text) from authenticated;
revoke execute on function public.log_activity(text, text, text) from authenticated;

grant execute on function public.public_catalog() to anon;

grant all on all tables    in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;

-- ---------------------------------------------------------------------
-- 7) التخزين: مجلد خاص للوصولات (المدير فقط عبر رابط مؤقت)
-- ---------------------------------------------------------------------

do $$ begin
  if exists (select 1 from information_schema.tables where table_schema = 'storage' and table_name = 'buckets') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('receipts', 'receipts', false, 5242880, array['image/jpeg','image/png','image/webp','application/pdf'])
    on conflict (id) do nothing;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 8) بيانات البداية
-- ---------------------------------------------------------------------

insert into public.app_settings(key, value) values
  ('academy', '{"name":"HY CORE TEAM","phone":"+963 981 768 529","whatsapp":"963981768529","instagram":"hycore.team","address":"دمشق — الميدان — الكورنيش","tagline":"صدّقني، رح ترتقي فيك"}'),
  ('usd_syp', '{"rate":null}'),
  ('pricing', '{"monthly_usd":20,"discounts":{"1":0,"3":5,"6":10,"12":15}}'),
  ('payment_methods', '[
     {"key":"cash","name":"نقداً في المعهد","needs_receipt":false,"details":[{"label":"العنوان","value":"دمشق — الميدان — الكورنيش"}]},
     {"key":"shamcash","name":"شام كاش","needs_receipt":true,"details":[{"label":"رمز الحساب","value":"اكتب الرمز من الإعدادات"},{"label":"اسم المستفيد","value":"HY CORE TEAM"}]},
     {"key":"haram","name":"الهرم للحوالات","needs_receipt":true,"details":[{"label":"اسم المستلم","value":"اكتب الاسم من الإعدادات"},{"label":"المدينة","value":"دمشق"}]},
     {"key":"fouad","name":"الفؤاد للحوالات","needs_receipt":true,"details":[{"label":"اسم المستلم","value":"اكتب الاسم من الإعدادات"},{"label":"المدينة","value":"دمشق"}]}
   ]')
on conflict (key) do nothing;

do $$
declare g bigint; n text; i int := 0; subj text[];
begin
  if exists (select 1 from public.grades) then return; end if;
  foreach n in array array['الصف الرابع','الصف الخامس','الصف السادس','الصف السابع','الصف الثامن','الصف التاسع'] loop
    i := i + 1;
    insert into public.grades(name, sort) values (n, i) returning id into g;
    if i <= 3 then subj := array['الرياضيات','العلوم','اللغة العربية','اللغة الإنكليزية'];
    else subj := array['الرياضيات','الفيزياء والكيمياء','العلوم','اللغة العربية','اللغة الإنكليزية']; end if;
    insert into public.subjects(grade_id, name, sort) select g, s, ord from unnest(subj) with ordinality as t(s, ord);
  end loop;
end $$;
