'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';

type StudentRow = {
  id?: number | string;
  'الرقم الجامعي'?: string | number;
  'اسم الطالب'?: string;
  'الفئة'?: string;
  'السنه الدراسية'?: string | number;
  'القسم'?: string;
  'نوع التسجيل'?: string;
};

type AttendanceStatus = 'pending' | 'present' | 'absent';

type AttendanceEntry = {
  id: string;
  name: string;
  status: AttendanceStatus;
  timestamp: string | null;
  year: string;
};

type SupervisorRow = {
  'اسم المستخدم'?: string;
  username?: string;
  'كلمة المرور'?: string;
  password?: string;
  'الدرجة'?: string | number;
  degree?: string | number;
};

const tableCandidates = {
  students: ['students'],
  attendance: ['attendance', 'الحضور'],
  warnings: ['warnings', 'الانذارات', 'الإنذارات'],
};

const courseOptions = [
  'تشريح الأسنان',
  'مواد طب الأسنان الوقائي',
  'علم الأدوية',
  'علم الأمراض',
  'الاستعاضة الصناعية',
  'الوقاية الفموية',
  'تقويم الأسنان',
];

const classOptions = ['أ', 'ب', 'ج', 'د'];
const yearOptions = ['أولى', 'ثانية'];

const normalizeText = (value: unknown) => {
  if (value === null || value === undefined || value === '') return 'غير متوفر';
  return String(value).trim();
};

const normalizeSupervisorDegree = (value: unknown) => {
  const text = normalizeText(value).replace(/\s+/g, '').toLowerCase();
  if (['1', '١', 'one'].includes(text)) return '1';
  if (['2', '٢', 'two'].includes(text)) return '2';
  if (['3', '٣', 'three'].includes(text)) return '3';
  return text;
};

const normalizeSupervisorValue = (value: unknown) => {
  return normalizeText(value).replace(/\s+/g, '').toLowerCase();
};

const getSupervisorCredentials = (row: Record<string, unknown>) => {
  const values = Object.values(row)
    .filter((item) => item !== null && item !== undefined && String(item).trim() !== '')
    .map((item) => String(item).trim());

  const namedUsername = row['اسم المستخدم'] ?? row.username ?? row['username'] ?? row['اسم_المستخدم'] ?? row['user_name'] ?? '';
  const namedPassword = row['كلمة المرور'] ?? row.password ?? row['password'] ?? row['كلمة_المرور'] ?? row['pass'] ?? '';
  const namedDegree = row['الدرجة'] ?? row.degree ?? row['degree'] ?? row['درجه'] ?? row['rank'] ?? '';

  return {
    username: String(namedUsername || values[0] || ''),
    password: String(namedPassword || values[1] || ''),
    degree: String(namedDegree || values[2] || ''),
  };
};

const normalizeYearValue = (value: unknown) => {
  const text = normalizeText(value).toLowerCase();
  const cleaned = text.replace(/[_\-\s]/g, '').replace(/السنة|سنة|الدراسية|دراسية/g, '');

  if (/اول|first|1/.test(cleaned) && !/ثان|second|2/.test(cleaned)) return 'أولى';
  if (/ثان|second|2/.test(cleaned)) return 'ثانية';
  return cleaned || 'غير محدد';
};

const normalizeClassValue = (value: unknown) => {
  const text = normalizeText(value).toLowerCase().replace(/[_\-\s]/g, '');
  const cleaned = text.replace(/فئة|class/g, '').trim();
  return cleaned || 'غير محدد';
};

