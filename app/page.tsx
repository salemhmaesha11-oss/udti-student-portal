import { ArrowLeftRight, Bell, BookOpen, GraduationCap, ShieldCheck, UserCog, Users, CalendarCheck, ChartColumn, KeyRound, QrCode, PencilLine, Download, CheckCircle2, AlertTriangle, ClipboardList, Settings, Search, Plus, Trash2, FileSpreadsheet, BarChart3, Clock3, BadgeCheck } from 'lucide-react';

const student = {
  name: 'أحمد محمد علي',
  id: '202420011',
  major: 'علوم حاسب',
  level: 'السنة الثانية',
  status: 'نشط',
  email: 'student@udti.edu',
  password: '********',
  attendanceRate: 96,
  warnings: 2,
};

const grades = [
  { subject: 'برمجة', score: 90, theory: 44, practical: 46, annual: 90, assistance: 'مقبول', total: 90 },
  { subject: 'قواعد بيانات', score: 88, theory: 43, practical: 45, annual: 88, assistance: 'مقبول', total: 88 },
  { subject: 'شبكات', score: 82, theory: 41, practical: 41, annual: 82, assistance: 'لا', total: 82 },
  { subject: 'ذكاء اصطناعي', score: 91, theory: 45, practical: 46, annual: 91, assistance: 'مقبول', total: 91 },
];

const schedule = [
  { day: 'السبت', items: ['برمجة / 08:00', 'شبكات / 10:00', 'مكتبة / 13:00'] },
  { day: 'الأحد', items: ['قواعد بيانات / 08:30', 'لغة عربية / 11:00'] },
  { day: 'الإثنين', items: ['ذكاء اصطناعي / 09:00', 'دراسة مستقلة / 14:00'] },
  { day: 'الثلاثاء', items: ['مختبر شبكات / 10:00', 'تدريب / 15:00'] },
  { day: 'الأربعاء', items: ['برمجة تطبيقية / 09:00'] },
];

const warnings = [
  { title: 'تأخر 10 دقائق', date: '2026-09-02', severity: 'منخفض' },
  { title: 'عدم حضور محاضرة', date: '2026-09-06', severity: 'متوسط' },
  { title: 'إهمال الواجب', date: '2026-09-11', severity: 'عالي' },
];

const adminMetrics = [
  { label: 'إجمالي الطلاب', value: '1,248', icon: Users },
  { label: 'الغياب اليومي', value: '64', icon: Clock3 },
  { label: 'العلامات المراجعة', value: '89%', icon: CheckCircle2 },
  { label: 'الإنذارات', value: '120', icon: Bell },
];

const attendanceSummary = [
  { label: 'حاضر', value: '184', color: 'bg-emerald-500' },
  { label: 'غائب', value: '18', color: 'bg-red-500' },
  { label: 'منتظر', value: '7', color: 'bg-amber-500' },
];

