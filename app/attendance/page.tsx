'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { writeAuditLog } from '../../lib/auditLog';

type StudentRow = {
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

type AttendanceStatus = 'pending' | 'present' | 'absent';
type SupervisorFeature = 'attendance' | 'admin' | 'supervisors' | 'logs' | 'students';
type AdminRecord = Record<string, unknown>;

type AttendanceEntry = {
  id: string;
  name: string;
  status: AttendanceStatus;
  timestamp: string | null;
  year: string;
};

type PendingAttendanceJob = {
  type: 'attendance' | 'warning';
  student: StudentRow;
  course: string;
  classValue: string;
  status: AttendanceStatus;
  supervisor: string;
  queuedAt: string;
};

type RecentAttendanceSession = {
  id: string;
  course: string;
  classValue: string;
  supervisor: string;
  startedAt: string;
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
  attendance: ['الحضور'],
  warnings: ['الإنذارات'],
  sessions: ['جلسات الحضور'],
  supervisorWarnings: ['إنذارات المشرفين'],
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
const allowedStudentClasses = ['أ', 'ب', 'ج', 'د'];
const allowedStudentYears = ['أولى', 'ثانية'];
const defaultStudentSection = 'تعويضات أسنان';
const pendingAttendanceStorageKey = 'udti-pending-attendance-jobs';
const studentCacheStorageKey = 'udti-attendance-student-cache';
const localSessionLockKey = 'udti-active-attendance-session';
const recentSessionWindowMs = 60 * 60 * 1000;
const supervisorSessionStorageKey = 'udti-supervisor-session';

type StoredSupervisorSession = {
  username: string;
  degree: string;
  features: SupervisorFeature[];
  selectedFeature?: SupervisorFeature | null;
};

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

const getSupervisorDegree = (row: Record<string, unknown>) => {
  const value = row['الدرجة'] ?? row.degree ?? row['degree'] ?? row['درجه'] ?? row['rank'] ?? '';
  return normalizeSupervisorDegree(value);
};

const getSupervisorFeatures = (degree: string): SupervisorFeature[] => {
  if (degree === '1') return ['admin', 'attendance', 'supervisors', 'logs', 'students'];
  if (['2', '3'].includes(degree)) return ['attendance'];
  return [];
};

const getAdminRecordValue = (row: AdminRecord, keys: string[]) => {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null && row[key] !== '') return row[key];
  }
  return '';
};

const getFullStudentName = (row: AdminRecord | StudentRow) => {
  const firstName = String(row['اسم الطالب'] ?? '').trim();
  const fatherName = String(row['اسم الاب'] ?? '').trim();
  const familyName = String(row['الكنية'] ?? '').trim();
  return [firstName, fatherName, familyName].filter(Boolean).join(' ') || 'غير محدد';
};

const getStudentDisplayName = (student: StudentRow) => {
  const firstName = String(student['اسم الطالب'] ?? student.name ?? '').trim();
  const fatherName = String(student['اسم الاب'] ?? '').trim();
  const familyName = String(student['الكنية'] ?? '').trim();
  return [firstName, fatherName, familyName].filter(Boolean).join(' ') || 'غير محدد';
};

const adminIdCandidates = ['warnig_id', 'warning_id', 'warningId', 'warnigId', 'attendance_id', 'id'];

const getAdminRecordId = (row: AdminRecord) => {
  const key = adminIdCandidates.find((candidate) => row[candidate] !== undefined && row[candidate] !== null && row[candidate] !== '');
  return key ? String(row[key]).trim() : '';
};

const getAdminRecordDate = (row: AdminRecord) => String(getAdminRecordValue(row, ['التاريخ', 'started_at', 'created_at', 'date']) || '');

const getAdminRecordSupervisor = (row: AdminRecord) => String(getAdminRecordValue(row, ['المشرف', 'اسم المشرف', 'supervisor', 'username']) || 'غير محدد');

const getAdminRecordCourse = (row: AdminRecord) => {
  const directCourse = String(getAdminRecordValue(row, ['المادة', 'course', 'subject']) || '').trim();
  if (directCourse) return directCourse;
  const reason = String(getAdminRecordValue(row, ['السبب', 'التفاصيل']) || '');
  return reason.match(/مادة\s+(.+)$/)?.[1]?.trim() || '';
};

const isDatabaseTableMissing = (error: { code?: string; message?: string } | null | undefined) => {
  const message = String(error?.message || '').toLowerCase();
  return error?.code === 'PGRST205' || message.includes('does not exist') || message.includes('relation') || message.includes('not found');
};

const loadAdminRecords = async () => {
  const [attendanceResult, warningsResult, studentsResult, supervisorsResult, supervisorWarningsResult] = await Promise.all([
    supabase.from('الحضور').select('*'),
    supabase.from('الإنذارات').select('*'),
    supabase.from('students').select('*'),
    supabase.from('المشرفين').select('*'),
    supabase.from(tableCandidates.supervisorWarnings[0]).select('*'),
  ]);

  if (attendanceResult.error && !isDatabaseTableMissing(attendanceResult.error)) throw attendanceResult.error;
  if (warningsResult.error && !isDatabaseTableMissing(warningsResult.error)) throw warningsResult.error;

  const studentNames: Record<string, string> = {};
  if (!studentsResult.error && Array.isArray(studentsResult.data)) {
    (studentsResult.data as AdminRecord[]).forEach((student) => {
      const studentId = String(getAdminRecordValue(student, ['الرقم الجامعي', 'student_id', 'studentId', 'id'])).trim();
      if (studentId) studentNames[studentId] = getFullStudentName(student);
    });
  }

  return {
    attendance: Array.isArray(attendanceResult.data) ? attendanceResult.data as AdminRecord[] : [],
    warnings: Array.isArray(warningsResult.data) ? warningsResult.data as AdminRecord[] : [],
    studentNames,
    supervisors: !supervisorsResult.error && Array.isArray(supervisorsResult.data)
      ? supervisorsResult.data as AdminRecord[]
      : [],
    supervisorWarnings: !supervisorWarningsResult.error && Array.isArray(supervisorWarningsResult.data)
      ? supervisorWarningsResult.data as AdminRecord[]
      : [],
    auditLogs: [],
  };
};

const loadAuditLogs = async () => {
  const { data, error } = await supabase
    .from('سجلات النظام')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(300);
  if (error) throw error;
  return Array.isArray(data) ? data as AdminRecord[] : [];
};

const insertAdminAttendance = async (warning: AdminRecord, supervisor: string) => {
  const payload = {
    'الرقم الجامعي': getAdminRecordValue(warning, ['الرقم الجامعي', 'student_id', 'studentId']),
    'اسم الطالب': getAdminRecordValue(warning, ['اسم الطالب', 'student_name', 'name']),
    'المادة': getAdminRecordCourse(warning),
    'الفئة': getAdminRecordValue(warning, ['الفئة', 'class', 'class_name']),
    'الحالة': 'حاضر',
    'التاريخ': new Date().toISOString(),
    'الوقت': new Date().toLocaleTimeString('en-GB', { hour12: false }),
    'المشرف': supervisor || 'مشرف الدرجة الأولى',
  };

  const firstAttempt = await supabase.from('الحضور').insert([payload]);
  if (!firstAttempt.error) return { success: true };
  if (!String(firstAttempt.error.message || '').toLowerCase().includes('column')) {
    return { success: false, error: firstAttempt.error.message };
  }

  const { 'الحالة': _status, ...legacyPayload } = payload;
  const fallbackAttempt = await supabase.from('الحضور').insert([legacyPayload]);
  return fallbackAttempt.error ? { success: false, error: fallbackAttempt.error.message } : { success: true };
};

const deleteAdminWarning = async (warning: AdminRecord) => {
  const warningId = getAdminRecordId(warning);
  if (!warningId) return { success: false, error: 'لا يوجد معرف للإنذار' };
  const idKey = adminIdCandidates.find((candidate) => String(warning[candidate] ?? '') === warningId) ?? 'warnig_id';
  const { error } = await supabase.from('الإنذارات').delete().eq(idKey, warningId);
  return error ? { success: false, error: error.message } : { success: true };
};

const updateAdminWarning = async (warning: AdminRecord, details: string) => {
  const warningId = getAdminRecordId(warning);
  if (!warningId) return { success: false, error: 'لا يوجد معرف للإنذار' };
  const idKey = adminIdCandidates.find((candidate) => String(warning[candidate] ?? '') === warningId) ?? 'warnig_id';
  const updates: AdminRecord = { 'التفاصيل': details };
  if (warning['السبب'] !== undefined) updates['السبب'] = details;
  const { error } = await supabase.from('الإنذارات').update(updates).eq(idKey, warningId);
  return error ? { success: false, error: error.message } : { success: true };
};

const updateAdminAttendance = async (record: AdminRecord, status: 'حاضر' | 'غائب', absenceDetails = '') => {
  const recordId = getAdminRecordId(record);
  if (!recordId) return { success: false, error: 'لا يوجد معرف لسجل الحضور' };
  const idKey = adminIdCandidates.find((candidate) => String(record[candidate] ?? '') === recordId) ?? 'id';
  const updates: AdminRecord = {};
  if (record['الحالة'] !== undefined) updates['الحالة'] = status;
  if (record['تفاصيل الغياب'] !== undefined) updates['تفاصيل الغياب'] = absenceDetails;
  else if (record['التفاصيل'] !== undefined) updates['التفاصيل'] = absenceDetails;
  else if (record['ملاحظة'] !== undefined) updates['ملاحظة'] = absenceDetails;
  if (!Object.keys(updates).length) return { success: false, error: 'جدول الحضور لا يحتوي حقول تعديل الحالة' };

  const { error } = await supabase.from('الحضور').update(updates).eq(idKey, recordId);
  return error ? { success: false, error: error.message } : { success: true };
};

const createSupervisorWarning = async (username: string, degree: string, details: string, issuer: string) => {
  const { error } = await supabase.from(tableCandidates.supervisorWarnings[0]).insert([{
    'اسم المستخدم': username,
    'الدرجة': degree,
    'التفاصيل': details,
    'أنشأه': issuer,
    'التاريخ': new Date().toISOString().split('T')[0],
    'الوقت': new Date().toLocaleTimeString('en-GB', { hour12: false }),
  }]);
  return error ? { success: false, error: error.message } : { success: true };
};

const supervisorIdCandidates = ['id', 'supervisor_id', 'معرف المشرف', 'رقم المشرف'];

const getSupervisorRecordId = (row: AdminRecord) => {
  const key = supervisorIdCandidates.find((candidate) => row[candidate] !== undefined && row[candidate] !== null && row[candidate] !== '');
  return key ? String(row[key]).trim() : '';
};

const getSupervisorFieldKey = (row: AdminRecord, kind: 'username' | 'password' | 'degree') => {
  const candidates = kind === 'username'
    ? ['اسم المستخدم', 'username', 'اسم_المستخدم', 'user_name']
    : kind === 'password'
      ? ['كلمة المرور', 'password', 'كلمة_المرور', 'pass']
      : ['الدرجة', 'degree', 'درجه', 'rank'];
  return candidates.find((candidate) => candidate in row) ?? candidates[0];
};

const createSupervisorRecord = async (username: string, password: string, degree: string) => {
  const { error } = await supabase.from('المشرفين').insert([{
    'اسم المستخدم': username,
    'كلمة المرور': password,
    'الدرجة': degree,
  }]);
  return error ? { success: false, error: error.message } : { success: true };
};

