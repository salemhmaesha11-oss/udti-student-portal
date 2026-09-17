'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import {
  getAttendanceForStudent,
  getStudentById,
  getWarningsForStudent,
  getRecordValue,
  normalizeText,
  StudentRow,
} from '../lib/studentData';

type TabKey = 'grades' | 'record' | 'status';

type GradeEntry = {
  subject: string;
  annual: number | null;
  theory: number | null;
  practical: number | null;
  total: number | null;
  assistance: string;
};

const metadataKeys = new Set([
  'id',
  'الرقم الجامعي',
  'كلمة السر',
  'اسم الطالب',
  'اسم الاب',
  'الكنية',
  'القسم',
  'رقم الهاتف',
  'نوع التسجيل',
  'ملاحظة',
  'البريد الإلكتروني',
  'الفئة',
  'تاريخ_تغيير_الفئة',
  'تاريخ الإنشاء',
  'السنه الدراسية',
  'created_at',
  'updated_at',
  'createdAt',
  'updatedAt',
]);

const formatStudentValue = (value: string | number | null | undefined) => {
  if (value === null || value === undefined || value === '') return 'غير متوفر';
  return String(value);
};

const formatDate = (value: string | null | undefined) => {
  if (!value) return 'غير متوفر';

  try {
    return new Date(value).toLocaleDateString('ar-EG', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  } catch {
    return String(value);
  }
};

const toNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && !Number.isNaN(value)) return value;
  if (typeof value === 'string') {
    const cleaned = value.trim().replace(/,/g, '').replace(/[^0-9.-]/g, '');
    if (!cleaned || cleaned === '-' || cleaned === '.') return null;
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const getValueByKeys = (row: Record<string, unknown>, keys: string[]) => {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null && row[key] !== '') return row[key];
  }
  return undefined;
};

const extractGrades = (rows: Record<string, unknown>[]): GradeEntry[] => {
  if (!rows.length) return [];

  const first = rows[0];
  const gradeRows: GradeEntry[] = [];

  Object.entries(first).forEach(([key, value]) => {
    if (metadataKeys.has(key)) return;
    if (value === null || value === undefined || value === '') return;

    const parsed = toNumber(value);
    if (parsed === null) return;

    gradeRows.push({
      subject: key,
      annual: parsed,
      theory: null,
      practical: null,
      total: parsed,
      assistance: parsed >= 50 ? 'مقبول' : 'غير مقبول',
    });
  });

  if (gradeRows.length) return gradeRows;

  return rows.flatMap((row) => {
    return Object.entries(row)
      .filter(([key, value]) => !metadataKeys.has(key) && value !== null && value !== undefined && value !== '')
      .map(([subject, value]) => {
        const numeric = toNumber(value);
        return {
          subject,
          annual: numeric,
          theory: null,
          practical: null,
          total: numeric,
          assistance: numeric !== null && numeric >= 50 ? 'مقبول' : 'غير مقبول',
        };
      });
  });
};

const parseAttendance = (rows: Record<string, unknown>[]) => {
  const summary = { present: 0, absent: 0, waiting: 0 };

  rows.forEach((row) => {
    const status = getValueByKeys(row, ['الحضور', 'حضور', 'status', 'الحالة', 'attendance']) as string | number | boolean | undefined;
    const normalized = String(status ?? '').trim().toLowerCase();

    if (status === true || normalized === 'حاضر' || normalized === 'present' || normalized === '1' || normalized === 'yes') {
      summary.present += 1;
    } else if (status === false || normalized === 'غائب' || normalized === 'absent' || normalized === '0' || normalized === 'no') {
      summary.absent += 1;
    } else {
      summary.waiting += 1;
    }
  });

  return [
    { label: 'حاضر', value: String(summary.present), tone: 'present' },
    { label: 'غائب', value: String(summary.absent), tone: 'absent' },
    { label: 'منتظر', value: String(summary.waiting), tone: 'waiting' },
  ];
};

const getTableRows = async (tableNames: string[], select = '*') => {
  for (const tableName of tableNames) {
    const { data, error } = await supabase.from(tableName).select(select).limit(1);
    if (!error) return { data: data ?? [], tableName };
    const message = String(error.message || '');
    if (message.includes('does not exist') || message.includes('not found') || message.includes('relation')) {
      continue;
    }
    return { data: data ?? [], tableName, error };
  }

  return { data: [], tableName: tableNames[0], error: null };
};

