'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
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
  const [notice, setNotice] = useState('يرجى اختيار المادة والفئة لبدء الجلسة');
  const [sessionActive, setSessionActive] = useState(false);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [attendanceData, setAttendanceData] = useState<Record<string, AttendanceEntry>>({});
  const [loading, setLoading] = useState(false);

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
        </div>

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

        {!sessionActive && (
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

        {notice && <div className="notice-box">{notice}</div>}

        {loading && <div className="loading-box">جاري تحميل البيانات...</div>}

        {sessionActive && (
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
      </div>
    </main>
  );
}
