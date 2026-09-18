import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const message = body?.message;

    if (message && message.text === '/start') {
      const chatId = message.chat.id;
      const botToken = process.env.TELEGRAM_BOT_TOKEN;

      if (botToken) {
        const textMessage = `أهلاً بك في بوابة معهد دبي للتدريب! 🎓\n\nرقم المعرف الخاص بك (Chat ID) هو:\n\`${chatId}\`\n\nيرجى نسخ الرقم وضعه في خانة التفعيل بالموقع لتلقي التنبيهات.`;

        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: textMessage,
            parse_mode: 'Markdown'
          })
        });
      }
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    console.error('Telegram Webhook Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
