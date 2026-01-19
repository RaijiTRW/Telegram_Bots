import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import { getOpenRouterClient } from '@/lib/ai/openrouter-client';
import { plainTextToTiptap } from '@/lib/ai/content-converter';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/**
 * POST /api/ai/generate
 * Ручная генерация поста из выбранного контента
 */
export async function POST(request: NextRequest) {
  try {
    // Проверка аутентификации
    const cookieStore = await cookies();
    const userId = cookieStore.get('user_id')?.value;

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Парсим body
    const body = await request.json();
    const { channel_id, content_ids } = body;

    if (!channel_id || !content_ids || !Array.isArray(content_ids)) {
      return NextResponse.json(
        { error: 'channel_id and content_ids (array) are required' },
        { status: 400 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Загружаем канал
    const { data: channel, error: channelError } = await supabase
      .from('channels')
      .select('*')
      .eq('id', channel_id)
      .single();

    if (channelError || !channel) {
      return NextResponse.json({ error: 'Channel not found' }, { status: 404 });
    }

    // Загружаем контент
    const { data: parsedContent, error: contentError } = await supabase
      .from('parsed_content')
      .select('*')
      .in('id', content_ids);

    if (contentError || !parsedContent || parsedContent.length === 0) {
      return NextResponse.json({ error: 'Content not found' }, { status: 404 });
    }

    // Формируем данные для AI
    const sourceData = parsedContent.map((content) => ({
      title: content.title,
      content: content.content,
      url: content.url,
    }));

    // Получаем AI клиент
    const aiClient = getOpenRouterClient();

    // Генерируем пост
    const response = await aiClient.generatePost({
      topic: channel.topic,
      description: channel.description || '',
      sourceContent: sourceData,
    });

    // Конвертируем в Tiptap JSON
    const tiptapContent = plainTextToTiptap(response.content);

    // Сохраняем пост
    const { data: post, error: postError } = await supabase
      .from('posts')
      .insert({
        channel_id: channel.id,
        title: parsedContent[0]?.title,
        content: tiptapContent,
        plain_text: response.content,
        status: 'pending',
        ai_generated: true,
        source_content_ids: content_ids,
        generation_prompt: `Topic: ${channel.topic}\nDescription: ${channel.description}`,
      })
      .select()
      .single();

    if (postError) {
      throw new Error(`Failed to save post: ${postError.message}`);
    }

    // Логируем AI операцию
    await supabase.from('ai_generation_logs').insert({
      channel_id: channel.id,
      post_id: post.id,
      action_type: 'generate',
      prompt: `Manual generation for ${channel.topic}`,
      model: response.model,
      tokens_used: response.tokensUsed,
      cost_usd: response.costUSD,
      success: true,
    });

    // Помечаем контент как использованный
    await supabase
      .from('parsed_content')
      .update({ used_in_posts: true })
      .in('id', content_ids);

    return NextResponse.json({
      success: true,
      post: {
        id: post.id,
        title: post.title,
        status: post.status,
      },
      tokensUsed: response.tokensUsed,
      costUSD: response.costUSD,
    });
  } catch (error) {
    console.error('Error generating post:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
