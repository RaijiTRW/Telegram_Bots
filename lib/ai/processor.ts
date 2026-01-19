/**
 * AI Processor
 * Основной процессор для AI генерации контента
 * Использует Orchestrator для координации агентов
 */

import { getOrchestrator } from './agents/orchestrator';

// ============================================================================
// Типы (для обратной совместимости)
// ============================================================================

interface ProcessorResult {
  channelId: string;
  success: boolean;
  postsGenerated: number;
  contentParsed: number;
  errors: string[];
}

// ============================================================================
// AI Processor Class
// ============================================================================

export class AIProcessor {
  private orchestrator = getOrchestrator();

  /**
   * Обработка всех AI-enabled каналов
   */
  async processAllChannels(): Promise<ProcessorResult[]> {
    console.log('[AIProcessor] Starting processing all channels via Orchestrator...');

    const summary = await this.orchestrator.runFullCycle();

    // Конвертируем результаты Orchestrator в формат ProcessorResult
    return summary.results.map(result => ({
      channelId: result.channelId,
      success: result.success,
      postsGenerated: result.postId ? 1 : 0,
      contentParsed: result.stats.parsedItems,
      errors: result.error ? [result.error] : [],
    }));
  }

  /**
   * Обработка одного канала
   */
  async processChannel(
    channelId: string,
    options?: { parseMode?: 'new' | 'old'; telegramUserId?: string }
  ): Promise<ProcessorResult> {
    console.log(`[AIProcessor] Processing single channel ${channelId} via Orchestrator...`);

    // Получаем данные канала
    const { supabaseAdmin } = await import('@/lib/supabase/server');

    const { data: channel, error } = await (supabaseAdmin
      .from('channels') as any)
      .select('id, name, topic, description, ai_enabled, ai_status')
      .eq('id', channelId)
      .single();

    if (error || !channel) {
      return {
        channelId,
        success: false,
        postsGenerated: 0,
        contentParsed: 0,
        errors: ['Channel not found'],
      };
    }

    if (!channel.ai_enabled) {
      return {
        channelId,
        success: false,
        postsGenerated: 0,
        contentParsed: 0,
        errors: ['AI is not enabled for this channel'],
      };
    }

    // Используем Orchestrator для обработки канала
    const result = await this.orchestrator.processChannel(channel, options);

    return {
      channelId: result.channelId,
      success: result.success,
      postsGenerated: result.postId ? 1 : 0,
      contentParsed: result.stats.parsedItems,
      errors: result.error ? [result.error] : [],
    };
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Создание инстанса AI процессора
 */
export function createAIProcessor(): AIProcessor {
  return new AIProcessor();
}