export default function Home() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>('grades');
  const [notice, setNotice] = useState('يرجى تسجيل الدخول لعرض نتائجك');
  const [loginData, setLoginData] = useState({ studentId: '', password: '' });
  const [loggedStudent, setLoggedStudent] = useState<StudentRow | null>(null);
  const [grades, setGrades] = useState<GradeEntry[]>([]);
  const [warnings, setWarnings] = useState<Record<string, unknown>[]>([]);
  const [attendanceSummary, setAttendanceSummary] = useState([
    { label: 'حاضر', value: '0', tone: 'present' },
    { label: 'غائب', value: '0', tone: 'absent' },
    { label: 'منتظر', value: '0', tone: 'waiting' },
  ]);
  const [studentStatus, setStudentStatus] = useState<string>('غير متوفر');

  const tabs = [
    { key: 'grades', label: 'العلامات' },
    { key: 'record', label: 'السجل' },
    { key: 'status', label: 'الحالة' },
  ] as const;

  useEffect(() => {
    const loadDashboard = async () => {
      if (!loggedStudent || !loggedStudent['الرقم الجامعي']) return;

      const studentId = String(loggedStudent['الرقم الجامعي']);

      const [attendanceResult, warningsResult, gradesResult, statusResult] = await Promise.all([
        getAttendanceForStudent(studentId).then((rows) => ({ data: rows })),
        getWarningsForStudent(studentId).then((rows) => ({ data: rows })),
        getTableRows(['الاعمال', 'الأعمال', 'أعمال', 'العملي', 'النظري']).then(({ data }) => ({
          data: Array.isArray(data) ? data.filter((row) => {
            const rowRecord = row as unknown as Record<string, unknown>;
            const rowStudentId = getValueByKeys(rowRecord, ['الرقم الجامعي', 'student_id', 'studentId']);
            return String(rowStudentId ?? '') === String(studentId);
          }) : [],
        })),
        Promise.resolve({ data: Array.isArray(loggedStudent) ? loggedStudent : [loggedStudent].filter(Boolean) }),
      ]);

      const gradeRows = gradesResult.data.flatMap((row) => extractGrades([row as unknown as Record<string, unknown>]));
      setGrades(gradeRows);
      setWarnings(warningsResult.data as unknown as Record<string, unknown>[]);
      setAttendanceSummary(parseAttendance(attendanceResult.data as unknown as Record<string, unknown>[]));

      const statusData = (statusResult.data[0] as Record<string, unknown> | undefined) ?? (loggedStudent as Record<string, unknown> | null) ?? {};
      const statusValue = getValueByKeys(statusData, ['الحالة', 'status', 'الحالة_الدراسية']) ?? 'غير متوفر';
      setStudentStatus(normalizeText(statusValue));
    };

    loadDashboard();
  }, [loggedStudent]);

  const handleLogin = async (event: FormEvent) => {
    event.preventDefault();

    const studentId = loginData.studentId.trim();
    const password = loginData.password.trim();

    if (!studentId || !password) {
      setNotice('يرجى إدخال الرقم الجامعي وكلة السر');
      return;
    }

    const user = await getStudentById(studentId);

    if (!user) {
      setNotice('الرقم الجامعي غير موجود في قاعدة البيانات');
      return;
    }

    const storedPassword = String(getRecordValue(user as Record<string, unknown>, ['كلمة السر', 'password']) ?? '').trim();
    if (storedPassword !== password) {
      setNotice('كلمة السر غير صحيحة');
      return;
    }

    setLoggedStudent(user as StudentRow);
    setIsLoggedIn(true);
    setNotice(`تم تسجيل الدخول بنجاح، مرحباً ${normalizeText(getRecordValue(user as Record<string, unknown>, ['اسم الطالب', 'student_name', 'name']))}`);
  };

  const logout = () => {
    setIsLoggedIn(false);
    setLoggedStudent(null);
    setLoginData({ studentId: '', password: '' });
    setNotice('تم تسجيل الخروج بنجاح');
  };

  if (!isLoggedIn) {
    return (
      <main className="login-shell" dir="rtl">
        <div className="login-card">
          <div className="institute-header login-institute-header">
            <img
              className="login-logo"
              src="https://drive.google.com/thumbnail?id=1WBYFxtmLUfuREUY1H5Uso5ltomjshWlq&sz=w1000"
              alt="شعار المعهد"
            />
            <h2>المعهد التقاني لطب الأسنان</h2>
            <h3>جامعة اللاذقية</h3>
          </div>

          <h1 className="login-title">استعلام قسم تعويضات أسنان</h1>

          <form onSubmit={handleLogin} className="login-form">
            <div className="form-group">
              <input
                type="text"
                value={loginData.studentId}
                onChange={(event) => setLoginData({ ...loginData, studentId: event.target.value })}
                placeholder="الرقم الجامعي"
                inputMode="numeric"
                required
              />
            </div>

            <div className="form-group password-container">
              <input
                type="password"
                value={loginData.password}
                onChange={(event) => setLoginData({ ...loginData, password: event.target.value })}
                placeholder="كلمة السر"
                required
              />
              <button type="button" className="toggle-password" aria-label="إظهار كلمة السر">
                إظهار
              </button>
            </div>

            <button type="submit" className="login-button">عرض</button>
          </form>

          <div style={{ marginTop: 16 }}>
            <Link href="/attendance/" className="login-button" style={{ display: 'inline-flex', justifyContent: 'center', textDecoration: 'none', width: '100%' }}>
              لوحة التحكم للمشرفين
            </Link>
          </div>

          <div className="login-help">
            <strong>ملاحظات:</strong>
            <span>استخدم الرقم الجامعي وكلمة السر الخاصة بك</span>
          </div>

          <div className="system-notice">{notice}</div>

        </div>
      </main>
    );
  }

  return (
    <main className="student-shell" dir="rtl">
      <div className="student-page">
        <div className="container" id="mainContainer">
          <div className="topbar">
            <div className="institute-header">
              <img
                className="institute-logo"
                src="https://drive.google.com/thumbnail?id=1WBYFxtmLUfuREUY1H5Uso5ltomjshWlq&sz=w1000"
                alt="شعار المعهد"
              />
              <h2>المعهد التقاني لطب الأسنان</h2>
              <h3>جامعة اللاذقية</h3>
            </div>
            <button className="logout-button" type="button" onClick={logout}>تسجيل الخروج</button>
          </div>

          <div className="barcode-section">
            <div className="barcode-box">
              <svg viewBox="0 0 280 90" className="barcode-svg" aria-label="barcode">
                <rect width="280" height="90" rx="8" fill="#fff" />
                <g fill="#111827">
                  <rect x="10" y="20" width="2" height="50" />
                  <rect x="18" y="20" width="6" height="50" />
                  <rect x="30" y="20" width="2" height="50" />
                  <rect x="38" y="20" width="4" height="50" />
                  <rect x="48" y="20" width="2" height="50" />
                  <rect x="62" y="20" width="8" height="50" />
                  <rect x="74" y="20" width="4" height="50" />
                  <rect x="82" y="20" width="2" height="50" />
                  <rect x="90" y="20" width="6" height="50" />
                  <rect x="102" y="20" width="2" height="50" />
                  <rect x="110" y="20" width="8" height="50" />
                  <rect x="122" y="20" width="2" height="50" />
                  <rect x="128" y="20" width="4" height="50" />
                  <rect x="138" y="20" width="2" height="50" />
                  <rect x="146" y="20" width="8" height="50" />
                  <rect x="160" y="20" width="2" height="50" />
                  <rect x="166" y="20" width="6" height="50" />
                  <rect x="178" y="20" width="2" height="50" />
                  <rect x="186" y="20" width="8" height="50" />
                  <rect x="198" y="20" width="2" height="50" />
                  <rect x="206" y="20" width="4" height="50" />
                  <rect x="216" y="20" width="2" height="50" />
                  <rect x="224" y="20" width="8" height="50" />
                  <rect x="238" y="20" width="2" height="50" />
                  <rect x="246" y="20" width="6" height="50" />
                  <rect x="258" y="20" width="2" height="50" />
                  <rect x="266" y="20" width="4" height="50" />
                </g>
              </svg>
              <div className="barcode-name">{formatStudentValue(loggedStudent?.['اسم الطالب'])}</div>
              <div className="barcode-id">{formatStudentValue(loggedStudent?.['الرقم الجامعي'])}</div>
            </div>
          </div>

          <div className="system-notice">{notice}</div>

          <div className="header">
            <h1>الحساب الجامعي</h1>
          </div>

          <div className="student-info">
            <div className="info-item"><span className="info-label"><i className="fa-solid fa-user" /> الاسم</span> {formatStudentValue(loggedStudent?.['اسم الطالب'])}</div>
            <div className="info-item"><span className="info-label"><i className="fa-solid fa-id-card" /> الرقم الجامعي</span> {formatStudentValue(loggedStudent?.['الرقم الجامعي'])}</div>
            <div className="info-item"><span className="info-label"><i className="fa-solid fa-building-columns" /> القسم</span> {formatStudentValue(loggedStudent?.['القسم'])}</div>
            <div className="info-item"><span className="info-label"><i className="fa-solid fa-graduation-cap" /> اسم الأب</span> {formatStudentValue(loggedStudent?.['اسم الاب'])}</div>
            <div className="info-item"><span className="info-label"><i className="fa-solid fa-users" /> الكنية</span> {formatStudentValue(loggedStudent?.['الكنية'])}</div>
            <div className="info-item"><span className="info-label"><i className="fa-solid fa-layer-group" /> الفئة</span> {formatStudentValue(loggedStudent?.['الفئة'])}</div>
            <div className="info-item"><span className="info-label"><i className="fa-solid fa-check-circle" /> السنة الدراسية</span> {formatStudentValue(loggedStudent?.['السنه الدراسية'])}</div>
          </div>

          <div className="student-details-grid">
            <div className="detail-item">
              <div className="detail-label">رقم الهاتف</div>
              <div className="detail-value">{formatStudentValue(loggedStudent?.['رقم الهاتف'])}</div>
            </div>
            <div className="detail-item">
              <div className="detail-label">البريد الإلكتروني</div>
              <div className="detail-value">{formatStudentValue(loggedStudent?.['البريد الإلكتروني'])}</div>
            </div>
            <div className="detail-item">
              <div className="detail-label">نوع التسجيل</div>
              <div className="detail-value">{formatStudentValue(loggedStudent?.['نوع التسجيل'])}</div>
            </div>
            <div className="detail-item">
              <div className="detail-label">تاريخ الإنشاء</div>
              <div className="detail-value">{formatDate(loggedStudent?.['تاريخ الإنشاء'])}</div>
            </div>
            <div className="detail-item">
              <div className="detail-label">تاريخ تغيير الفئة</div>
              <div className="detail-value">{formatDate(loggedStudent?.['تاريخ_تغيير_الفئة'])}</div>
            </div>
            <div className="detail-item">
              <div className="detail-label">ملاحظة</div>
              <div className="detail-value">{formatStudentValue(loggedStudent?.['ملاحظة'])}</div>
            </div>
          </div>

          <div className="tabs-container">
            <div className="tabs">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  className={`tab ${activeTab === tab.key ? 'active' : ''}`}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {activeTab === 'grades' && (
              <div className="tab-content active">
                {grades.length === 0 ? (
                  <div className="no-data">
                    <i className="fa-solid fa-table-list" />
                    <div>لا توجد بيانات للعلامات حتى الآن.</div>
                  </div>
                ) : (
                  <table>
                    <thead>
                      <tr>
                        <th>المادة</th>
                        <th>أعمال السنة</th>
                        <th>نظري</th>
                        <th>عملي</th>
                        <th>المجموع</th>
                        <th>مساعدة امتحانية</th>
                      </tr>
                    </thead>
                    <tbody>
                      {grades.map((item) => (
                        <tr key={item.subject}>
                          <td>{item.subject}</td>
                          <td>{item.annual ?? '—'}</td>
                          <td>{item.theory ?? '—'}</td>
                          <td>{item.practical ?? '—'}</td>
                          <td>{item.total ?? '—'}</td>
                          <td>{item.assistance}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {activeTab === 'record' && (
              <div className="tab-content active">
                {warnings.length === 0 ? (
                  <div className="no-data">
                    <i className="fa-solid fa-clipboard-list" />
                    <div>لا يوجد سجل للطالب في الوقت الحالي.</div>
                  </div>
                ) : (
                  <div className="warning-list">
                    {warnings.map((warning, index) => (
                      <div key={`${warning['الرقم الجامعي'] ?? 'warning'}-${index}`} className="warning-item">
                        <div className="warning-header">
                          <strong>{normalizeText(getValueByKeys(warning, ['نوع الإنذار']))}</strong>
                          <span className="warning-type">{normalizeText(getValueByKeys(warning, ['السبب']))}</span>
                        </div>
                        <div className="warning-reason">{normalizeText(getValueByKeys(warning, ['التفاصيل']))}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'status' && (
              <div className="tab-content active">
                <div className="status-grid">
                  <div className="status-card">
                    <div className="status-icon"><i className="fa-solid fa-check-circle" /></div>
                    <div className="status-title">الحالة الدراسية</div>
                    <div className="status-data">{studentStatus}</div>
                  </div>
                  <div className="status-card">
                    <div className="status-icon"><i className="fa-solid fa-user-check" /></div>
                    <div className="status-title">الفئة</div>
                    <div className="status-data">{formatStudentValue(loggedStudent?.['الفئة'])}</div>
                  </div>
                  <div className="status-card">
                    <div className="status-icon"><i className="fa-solid fa-calendar-days" /></div>
                    <div className="status-title">السنة الدراسية</div>
                    <div className="status-data">{formatStudentValue(loggedStudent?.['السنه الدراسية'])}</div>
                  </div>
                </div>
              </div>
            )}

          </div>

          <div className="last-updated">آخر تحديث للنظام: {formatDate(loggedStudent?.['تاريخ_تغيير_الفئة'])}</div>
        </div>
      </div>
    </main>
  );
}