const updateSupervisorRecord = async (row: AdminRecord, values: { username: string; password: string; degree: string }) => {
  const id = getSupervisorRecordId(row);
  if (!id) return { success: false, error: 'لا يوجد معرف لهذا المشرف' };
  const updates: AdminRecord = {
    [getSupervisorFieldKey(row, 'username')]: values.username,
    [getSupervisorFieldKey(row, 'degree')]: values.degree,
  };
  if (values.password.trim()) updates[getSupervisorFieldKey(row, 'password')] = values.password;
  const idKey = supervisorIdCandidates.find((candidate) => String(row[candidate] ?? '') === id) ?? 'id';
  const { error } = await supabase.from('المشرفين').update(updates).eq(idKey, id);
  return error ? { success: false, error: error.message } : { success: true };
};

const deleteSupervisorRecord = async (row: AdminRecord) => {
  const id = getSupervisorRecordId(row);
  if (!id) return { success: false, error: 'لا يوجد معرف لهذا المشرف' };
  const idKey = supervisorIdCandidates.find((candidate) => String(row[candidate] ?? '') === id) ?? 'id';
  const { error } = await supabase.from('المشرفين').delete().eq(idKey, id);
  return error ? { success: false, error: error.message } : { success: true };
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
  const direct = [
    student['الرقم الجامعي'],
    student['الرقم'],
    student.student_id,
    student.studentId,
    student.id,
    student['id'],
  ].find((value) => value !== undefined && value !== null && String(value).trim() !== '');

  if (direct !== undefined) return String(direct).trim();

  for (const [key, value] of Object.entries(student)) {
    if (value !== undefined && value !== null && String(value).trim() !== '' && /(رقم|id|student)/i.test(key)) {
      return String(value).trim();
    }
  }

  return '';
};

const normalizeStudentClassValue = (value: string) => {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  const normalized = raw.toLowerCase().replace(/\s+/g, '');
  if (['a', 'أ'].includes(normalized)) return 'أ';
  if (['b', 'ب'].includes(normalized)) return 'ب';
  if (['c', 'ج'].includes(normalized)) return 'ج';
  if (['d', 'د'].includes(normalized)) return 'د';
  return '';
};

const normalizeStudentYearValue = (value: string) => {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  const normalized = raw.toLowerCase().replace(/\s+/g, '');
  if (['1', 'اولى', 'أولى', 'first'].includes(normalized)) return 'أولى';
  if (['2', 'ثانية', 'second'].includes(normalized)) return 'ثانية';
  return '';
};

const getStudentValidationError = (draft: Record<string, string>) => {
  const requiredFields = [
    'اسم الطالب',
    'اسم الاب',
    'الكنية',
    'رقم الهاتف',
    'البريد الإلكتروني',
  ] as const;

  for (const field of requiredFields) {
    const value = String(draft[field] ?? '').trim();
    if (!value) {
      return `الحقل ${field} مطلوب ولا يمكن تركه فارغاً`;
    }
  }

  const classValue = normalizeStudentClassValue(String(draft['الفئة'] ?? ''));
  if (!classValue || !allowedStudentClasses.includes(classValue as typeof allowedStudentClasses[number])) {
    return 'الفئة يجب أن تكون واحدة من: أ، ب، ج، د فقط';
  }

  const yearValue = normalizeStudentYearValue(String(draft['السنه الدراسية'] ?? ''));
  if (!yearValue || !allowedStudentYears.includes(yearValue as typeof allowedStudentYears[number])) {
    return 'السنة الدراسية يجب أن تكون: أولى أو ثانية فقط';
  }

  if (!String(draft['القسم'] ?? '').trim()) {
    return 'القسم مطلوب ويجب أن يكون تلقائياً تعويضات أسنان';
  }

  return '';
};

const normalizeStudentDraftValues = (draft: Record<string, string>) => {
  const normalized: Record<string, string> = {
    ...draft,
    'القسم': String(draft['القسم'] ?? defaultStudentSection).trim() || defaultStudentSection,
    'الفئة': normalizeStudentClassValue(draft['الفئة'] ?? '') || '',
    'السنه الدراسية': normalizeStudentYearValue(draft['السنه الدراسية'] ?? '') || '',
  };
  return normalized;
};

const buildStudentEditDraft = (student: StudentRow) => ({
  'الرقم الجامعي': String(getStudentIdentifier(student) || student['الرقم الجامعي'] || student['الرقم'] || student.student_id || student.studentId || student.id || ''),
  'كلمة السر': String(student['كلمة السر'] ?? student.password ?? ''),
  'اسم الطالب': String(student['اسم الطالب'] ?? student.name ?? ''),
  'اسم الاب': String(student['اسم الاب'] ?? ''),
  'الكنية': String(student['الكنية'] ?? ''),
  'القسم': String(student['القسم'] ?? ''),
  'الفئة': String(student['الفئة'] ?? ''),
  'السنه الدراسية': String(student['السنه الدراسية'] ?? student.year ?? ''),
  'رقم الهاتف': String(student['رقم الهاتف'] ?? ''),
  'البريد الإلكتروني': String(student['البريد الإلكتروني'] ?? ''),
  'نوع التسجيل': String(student['نوع التسجيل'] ?? ''),
  'ملاحظة': String(student['ملاحظة'] ?? ''),
});

const readPendingAttendanceJobs = (): PendingAttendanceJob[] => {
  if (typeof window === 'undefined') return [];

  try {
    const stored = window.localStorage.getItem(pendingAttendanceStorageKey);
    const jobs = stored ? JSON.parse(stored) : [];
    return Array.isArray(jobs) ? jobs : [];
  } catch {
    return [];
  }
};

const writePendingAttendanceJobs = (jobs: PendingAttendanceJob[]) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(pendingAttendanceStorageKey, JSON.stringify(jobs));
};

const enqueueAttendanceJobs = (jobs: PendingAttendanceJob[]) => {
  const existingJobs = readPendingAttendanceJobs();
  writePendingAttendanceJobs([...existingJobs, ...jobs]);
};

const getStudentCacheKey = (classValue: string, year: string) => `${studentCacheStorageKey}:${classValue}:${year}`;

const readCachedStudents = (classValue: string, year: string): StudentRow[] => {
  if (typeof window === 'undefined') return [];

  try {
    const stored = window.localStorage.getItem(getStudentCacheKey(classValue, year));
    const students = stored ? JSON.parse(stored) : [];
    return Array.isArray(students) ? students as StudentRow[] : [];
  } catch {
    return [];
  }
};

const writeCachedStudents = (classValue: string, year: string, students: StudentRow[]) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(getStudentCacheKey(classValue, year), JSON.stringify(students));
};

const getSessionKey = (course: string, classValue: string) => `${course.trim()}::${classValue.trim()}`;

const readLocalSessionLock = () => {
  if (typeof window === 'undefined') return null;

  try {
    const stored = window.localStorage.getItem(localSessionLockKey);
    return stored ? JSON.parse(stored) as RecentAttendanceSession : null;
  } catch {
    return null;
  }
};

const writeLocalSessionLock = (session: RecentAttendanceSession) => {
  if (typeof window !== 'undefined') window.localStorage.setItem(localSessionLockKey, JSON.stringify(session));
};

const clearLocalSessionLock = (sessionId: string) => {
  const current = readLocalSessionLock();
  if (current?.id === sessionId && typeof window !== 'undefined') window.localStorage.removeItem(localSessionLockKey);
};

const normalizeSessionRow = (row: Record<string, unknown>): RecentAttendanceSession | null => {
  const id = String(row['session_id'] ?? row['معرف الجلسة'] ?? row['id'] ?? '').trim();
  const course = String(row['المادة'] ?? row['course'] ?? '').trim();
  const classValue = String(row['الفئة'] ?? row['class'] ?? '').trim();
  const supervisor = String(row['المشرف'] ?? row['supervisor'] ?? '').trim();
  const startedAt = String(row['بدأت في'] ?? row['started_at'] ?? row['التاريخ'] ?? '').trim();
  if (!id || !course || !classValue || !startedAt) return null;
  return { id, course, classValue, supervisor, startedAt };
};

const isMissingSessionTableError = (error: { code?: string; message?: string } | null | undefined) => {
  const message = String(error?.message || '').toLowerCase();
  return error?.code === 'PGRST205'
    || message.includes('could not find the table')
    || message.includes('does not exist')
    || message.includes('relation')
    || message.includes('not found');
};

const loadRecentAttendanceSessions = async () => {
  const cutoff = Date.now() - recentSessionWindowMs;
  const { data, error } = await supabase.from(tableCandidates.sessions[0]).select('*');
  if (error) {
    if (isMissingSessionTableError(error)) return [];
    throw error;
  }

  return (Array.isArray(data) ? data as Record<string, unknown>[] : [])
    .map(normalizeSessionRow)
    .filter((session): session is RecentAttendanceSession => Boolean(session))
    .filter((session) => Date.parse(session.startedAt) >= cutoff)
    .sort((left, right) => Date.parse(right.startedAt) - Date.parse(left.startedAt));
};

const closeExpiredAttendanceSessions = async () => {
  const cutoff = new Date(Date.now() - recentSessionWindowMs).toISOString();
  const { error } = await supabase
    .from(tableCandidates.sessions[0])
    .update({ الحالة: 'منتهية', ended_at: new Date().toISOString() })
    .eq('الحالة', 'نشطة')
    .lt('started_at', cutoff);
  if (error && !isMissingSessionTableError(error)) console.error('Expired session cleanup failed:', error.message);
};

const createAttendanceSession = async (course: string, classValue: string, supervisor: string) => {
  const session: RecentAttendanceSession = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    course,
    classValue,
    supervisor: supervisor || 'مشرف غير محدد',
    startedAt: new Date().toISOString(),
  };

  await closeExpiredAttendanceSessions();

  const { error } = await supabase.from(tableCandidates.sessions[0]).insert([{
    session_id: session.id,
    session_key: getSessionKey(session.course, session.classValue),
    المادة: session.course,
    الفئة: session.classValue,
    المشرف: session.supervisor,
    started_at: session.startedAt,
    الحالة: 'نشطة',
  }]);

  if (error && !isMissingSessionTableError(error)) return { session: null, error };
  writeLocalSessionLock(session);
  return { session, error: null };
};

const closeAttendanceSession = async (sessionId: string) => {
  const { error } = await supabase
    .from(tableCandidates.sessions[0])
    .update({ الحالة: 'منتهية', ended_at: new Date().toISOString() })
    .eq('session_id', sessionId);

  clearLocalSessionLock(sessionId);
  return !error || isMissingSessionTableError(error);
};

