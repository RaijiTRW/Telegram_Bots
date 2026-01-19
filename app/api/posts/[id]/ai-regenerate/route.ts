import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import { getOpenRouterClient } from '@/lib/ai/openrouter-client';
import { plainTextToTiptap, tiptapToPlainText } from '@/lib/ai/content-converter';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/**
 * POST /api/posts/[id]/ai-regenerate
 * AI пересоздание всего поста
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: postId } = await params;

    // Проверка аутентификации
    const cookieStore = await cookies();
    const userId = cookieStore.get('user_id')?.value;

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Парсим body
    const body = await request.json();
    const { instruction } = body;

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Загружаем пост
    const { data: post, error: postError } = await supabase
      .from('posts')
      .select('*, channels(topic, description)')
      .eq('id', postId)
      .single();

    if (postError || !post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    // Устанавливаем флаг ai_editing = true
    await supabase
      .from('posts')
      .update({ ai_editing: true, original_content: post.content })
      .eq('id', postId);

    try {
      // Загружаем оригинальный контент из источников
      let sourceData: Array<{ title?: string; content: string; url?: string }> = [];

      if (post.source_content_ids && post.source_content_ids.length > 0) {
        const { data: parsedContent, error: contentError } = await supabase
          .from('parsed_content')
          .select('*')
          .in('id', post.source_content_ids);

        if (!contentError && parsedContent) {
          sourceData = parsedContent.map((content) => ({
            title: content.title,
            content: content.content,
            url: content.url,
          }));
        }
      }

      // Если нет исходного контента, используем текущий пост
      if (sourceData.length === 0) {
        const plainText = tiptapToPlainText(post.content);
        sourceData = [
          {
            title: post.title,
            content: plainText,
          },
        ];
      }

      // Получаем AI клиент
      const aiClient = getOpenRouterClient();

      // Пересоздаем пост через AI
      const response = await aiClient.regeneratePost({
        originalPrompt: post.generation_prompt || `Topic: ${post.channels.topic}`,
        newInstruction: instruction,
        sourceContent: sourceData,
      });

      const newContent = response.content.trim();

      // Конвертируем в Tiptap JSON
      const tiptapContent = plainTextToTiptap(newContent);

      // Сохраняем обновленный пост
      const { data: updatedPost, error: updateError } = await supabase
        .from('posts')
        .update({
          content: tiptapContent,
          plain_text: newContent,
          ai_editing: false,
          updated_at: new Date().toISOString(),
        })
        .eq('id', postId)
        .select()
        .single();

      if (updateError) {
        throw new Error(`Failed to update post: ${updateError.message}`);
      }

      // Логируем AI операцию
      await supabase.from('ai_generation_logs').insert({
        post_id: postId,
        channel_id: post.channel_id,
        action_type: 'regenerate',
        prompt: instruction
          ? `Regenerate with instruction: "${instruction}"`
          : 'Regenerate post',
        model: response.model,
        tokens_used: response.tokensUsed,
        cost_usd: response.costUSD,
        success: true,
      });

      return NextResponse.json({
        success: true,
        post: {
          id: updatedPost.id,
          content: updatedPost.content,
          plain_text: updatedPost.plain_text,
        },
        tokensUsed: response.tokensUsed,
        costUSD: response.costUSD,
      });
    } catch (error) {
      // В случае ошибки сбрасываем флаг ai_editing и восстанавливаем оригинал
      await supabase
        .from('posts')
        .update({
          ai_editing: false,
          content: post.original_content || post.content,
        })
        .eq('id', postId);

      // Логируем ошибку
      await supabase.from('ai_generation_logs').insert({
        post_id: postId,
        channel_id: post.channel_id,
        action_type: 'regenerate',
        prompt: instruction ? `Regenerate failed: "${instruction}"` : 'Regenerate failed',
        model: 'anthropic/claude-sonnet-4.5',
        success: false,
        error_message: error instanceof Error ? error.message : 'Unknown error',
      });

      throw error;
    }
  } catch (error) {
    console.error('Error regenerating post with AI:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
