const escapeHtml = (value: string | number | null | undefined) => {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
};

export function buildStudentTelegramMessage({
  studentName,
  studentId,
  studentYear,
  studentClass,
  statusText,
}: {
  studentName: string;
  studentId: string;
  studentYear: string;
  studentClass: string;
  statusText: string;
}) {
  return [
    '🔔 <b>تنبيه نظام الحضور والغياب</b>',
    '━━━━━━━━━━━━━━━━━━━',
    `👤 <b>الاسم:</b> ${escapeHtml(studentName)}`,
    `🆔 <b>الرقم الجامعي:</b> ${escapeHtml(studentId)}`,
    `🎓 <b>السنة الدراسية:</b> ${escapeHtml(studentYear)}`,
    `📌 <b>الفئة:</b> ${escapeHtml(studentClass)}`,
    '━━━━━━━━━━━━━━━━━━━',
    `📢 <b>الحالة:</b> ${escapeHtml(statusText)}`,
  ].join('\n');
}

export async function sendTelegramNotification(message: string) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN || '8672071352:AAHn63d112hNq29pRd8NTsR8eEs5OA_KPlA';
  const chatId = process.env.TELEGRAM_CHAT_ID || '7259761374';

  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    });
    return await res.json();
  } catch (error) {
    console.error('Telegram Send Error:', error);
    return null;
  }
}
