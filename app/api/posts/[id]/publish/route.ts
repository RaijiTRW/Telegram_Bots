import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase/server';

type Params = Promise<{ id: string }>;

export async function POST(
  request: NextRequest,
  { params }: { params: Params }
) {
  try {
    const cookieStore = await cookies();
    const userId = cookieStore.get('user_id')?.value;

    if (!userId) {
      return NextResponse.json(
        { error: 'Не авторизован' },
        { status: 401 }
      );
    }

    const { id } = await params;

    // Получаем пост с данными канала
    const { data: post, error: postError } = await (supabaseAdmin
      .from('posts') as any)
      .select('*, channels(id, name, telegram_link, telegram_chat_id, topic)')
      .eq('id', id)
      .single();

    if (postError || !post) {
      return NextResponse.json(
        { error: 'Пост не найден' },
        { status: 404 }
      );
    }

    if (!post.channels?.telegram_link) {
      return NextResponse.json(
        { error: 'У канала не настроен Telegram бот' },
        { status: 400 }
      );
    }

    if (!post.channels?.telegram_chat_id) {
      return NextResponse.json(
        { error: 'У канала не указан Chat ID. Укажите @username или числовой ID канала в настройках.' },
        { status: 400 }
      );
    }

    const botToken = post.channels.telegram_link;
    const chatId = post.channels.telegram_chat_id;

    const escapeHtml = (text: string) =>
      text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

    // Проверяем валидность токена бота
    const getMeResponse = await fetch(`https://api.telegram.org/bot${botToken}/getMe`);
    const getMeData = await getMeResponse.json();

    if (!getMeData.ok) {
      return NextResponse.json(
        { error: 'Неверный токен бота: ' + (getMeData.description || 'Unknown error') },
        { status: 400 }
      );
    }

    // Формируем текст сообщения
    let messageText = escapeHtml(post.plain_text || '');

    // Если есть заголовок, добавляем его
    if (post.title) {
      messageText = `<b>${escapeHtml(String(post.title))}</b>\n\n${messageText}`;
    }

    // Загружаем изображения поста (если есть)
    const { data: images } = await (supabaseAdmin
      .from('post_images') as any)
      .select('url, position')
      .eq('post_id', id)
      .order('position', { ascending: true })
      .limit(10);

    const imageUrls: string[] = (images || [])
      .map((img: any) => img.url)
      .filter((u: any) => typeof u === 'string' && u.length > 0);

    let telegramMessageId: number | undefined;
    const TELEGRAM_CAPTION_LIMIT = 3068;

    // Если есть изображения — публикуем ОДНО сообщение с фото + caption (Telegram ограничивает caption 1024).
    if (imageUrls.length > 0) {
      // Публикуем только обложку (position=0) как фото, чтобы это было одним сообщением.
      const coverUrl = imageUrls[0];
      const caption =
        messageText.length <= TELEGRAM_CAPTION_LIMIT
          ? messageText
          : messageText.slice(0, Math.max(0, TELEGRAM_CAPTION_LIMIT - 1)).trimEnd() + '…';

      const sendPhotoResponse = await fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          photo: coverUrl,
          caption,
          parse_mode: 'HTML',
        }),
      });

      const sendPhotoResult = await sendPhotoResponse.json();
      if (!sendPhotoResult.ok) {
        return NextResponse.json(
          { error: 'Ошибка отправки изображения в Telegram: ' + (sendPhotoResult.description || 'Unknown error') },
          { status: 500 }
        );
      }
      telegramMessageId = sendPhotoResult.result?.message_id;
    } else {
      // Отправляем только текст
      const sendMessageResponse = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: chatId,
          text: messageText,
          parse_mode: 'HTML',
        }),
      });

      const sendResult = await sendMessageResponse.json();

      if (!sendResult.ok) {
        return NextResponse.json(
          { error: 'Ошибка отправки в Telegram: ' + (sendResult.description || 'Unknown error') },
          { status: 500 }
        );
      }
      telegramMessageId = sendResult.result?.message_id;
    }

    let analyticsSaved = false;
    let analyticsError: string | undefined;

    if (telegramMessageId) {
      const { error: upsertError } = await (supabaseAdmin
        .from('post_analytics') as any)
        .upsert(
          {
            post_id: id,
            telegram_message_id: telegramMessageId,
          },
          { onConflict: 'post_id' }
        );

      if (upsertError) {
        analyticsError = upsertError.message || String(upsertError);
        console.error('Failed to upsert post_analytics:', upsertError);
      } else {
        analyticsSaved = true;
      }
    }

    // Обновляем статус поста
    const { error: updateError } = await (supabaseAdmin
      .from('posts') as any)
      .update({
        status: 'published',
        published_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (updateError) {
      console.error('Ошибка обновления статуса:', updateError);
    }

    return NextResponse.json({
      success: true,
      message: 'Пост успешно опубликован в Telegram!',
      telegram_message_id: telegramMessageId,
      analyticsSaved,
      analyticsError: process.env.NODE_ENV === 'production' ? undefined : analyticsError,
    });

  } catch (error) {
    console.error('Ошибка публикации:', error);
    return NextResponse.json(
      { error: 'Ошибка сервера при публикации' },
      { status: 500 }
    );
  }
}
