import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import { getOpenRouterClient } from '@/lib/ai/openrouter-client';
import {
  tiptapToPlainText,
  replaceTextInTiptap,
  getTextContext,
} from '@/lib/ai/content-converter';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/**
 * POST /api/posts/[id]/ai-edit
 * AI редактирование выделенного фрагмента текста
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
    const { selected_text, instruction } = body;

    if (!selected_text || !instruction) {
      return NextResponse.json(
        { error: 'selected_text and instruction are required' },
        { status: 400 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Загружаем пост
    const { data: post, error: postError } = await supabase
      .from('posts')
      .select('*')
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
      // Получаем контекст вокруг выделенного текста
      const context = getTextContext(post.content, selected_text, 200);

      const fullContext = context.before
        ? `...${context.before}\n\n${selected_text}\n\n${context.after}...`
        : undefined;

      // Получаем AI клиент
      const aiClient = getOpenRouterClient();

      // Редактируем текст через AI
      const response = await aiClient.editText({
        originalText: selected_text,
        instruction,
        context: fullContext,
      });

      const editedText = response.content.trim();

      // Заменяем текст в Tiptap JSON
      const updatedContent = replaceTextInTiptap(
        post.content,
        selected_text,
        editedText
      );

      // Обновляем plain_text
      const updatedPlainText = tiptapToPlainText(updatedContent);

      // Сохраняем обновленный пост
      const { data: updatedPost, error: updateError } = await supabase
        .from('posts')
        .update({
          content: updatedContent,
          plain_text: updatedPlainText,
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
        action_type: 'edit',
        prompt: `Edit: "${instruction}" for text: "${selected_text.substring(0, 100)}..."`,
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
        editedText,
        tokensUsed: response.tokensUsed,
        costUSD: response.costUSD,
      });
    } catch (error) {
      // В случае ошибки сбрасываем флаг ai_editing
      await supabase
        .from('posts')
        .update({ ai_editing: false })
        .eq('id', postId);

      // Логируем ошибку
      await supabase.from('ai_generation_logs').insert({
        post_id: postId,
        channel_id: post.channel_id,
        action_type: 'edit',
        prompt: `Edit failed: "${instruction}"`,
        model: 'anthropic/claude-sonnet-4.5',
        success: false,
        error_message: error instanceof Error ? error.message : 'Unknown error',
      });

      throw error;
    }
  } catch (error) {
    console.error('Error editing text with AI:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