const stripAutoGeneratedWarningIds = (payload: Record<string, unknown>) => {
  const sanitized = { ...payload };
  ['warnig_id', 'warning_id', 'warningId', 'warnigId', 'id'].forEach((key) => {
    delete sanitized[key];
  });
  return sanitized;
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

const saveWarningRecord = async (student: StudentRow, course: string, classValue: string, status: 'absent' | 'present', supervisor: string) => {
  const studentId = getStudentIdentifier(student);
  if (!studentId) {
    console.warn('[attendance][warning] student id missing before insert', { student, course, classValue, status });
    return false;
  }

  if (!course || !classValue) {
    console.warn('[attendance][warning] missing course/class before insert', { studentId, course, classValue, status });
    return false;
  }

  const warningDate = new Date().toISOString().split('T')[0];
  const warningTime = new Date().toLocaleTimeString('en-GB', { hour12: false });
  const courseName = course || 'غير محددة';
  const reasonText = `غياب في مادة ${courseName}`;
  const detailsText = '';

  const baseRecord = stripAutoGeneratedWarningIds({
    'الرقم الجامعي': studentId,
    'اسم الطالب': getFullStudentName(student),
    'نوع الإنذار': status === 'absent' ? 'إنذار غياب' : 'حضور',
    'السبب': reasonText,
    'التفاصيل': detailsText,
    'التاريخ': warningDate,
    'الوقت': warningTime,
    'المشرف': supervisor || 'مشرف غير محدد',
    'تم الإرسال': true,
  });

  const payloadVariants = [baseRecord, { ...baseRecord, 'الوقت': undefined, 'المشرف': undefined }];

  for (const tableName of tableCandidates.warnings) {
    for (const payload of payloadVariants) {
      console.log('[attendance][warning] attempting insert', {
        tableName,
        payloadKeys: Object.keys(payload),
        payload,
        studentId,
        course,
        classValue,
        status,
      });

      try {
        const cleanPayload = Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== undefined));
        const { data, error } = await supabase.from(tableName).insert([cleanPayload]).select();
        console.log('[attendance][warning] insert response', { tableName, data, error: error ? error.message : null });

        if (!error) return true;
        const lowerMessage = error.message.toLowerCase();
        if (lowerMessage.includes('does not exist') || lowerMessage.includes('relation') || lowerMessage.includes('column') || lowerMessage.includes('not found')) {
          console.warn('[attendance][warning] table/column mismatch', { tableName, error: error.message, payloadKeys: Object.keys(payload) });
          continue;
        }

        console.error('[attendance][warning] insert failed', { tableName, error: error.message, payloadKeys: Object.keys(payload), payload });
        return false;
      } catch (error) {
        console.error('[attendance][warning] api exception', { tableName, error: getSupabaseErrorText(error), payloadKeys: Object.keys(payload), payload });
      }
    }
  }

  console.warn('[attendance][warning] all warning insert attempts failed', { studentId, course, classValue, status, attemptedTables: tableCandidates.warnings });
  return false;
};

const saveAttendanceRecord = async (student: StudentRow, course: string, classValue: string, status: AttendanceStatus, supervisor: string) => {
  const studentId = getStudentIdentifier(student);
  if (!studentId) {
    console.warn('[attendance][save] student id missing before insert', { student, course, classValue, status });
    return false;
  }

  if (!course || !classValue) {
    console.warn('[attendance][save] missing course/class before insert', { studentId, course, classValue, status });
    return false;
  }

  const attendanceDate = new Date().toISOString().split('T')[0];
  const attendanceTime = new Date().toLocaleTimeString('en-GB', { hour12: false });

  const baseRecord = {
    'التاريخ': attendanceDate,
    'الوقت': attendanceTime,
    'الرقم الجامعي': studentId,
    'اسم الطالب': getFullStudentName(student),
    'المادة': course,
    'الفئة': classValue,
    'الحالة': status === 'present' ? 'حاضر' : status === 'absent' ? 'غائب' : 'بانتظار',
    'المشرف': supervisor || 'مشرف غير محدد',
  };

  const payloadVariants = [
    baseRecord,
    { ...baseRecord, 'الحالة': undefined },
    { ...baseRecord, 'الحالة': undefined, 'المشرف': undefined },
  ];

  for (const tableName of tableCandidates.attendance) {
    for (const payload of payloadVariants) {
      console.log('[attendance][save] attempting insert', {
        tableName,
        payloadKeys: Object.keys(payload),
        payload,
        studentId,
        course,
        classValue,
        status,
      });

      try {
        const cleanPayload = Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== undefined));
        const { data, error } = await supabase.from(tableName).insert([cleanPayload]).select();
        console.log('[attendance][save] insert response', { tableName, data, error: error ? error.message : null });

        if (!error) return true;
        const lowerMessage = error.message.toLowerCase();
        if (lowerMessage.includes('does not exist') || lowerMessage.includes('relation') || lowerMessage.includes('column') || lowerMessage.includes('not found')) {
          console.warn('[attendance][save] table/column mismatch', { tableName, error: error.message, payloadKeys: Object.keys(payload) });
          continue;
        }

        console.error('[attendance][save] insert failed', { tableName, error: error.message, payloadKeys: Object.keys(payload), payload });
        return false;
      } catch (error) {
        console.error('[attendance][save] api exception', { tableName, error: getSupabaseErrorText(error), payloadKeys: Object.keys(payload), payload });
      }
    }
  }

  console.warn('[attendance][save] all attendance insert attempts failed', { studentId, course, classValue, status, attemptedTables: tableCandidates.attendance });
  return false;
};

const savePendingAttendanceJob = async (job: PendingAttendanceJob) => {
  if (job.type === 'warning') {
    return saveWarningRecord(job.student, job.course, job.classValue, 'absent', job.supervisor);
  }

  return saveAttendanceRecord(job.student, job.course, job.classValue, job.status, job.supervisor);
};

