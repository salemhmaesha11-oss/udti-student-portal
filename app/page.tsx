const student = {
  name: 'أحمد محمد علي',
  id: '202420011',
  faculty: 'قسم تعويضات الأسنان',
  major: 'علوم حاسب',
  level: 'السنة الثانية',
  status: 'نشط',
  email: 'student@udti.edu',
  password: '********',
};

const grades = [
  { subject: 'برمجة', annual: 90, theory: 44, practical: 46, total: 90, assistance: 'مقبول' },
  { subject: 'قواعد بيانات', annual: 88, theory: 43, practical: 45, total: 88, assistance: 'مقبول' },
  { subject: 'شبكات', annual: 82, theory: 41, practical: 41, total: 82, assistance: 'لا' },
  { subject: 'ذكاء اصطناعي', annual: 91, theory: 45, practical: 46, total: 91, assistance: 'مقبول' },
];

const warnings = [
  { title: 'تأخر 10 دقائق', date: '2026-09-02', severity: 'منخفض' },
  { title: 'عدم حضور محاضرة', date: '2026-09-06', severity: 'متوسط' },
  { title: 'إهمال الواجب', date: '2026-09-11', severity: 'عالي' },
];

const schedule = [
  { day: 'السبت', items: ['برمجة / 08:00', 'شبكات / 10:00', 'مكتبة / 13:00'] },
  { day: 'الأحد', items: ['قواعد بيانات / 08:30', 'لغة عربية / 11:00'] },
  { day: 'الإثنين', items: ['ذكاء اصطناعي / 09:00', 'دراسة مستقلة / 14:00'] },
  { day: 'الثلاثاء', items: ['مختبر شبكات / 10:00', 'تدريب / 15:00'] },
  { day: 'الأربعاء', items: ['برمجة تطبيقية / 09:00'] },
];

const attendanceSummary = [
  { label: 'حاضر', value: '184', tone: 'present' },
  { label: 'غائب', value: '18', tone: 'absent' },
  { label: 'منتظر', value: '7', tone: 'waiting' },
];

export default function Home() {
  return (
    <main className="student-shell" dir="rtl">
      <div className="student-page">
        <div className="container" id="mainContainer">
          <div className="institute-header">
            <img
              className="institute-logo"
              src="https://drive.google.com/thumbnail?id=1WBYFxtmLUfuREUY1H5Uso5ltomjshWlq&sz=w1000"
              alt="شعار المعهد"
            />
            <h2>المعهد التقاني لطب الأسنان</h2>
            <h3>جامعة اللاذقية</h3>
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
              <div className="barcode-name">{student.name}</div>
              <div className="barcode-id">{student.id}</div>
            </div>
          </div>

          <div className="header">
            <h1>الحساب الجامعي</h1>
          </div>

          <div className="student-info">
            <div className="info-item"><span className="info-label"><i className="fa-solid fa-user" /> الاسم</span> {student.name}</div>
            <div className="info-item"><span className="info-label"><i className="fa-solid fa-id-card" /> الرقم الجامعي</span> {student.id}</div>
            <div className="info-item"><span className="info-label"><i className="fa-solid fa-building-columns" /> القسم</span> {student.faculty}</div>
            <div className="info-item"><span className="info-label"><i className="fa-solid fa-graduation-cap" /> التخصص</span> {student.major}</div>
            <div className="info-item"><span className="info-label"><i className="fa-solid fa-layer-group" /> الفصل</span> {student.level}</div>
            <div className="info-item"><span className="info-label"><i className="fa-solid fa-check-circle" /> الحالة</span> {student.status}</div>
          </div>

          <div className="student-details-grid">
            <div className="detail-item">
              <div className="detail-label">المعدل الفصلي</div>
              <div className="detail-value">92.4%</div>
            </div>
            <div className="detail-item">
              <div className="detail-label">المعدل التراكمي</div>
              <div className="detail-value">90.8%</div>
            </div>
            <div className="detail-item">
              <div className="detail-label">البريد الإلكتروني</div>
              <div className="detail-value">{student.email}</div>
            </div>
            <div className="detail-item">
              <div className="detail-label">كلمة المرور</div>
              <div className="detail-value">{student.password}</div>
            </div>
          </div>

          <div className="tabs-container">
            <div className="tabs">
              <button className="tab active" type="button">العلامات</button>
              <button className="tab" type="button">السجل</button>
              <button className="tab" type="button">الحالة</button>
              <button className="tab" type="button">الدوام</button>
            </div>

            <div className="tab-content active">
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
                      <td>{item.annual}</td>
                      <td>{item.theory}</td>
                      <td>{item.practical}</td>
                      <td>{item.total}</td>
                      <td>{item.assistance}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="final-average">
                <div className="average-title">المعدل التراكمي</div>
                <div className="average-value">90.8</div>
                <div className="percentage-container">
                  <div className="percentage-value">90.8%</div>
                  <div className="progress-container">
                    <div className="progress-bar">
                      <div className="progress-fill" style={{ width: '90.8%' }}>
                        <span className="progress-text">90.8%</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="tab-content">
              <div className="warning-icon"><i className="fa-solid fa-triangle-exclamation" /></div>
              <div className="warning-list">
                {warnings.map((warning) => (
                  <div key={warning.title} className="warning-item">
                    <div className="warning-header">
                      <strong>{warning.title}</strong>
                      <span className="warning-type">{warning.severity}</span>
                    </div>
                    <div className="warning-date">{warning.date}</div>
                    <div className="warning-reason">تم تسجيل هذا الإنذار وفقاً للسياسات الأكاديمية المعتمدة.</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="tab-content">
              <div className="status-grid">
                <div className="status-card">
                  <div className="status-icon"><i className="fa-solid fa-check-circle" /></div>
                  <div className="status-title">الحالة الدراسية</div>
                  <div className="status-data">نشط</div>
                </div>
                <div className="status-card">
                  <div className="status-icon"><i className="fa-solid fa-calendar-check" /></div>
                  <div className="status-title">معدل الحضور</div>
                  <div className="status-data">96%</div>
                </div>
                <div className="status-card">
                  <div className="status-icon"><i className="fa-solid fa-bell" /></div>
                  <div className="status-title">عدد الإنذارات</div>
                  <div className="status-data">3</div>
                </div>
              </div>
            </div>

            <div className="tab-content">
              <div className="schedule-cards">
                {schedule.map((day) => (
                  <div key={day.day} className="schedule-card">
                    <div className="day-header"><i className="fa-regular fa-calendar" /> {day.day}</div>
                    <div className="schedule-content">
                      {day.items.map((item) => (
                        <div key={item} className="schedule-text">{item}</div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="attendance-box">
            <h3>نظام الحضور والغياب</h3>
            <div className="attendance-list">
              {attendanceSummary.map((item) => (
                <div key={item.label} className="attendance-row">
                  <span className={`attendance-dot ${item.tone}`} />
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                </div>
              ))}
            </div>
          </div>

          <div className="action-buttons">
            <button className="btn btn-primary" type="button">تحديث البريد الإلكتروني</button>
            <button className="btn btn-primary" type="button">تغيير كلمة المرور</button>
            <button className="btn btn-primary" type="button">تغيير الفئة</button>
            <button className="btn btn-danger" type="button">طباعة النتيجة</button>
          </div>

          <div className="last-updated">آخر تحديث للنظام: 2026/09/16</div>
        </div>
      </div>
    </main>
  );
}