export default function Home() {
  return (
    <main className="min-h-screen p-4 sm:p-6 lg:p-8" dir="rtl">
      <div className="mx-auto max-w-7xl space-y-8">
        <header className="card overflow-hidden p-6">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-medium text-primary-600">بوابة الطالب</p>
              <h1 className="mt-2 text-3xl font-bold text-slate-900">جامعة دبي التقنية</h1>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button className="rounded-xl bg-primary-600 px-4 py-2 text-sm font-semibold text-white">تسجيل الدخول</button>
              <button className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700">لوحة المشرف</button>
            </div>
          </div>
        </header>

        <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="card p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">مرحباً</p>
                <h2 className="text-2xl font-bold text-slate-900">{student.name}</h2>
              </div>
              <div className="rounded-2xl bg-primary-50 p-3 text-primary-600">
                <GraduationCap className="h-7 w-7" />
              </div>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <InfoTile label="الرقم الجامعي" value={student.id} icon={UserCog} />
              <InfoTile label="التخصص" value={student.major} icon={BookOpen} />
              <InfoTile label="الفصل" value={student.level} icon={CalendarCheck} />
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              <MiniStat label="المعدل الفصلي" value="92.4%" tone="emerald" />
              <MiniStat label="المعدل التراكمي" value="90.8%" tone="blue" />
              <MiniStat label="الحالة الدراسية" value={student.status} tone="purple" />
            </div>
          </div>

          <div className="card p-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">رمز الطالب</h3>
              <QrCode className="h-5 w-5 text-primary-600" />
            </div>
            <div className="mt-6 flex items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 p-6">
              <div className="grid h-44 w-44 place-items-center rounded-2xl bg-white text-center shadow-inner ring-2 ring-slate-200">
                <div className="text-xs font-bold tracking-[0.35em] text-slate-700">{student.id}</div>
                <div className="mt-4 h-16 w-16 rounded-xl bg-slate-900" />
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard title="أعمال السنة" value="94" icon={ChartColumn} accent="emerald" />
          <StatCard title="العملي" value="91" icon={ClipboardList} accent="blue" />
          <StatCard title="النظري" value="87" icon={BookOpen} accent="amber" />
          <StatCard title="المجموع" value="90.8" icon={BadgeCheck} accent="purple" />
        </section>

        <section className="card p-6">
          <div className="mb-5 flex items-center justify-between">
            <h3 className="text-xl font-bold text-slate-900">عرض العلامات الدراسية</h3>
            <span className="badge bg-primary-50 text-primary-700">مساعدة امتحانية: نعم</span>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full table-auto border-collapse text-right">
              <thead>
                <tr className="bg-slate-50 text-sm text-slate-600">
                  <th className="px-3 py-3 font-semibold">المادة</th>
                  <th className="px-3 py-3 font-semibold">أعمال السنة</th>
                  <th className="px-3 py-3 font-semibold">نظري</th>
                  <th className="px-3 py-3 font-semibold">عملي</th>
                  <th className="px-3 py-3 font-semibold">المجموع</th>
                  <th className="px-3 py-3 font-semibold">مساعدة امتحانية</th>
                </tr>
              </thead>
              <tbody>
                {grades.map((item) => (
                  <tr key={item.subject} className="border-t border-slate-200 text-sm text-slate-700">
                    <td className="px-3 py-3 font-medium">{item.subject}</td>
                    <td className="px-3 py-3">{item.annual}</td>
                    <td className="px-3 py-3">{item.theory}</td>
                    <td className="px-3 py-3">{item.practical}</td>
                    <td className="px-3 py-3">{item.total}</td>
                    <td className="px-3 py-3"><span className="badge bg-emerald-100 text-emerald-700">{item.assistance}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1fr_1fr]">
          <div className="card p-6">
            <div className="mb-5 flex items-center justify-between">
              <h3 className="text-xl font-bold text-slate-900">سجل الإنذارات</h3>
              <Bell className="h-5 w-5 text-amber-500" />
            </div>
            <div className="space-y-4">
              {warnings.map((warning) => (
                <div key={warning.title} className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <div>
                    <p className="font-semibold text-slate-800">{warning.title}</p>
                    <p className="text-sm text-slate-500">{warning.date}</p>
                  </div>
                  <span className={`badge ${warning.severity === 'عالي' ? 'bg-red-100 text-red-700' : warning.severity === 'متوسط' ? 'bg-amber-100 text-amber-700' : 'bg-sky-100 text-sky-700'}`}>
                    {warning.severity}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="card p-6">
            <div className="mb-5 flex items-center justify-between">
              <h3 className="text-xl font-bold text-slate-900">جدول الدوام الأسبوعي</h3>
              <CalendarCheck className="h-5 w-5 text-primary-600" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {schedule.map((day) => (
                <div key={day.day} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <h4 className="mb-2 font-bold text-slate-800">{day.day}</h4>
                  <ul className="space-y-2 text-sm text-slate-700">
                    {day.items.map((item) => (
                      <li key={item} className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-primary-500" /> {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="card p-6">
          <div className="mb-6 flex items-center justify-between">
            <h3 className="text-xl font-bold text-slate-900">حالة الحساب</h3>
            <ShieldCheck className="h-5 w-5 text-emerald-600" />
          </div>

          <div className="grid gap-5 lg:grid-cols-3">
            <SettingCard label="البريد الإلكتروني" value={student.email} icon={PencilLine} />
            <SettingCard label="كلمة المرور" value={student.password} icon={KeyRound} />
            <SettingCard label="الفئة" value="A-201" icon={ArrowLeftRight} />
          </div>
        </section>

        <section className="card p-6">
          <div className="mb-6 flex items-center justify-between">
            <h3 className="text-xl font-bold text-slate-900">لوحة التحكم الإداري</h3>
            <UserCog className="h-5 w-5 text-slate-700" />
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {adminMetrics.map(({ label, value, icon: Icon }) => (
              <div key={label} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-slate-500">{label}</p>
                  <Icon className="h-5 w-5 text-primary-600" />
                </div>
                <p className="mt-3 text-2xl font-bold text-slate-900">{value}</p>
              </div>
            ))}
          </div>

          <div className="mt-6 grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="mb-4 flex items-center justify-between">
                <h4 className="font-bold text-slate-900">إدارة الطلاب</h4>
                <button className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-3 py-2 text-sm font-semibold text-white"><Plus className="h-4 w-4" /> إضافة</button>
              </div>
              <div className="space-y-3 text-sm text-slate-700">
                <div className="flex items-center justify-between rounded-xl bg-white p-3"><span>أحمد محمد</span><span className="flex gap-2"><button className="text-primary-600">تعديل</button><button className="text-red-500">حذف</button></span></div>
                <div className="flex items-center justify-between rounded-xl bg-white p-3"><span>سارة علي</span><span className="flex gap-2"><button className="text-primary-600">تعديل</button><button className="text-red-500">حذف</button></span></div>
                <div className="flex items-center justify-between rounded-xl bg-white p-3"><span>محمود ناصر</span><span className="flex gap-2"><button className="text-primary-600">تعديل</button><button className="text-red-500">حذف</button></span></div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="mb-4 flex items-center justify-between">
                <h4 className="font-bold text-slate-900">نظام الحضور والغياب</h4>
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              </div>
              <div className="space-y-3">
                {attendanceSummary.map(({ label, value, color }) => (
                  <div key={label} className="flex items-center justify-between rounded-xl bg-white p-3 text-sm">
                    <span className="flex items-center gap-2"><span className={`h-3 w-3 rounded-full ${color}`} /> {label}</span>
                    <span className="font-bold text-slate-900">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <footer className="pb-4 pt-2 text-center text-sm text-slate-500">
          منصة الطلاب والإدارة • جاهزة للنشر على Vercel
        </footer>
      </div>
    </main>
  );
}

function InfoTile({ label, value, icon: Icon }: { label: string; value: string; icon: any }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-white p-2 text-primary-600 shadow-sm"><Icon className="h-5 w-5" /></div>
        <div>
          <p className="text-xs text-slate-500">{label}</p>
          <p className="mt-1 font-bold text-slate-800">{value}</p>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon: Icon, accent }: { title: string; value: string; icon: any; accent: string }) {
  const tone = accent === 'emerald' ? 'bg-emerald-100 text-emerald-700' : accent === 'blue' ? 'bg-blue-100 text-blue-700' : accent === 'amber' ? 'bg-amber-100 text-amber-700' : 'bg-violet-100 text-violet-700';

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-500">{title}</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">{value}</p>
        </div>
        <div className={`rounded-xl p-3 ${tone}`}><Icon className="h-6 w-6" /></div>
      </div>
    </div>
  );
}

function MiniStat({ label, value, tone }: { label: string; value: string; tone: 'emerald' | 'blue' | 'purple' }) {
  const palette = tone === 'emerald' ? 'bg-emerald-100 text-emerald-700' : tone === 'blue' ? 'bg-blue-100 text-blue-700' : 'bg-violet-100 text-violet-700';
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-sm font-bold ${palette}`}>{value}</p>
    </div>
  );
}

function SettingCard({ label, value, icon: Icon }: { label: string; value: string; icon: any }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-white p-2 text-primary-600 shadow-sm"><Icon className="h-5 w-5" /></div>
        <div>
          <p className="text-sm text-slate-500">{label}</p>
          <p className="mt-1 font-bold text-slate-800">{value}</p>
        </div>
      </div>
    </div>
  );
}
