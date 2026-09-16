'use client';

import { FormEvent, useState } from 'react';
import { supabase } from '../lib/supabase';

type StudentRow = {
  id?: number;
  'الرقم الجامعي'?: string | number;
  'كلمة السر'?: string;
  'اسم الطالب'?: string;
  'اسم الاب'?: string;
  'الكنية'?: string;
  'القسم'?: string;
  'رقم الهاتف'?: string;
  'نوع التسجيل'?: string;
  'ملاحظة'?: string;
  'البريد الإلكتروني'?: string;
  'الفئة'?: string;
  'تاريخ_تغيير_الفئة'?: string | null;
  'تاريخ الإنشاء'?: string | null;
  'السنه الدراسية'?: string | number;
};

type TabKey = 'grades' | 'record' | 'status' | 'schedule';

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

export default function Home() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>('grades');
  const [notice, setNotice] = useState('يرجى تسجيل الدخول لعرض نتائجك');
  const [loginData, setLoginData] = useState({ studentId: '', password: '' });
  const [loggedStudent, setLoggedStudent] = useState<StudentRow | null>(null);

  const tabs = [
    { key: 'grades', label: 'العلامات' },
    { key: 'record', label: 'السجل' },
    { key: 'status', label: 'الحالة' },
    { key: 'schedule', label: 'الدوام' },
  ] as const;

  const handleLogin = async (event: FormEvent) => {
    event.preventDefault();

    const studentId = loginData.studentId.trim();
    const password = loginData.password.trim();

    if (!studentId || !password) {
      setNotice('يرجى إدخال الرقم الجامعي وكلمة السر');
      return;
    }

    const { data, error } = await supabase
      .from('students')
      .select('*')
      .eq('الرقم الجامعي', studentId)
      .maybeSingle();

    if (error) {
      setNotice(`تعذر البحث عن الطالب في قاعدة البيانات: ${error.message}`);
      return;
    }

    if (!data) {
      setNotice('الرقم الجامعي غير موجود في قاعدة البيانات');
      return;
    }

    const storedPassword = String(data['كلمة السر'] ?? '').trim();
    if (storedPassword !== password) {
      setNotice('كلمة السر غير صحيحة');
      return;
    }

    setLoggedStudent(data as StudentRow);
    setIsLoggedIn(true);
    setNotice(`تم تسجيل الدخول بنجاح، مرحباً ${data['اسم الطالب'] ?? 'الطالب'}`);
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
                <div className="no-data">
                  <i className="fa-solid fa-table-list" />
                  <div>لا توجد بيانات للعلامات حتى الآن.</div>
                </div>
              </div>
            )}

            {activeTab === 'record' && (
              <div className="tab-content active">
                <div className="no-data">
                  <i className="fa-solid fa-clipboard-list" />
                  <div>لا يوجد سجل للطالب في الوقت الحالي.</div>
                </div>
              </div>
            )}

            {activeTab === 'status' && (
              <div className="tab-content active">
                <div className="status-grid">
                  <div className="status-card">
                    <div className="status-icon"><i className="fa-solid fa-check-circle" /></div>
                    <div className="status-title">الحالة الدراسية</div>
                    <div className="status-data">{formatStudentValue(loggedStudent?.['نوع التسجيل']) || 'غير متوفر'}</div>
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

            {activeTab === 'schedule' && (
              <div className="tab-content active">
                <div className="no-data">
                  <i className="fa-solid fa-calendar-week" />
                  <div>لا توجد بيانات للدوام في هذا الوقت.</div>
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
