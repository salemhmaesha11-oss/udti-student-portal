alter table if exists public."الحضور"
  add column if not exists "الحالة" text default 'غير محدد';

alter table if exists public."الحضور"
  add column if not exists "تفاصيل الغياب" text;

create index if not exists attendance_student_id_idx
  on public."الحضور" ("الرقم الجامعي");

create index if not exists warnings_student_id_idx
  on public."الإنذارات" ("الرقم الجامعي");
