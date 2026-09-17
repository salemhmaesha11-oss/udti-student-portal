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
      }),
    });
    return await res.json();
  } catch (error) {
    console.error('Telegram Send Error:', error);
    return null;
  }
}