function readStudentField(student: StudentRow, keys: string[]) {
  for (const key of keys) {
    const value = student[key as keyof StudentRow];
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return undefined;
}

const getSupabaseErrorText = (error: unknown) => {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  try {
    return JSON.stringify(error);
  } catch {
    return 'خطأ غير معروف في قاعدة البيانات';
  }
};

const getStudentIdentifier = (student: StudentRow) => {
  return String(student['الرقم الجامعي'] ?? student.id ?? '').trim();
};

const findSupervisorLogin = async (username: string, password: string) => {
  const tableName = 'المشرفين';
  const { data, error } = await supabase.from(tableName).select('*');

  if (error) {
    throw error;
  }

  const rows = Array.isArray(data) ? (data as Record<string, unknown>[]) : [];

  for (const row of rows) {
    const values = Object.values(row)
      .filter((item) => item !== null && item !== undefined && String(item).trim() !== '')
      .map((item) => String(item).trim());

    if (values.length < 3) continue;

    const [rawUsername, rawPassword, rawDegree] = values;
    const userValue = normalizeSupervisorValue(rawUsername);
    const passwordValue = normalizeSupervisorValue(rawPassword);
    const degreeValue = normalizeSupervisorDegree(rawDegree);
    const normalizedInputUser = normalizeSupervisorValue(username);
    const normalizedInputPassword = normalizeSupervisorValue(password);
    const isAllowedDegree = ['1', '2', '3', '١', '٢', '٣'].includes(degreeValue);

    if (userValue !== normalizedInputUser) {
      continue;
    }

    if (passwordValue !== normalizedInputPassword) {
      return {
        match: false,
        reason: 'password',
        row,
        expectedPassword: rawPassword,
        enteredPassword: password,
        tableName,
      };
    }

    if (!isAllowedDegree) {
      return {
        match: false,
        reason: 'degree',
        row,
        expectedDegree: rawDegree,
        tableName,
      };
    }

    return { match: true, row, tableName };
  }

  return { match: false, reason: 'username', tableName };
};

const fetchStudentsByClass = async (selectedClass: string, selectedYear: string) => {
  for (const tableName of tableCandidates.students) {
    const { data, error } = await supabase.from(tableName).select('*');
    if (error) {
      const lowerMessage = error.message.toLowerCase();
      if (lowerMessage.includes('does not exist') || lowerMessage.includes('relation')) continue;
      throw error;
    }

    const rows = Array.isArray(data) ? (data as StudentRow[]) : [];
    const filtered = rows.filter((student) => {
      const classValue = normalizeClassValue(
        readStudentField(student, ['الفئة', 'class', 'class_name', 'الفئة_الجامعية'])
      );
      const yearValue = normalizeYearValue(
        readStudentField(student, ['السنه الدراسية', 'السنة الدراسية', 'year', 'student_year'])
      );
      const normalizedClass = normalizeClassValue(selectedClass);
      const normalizedYear = normalizeYearValue(selectedYear);

      const matchesClass = !selectedClass || classValue === normalizedClass || classValue === `فئة${normalizedClass}` || classValue.includes(normalizedClass) || normalizedClass.includes(classValue);
      const matchesYear = !selectedYear || yearValue === normalizedYear || yearValue.includes(normalizedYear) || normalizedYear.includes(yearValue);
      return matchesClass && matchesYear;
    });

    if (filtered.length > 0 || tableName === tableCandidates.students[tableCandidates.students.length - 1]) {
      return filtered;
    }
  }

  return [] as StudentRow[];
};

const saveWarningRecord = async (student: StudentRow, course: string, classValue: string, status: 'absent' | 'present') => {
  const studentId = getStudentIdentifier(student);
  if (!studentId) return;

  const record = {
    'الرقم الجامعي': studentId,
    'اسم الطالب': student['اسم الطالب'] ?? 'غير محدد',
    'الفئة': classValue,
    'المادة': course,
    'الحالة': status === 'absent' ? 'غائب' : 'حاضر',
    'التاريخ': new Date().toISOString(),
    'سبب': status === 'absent' ? 'غياب' : 'حضور',
    'ملاحظة': status === 'absent' ? 'تم تسجيل إنذار تلقائي بسبب الغياب.' : 'تم تسجيل حضور الطالب بنجاح.',
  };

  for (const tableName of tableCandidates.warnings) {
    try {
      const { error } = await supabase.from(tableName).insert([record]);
      if (!error) return true;
      const lowerMessage = error.message.toLowerCase();
      if (lowerMessage.includes('does not exist') || lowerMessage.includes('relation')) continue;
      console.error(`Warning insert failed for table ${tableName}:`, error.message);
      return false;
    } catch (error) {
      console.error(`Warning table ${tableName} failed:`, error);
    }
  }

  return false;
};

const saveAttendanceRecord = async (student: StudentRow, course: string, classValue: string, status: AttendanceStatus) => {
  const studentId = getStudentIdentifier(student);
  if (!studentId) return;

  const record = {
    'الرقم الجامعي': studentId,
    'اسم الطالب': student['اسم الطالب'] ?? 'غير محدد',
    'الفئة': classValue,
    'المادة': course,
    'الحالة': status === 'present' ? 'حاضر' : status === 'absent' ? 'غائب' : 'بانتظار',
    'التاريخ': new Date().toISOString(),
    'السنه الدراسية': student['السنه الدراسية'] ?? '',
  };

  for (const tableName of tableCandidates.attendance) {
    try {
      const { error } = await supabase.from(tableName).insert([record]);
      if (!error) return true;
      const lowerMessage = error.message.toLowerCase();
      if (lowerMessage.includes('does not exist') || lowerMessage.includes('relation')) continue;
      console.error(`Attendance insert failed for table ${tableName}:`, error.message);
      return false;
    } catch (error) {
      console.error(`Attendance table ${tableName} failed:`, error);
    }
  }

  return false;
};

export default function AttendancePage() {
  const [selectedCourse, setSelectedCourse] = useState('');
  const [selectedClass, setSelectedClass] = useState('أ');
  const [selectedYear, setSelectedYear] = useState('أولى');
  const [notice, setNotice] = useState('يرجى تسجيل دخول المشرف لبدء الجلسة');
  const [sessionActive, setSessionActive] = useState(false);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [attendanceData, setAttendanceData] = useState<Record<string, AttendanceEntry>>({});
  const [loading, setLoading] = useState(false);
  const [supervisorLoggedIn, setSupervisorLoggedIn] = useState(false);
  const [supervisorUsername, setSupervisorUsername] = useState('');
  const [supervisorPassword, setSupervisorPassword] = useState('');
  const [supervisorNames, setSupervisorNames] = useState<string[]>([]);
  const [supervisorLoadStatus, setSupervisorLoadStatus] = useState('');

  const loadSupervisorNames = async () => {
    const candidateTables = ['المشرفين', 'supervisors', 'Supervisor', 'supervisor'];

    for (const tableName of candidateTables) {
      const { data, error } = await supabase.from(tableName).select('*').limit(50);

      if (error) {
        continue;
      }

      const rows = Array.isArray(data) ? (data as Record<string, unknown>[]) : [];
      const names = rows
        .map((row) => {
          const values = Object.values(row)
            .filter((item) => item !== null && item !== undefined && String(item).trim() !== '')
            .map((item) => String(item).trim());
          return values[0] ?? '';
        })
        .filter((name) => name && name !== '');

      if (names.length > 0) {
        setSupervisorNames(names);
        setSupervisorLoadStatus(`تم جلب ${names.length} اسم من جدول ${tableName}`);
        return;
      }

      setSupervisorNames([]);
      setSupervisorLoadStatus(`تم الاتصال بجدول ${tableName} لكنه لا يحتوي على بيانات`);
      return;
    }

    setSupervisorNames([]);
    setSupervisorLoadStatus('لم يتم العثور على أي جدول باسم المشرفين أو supervisors. تحقق من اسم الجدول في Supabase.');
  };

  useEffect(() => {
    loadSupervisorNames();
  }, []);

  const handleSupervisorLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const username = supervisorUsername.trim();
    const password = supervisorPassword.trim();

    if (!username || !password) {
      setNotice('يرجى إدخال اسم المستخدم وكلمة المرور');
      return;
    }

    setLoading(true);
    try {
      await loadSupervisorNames();
      const supervisor = await findSupervisorLogin(username, password);
      if (!supervisor || !('match' in supervisor) || supervisor.match !== true) {
        const failedReason = supervisor && 'reason' in supervisor ? supervisor.reason : 'username';

        if (failedReason === 'username') {
          setNotice('اسم المستخدم غير موجود في جدول المشرفين');
        } else if (failedReason === 'password') {
          setNotice(`كلمة المرور غير صحيحة. كلمة المرور الصحيحة في الجدول هي: ${String((supervisor as any)?.expectedPassword ?? '')}`);
        } else if (failedReason === 'degree') {
          setNotice(`الدرجة غير مسموحة. الدرجة في الجدول هي: ${String((supervisor as any)?.expectedDegree ?? '')} - المسموح فقط 1 أو 2 أو 3`);
        } else {
          setNotice('اسم المستخدم أو كلمة المرور غير صحيحة أو الدرجة غير مسموحة');
        }

        setLoading(false);
        return;
      }

      const row = supervisor.row as Record<string, unknown>;
      const displayName = String(row[Object.keys(row)[0]] ?? 'المشرف');
      setSupervisorLoggedIn(true);
      setNotice(`مرحباً ${displayName} - تم تسجيل دخول المشرف بنجاح`);
    } catch (error) {
      const message = getSupabaseErrorText(error);
      console.error('Supervisor auth error:', message);
      setNotice(`حدث خطأ في تسجيل دخول المشرف: ${message}`);
    } finally {
      setLoading(false);
    }
  };

  const stats = useMemo(() => {
    const total = Object.keys(attendanceData).length;
    const present = Object.values(attendanceData).filter((item) => item.status === 'present').length;
    const absent = Object.values(attendanceData).filter((item) => item.status === 'absent').length;
    const pending = total - present - absent;

    return { total, present, absent, pending };
  }, [attendanceData]);

  const startSession = async () => {
    if (!selectedCourse || !selectedClass) {
      setNotice('يرجى اختيار المادة والفئة أولاً');
      return;
    }

    setLoading(true);
    try {
      const rows = await fetchStudentsByClass(selectedClass, selectedYear);
      if (!rows.length) {
        setNotice('لا يوجد طلاب مسجلون في هذه الفئة والسنة المحددة');
        setLoading(false);
        return;
      }

      const map = rows.reduce<Record<string, AttendanceEntry>>((acc, row) => {
        const studentId = getStudentIdentifier(row);
        if (!studentId) return acc;
        acc[studentId] = {
          id: studentId,
          name: normalizeText(row['اسم الطالب']),
          status: 'pending',
          timestamp: null,
          year: normalizeText(row['السنه الدراسية']),
        };
        return acc;
      }, {});

      setStudents(rows);
      setAttendanceData(map);
      setSessionActive(true);
      setNotice(`تم بدء جلسة الحضور للفئة ${selectedClass} في مادة ${selectedCourse}`);
    } catch (error) {
      const message = getSupabaseErrorText(error);
      console.error('Attendance fetch failed:', message);
      setNotice(`حدث خطأ أثناء جلب الطلاب من قاعدة البيانات: ${message}`);
    } finally {
      setLoading(false);
    }
  };

  const updateStudentStatus = async (student: StudentRow, status: AttendanceStatus) => {
    const studentId = getStudentIdentifier(student);
    if (!studentId) return;

    const timestamp = new Date().toLocaleTimeString('ar-EG', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

    setAttendanceData((prev) => ({
      ...prev,
      [studentId]: {
        id: studentId,
        name: normalizeText(student['اسم الطالب']),
        status,
        timestamp,
        year: normalizeText(student['السنه الدراسية']),
      },
    }));

    await saveAttendanceRecord(student, selectedCourse, selectedClass, status);

    if (status === 'absent') {
      await saveWarningRecord(student, selectedCourse, selectedClass, 'absent');
      setNotice(`تم تسجيل غياب الطالب ${student['اسم الطالب'] ?? 'غير محدد'} وإنذاره تلقائياً.`);
    } else {
      setNotice(`تم تسجيل حضور الطالب ${student['اسم الطالب'] ?? 'غير محدد'} بنجاح.`);
    }
  };

  const resetSession = () => {
    setAttendanceData({});
    setStudents([]);
    setSessionActive(false);
    setNotice('تم إلغاء الجلسة بنجاح');
  };

  const saveSession = async () => {
    if (!students.length) {
      setNotice('لا توجد بيانات للحضور لحفظها');
      return;
    }

    setLoading(true);
    try {
      let savedRecords = 0;
      let savedWarnings = 0;

      for (const student of students) {
        const studentId = getStudentIdentifier(student);
        const entry = attendanceData[studentId];
        if (!entry) continue;

        const status = entry.status;
        const didSaveAttendance = await saveAttendanceRecord(student, selectedCourse, selectedClass, status);
        if (didSaveAttendance) savedRecords += 1;

        if (status === 'absent') {
          const didSaveWarning = await saveWarningRecord(student, selectedCourse, selectedClass, 'absent');
          if (didSaveWarning) savedWarnings += 1;
        }
      }

      setNotice(`تم حفظ البيانات بنجاح: ${savedRecords} سجل حضور و ${savedWarnings} إنذار`);
      setSessionActive(false);
      setStudents([]);
      setAttendanceData({});
    } catch (error) {
      console.error('saveSession error:', error);
      setNotice('حدث خطأ أثناء حفظ بيانات الحضور');
    } finally {
      setLoading(false);
    }
  };

  const currentCourseText = selectedCourse || 'غير محدد';
  const currentClassText = selectedClass || 'غير محدد';

  return (
    <main className="attendance-shell" dir="rtl">
      <div className="attendance-page">
        <div className="attendance-topbar">
          <Link href="/" className="back-link">العودة للرئيسية</Link>
          {supervisorLoggedIn && (
            <button
              type="button"
              className="back-link"
              onClick={() => {
                setSupervisorLoggedIn(false);
                setSupervisorUsername('');
                setSupervisorPassword('');
                setNotice('تم تسجيل خروج المشرف');
              }}
              style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}
            >
              تسجيل خروج المشرف
            </button>
          )}
        </div>

        {!supervisorLoggedIn && (
          <section className="panel">
            <div className="panel-header">
              <span>تسجيل دخول المشرف</span>
            </div>

            <form onSubmit={handleSupervisorLogin}>
              <div className="field-group">
                <label htmlFor="supervisor-user">اسم المستخدم</label>
                <input
                  id="supervisor-user"
                  type="text"
                  value={supervisorUsername}
                  onChange={(event) => setSupervisorUsername(event.target.value)}
                  placeholder="أدخل اسم المستخدم"
                  required
                />
              </div>

              <div className="field-group">
                <label htmlFor="supervisor-password">كلمة المرور</label>
                <input
                  id="supervisor-password"
                  type="password"
                  value={supervisorPassword}
                  onChange={(event) => setSupervisorPassword(event.target.value)}
                  placeholder="أدخل كلمة المرور"
                  required
                />
              </div>

              <button className="action-button primary" type="submit" disabled={loading}>
                {loading ? 'جاري التحقق...' : 'دخول المشرف'}
              </button>
            </form>

            {supervisorLoadStatus && (
              <div className="notice-box" style={{ marginTop: 16, color: '#374151', fontSize: 14 }}>
                {supervisorLoadStatus}
              </div>
            )}
          </section>
        )}

        {notice && <div className="notice-box">{notice}</div>}

        {!supervisorLoggedIn && <div className="loading-box">يجب تسجيل دخول المشرف قبل استخدام نظام الحضور والغياب</div>}

        {supervisorLoggedIn && (
          <>
            <header className="attendance-header">
          <div className="attendance-header-inner">
            <img
              src="https://drive.google.com/thumbnail?id=1WBYFxtmLUfuREUY1H5Uso5ltomjshWlq&sz=w1000"
              alt="شعار المعهد"
              className="attendance-logo"
            />
            <div>
              <h1>المعهد التقاني لطب الأسنان</h1>
              <p>جامعة اللاذقية - نظام الحضور والغياب الإلكتروني</p>
            </div>
          </div>
        </header>

        <div className="attendance-title">نظام الحضور والغياب الإلكتروني</div>

        {supervisorLoggedIn && !sessionActive && (
          <section className="panel">
            <div className="panel-header">
              <span>إعدادات الجلسة</span>
            </div>

            <div className="field-group">
              <label htmlFor="course-select">اختر المادة</label>
              <select id="course-select" value={selectedCourse} onChange={(e) => setSelectedCourse(e.target.value)}>
                <option value="">-- اختر المادة --</option>
                {courseOptions.map((course) => (
                  <option value={course} key={course}>{course}</option>
                ))}
              </select>
            </div>

            <div className="field-group">
              <label htmlFor="year-select">السنة الدراسية</label>
              <select id="year-select" value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)}>
                {yearOptions.map((year) => (
                  <option value={year} key={year}>سنة {year}</option>
                ))}
              </select>
            </div>

            <div className="field-group">
              <label htmlFor="class-select">اختر الفئة</label>
              <select id="class-select" value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)}>
                <option value="">-- اختر الفئة --</option>
                {classOptions.map((className) => (
                  <option value={className} key={className}>فئة {className}</option>
                ))}
              </select>
            </div>

            <button className="action-button primary" type="button" onClick={startSession} disabled={loading}>
              {loading ? 'جاري تحميل البيانات...' : 'بدء جلسة الحضور'}
            </button>
          </section>
        )}

        {supervisorLoggedIn && loading && <div className="loading-box">جاري تحميل البيانات...</div>}

        {supervisorLoggedIn && sessionActive && (
          <section className="panel">
            <div className="panel-header">
              <span>جلسة الحضور النشطة</span>
            </div>

            <div className="session-info">
              جلسة الحضور النشطة: <strong>{currentCourseText}</strong> - الفئة <strong>{currentClassText}</strong>
            </div>

            <div className="stats-grid">
              <div className="stat-box">
                <div className="stat-value">{stats.total}</div>
                <div className="stat-label">إجمالي الطلاب</div>
              </div>
              <div className="stat-box">
                <div className="stat-value">{stats.present}</div>
                <div className="stat-label">الحاضرين</div>
              </div>
              <div className="stat-box">
                <div className="stat-value">{stats.absent}</div>
                <div className="stat-label">الغائبين</div>
              </div>
              <div className="stat-box">
                <div className="stat-value">{stats.pending}</div>
                <div className="stat-label">بانتظار التسجيل</div>
              </div>
            </div>

            <div className="student-grid">
              {students.map((student) => {
                const studentId = getStudentIdentifier(student);
                const entry = attendanceData[studentId];
                const status = entry?.status ?? 'pending';

                return (
                  <div key={studentId || student['اسم الطالب']} className={`student-card ${status}`}>
                    <div className="student-card-top">
                      <div className="student-name">{student['اسم الطالب'] ?? 'غير محدد'}</div>
                      <div className="student-id">{studentId || 'بدون رقم'}</div>
                    </div>

                    <div className="student-meta">السنة: {student['السنه الدراسية'] ?? 'غير محدد'}</div>

                    <div className="student-actions">
                      <button type="button" className="mini-btn success" onClick={() => updateStudentStatus(student, 'present')}>
                        حاضر
                      </button>
                      <button type="button" className="mini-btn danger" onClick={() => updateStudentStatus(student, 'absent')}>
                        غائب
                      </button>
                    </div>

                    <div className={`status-pill ${status}`}>
                      {status === 'present' ? 'حاضر' : status === 'absent' ? 'غائب' : 'بانتظار'}
                    </div>

                    {entry?.timestamp && <div className="timestamp">تم التسجيل: {entry.timestamp}</div>}
                  </div>
                );
              })}
            </div>

            <div className="session-actions">
              <button type="button" className="action-button warning" onClick={resetSession}>
                إعادة تعيين
              </button>
              <button type="button" className="action-button primary" onClick={saveSession} disabled={loading}>
                {loading ? 'جاري الحفظ...' : 'إنهاء الجلسة وحفظ البيانات'}
              </button>
            </div>
          </section>
        )}
          </>
        )}
      </div>
    </main>
  );
}
