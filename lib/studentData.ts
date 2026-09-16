import { supabase } from './supabase';

export type StudentRow = {
  id?: number | string;
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
  class?: string;
  year?: string;
  password?: string;
  name?: string;
  student_id?: string | number;
  studentId?: string | number;
  ['الرقم']?: string | number;
};

export const fieldAliases = {
  studentId: ['الرقم الجامعي', 'student_id', 'studentId', 'الرقم', 'id'],
  password: ['كلمة السر', 'password', 'pass'],
  studentName: ['اسم الطالب', 'student_name', 'name', 'الاسم'],
  className: ['الفئة', 'class', 'class_name', 'الفئة_الجامعية'],
  year: ['السنه الدراسية', 'السنة الدراسية', 'year', 'student_year'],
  section: ['القسم', 'section', 'department'],
  status: ['الحالة', 'status', 'الحالة_الدراسية'],
};

export const normalizeText = (value: unknown) => {
  if (value === null || value === undefined || value === '') return 'غير متوفر';
  return String(value).trim();
};

export const getRecordValue = (row: Record<string, unknown>, keys: string[]) => {
  for (const key of keys) {
    const value = row[key];
    if (value !== null && value !== undefined && value !== '') return value;
  }
  return undefined;
};

export const getStudentId = (student: Partial<StudentRow>) => {
  const value = getRecordValue(student as Record<string, unknown>, fieldAliases.studentId);
  return value === undefined ? '' : String(value).trim();
};

export const getTableRows = async (tableNames: string[]) => {
  for (const tableName of tableNames) {
    const { data, error } = await supabase.from(tableName).select('*');
    if (!error) {
      return { data: (Array.isArray(data) ? data : []) as Record<string, unknown>[], tableName };
    }

    const message = String(error.message || '').toLowerCase();
    if (message.includes('does not exist') || message.includes('relation') || message.includes('not found')) {
      continue;
    }

    return { data: [], tableName, error };
  }

  return { data: [], tableName: tableNames[0], error: null };
};

export const getStudentById = async (studentId: string) => {
  const tables = ['students'];
  for (const tableName of tables) {
    const { data, error } = await supabase.from(tableName).select('*');
    if (error) {
      const message = String(error.message || '').toLowerCase();
      if (message.includes('does not exist') || message.includes('relation') || message.includes('not found')) {
        continue;
      }
      throw error;
    }

    const rows = Array.isArray(data) ? (data as StudentRow[]) : [];
    const match = rows.find((row) => getStudentId(row) === String(studentId).trim());
    if (match) return match;
  }

  return null;
};

export const getStudentsByClass = async (classGroup: string, yearFilter = '') => {
  const rows = await getTableRows(['students']);
  const data = rows.data as StudentRow[];

  return data.filter((student) => {
    const classValue = normalizeText(getRecordValue(student as Record<string, unknown>, fieldAliases.className)).replace('فئة ', '');
    const yearValue = normalizeText(getRecordValue(student as Record<string, unknown>, fieldAliases.year));
    const classMatches = !classGroup || classValue === classGroup || classValue === `فئة ${classGroup}`;
    const yearMatches = !yearFilter || yearValue === yearFilter;
    return classMatches && yearMatches;
  });
};

export const recordAttendance = async (student: Partial<StudentRow>, course: string, classValue: string, status: 'pending' | 'present' | 'absent') => {
  const studentId = getStudentId(student);
  if (!studentId) return false;

  const payload = {
    'الرقم الجامعي': studentId,
    'اسم الطالب': normalizeText(getRecordValue(student as Record<string, unknown>, fieldAliases.studentName)),
    'الفئة': classValue,
    'المادة': course,
    'الحالة': status === 'present' ? 'حاضر' : status === 'absent' ? 'غائب' : 'بانتظار',
    'التاريخ': new Date().toISOString(),
    'السنه الدراسية': normalizeText(getRecordValue(student as Record<string, unknown>, fieldAliases.year)),
  };

  const attendanceTables = ['attendance', 'الحضور', 'حضور'];
  for (const tableName of attendanceTables) {
    try {
      const { error } = await supabase.from(tableName).insert([payload]);
      if (!error) return true;
      const message = String(error.message || '').toLowerCase();
      if (message.includes('does not exist') || message.includes('relation') || message.includes('not found')) {
        continue;
      }
      console.error(`Attendance insert failed for ${tableName}:`, error.message);
      return false;
    } catch (error) {
      console.error('Attendance insert threw', error);
    }
  }

  return false;
};

export const recordWarning = async (student: Partial<StudentRow>, course: string, classValue: string, reason = 'غياب') => {
  const studentId = getStudentId(student);
  if (!studentId) return false;

  const payload = {
    'الرقم الجامعي': studentId,
    'اسم الطالب': normalizeText(getRecordValue(student as Record<string, unknown>, fieldAliases.studentName)),
    'الفئة': classValue,
    'المادة': course,
    'نوع الإنذار': reason === 'غياب' ? 'إنذار غياب' : 'إنذار',
    'السبب': reason,
    'التاريخ': new Date().toISOString(),
    'ملاحظة': 'تم تسجيل إنذار تلقائي بسبب غياب الطالب.',
  };

  const warningTables = ['warnings', 'الانذارات', 'الإنذارات'];
  for (const tableName of warningTables) {
    try {
      const { error } = await supabase.from(tableName).insert([payload]);
      if (!error) return true;
      const message = String(error.message || '').toLowerCase();
      if (message.includes('does not exist') || message.includes('relation') || message.includes('not found')) {
        continue;
      }
      console.error(`Warning insert failed for ${tableName}:`, error.message);
      return false;
    } catch (error) {
      console.error('Warning insert threw', error);
    }
  }

  return false;
};

export const getWarningsForStudent = async (studentId: string) => {
  const { data } = await getTableRows(['warnings', 'الانذارات', 'الإنذارات']);
  return (data as Record<string, unknown>[]).filter((row) => {
    const rowId = String(getRecordValue(row, ['الرقم الجامعي', 'student_id', 'studentId']) ?? '');
    return rowId === String(studentId).trim();
  });
};

export const getAttendanceForStudent = async (studentId: string) => {
  const { data } = await getTableRows(['attendance', 'الحضور', 'حضور']);
  return (data as Record<string, unknown>[]).filter((row) => {
    const rowId = String(getRecordValue(row, ['الرقم الجامعي', 'student_id', 'studentId']) ?? '');
    return rowId === String(studentId).trim();
  });
};
