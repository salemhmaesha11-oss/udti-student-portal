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

const formatStudentValue = (value: string | number | null | undefined) => {
  if (value === null || value === undefined || value === '') return 'غير متوفر';
  return String(value);
};

export default function Home() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [notice, setNotice] = useState('يرجى تسجيل الدخول لعرض نتائجك');
  const [loginData, setLoginData] = useState({ studentId: '', password: '' });
  const [loggedStudent, setLoggedStudent] = useState<StudentRow | null>(null);

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

          <div className="system-notice">{notice}</div>

          <div className="header">
            <h1>بيانات الطالب</h1>
          </div>

          <div className="student-info">
            <div className="info-item"><span className="info-label"><i className="fa-solid fa-user" /> الاسم</span> {formatStudentValue(loggedStudent?.['اسم الطالب'])}</div>
            <div className="info-item"><span className="info-label"><i className="fa-solid fa-id-card" /> الرقم الجامعي</span> {formatStudentValue(loggedStudent?.['الرقم الجامعي'])}</div>
            <div className="info-item"><span className="info-label"><i className="fa-solid fa-building-columns" /> القسم</span> {formatStudentValue(loggedStudent?.['القسم'])}</div>
            <div className="info-item"><span className="info-label"><i className="fa-solid fa-graduation-cap" /> اسم الأب</span> {formatStudentValue(loggedStudent?.['اسم الاب'])}</div>
            <div className="info-item"><span className="info-label"><i className="fa-solid fa-users" /> الكنية</span> {formatStudentValue(loggedStudent?.['الكنية'])}</div>
            <div className="info-item"><span className="info-label"><i className="fa-solid fa-layer-group" /> الفئة</span> {formatStudentValue(loggedStudent?.['الفئة'])}</div>
            <div className="info-item"><span className="info-label"><i className="fa-solid fa-check-circle" /> السنة الدراسية</span> {formatStudentValue(loggedStudent?.['السنه الدراسية'])}</div>
            <div className="info-item"><span className="info-label"><i className="fa-solid fa-phone" /> رقم الهاتف</span> {formatStudentValue(loggedStudent?.['رقم الهاتف'])}</div>
            <div className="info-item"><span className="info-label"><i className="fa-solid fa-envelope" /> البريد الإلكتروني</span> {formatStudentValue(loggedStudent?.['البريد الإلكتروني'])}</div>
            <div className="info-item"><span className="info-label"><i className="fa-solid fa-clipboard-list" /> نوع التسجيل</span> {formatStudentValue(loggedStudent?.['نوع التسجيل'])}</div>
            <div className="info-item"><span className="info-label"><i className="fa-solid fa-note-sticky" /> ملاحظة</span> {formatStudentValue(loggedStudent?.['ملاحظة'])}</div>
            <div className="info-item"><span className="info-label"><i className="fa-solid fa-calendar" /> تاريخ الإنشاء</span> {formatStudentValue(loggedStudent?.['تاريخ الإنشاء'])}</div>
          </div>

          <div className="last-updated">
            آخر تحديث للنظام: {loggedStudent?.['تاريخ_تغيير_الفئة'] ? new Date(String(loggedStudent['تاريخ_تغيير_الفئة'])).toLocaleDateString('ar-EG') : 'غير متوفر'}
          </div>
        </div>
      </div>
    </main>
  );
}