const flushPendingAttendanceJobs = async () => {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return 0;

  const jobs = readPendingAttendanceJobs();
  if (!jobs.length) return 0;

  const results = await Promise.all(jobs.map(async (job) => ({
    job,
    saved: await savePendingAttendanceJob(job),
  })));
  const remainingJobs = results.filter((result) => !result.saved).map((result) => result.job);
  writePendingAttendanceJobs(remainingJobs);
  return jobs.length - remainingJobs.length;
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
  const [supervisorFeatures, setSupervisorFeatures] = useState<SupervisorFeature[]>([]);
  const [supervisorDegree, setSupervisorDegree] = useState('');
  const [selectedFeature, setSelectedFeature] = useState<SupervisorFeature | null>(null);
  const [recentSessions, setRecentSessions] = useState<RecentAttendanceSession[]>([]);
  const [activeSession, setActiveSession] = useState<RecentAttendanceSession | null>(null);
  const saveInProgressRef = useRef(false);
  const [adminAttendance, setAdminAttendance] = useState<AdminRecord[]>([]);
  const [adminWarnings, setAdminWarnings] = useState<AdminRecord[]>([]);
  const [adminStudentNames, setAdminStudentNames] = useState<Record<string, string>>({});
  const [adminSupervisors, setAdminSupervisors] = useState<AdminRecord[]>([]);
  const [adminSupervisorWarnings, setAdminSupervisorWarnings] = useState<AdminRecord[]>([]);
  const [supervisorRecords, setSupervisorRecords] = useState<AdminRecord[]>([]);
  const [auditLogs, setAuditLogs] = useState<AdminRecord[]>([]);
  const [supervisorForm, setSupervisorForm] = useState({ username: '', password: '', degree: '3' });
  const [editingSupervisorId, setEditingSupervisorId] = useState('');
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminSearch, setAdminSearch] = useState('');
  const [adminCourseFilter, setAdminCourseFilter] = useState('');
  const [adminDateFrom, setAdminDateFrom] = useState('');
  const [adminDateTo, setAdminDateTo] = useState('');
  const [adminRecordType, setAdminRecordType] = useState<'all' | 'attendance' | 'warnings'>('all');
  const [selectedAdminStudentId, setSelectedAdminStudentId] = useState('');
  const [studentDirectory, setStudentDirectory] = useState<StudentRow[]>([]);
  const [studentDirectorySearch, setStudentDirectorySearch] = useState('');
  const [studentClassFilter, setStudentClassFilter] = useState('');
  const [studentYearFilter, setStudentYearFilter] = useState('');
  const [studentSectionFilter, setStudentSectionFilter] = useState('');
  const [editingStudentId, setEditingStudentId] = useState('');
  const [editingStudentDraft, setEditingStudentDraft] = useState<Record<string, string>>({});
  const [showCreateStudentForm, setShowCreateStudentForm] = useState(false);
  const [newStudentForm, setNewStudentForm] = useState<Record<string, string>>({
    'الرقم الجامعي': '',
    'كلمة السر': '',
    'اسم الطالب': '',
    'اسم الاب': '',
    'الكنية': '',
    'القسم': defaultStudentSection,
    'الفئة': '',
    'السنه الدراسية': '',
    'رقم الهاتف': '',
    'البريد الإلكتروني': '',
    'نوع التسجيل': 'جديد',
    'ملاحظة': '',
  });

  useEffect(() => {
    try {
      const storedSupervisor = window.localStorage.getItem(supervisorSessionStorageKey);
      if (!storedSupervisor) return;
      const session = JSON.parse(storedSupervisor) as StoredSupervisorSession;
      if (session?.username && Array.isArray(session.features)) {
        setSupervisorUsername(session.username);
        setSupervisorDegree(session.degree || '');
        setSupervisorFeatures(session.features);
        setSelectedFeature(session.selectedFeature ?? null);
        setSupervisorLoggedIn(true);
        setNotice('تمت استعادة جلسة المشرف. اختر الوظيفة للمتابعة.');
      }
    } catch {
      window.localStorage.removeItem(supervisorSessionStorageKey);
    }
  }, []);

  useEffect(() => {
    const syncPendingAttendance = async () => {
      const savedCount = await flushPendingAttendanceJobs();
      if (savedCount > 0) {
        setNotice(`تمت مزامنة ${savedCount} عملية حضور معلقة بعد عودة الاتصال.`);
      }
    };

    window.addEventListener('online', syncPendingAttendance);
    void syncPendingAttendance();

    return () => window.removeEventListener('online', syncPendingAttendance);
  }, []);

  const refreshRecentSessions = async () => {
    try {
      setRecentSessions(await loadRecentAttendanceSessions());
    } catch (error) {
      console.error('Recent attendance sessions load failed:', getSupabaseErrorText(error));
    }
  };

  const refreshAdminData = async () => {
    setAdminLoading(true);
    try {
      const records = await loadAdminRecords();
      setAdminAttendance(records.attendance);
      setAdminWarnings(records.warnings);
      setAdminStudentNames(records.studentNames);
      setAdminSupervisors(records.supervisors);
      setAdminSupervisorWarnings(records.supervisorWarnings);
      setSupervisorRecords(records.supervisors);
    } catch (error) {
      setNotice(`تعذر تحميل بيانات لوحة الإدارة: ${getSupabaseErrorText(error)}`);
    } finally {
      setAdminLoading(false);
    }
  };

  const refreshAuditLogs = async () => {
    setAdminLoading(true);
    try {
      setAuditLogs(await loadAuditLogs());
    } catch (error) {
      setNotice(`تعذر تحميل سجلات النظام: ${getSupabaseErrorText(error)}`);
    } finally {
      setAdminLoading(false);
    }
  };

  const refreshStudentDirectory = async () => {
    setAdminLoading(true);
    try {
      const tableNames = ['students', 'student'];
      let finalRows: StudentRow[] = [];
      let lastError: unknown = null;

      for (const tableName of tableNames) {
        const { data, error } = await supabase.from(tableName).select('*');
        if (!error) {
          finalRows = Array.isArray(data) ? (data as StudentRow[]) : [];
          break;
        }
        lastError = error;
      }

      if (!finalRows.length && lastError) throw lastError;
      setStudentDirectory(finalRows);
    } catch (error) {
      setNotice(`تعذر تحميل بيانات الطلاب: ${getSupabaseErrorText(error)}`);
    } finally {
      setAdminLoading(false);
    }
  };

  const sanitizedStudentUpdatePayload = (payload: Record<string, string>) => {
    return Object.fromEntries(
      Object.entries(payload).filter(([, value]) => value !== null && value !== undefined && String(value).trim() !== '')
    );
  };

  const handleOpenStudentEditor = (student: StudentRow) => {
    const selectedStudentId = getStudentIdentifier(student);
    if (!selectedStudentId) {
      const fallbackId = Object.entries(student).find(([key, value]) => {
        if (value === undefined || value === null || String(value).trim() === '') return false;
        return /(?:رقم|id|student)/i.test(key);
      });

      const fallbackValue = fallbackId ? String(fallbackId[1]).trim() : '';
      if (!fallbackValue) {
        setNotice('هذا الطالب لا يحتوي على معرف صالح للتعديل.');
        return;
      }

      setEditingStudentId(fallbackValue);
      setEditingStudentDraft(buildStudentEditDraft({ ...student, ['الرقم الجامعي']: fallbackValue }));
      return;
    }

    setEditingStudentId(selectedStudentId);
    setEditingStudentDraft(buildStudentEditDraft(student));
  };

  const saveEditedStudent = async () => {
    if (!editingStudentId) return;

    const draftCopy: Record<string, string> = {
      ...editingStudentDraft,
      'القسم': String(editingStudentDraft['القسم'] ?? defaultStudentSection).trim() || defaultStudentSection,
    };

    const validationError = getStudentValidationError(draftCopy);
    if (validationError) {
      setNotice(validationError);
      return;
    }

    const normalizedDraft: Record<string, string> = normalizeStudentDraftValues(draftCopy);
    normalizedDraft['القسم'] = defaultStudentSection;

    const payload: Record<string, string> = {};
    const editableFields = [
      'الرقم الجامعي',
      'كلمة السر',
      'اسم الطالب',
      'اسم الاب',
      'الكنية',
      'القسم',
      'الفئة',
      'السنه الدراسية',
      'رقم الهاتف',
      'البريد الإلكتروني',
      'نوع التسجيل',
      'ملاحظة',
    ];

    editableFields.forEach((field) => {
      if (normalizedDraft[field] !== undefined) {
        const value = String(normalizedDraft[field] ?? '').trim();
        if (value !== '') payload[field] = value;
      }
    });

    if (!Object.keys(payload).length) {
      setNotice('لا توجد بيانات جديدة لتحديثها');
      return;
    }

    const studentId = String(normalizedDraft['الرقم الجامعي'] ?? editingStudentId).trim();
    if (!studentId) {
      setNotice('لا يوجد رقم جامعي صالح لتحديث الطالب');
      return;
    }

    const cleanPayload = Object.fromEntries(
      Object.entries(payload).filter(([, value]) => value !== undefined && value !== null && value !== '')
    ) as Record<string, string>;

    const selectedStudent = studentDirectory.find((row) => {
      const rowId = getStudentIdentifier(row);
      return rowId === editingStudentId || String(row.id ?? '') === editingStudentId || String(row['الرقم الجامعي'] ?? row['الرقم'] ?? row.student_id ?? row.studentId ?? row.id ?? '') === editingStudentId;
    }) ?? studentDirectory.find((row) => getStudentIdentifier(row) === studentId || String(row.id ?? '') === studentId);

    const idSearchValues = selectedStudent
      ? [
          String(selectedStudent['الرقم الجامعي'] ?? selectedStudent['الرقم'] ?? selectedStudent.student_id ?? selectedStudent.studentId ?? selectedStudent.id ?? ''),
          String(selectedStudent.id ?? ''),
        ].filter(Boolean)
      : [studentId];

    const candidateTableNames = ['students', 'student'];
    let lastError: unknown = null;

    for (const tableName of candidateTableNames) {
      for (const fieldName of ['الرقم الجامعي', 'الرقم', 'student_id', 'studentId', 'id']) {
        for (const lookupValue of idSearchValues) {
          const result = await supabase.from(tableName).update(cleanPayload).eq(fieldName, lookupValue);
          if (!result.error) {
            setNotice('تم تحديث بيانات الطالب بنجاح');
            setEditingStudentId('');
            setEditingStudentDraft({});
            await refreshStudentDirectory();
            return;
          }
          lastError = result.error;
        }
      }
    }

    setNotice(`تعذر تحديث بيانات الطالب: ${getSupabaseErrorText(lastError ?? 'خطأ غير معروف')}`);
  };

  const createStudentAccount = async () => {
    const draft: Record<string, string> = {
      ...newStudentForm,
      'القسم': defaultStudentSection,
    };

    const validationError = getStudentValidationError(draft);
    if (validationError) {
      setNotice(validationError);
      return;
    }

    const normalizedDraft: Record<string, string> = normalizeStudentDraftValues(draft);
    normalizedDraft['القسم'] = defaultStudentSection;

    const payload: Record<string, string> = {
      'الرقم الجامعي': String(normalizedDraft['الرقم الجامعي'] ?? '').trim(),
      'كلمة السر': String(normalizedDraft['كلمة السر'] ?? '').trim() || '123456',
      'اسم الطالب': String(normalizedDraft['اسم الطالب'] ?? '').trim(),
      'اسم الاب': String(normalizedDraft['اسم الاب'] ?? '').trim(),
      'الكنية': String(normalizedDraft['الكنية'] ?? '').trim(),
      'القسم': defaultStudentSection,
      'الفئة': String(normalizedDraft['الفئة'] ?? '').trim(),
      'السنه الدراسية': String(normalizedDraft['السنه الدراسية'] ?? '').trim(),
      'رقم الهاتف': String(normalizedDraft['رقم الهاتف'] ?? '').trim(),
      'البريد الإلكتروني': String(normalizedDraft['البريد الإلكتروني'] ?? '').trim(),
      'نوع التسجيل': String(normalizedDraft['نوع التسجيل'] ?? 'جديد').trim() || 'جديد',
      'ملاحظة': String(normalizedDraft['ملاحظة'] ?? '').trim(),
    };

    try {
      const { error } = await supabase.from('students').insert([payload]);
      if (error) {
        setNotice(`تعذر إنشاء حساب الطالب: ${error.message}`);
        return;
      }

      setNotice('تم إنشاء حساب الطالب بنجاح');
      setShowCreateStudentForm(false);
      setNewStudentForm({
        'الرقم الجامعي': '',
        'كلمة السر': '',
        'اسم الطالب': '',
        'اسم الاب': '',
        'الكنية': '',
        'القسم': defaultStudentSection,
        'الفئة': '',
        'السنه الدراسية': '',
        'رقم الهاتف': '',
        'البريد الإلكتروني': '',
        'نوع التسجيل': 'جديد',
        'ملاحظة': '',
      });
      await refreshStudentDirectory();
    } catch (error) {
      setNotice(`تعذر إنشاء حساب الطالب: ${getSupabaseErrorText(error)}`);
    }
  };

  const normalizedAdminSearch = adminSearch.trim().toLowerCase();
  const getAdminStudentName = (record: AdminRecord) => {
    const studentId = String(getAdminRecordValue(record, ['الرقم الجامعي', 'student_id', 'studentId'])).trim();
    return adminStudentNames[studentId] || getFullStudentName(record);
  };
  const filteredAdminAttendance = useMemo(() => adminAttendance.filter((record) => {
    const searchable = [
      getAdminRecordValue(record, ['الرقم الجامعي', 'student_id', 'studentId']),
      getAdminStudentName(record),
      getAdminRecordCourse(record),
    ].join(' ').toLowerCase();
    const course = getAdminRecordCourse(record);
    const date = getAdminRecordDate(record).slice(0, 10);
    return (!normalizedAdminSearch || searchable.includes(normalizedAdminSearch))
      && (!adminCourseFilter || course === adminCourseFilter)
      && (!adminDateFrom || date >= adminDateFrom)
      && (!adminDateTo || date <= adminDateTo);
  }), [adminAttendance, normalizedAdminSearch, adminCourseFilter, adminDateFrom, adminDateTo, adminStudentNames]);

  const filteredAdminWarnings = useMemo(() => adminWarnings.filter((record) => {
    const searchable = [
      getAdminRecordValue(record, ['الرقم الجامعي', 'student_id', 'studentId']),
      getAdminStudentName(record),
      getAdminRecordCourse(record),
      getAdminRecordValue(record, ['السبب', 'التفاصيل']),
    ].join(' ').toLowerCase();
    const course = getAdminRecordCourse(record);
    const date = getAdminRecordDate(record).slice(0, 10);
    return (!normalizedAdminSearch || searchable.includes(normalizedAdminSearch))
      && (!adminCourseFilter || course === adminCourseFilter)
      && (!adminDateFrom || date >= adminDateFrom)
      && (!adminDateTo || date <= adminDateTo);
  }), [adminWarnings, normalizedAdminSearch, adminCourseFilter, adminDateFrom, adminDateTo, adminStudentNames]);

  const adminStudentIds = useMemo(() => Array.from(new Set([
    ...filteredAdminAttendance,
    ...filteredAdminWarnings,
  ].map((record) => String(getAdminRecordValue(record, ['الرقم الجامعي', 'student_id', 'studentId']))).filter(Boolean))), [filteredAdminAttendance, filteredAdminWarnings]);

  const studentClassOptions = useMemo(() => {
    const options = new Set<string>(['أ', 'ب', 'ج', 'د', 'بدون فئة']);
    studentDirectory.forEach((student) => {
      const className = String(student['الفئة'] ?? '').trim();
      if (className) options.add(className);
      if (!className || className === 'غير محدد') options.add('بدون فئة');
    });
    return Array.from(options);
  }, [studentDirectory]);

  const filteredStudentDirectory = useMemo(() => {
    const normalizedSearch = studentDirectorySearch.trim().toLowerCase();
    return studentDirectory.filter((student) => {
      const studentId = String(student['الرقم الجامعي'] ?? student.id ?? '').trim();
      const studentName = String(student['اسم الطالب'] ?? '').trim();
      const fatherName = String(student['اسم الاب'] ?? '').trim();
      const familyName = String(student['الكنية'] ?? '').trim();
      const section = String(student['القسم'] ?? '').trim();
      const rawClassName = String(student['الفئة'] ?? '').trim();
      const className = rawClassName || 'بدون فئة';
      const normalizedClassName = className === 'غير محدد' ? 'بدون فئة' : className;
      const year = String(student['السنه الدراسية'] ?? '').trim();
      const searchable = `${studentId} ${studentName} ${fatherName} ${familyName} ${section} ${normalizedClassName}`.toLowerCase();

      const matchesSearch = !normalizedSearch || searchable.includes(normalizedSearch);
      const matchesClass = !studentClassFilter || (studentClassFilter === 'بدون فئة' ? (!rawClassName || rawClassName === 'غير محدد') : normalizedClassName === studentClassFilter);
      const matchesYear = !studentYearFilter || year === studentYearFilter;
      const matchesSection = !studentSectionFilter || section === studentSectionFilter;

      return matchesSearch && matchesClass && matchesYear && matchesSection;
    });
  }, [studentDirectory, studentDirectorySearch, studentClassFilter, studentYearFilter, studentSectionFilter]);

  const selectedStudentAttendance = selectedAdminStudentId
    ? filteredAdminAttendance.filter((record) => String(getAdminRecordValue(record, ['الرقم الجامعي', 'student_id', 'studentId'])) === selectedAdminStudentId)
    : [];
  const selectedStudentWarnings = selectedAdminStudentId
    ? filteredAdminWarnings.filter((record) => String(getAdminRecordValue(record, ['الرقم الجامعي', 'student_id', 'studentId'])) === selectedAdminStudentId)
    : [];

  const handleWarningToAttendance = async (warning: AdminRecord) => {
    setAdminLoading(true);
    const attendanceResult = await insertAdminAttendance({ ...warning, 'اسم الطالب': getAdminStudentName(warning) }, supervisorUsername);
    if (!attendanceResult.success) {
      setNotice(`تعذر تسجيل الحضور: ${attendanceResult.error}`);
      setAdminLoading(false);
      return;
    }

    const deleteResult = await deleteAdminWarning(warning);
    if (!deleteResult.success) {
      setNotice(`تم تسجيل الحضور، لكن تعذر حذف الإنذار: ${deleteResult.error}`);
    } else {
      setNotice('تم تحويل الإنذار إلى سجل حضور بنجاح.');
      writeAuditLog({
        action: 'warning_to_attendance',
        userType: 'supervisor',
        username: supervisorUsername,
        details: { studentId: getAdminRecordValue(warning, ['الرقم الجامعي']), warningId: getAdminRecordId(warning) },
      });
    }
    await refreshAdminData();
  };

  const handleDeleteWarning = async (warning: AdminRecord) => {
    if (!window.confirm('هل تريد حذف هذا الإنذار نهائيًا؟')) return;
    setAdminLoading(true);
    const result = await deleteAdminWarning(warning);
    writeAuditLog({
      action: 'warning_deleted',
      userType: 'supervisor',
      username: supervisorUsername,
      details: { studentId: getAdminRecordValue(warning, ['الرقم الجامعي']), warningId: getAdminRecordId(warning) },
    });
    setNotice(result.success ? 'تم حذف الإنذار بنجاح.' : `تعذر حذف الإنذار: ${result.error}`);
    await refreshAdminData();
  };

  const handleWarningDetails = async (warning: AdminRecord, details: string) => {
    setAdminLoading(true);
    const result = await updateAdminWarning(warning, details);
    writeAuditLog({
      action: 'warning_updated',
      userType: 'supervisor',
      username: supervisorUsername,
      details: { studentId: getAdminRecordValue(warning, ['الرقم الجامعي']), warningId: getAdminRecordId(warning), details },
    });
    setNotice(result.success ? 'تم تحديث تفاصيل الغياب.' : `تعذر تحديث الإنذار: ${result.error}`);
    await refreshAdminData();
  };

  const handleAttendanceStatus = async (record: AdminRecord, status: 'حاضر' | 'غائب', details = '') => {
    setAdminLoading(true);
    const result = await updateAdminAttendance(record, status, details);
    writeAuditLog({
      action: 'attendance_updated',
      userType: 'supervisor',
      username: supervisorUsername,
      details: { studentId: getAdminRecordValue(record, ['الرقم الجامعي']), status },
    });
    setNotice(result.success ? 'تم تحديث حالة الحضور.' : `تعذر تحديث سجل الحضور: ${result.error}`);
    await refreshAdminData();
  };

  const handleSupervisorWarning = async (username: string, degree: string) => {
    const details = window.prompt(`اكتب تفاصيل الإنذار للمشرف ${username}`);
    if (!details?.trim()) return;
    setAdminLoading(true);
    const result = await createSupervisorWarning(username, degree, details.trim(), supervisorUsername);
    writeAuditLog({
      action: 'supervisor_warning_created',
      userType: 'supervisor',
      username: supervisorUsername,
      details: { targetUsername: username, targetDegree: degree, warningDetails: details.trim() },
    });
    setNotice(result.success ? 'تم تسجيل إنذار المشرف.' : `تعذر تسجيل إنذار المشرف: ${result.error}`);
    await refreshAdminData();
  };

  const handleSupervisorFormSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supervisorForm.username.trim() || (!editingSupervisorId && !supervisorForm.password.trim())) {
      setNotice('أدخل اسم المستخدم وكلمة المرور للمشرف الجديد.');
      return;
    }
    setAdminLoading(true);
    const current = supervisorRecords.find((row) => getSupervisorRecordId(row) === editingSupervisorId);
    const result = current
      ? await updateSupervisorRecord(current, supervisorForm)
      : await createSupervisorRecord(supervisorForm.username.trim(), supervisorForm.password.trim(), supervisorForm.degree);
    writeAuditLog({
      action: current ? 'supervisor_updated' : 'supervisor_created',
      userType: 'supervisor',
      username: supervisorUsername,
      details: { targetUsername: supervisorForm.username.trim(), targetDegree: supervisorForm.degree },
    });
    setNotice(result.success ? 'تم حفظ بيانات المشرف.' : `تعذر حفظ المشرف: ${result.error}`);
    setSupervisorForm({ username: '', password: '', degree: '3' });
    setEditingSupervisorId('');
    await refreshAdminData();
  };

  const handleSupervisorDelete = async (row: AdminRecord) => {
    if (!window.confirm('هل تريد حذف حساب المشرف نهائيًا؟')) return;
    setAdminLoading(true);
    const result = await deleteSupervisorRecord(row);
    writeAuditLog({ action: 'supervisor_deleted', userType: 'supervisor', username: supervisorUsername, details: { targetUsername: getSupervisorCredentials(row).username, targetDegree: getSupervisorDegree(row) } });
    setNotice(result.success ? 'تم حذف المشرف.' : `تعذر حذف المشرف: ${result.error}`);
    await refreshAdminData();
  };

  useEffect(() => {
    void refreshRecentSessions();
  }, []);

  useEffect(() => {
    if (supervisorLoggedIn && selectedFeature === 'students') {
      void refreshStudentDirectory();
    }
  }, [supervisorLoggedIn, selectedFeature]);

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
      const supervisor = await findSupervisorLogin(username, password);
      if (!supervisor || !('match' in supervisor) || supervisor.match !== true) {
        const failedReason = supervisor && 'reason' in supervisor ? supervisor.reason : 'username';

        if (failedReason === 'username' || failedReason === 'password') {
          setNotice('اسم المستخدم أو كلمة المرور غير صحيحة');
        } else if (failedReason === 'degree') {
          setNotice('لا توجد صلاحيات مفعلة لهذا الحساب');
        } else {
          setNotice('اسم المستخدم أو كلمة المرور غير صحيحة أو الدرجة غير مسموحة');
        }

        setLoading(false);
        return;
      }

      const row = supervisor.row as Record<string, unknown>;
      const features = getSupervisorFeatures(getSupervisorDegree(row));
      if (!features.length) {
        setNotice('تم التحقق من الحساب، لكن لا توجد وظائف متاحة لهذه الدرجة');
        return;
      }
      setSupervisorLoggedIn(true);
      setSupervisorFeatures(features);
      setSupervisorDegree(getSupervisorDegree(row));
      window.localStorage.setItem(supervisorSessionStorageKey, JSON.stringify({
        username,
        degree: getSupervisorDegree(row),
        features,
        selectedFeature: null,
      } satisfies StoredSupervisorSession));
      writeAuditLog({
        action: 'supervisor_login',
        userType: 'supervisor',
        username,
        details: { degree: getSupervisorDegree(row), features },
      });
      setSelectedFeature(null);
      setNotice('تم تسجيل الدخول بأمان. اختر الوظيفة المطلوبة للمتابعة.');
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
    if (loading || sessionActive) return;
    if (!selectedCourse || !selectedClass) {
      setNotice('يرجى اختيار المادة والفئة أولاً');
      return;
    }

    setLoading(true);
    let openedSessionId: string | null = null;
    try {
      const sessionKey = getSessionKey(selectedCourse, selectedClass);
      const localLock = readLocalSessionLock();
      if (localLock && getSessionKey(localLock.course, localLock.classValue) === sessionKey
        && Date.parse(localLock.startedAt) >= Date.now() - recentSessionWindowMs) {
        setNotice(`هذه الجلسة مفتوحة حالياً للمادة ${localLock.course} والفئة ${localLock.classValue} بواسطة ${localLock.supervisor}.`);
        return;
      }

      const currentSessions = await loadRecentAttendanceSessions();
      const duplicateSession = currentSessions.find((session) => getSessionKey(session.course, session.classValue) === sessionKey);
      if (duplicateSession) {
        setRecentSessions(currentSessions);
        setNotice(`لا يمكن فتح جلسة جديدة. توجد جلسة مفتوحة لنفس المادة والفئة بواسطة ${duplicateSession.supervisor}.`);
        return;
      }

      const created = await createAttendanceSession(selectedCourse, selectedClass, supervisorUsername);
      if (created.error || !created.session) {
        const message = getSupabaseErrorText(created.error);
        const lowerMessage = message.toLowerCase();
        setNotice(lowerMessage.includes('does not exist') || lowerMessage.includes('relation')
          ? 'يجب إنشاء جدول جلسات الحضور في Supabase أولاً لمنع فتح جلسات متزامنة.'
          : lowerMessage.includes('duplicate') || lowerMessage.includes('unique') || lowerMessage.includes('23505')
            ? 'لا يمكن فتح الجلسة: يوجد مشرف آخر يسجل الحضور للمادة والفئة نفسها حالياً.'
          : `تعذر فتح جلسة الحضور: ${message}`);
        return;
      }
      openedSessionId = created.session.id;

      let rows: StudentRow[];
      try {
        rows = await fetchStudentsByClass(selectedClass, selectedYear);
        writeCachedStudents(selectedClass, selectedYear, rows);
      } catch (error) {
        rows = readCachedStudents(selectedClass, selectedYear);
        if (!rows.length) throw error;
        setNotice('تعذر الاتصال مؤقتاً، تم تحميل آخر قائمة طلاب محفوظة محلياً.');
      }

      if (!rows.length) {
        await closeAttendanceSession(created.session.id);
        setActiveSession(null);
        setNotice('لا يوجد طلاب مسجلون في هذه الفئة والسنة المحددة');
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
      setActiveSession(created.session);
      setRecentSessions([created.session, ...currentSessions]);
      writeAuditLog({
        action: 'attendance_session_started',
        userType: 'supervisor',
        username: supervisorUsername,
        details: { course: selectedCourse, classValue: selectedClass, year: selectedYear, studentCount: rows.length },
      });
      setNotice(`تم بدء جلسة الحضور للفئة ${selectedClass} في مادة ${selectedCourse}`);
    } catch (error) {
      if (openedSessionId) await closeAttendanceSession(openedSessionId);
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
        name: getFullStudentName(student),
        status,
        timestamp,
        year: normalizeText(student['السنه الدراسية']),
      },
    }));

    setNotice(`تم تسجيل حالة الطالب ${getFullStudentName(student)} محلياً. اضغط حفظ الجلسة للمزامنة.`);
    writeAuditLog({
      action: 'attendance_status_selected',
      userType: 'supervisor',
      username: supervisorUsername,
      details: { studentId, studentName: getFullStudentName(student), status, course: selectedCourse, classValue: selectedClass },
    });
  };

  const resetSession = () => {
    if (activeSession) void closeAttendanceSession(activeSession.id);
    setAttendanceData({});
    setStudents([]);
    setSessionActive(false);
    setActiveSession(null);
    setNotice('تم إلغاء الجلسة بنجاح');
  };

  const saveSession = async () => {
    if (saveInProgressRef.current || loading) return;
    saveInProgressRef.current = true;
    const attendanceKeys = Object.keys(attendanceData);

    console.log('[attendance][saveSession] begin save', {
      studentsCount: students.length,
      attendanceKeys,
      selectedCourse,
      selectedClass,
      selectedYear,
      attendanceData,
    });

    if (!students.length || !attendanceKeys.length) {
      console.warn('[attendance][saveSession] attendance state is empty before save', {
        studentsCount: students.length,
        attendanceKeys,
        attendanceData,
      });
      setNotice('لا توجد بيانات للحضور لحفظها؛ حالة الحضور فارغة أو لا تحتوي على أرقام الطلاب');
      return;
    }

    setLoading(true);
    try {
      const jobs: PendingAttendanceJob[] = [];

      for (const student of students) {
        const studentId = getStudentIdentifier(student);
        const entry = attendanceData[studentId];

        console.log('[attendance][saveSession] processing student', { studentId, student, entry, status: entry?.status });

        if (!entry) {
          console.warn('[attendance][saveSession] no attendance entry for student', { studentId, student });
          continue;
        }

        const status = entry.status;
        if (!status || !['pending', 'present', 'absent'].includes(status)) {
          console.warn('[attendance][saveSession] invalid attendance status for student', { studentId, status, entry });
          continue;
        }

        jobs.push({
          type: 'attendance',
          student,
          course: selectedCourse,
          classValue: selectedClass,
          status,
          supervisor: supervisorUsername,
          queuedAt: new Date().toISOString(),
        });

        if (status === 'absent') {
          jobs.push({
            type: 'warning',
            student,
            course: selectedCourse,
            classValue: selectedClass,
            status: 'absent',
            supervisor: supervisorUsername,
            queuedAt: new Date().toISOString(),
          });
        }
      }

      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        enqueueAttendanceJobs(jobs);
        setNotice(`لا يوجد اتصال حالياً. تم حفظ ${jobs.length} عملية محلياً وستتم مزامنتها تلقائياً عند عودة الإنترنت.`);
        return;
      }

      const results = await Promise.all(jobs.map(async (job) => ({
        job,
        saved: await savePendingAttendanceJob(job),
      })));
      const failedJobs = results.filter((result) => !result.saved).map((result) => result.job);
      if (failedJobs.length) enqueueAttendanceJobs(failedJobs);

      const savedRecords = results.filter((result) => result.saved && result.job.type === 'attendance').length;
      const savedWarnings = results.filter((result) => result.saved && result.job.type === 'warning').length;
      console.log('[attendance][saveSession] final save summary', { savedRecords, savedWarnings, failedJobs: failedJobs.length, attendanceKeys });
      setNotice(failedJobs.length
        ? `تم حفظ ${savedRecords} سجل و${savedWarnings} إنذار، وتعذر حفظ ${failedJobs.length} عملية. ستتم إعادة المحاولة تلقائياً.`
        : `تم حفظ البيانات بنجاح: ${savedRecords} سجل حضور و ${savedWarnings} إنذار`);
      if (!failedJobs.length) {
        if (activeSession) await closeAttendanceSession(activeSession.id);
        setActiveSession(null);
        setSessionActive(false);
        setStudents([]);
        setAttendanceData({});
        await refreshRecentSessions();
      }
      writeAuditLog({
        action: 'attendance_session_saved',
        userType: 'supervisor',
        username: supervisorUsername,
        details: { course: selectedCourse, classValue: selectedClass, savedRecords, savedWarnings, failedJobs: failedJobs.length },
      });
    } catch (error) {
      console.error('[attendance][saveSession] fatal save error:', error);
      setNotice('حدث خطأ أثناء حفظ بيانات الحضور');
    } finally {
      saveInProgressRef.current = false;
      setLoading(false);
    }
  };

  const currentCourseText = selectedCourse || 'غير محدد';
  const currentClassText = selectedClass || 'غير محدد';

  return (
    <main className="attendance-shell" dir="rtl">
      <div className="attendance-page">
        <div className="attendance-topbar">
          <button
            type="button"
            className="inline-flex items-center gap-2 px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg font-semibold transition-all cursor-pointer z-50"
            onClick={() => {
              if (activeSession) void closeAttendanceSession(activeSession.id);
              setSelectedFeature(null);
              setSessionActive(false);
              setStudents([]);
              setAttendanceData({});
              setActiveSession(null);
              setNotice('تمت العودة إلى صفحة وظائف المشرفين.');
            }}
          >
            ← العودة للوحة التحكم
          </button>
          <Link href="/" className="back-link">العودة للرئيسية</Link>
          {supervisorLoggedIn && (
            <button
              type="button"
              className="back-link"
              onClick={() => {
                if (activeSession) void closeAttendanceSession(activeSession.id);
                writeAuditLog({ action: 'supervisor_logout', userType: 'supervisor', username: supervisorUsername });
                window.localStorage.removeItem(supervisorSessionStorageKey);
                setSupervisorLoggedIn(false);
                setSupervisorUsername('');
                setSupervisorPassword('');
                setSupervisorFeatures([]);
                setSupervisorDegree('');
                setSelectedFeature(null);
                setSelectedAdminStudentId('');
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
                  autoComplete="username"
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
                  autoComplete="current-password"
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

          </section>
        )}

        {notice && <div className="notice-box">{notice}</div>}

        {!supervisorLoggedIn && <div className="loading-box">يجب تسجيل دخول المشرف قبل استخدام نظام الحضور والغياب</div>}

        {supervisorLoggedIn && !selectedFeature && (
          <section className="supervisor-feature-panel">
            <div className="feature-panel-heading">
              <span className="feature-panel-kicker">مساحة المشرف</span>
              <h1>اختر الوظيفة المطلوبة</h1>
              <p>الوظائف الظاهرة هنا تعتمد على صلاحيات حسابك.</p>
            </div>

            <div className="supervisor-feature-grid">
              {supervisorFeatures.includes('attendance') && (
                <button
                  type="button"
                  className="supervisor-feature-card"
                  onClick={() => {
                    setSelectedFeature('attendance');
                    const stored = JSON.parse(window.localStorage.getItem(supervisorSessionStorageKey) || '{}') as StoredSupervisorSession;
                    window.localStorage.setItem(supervisorSessionStorageKey, JSON.stringify({ ...stored, selectedFeature: 'attendance' }));
                    writeAuditLog({ action: 'feature_opened', userType: 'supervisor', username: supervisorUsername, details: { feature: 'attendance' } });
                    setNotice('تم فتح وظيفة تسجيل الحضور والغياب.');
                  }}
                >
                  <span className="feature-icon" aria-hidden="true">✓</span>
                  <span>
                    <strong>الحضور والغياب</strong>
                    <small>إدارة جلسات الحضور وتسجيل حالة الطلاب</small>
                  </span>
                  <span className="feature-arrow" aria-hidden="true">←</span>
                </button>
              )}
              {supervisorFeatures.includes('admin') && (
                <button
                  type="button"
                  className="supervisor-feature-card"
                  onClick={() => {
                    setSelectedFeature('admin');
                    const stored = JSON.parse(window.localStorage.getItem(supervisorSessionStorageKey) || '{}') as StoredSupervisorSession;
                    window.localStorage.setItem(supervisorSessionStorageKey, JSON.stringify({ ...stored, selectedFeature: 'admin' }));
                    writeAuditLog({ action: 'feature_opened', userType: 'supervisor', username: supervisorUsername, details: { feature: 'admin' } });
                    void refreshAdminData();
                    setNotice('تم فتح لوحة الإدارة للدرجة الأولى.');
                  }}
                >
                  <span className="feature-icon" aria-hidden="true">⌘</span>
                  <span>
                    <strong>لوحة إدارة الحضور والإنذارات</strong>
                    <small>بحث وتصفية وتعديل سجلات الطلاب بالكامل</small>
                  </span>
                  <span className="feature-arrow" aria-hidden="true">←</span>
                </button>
              )}
              {supervisorFeatures.includes('students') && (
                <button type="button" className="supervisor-feature-card" onClick={() => {
                  setSelectedFeature('students');
                  const stored = JSON.parse(window.localStorage.getItem(supervisorSessionStorageKey) || '{}') as StoredSupervisorSession;
                  window.localStorage.setItem(supervisorSessionStorageKey, JSON.stringify({ ...stored, selectedFeature: 'students' }));
                  void refreshStudentDirectory();
                  writeAuditLog({ action: 'feature_opened', userType: 'supervisor', username: supervisorUsername, details: { feature: 'students' } });
                  setNotice('تم فتح قائمة الطلاب وتعديل بياناتهم.');
                }}>
                  <span className="feature-icon" aria-hidden="true">👥</span>
                  <span>
                    <strong>الطلاب</strong>
                    <small>البحث، التصفية، وتعديل بيانات جميع الطلاب</small>
                  </span>
                  <span className="feature-arrow" aria-hidden="true">←</span>
                </button>
              )}
              {supervisorFeatures.includes('supervisors') && (
                <button type="button" className="supervisor-feature-card" onClick={() => {
                  setSelectedFeature('supervisors');
                  const stored = JSON.parse(window.localStorage.getItem(supervisorSessionStorageKey) || '{}') as StoredSupervisorSession;
                  window.localStorage.setItem(supervisorSessionStorageKey, JSON.stringify({ ...stored, selectedFeature: 'supervisors' }));
                  void refreshAdminData();
                  writeAuditLog({ action: 'feature_opened', userType: 'supervisor', username: supervisorUsername, details: { feature: 'supervisors' } });
                }}>
                  <span className="feature-icon" aria-hidden="true">+</span>
                  <span><strong>إدارة المشرفين</strong><small>إضافة وتعديل وحذف وترقية وخفض الحسابات</small></span>
                  <span className="feature-arrow" aria-hidden="true">←</span>
                </button>
              )}
              {supervisorFeatures.includes('logs') && (
                <button type="button" className="supervisor-feature-card" onClick={() => {
                  setSelectedFeature('logs');
                  const stored = JSON.parse(window.localStorage.getItem(supervisorSessionStorageKey) || '{}') as StoredSupervisorSession;
                  window.localStorage.setItem(supervisorSessionStorageKey, JSON.stringify({ ...stored, selectedFeature: 'logs' }));
                  void refreshAuditLogs();
                  writeAuditLog({ action: 'feature_opened', userType: 'supervisor', username: supervisorUsername, details: { feature: 'logs' } });
                }}>
                  <span className="feature-icon" aria-hidden="true">≡</span>
                  <span><strong>سجلات النظام</strong><small>متابعة حركات الطلاب والمشرفين والعمليات</small></span>
                  <span className="feature-arrow" aria-hidden="true">←</span>
                </button>
              )}
            </div>
          </section>
        )}

        {supervisorLoggedIn && selectedFeature === 'admin' && (
          <section className="admin-dashboard-panel">
            <div className="admin-dashboard-heading">
              <div>
                <span className="feature-panel-kicker">صلاحيات الدرجة {supervisorDegree}</span>
                <h1>إدارة الحضور والإنذارات</h1>
                <p>ابحث عن أي طالب، راجع سجله الكامل، وعدّل حالة الحضور أو تفاصيل الغياب.</p>
              </div>
              <button type="button" className="action-button primary" onClick={() => void refreshAdminData()} disabled={adminLoading}>
                {adminLoading ? 'جاري التحديث...' : 'تحديث البيانات'}
              </button>
            </div>

            <div className="admin-filter-grid">
              <div className="field-group">
                <label htmlFor="admin-search">بحث بالاسم أو الرقم الجامعي</label>
                <input id="admin-search" value={adminSearch} onChange={(event) => setAdminSearch(event.target.value)} placeholder="اكتب اسم الطالب أو رقمه" />
              </div>
              <div className="field-group">
                <label htmlFor="admin-course">المادة</label>
                <select id="admin-course" value={adminCourseFilter} onChange={(event) => setAdminCourseFilter(event.target.value)}>
                  <option value="">كل المواد</option>
                  {Array.from(new Set([...adminAttendance, ...adminWarnings].map(getAdminRecordCourse).filter(Boolean))).map((course) => <option key={course} value={course}>{course}</option>)}
                </select>
              </div>
              <div className="field-group">
                <label htmlFor="admin-from">من تاريخ</label>
                <input id="admin-from" type="date" value={adminDateFrom} onChange={(event) => setAdminDateFrom(event.target.value)} />
              </div>
              <div className="field-group">
                <label htmlFor="admin-to">إلى تاريخ</label>
                <input id="admin-to" type="date" value={adminDateTo} onChange={(event) => setAdminDateTo(event.target.value)} />
              </div>
            </div>

            <div className="admin-view-tabs">
              {([
                ['all', 'الكل'],
                ['attendance', 'الحضور'],
                ['warnings', 'الإنذارات'],
              ] as const).map(([value, label]) => (
                <button key={value} type="button" className={adminRecordType === value ? 'active' : ''} onClick={() => setAdminRecordType(value)}>{label}</button>
              ))}
            </div>

            <div className="admin-stats-row">
              <span>سجلات الحضور: <strong>{filteredAdminAttendance.length}</strong></span>
              <span>الإنذارات: <strong>{filteredAdminWarnings.length}</strong></span>
              <span>طلاب مطابقون: <strong>{adminStudentIds.length}</strong></span>
            </div>

            <div className="admin-supervisor-section">
              <div className="admin-section-heading">
                <h2>المشرفون وسجل الجلسات</h2>
                <span>لا تظهر كلمات المرور أو أي بيانات سرية</span>
              </div>
              <div className="admin-supervisor-list">
                {adminSupervisors.filter((supervisor) => getSupervisorDegree(supervisor) !== '1').map((supervisor, index) => {
                  const credentials = getSupervisorCredentials(supervisor);
                  const username = String(credentials.username || 'مشرف');
                  const degree = String(getSupervisorDegree(supervisor) || 'غير محدد');
                  return (
                  <div className="admin-supervisor-item" key={`${username}-${degree}-${index}`}>
                    <strong>{username}</strong>
                    <span>الدرجة {degree}</span>
                    <button type="button" onClick={() => void handleSupervisorWarning(username, degree)}>إعطاء إنذار</button>
                  </div>
                ); })}
                {adminSupervisors.filter((supervisor) => supervisor.degree !== '1').length === 0 && <span>لا توجد حسابات مشرفين أدنى مسجلة.</span>}
              </div>
              {adminSupervisorWarnings.length > 0 && (
                <div className="admin-record-list">
                  {adminSupervisorWarnings.slice(0, 20).map((warning, index) => <div className="admin-record-item warning-record" key={`${getAdminRecordId(warning)}-${index}`}><strong>{String(getAdminRecordValue(warning, ['اسم المستخدم', 'username']))}</strong><span>{String(getAdminRecordValue(warning, ['التفاصيل']))}</span><span>أنشأه: {String(getAdminRecordValue(warning, ['أنشأه', 'issuer']))}</span><span>{getAdminRecordDate(warning)} {String(getAdminRecordValue(warning, ['الوقت', 'time']))}</span></div>)}
                </div>
              )}
            </div>

            <div className="admin-student-picker">
              <label htmlFor="admin-student-details">عرض سجل طالب كامل</label>
              <select id="admin-student-details" value={selectedAdminStudentId} onChange={(event) => setSelectedAdminStudentId(event.target.value)}>
                <option value="">اختر طالبًا لعرض تفاصيل حضوره وإنذاراته</option>
                {adminStudentIds.map((studentId) => {
                  const source = [...filteredAdminAttendance, ...filteredAdminWarnings].find((record) => String(getAdminRecordValue(record, ['الرقم الجامعي', 'student_id', 'studentId'])) === studentId);
                  return <option key={studentId} value={studentId}>{getAdminStudentName(source ?? {})} - {studentId}</option>;
                })}
              </select>
            </div>

            {selectedAdminStudentId && (
              <div className="admin-student-detail">
                <h2>السجل الكامل للطالب {getAdminStudentName(selectedStudentAttendance[0] ?? selectedStudentWarnings[0] ?? {})} - {selectedAdminStudentId}</h2>
                <div className="admin-detail-columns">
                  <div>
                    <h3>الحضور والغياب</h3>
                    {selectedStudentAttendance.length === 0 ? <p>لا توجد سجلات حضور.</p> : selectedStudentAttendance.map((record, index) => (
                      <div className="admin-record-item" key={`${getAdminRecordId(record)}-${index}`}>
                        <strong>{getAdminRecordCourse(record) || 'مادة غير محددة'}</strong>
                        <span>{getAdminRecordDate(record)} - {String(getAdminRecordValue(record, ['الوقت', 'time']) || '')}</span>
                        <span>{String(getAdminRecordValue(record, ['الحالة', 'status']) || 'غير محدد')}</span><span>المشرف: {getAdminRecordSupervisor(record)}</span><span>{String(getAdminRecordValue(record, ['الوقت', 'time']) || '')}</span>
                        {record['الحالة'] !== undefined && <div className="admin-record-actions"><button type="button" onClick={() => void handleAttendanceStatus(record, 'حاضر')}>حاضر</button><button type="button" onClick={() => void handleAttendanceStatus(record, 'غائب')}>غائب</button></div>}
                      </div>
                    ))}
                  </div>
                  <div>
                    <h3>الإنذارات</h3>
                    {selectedStudentWarnings.length === 0 ? <p>لا توجد إنذارات.</p> : selectedStudentWarnings.map((warning, index) => (
                      <div className="admin-record-item warning-record" key={`${getAdminRecordId(warning)}-${index}`}>
                        <strong>{getAdminRecordCourse(warning) || 'إنذار غياب'}</strong>
                        <span>{String(getAdminRecordValue(warning, ['السبب']) || '')}</span>
                        <span>{String(getAdminRecordValue(warning, ['التفاصيل']) || '')}</span><span>المشرف: {getAdminRecordSupervisor(warning)}</span><span>{String(getAdminRecordValue(warning, ['الوقت', 'time']) || '')}</span>
                        <div className="admin-record-actions"><button type="button" onClick={() => void handleWarningDetails(warning, 'غياب مبرر')}>غياب مبرر</button><button type="button" onClick={() => void handleWarningDetails(warning, 'غياب غير مبرر')}>غير مبرر</button><button type="button" onClick={() => void handleWarningToAttendance(warning)}>تحويل لحضور</button><button type="button" className="danger" onClick={() => void handleDeleteWarning(warning)}>حذف</button></div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {(adminRecordType === 'all' || adminRecordType === 'attendance') && (
              <div className="admin-table-section"><h2>آخر سجلات الحضور</h2><div className="admin-record-list">{filteredAdminAttendance.slice(0, 50).map((record, index) => <div className="admin-record-item" key={`${getAdminRecordId(record)}-${index}`}><strong>{getAdminStudentName(record)}</strong><span>{String(getAdminRecordValue(record, ['الرقم الجامعي', 'student_id', 'studentId']))}</span><span>{getAdminRecordCourse(record)} - {getAdminRecordDate(record)}</span><span>المشرف: {getAdminRecordSupervisor(record)} - {String(getAdminRecordValue(record, ['الوقت', 'time']) || '')}</span><button type="button" onClick={() => setSelectedAdminStudentId(String(getAdminRecordValue(record, ['الرقم الجامعي', 'student_id', 'studentId'])))}>تفاصيل الطالب</button></div>)}</div></div>
            )}

            {(adminRecordType === 'all' || adminRecordType === 'warnings') && (
              <div className="admin-table-section"><h2>آخر الإنذارات</h2><div className="admin-record-list">{filteredAdminWarnings.slice(0, 50).map((warning, index) => <div className="admin-record-item warning-record" key={`${getAdminRecordId(warning)}-${index}`}><strong>{getAdminStudentName(warning)}</strong><span>{getAdminRecordCourse(warning)} - {getAdminRecordDate(warning)}</span><span>المشرف: {getAdminRecordSupervisor(warning)} - {String(getAdminRecordValue(warning, ['الوقت', 'time']) || '')}</span><div className="admin-record-actions"><button type="button" onClick={() => setSelectedAdminStudentId(String(getAdminRecordValue(warning, ['الرقم الجامعي', 'student_id', 'studentId'])))}>تفاصيل</button><button type="button" onClick={() => void handleWarningToAttendance(warning)}>تحويل لحضور</button><button type="button" className="danger" onClick={() => void handleDeleteWarning(warning)}>حذف</button></div></div>)}</div></div>
            )}
          </section>
        )}

        {supervisorLoggedIn && selectedFeature === 'students' && (
          <section className="admin-dashboard-panel">
            <div className="admin-dashboard-heading">
              <div>
                <span className="feature-panel-kicker">إدارة الطلاب</span>
                <h1>الطلاب</h1>
                <p>ابحث فلة الطلاب وتعديل بياناتهم مباشرة من جدول student.</p>
              </div>
              <button type="button" className="action-button primary" onClick={() => void refreshStudentDirectory()} disabled={adminLoading}>
                {adminLoading ? 'جاري التحديث...' : 'تحديث الطلاب'}
              </button>
            </div>

            <div className="admin-filter-grid">
              <div className="field-group">
                <label htmlFor="student-directory-search">بحث</label>
                <input id="student-directory-search" value={studentDirectorySearch} onChange={(event) => setStudentDirectorySearch(event.target.value)} placeholder="اسم الطالب، الرقم الجامعي، الفئة أو القسم" />
              </div>
              <div className="field-group">
                <label htmlFor="student-directory-class">الفئة</label>
                <select id="student-directory-class" value={studentClassFilter} onChange={(event) => setStudentClassFilter(event.target.value)}>
                  <option value="">اختر الفئة أولاً</option>
                  {studentClassOptions.map((className) => (
                    <option key={className} value={className}>{className === 'بدون فئة' ? 'بدون فئة' : `فئة ${className}`}</option>
                  ))}
                </select>
              </div>
              <div className="field-group">
                <label htmlFor="student-directory-year">السنة</label>
                <select id="student-directory-year" value={studentYearFilter} onChange={(event) => setStudentYearFilter(event.target.value)}>
                  <option value="">كل السنوات</option>
                  {Array.from(new Set(studentDirectory.map((student) => String(student['السنه الدراسية'] ?? '')).filter(Boolean))).map((year) => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
              </div>
              <div className="field-group">
                <label htmlFor="student-directory-section">القسم</label>
                <select id="student-directory-section" value={studentSectionFilter} onChange={(event) => setStudentSectionFilter(event.target.value)}>
                  <option value="">كل الأقسام</option>
                  {Array.from(new Set(studentDirectory.map((student) => String(student['القسم'] ?? '')).filter(Boolean))).map((section) => (
                    <option key={section} value={section}>{section}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="admin-record-actions" style={{ marginBottom: 18 }}>
              <button type="button" className="action-button primary" onClick={() => setShowCreateStudentForm((state) => !state)}>
                {showCreateStudentForm ? 'إغلاق نموذج إنشاء الحساب' : 'إنشاء حساب طالب'}
              </button>
            </div>

            {!studentClassFilter ? (
              <div className="loading-box">اختر الفئة أولاً ثم ستظهر طلاب تلك الفئة فقط، أو اختر بدون فئة لعرض الطلاب غير المخصصين لفئة.</div>
            ) : null}

            {showCreateStudentForm && (
              <form className="admin-supervisor-form" onSubmit={(event) => {
                event.preventDefault();
                void createStudentAccount();
              }}>
                <input value={newStudentForm['الرقم الجامعي'] ?? ''} onChange={(event) => setNewStudentForm({ ...newStudentForm, 'الرقم الجامعي': event.target.value })} placeholder="الرقم الجامعي" required />
                <input value={newStudentForm['كلمة السر'] ?? ''} onChange={(event) => setNewStudentForm({ ...newStudentForm, 'كلمة السر': event.target.value })} placeholder="كلمة السر" type="text" />
                <input value={newStudentForm['اسم الطالب'] ?? ''} onChange={(event) => setNewStudentForm({ ...newStudentForm, 'اسم الطالب': event.target.value })} placeholder="اسم الطالب" required />
                <input value={newStudentForm['اسم الاب'] ?? ''} onChange={(event) => setNewStudentForm({ ...newStudentForm, 'اسم الاب': event.target.value })} placeholder="اسم الأب" required />
                <input value={newStudentForm['الكنية'] ?? ''} onChange={(event) => setNewStudentForm({ ...newStudentForm, 'الكنية': event.target.value })} placeholder="الكنية" required />
                <select value={newStudentForm['الفئة'] ?? ''} onChange={(event) => setNewStudentForm({ ...newStudentForm, 'الفئة': event.target.value })} required>
                  <option value="">اختر الفئة</option>
                  {allowedStudentClasses.map((className) => <option key={className} value={className}>{className}</option>)}
                </select>
                <select value={newStudentForm['السنه الدراسية'] ?? ''} onChange={(event) => setNewStudentForm({ ...newStudentForm, 'السنه الدراسية': event.target.value })} required>
                  <option value="">اختر السنة</option>
                  {allowedStudentYears.map((year) => <option key={year} value={year}>{year}</option>)}
                </select>
                <input value={newStudentForm['القسم'] ?? defaultStudentSection} readOnly />
                <input value={newStudentForm['رقم الهاتف'] ?? ''} onChange={(event) => setNewStudentForm({ ...newStudentForm, 'رقم الهاتف': event.target.value })} placeholder="رقم الهاتف" required />
                <input value={newStudentForm['البريد الإلكتروني'] ?? ''} onChange={(event) => setNewStudentForm({ ...newStudentForm, 'البريد الإلكتروني': event.target.value })} placeholder="البريد الإلكتروني" type="email" required />
                <input value={newStudentForm['نوع التسجيل'] ?? 'جديد'} onChange={(event) => setNewStudentForm({ ...newStudentForm, 'نوع التسجيل': event.target.value })} placeholder="نوع التسجيل" />
                <textarea value={newStudentForm['ملاحظة'] ?? ''} onChange={(event) => setNewStudentForm({ ...newStudentForm, 'ملاحظة': event.target.value })} placeholder="ملاحظة" rows={3} />
                <div className="admin-record-actions">
                  <button type="submit" className="action-button primary">حفظ الحساب</button>
                  <button type="button" className="action-button warning" onClick={() => { setShowCreateStudentForm(false); setNewStudentForm({ ...newStudentForm, 'القسم': defaultStudentSection }); }}>إلغاء</button>
                </div>
              </form>
            )}

            <div className="admin-record-list">
              {filteredStudentDirectory.map((student) => {
                const id = String(student['الرقم الجامعي'] ?? student.id ?? '').trim();
                const name = getStudentDisplayName(student);
                return (
                  <div className="admin-record-item" key={`${id || name}-${student['الفئة'] || 'unknown'}`}>
                    <strong>{name}</strong>
                    <span>الرقم: {id || 'غير محدد'}</span>
                    <span>الفئة: {String(student['الفئة'] ?? 'غير محدد')}</span>
                    <span>القسم: {String(student['القسم'] ?? 'غير محدد')}</span>
                    <span>السنة: {String(student['السنه الدراسية'] ?? 'غير محدد')}</span>
                    <div className="admin-record-actions">
                      <button
                        type="button"
                        onClick={() => handleOpenStudentEditor(student)}
                      >
                        تعديل
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {editingStudentId && (
              <form className="admin-supervisor-form" onSubmit={(event) => {
                event.preventDefault();
                void saveEditedStudent();
              }}>
                <input value={editingStudentDraft['اسم الطالب'] ?? ''} onChange={(event) => setEditingStudentDraft({ ...editingStudentDraft, 'اسم الطالب': event.target.value })} placeholder="اسم الطالب" required />
                <input value={editingStudentDraft['اسم الاب'] ?? ''} onChange={(event) => setEditingStudentDraft({ ...editingStudentDraft, 'اسم الاب': event.target.value })} placeholder="اسم الأب" required />
                <input value={editingStudentDraft['الكنية'] ?? ''} onChange={(event) => setEditingStudentDraft({ ...editingStudentDraft, 'الكنية': event.target.value })} placeholder="الكنية" required />
                <input value={editingStudentDraft['الرقم الجامعي'] ?? ''} onChange={(event) => setEditingStudentDraft({ ...editingStudentDraft, 'الرقم الجامعي': event.target.value })} placeholder="الرقم الجامعي" required />
                <input value={editingStudentDraft['كلمة السر'] ?? ''} onChange={(event) => setEditingStudentDraft({ ...editingStudentDraft, 'كلمة السر': event.target.value })} placeholder="كلمة السر" type="text" />
                <input value={editingStudentDraft['القسم'] ?? defaultStudentSection} onChange={(event) => setEditingStudentDraft({ ...editingStudentDraft, 'القسم': event.target.value })} placeholder="القسم" readOnly />
                <select value={editingStudentDraft['الفئة'] ?? ''} onChange={(event) => setEditingStudentDraft({ ...editingStudentDraft, 'الفئة': event.target.value })} required>
                  <option value="">اختر الفئة</option>
                  {allowedStudentClasses.map((className) => <option key={className} value={className}>{className}</option>)}
                </select>
                <select value={editingStudentDraft['السنه الدراسية'] ?? ''} onChange={(event) => setEditingStudentDraft({ ...editingStudentDraft, 'السنه الدراسية': event.target.value })} required>
                  <option value="">اختر السنة</option>
                  {allowedStudentYears.map((year) => <option key={year} value={year}>{year}</option>)}
                </select>
                <input value={editingStudentDraft['رقم الهاتف'] ?? ''} onChange={(event) => setEditingStudentDraft({ ...editingStudentDraft, 'رقم الهاتف': event.target.value })} placeholder="رقم الهاتف" required />
                <input value={editingStudentDraft['البريد الإلكتروني'] ?? ''} onChange={(event) => setEditingStudentDraft({ ...editingStudentDraft, 'البريد الإلكتروني': event.target.value })} placeholder="البريد الإلكتروني" type="email" required />
                <input value={editingStudentDraft['نوع التسجيل'] ?? ''} onChange={(event) => setEditingStudentDraft({ ...editingStudentDraft, 'نوع التسجيل': event.target.value })} placeholder="نوع التسجيل" />
                <textarea value={editingStudentDraft['ملاحظة'] ?? ''} onChange={(event) => setEditingStudentDraft({ ...editingStudentDraft, 'ملاحظة': event.target.value })} placeholder="ملاحظة" rows={3} />
                <div className="admin-record-actions">
                  <button type="submit" className="action-button primary">حفظ التعديل</button>
                  <button type="button" className="action-button warning" onClick={() => { setEditingStudentId(''); setEditingStudentDraft({}); }}>إلغاء</button>
                </div>
              </form>
            )}
          </section>
        )}

        {supervisorLoggedIn && selectedFeature === 'supervisors' && (
          <section className="admin-dashboard-panel">
            <div className="admin-dashboard-heading"><div><span className="feature-panel-kicker">إدارة الحسابات</span><h1>إدارة المشرفين</h1><p>يمكن للدرجة الأولى إنشاء الحسابات وتغيير الدرجات وكلمات المرور.</p></div><button type="button" className="action-button primary" onClick={() => void refreshAdminData()}>تحديث</button></div>
            <form className="admin-supervisor-form" onSubmit={handleSupervisorFormSubmit}>
              <input value={supervisorForm.username} onChange={(event) => setSupervisorForm({ ...supervisorForm, username: event.target.value })} placeholder="اسم المستخدم" required />
              <input value={supervisorForm.password} onChange={(event) => setSupervisorForm({ ...supervisorForm, password: event.target.value })} placeholder={editingSupervisorId ? 'كلمة مرور جديدة (اختياري)' : 'كلمة المرور'} type="password" required={!editingSupervisorId} />
              <select value={supervisorForm.degree} onChange={(event) => setSupervisorForm({ ...supervisorForm, degree: event.target.value })}><option value="1">الدرجة 1</option><option value="2">الدرجة 2</option><option value="3">الدرجة 3</option></select>
              <button type="submit" className="action-button primary">{editingSupervisorId ? 'حفظ التعديل' : 'إضافة مشرف'}</button>
              {editingSupervisorId && <button type="button" className="action-button warning" onClick={() => { setEditingSupervisorId(''); setSupervisorForm({ username: '', password: '', degree: '3' }); }}>إلغاء</button>}
            </form>
            <div className="admin-record-list">
              {supervisorRecords.map((row, index) => { const credentials = getSupervisorCredentials(row); const id = getSupervisorRecordId(row); const username = String(credentials.username || 'مشرف'); const degree = String(getSupervisorDegree(row) || 'غير محدد'); return <div className="admin-supervisor-item" key={`${id || username}-${index}`}><strong>{username}</strong><span>الدرجة {degree}</span><button type="button" onClick={() => { setEditingSupervisorId(id); setSupervisorForm({ username, password: '', degree: degree === 'غير محدد' ? '3' : degree }); }}>تعديل</button><button type="button" onClick={() => void handleSupervisorDelete(row)}>حذف</button></div>; })}
            </div>
          </section>
        )}

        {supervisorLoggedIn && selectedFeature === 'logs' && (
          <section className="admin-dashboard-panel">
            <div className="admin-dashboard-heading"><div><span className="feature-panel-kicker">المتابعة والتدقيق</span><h1>سجلات الطلاب والمشرفين</h1><p>كل عملية مسجلة مع المستخدم والجهاز والتاريخ والوقت.</p></div><button type="button" className="action-button primary" onClick={() => void refreshAuditLogs()}>تحديث السجلات</button></div>
            <div className="admin-record-list">{auditLogs.map((log, index) => <div className="admin-record-item" key={`${getAdminRecordValue(log, ['log_id'])}-${index}`}><strong>{String(getAdminRecordValue(log, ['action']) || 'عملية')}</strong><span>المستخدم: {String(getAdminRecordValue(log, ['username']) || 'غير محدد')}</span><span>النوع: {String(getAdminRecordValue(log, ['user_type']) || '')}</span><span>{String(getAdminRecordValue(log, ['created_at']) || '')}</span><span>الجهاز: {String(getAdminRecordValue(log, ['device_type']) || '')} / {String(getAdminRecordValue(log, ['platform']) || '')}</span><span>المسار: {String(getAdminRecordValue(log, ['path']) || '')}</span></div>)}</div>
            {auditLogs.length === 0 && <div className="loading-box">لا توجد سجلات أو لم يتم إنشاء جدول سجلات النظام بعد.</div>}
          </section>
        )}

        {supervisorLoggedIn && selectedFeature === 'attendance' && (
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

        {supervisorLoggedIn && selectedFeature === 'attendance' && !sessionActive && (
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

            <div className="session-info" style={{ marginTop: 20 }}>
              <strong>الجلسات خلال آخر ساعة</strong>
              {recentSessions.length === 0 ? (
                <div style={{ marginTop: 8 }}>لا توجد جلسات مسجلة خلال آخر ساعة.</div>
              ) : (
                <div style={{ marginTop: 8 }}>
                  {recentSessions.map((session) => (
                    <div key={session.id} style={{ marginTop: 6 }}>
                      {session.course} - الفئة {session.classValue} - {session.supervisor} - {new Date(session.startedAt).toLocaleTimeString('ar-EG')}
                    </div>
                  ))}
                </div>
              )}
            </div>
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
                  <div key={studentId || getFullStudentName(student)} className={`student-card ${status}`}>
                    <div className="student-card-top">
                      <div className="student-name">{getFullStudentName(student)}</div>
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
              <button type="button" className="action-button primary" onClick={saveSession} disabled={loading || saveInProgressRef.current}>
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
