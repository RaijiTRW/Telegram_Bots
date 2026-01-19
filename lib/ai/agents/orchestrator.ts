/**
 * Orchestrator
 * Координатор всех AI агентов
 * Управляет полным циклом: парсинг → планирование → написание → сохранение
 */

import { supabaseAdmin } from '@/lib/supabase/server';
import { getParserAgent, ParserOutput } from './parser-agent';
import { getPlannerAgent, PlannerOutput } from './planner-agent';
import { getWriterAgent, WriterOutput } from './writer-agent';
import { getImageAgent } from './image-agent';
import { Source } from '../parsers/factory';
import { markdownToTiptap } from '../content-converter';

interface Channel {
  id: string;
  name: string;
  topic: string;
  description: string | null;
  ai_enabled: boolean;
  ai_status: string;
}

interface OrchestratorResult {
  channelId: string;
  channelName: string;
  success: boolean;
  postId?: string;
  error?: string;
  stats: {
    parsedItems: number;
    newItems: number;
    tokensUsed: number;
    costUSD: number;
  };
}

interface OrchestratorSummary {
  totalChannels: number;
  successfulChannels: number;
  failedChannels: number;
  totalPostsCreated: number;
  totalTokensUsed: number;
  totalCostUSD: number;
  results: OrchestratorResult[];
}

export class Orchestrator {
  private parserAgent = getParserAgent();
  private plannerAgent = getPlannerAgent();
  private writerAgent = getWriterAgent();
  private imageAgent = getImageAgent();

  /**
   * Запуск полного цикла для всех AI-enabled каналов
   */
  async runFullCycle(): Promise<OrchestratorSummary> {
    this.log('Starting full AI cycle...');

    const summary: OrchestratorSummary = {
      totalChannels: 0,
      successfulChannels: 0,
      failedChannels: 0,
      totalPostsCreated: 0,
      totalTokensUsed: 0,
      totalCostUSD: 0,
      results: [],
    };

    try {
      // Получаем все AI-enabled каналы
      const channels = await this.getEnabledChannels();
      summary.totalChannels = channels.length;

      this.log(`Found ${channels.length} AI-enabled channels`);

      // Обрабатываем каждый канал
      for (const channel of channels) {
        const result = await this.processChannel(channel);
        summary.results.push(result);

        if (result.success) {
          summary.successfulChannels++;
          if (result.postId) {
            summary.totalPostsCreated++;
          }
        } else {
          summary.failedChannels++;
        }

        summary.totalTokensUsed += result.stats.tokensUsed;
        summary.totalCostUSD += result.stats.costUSD;
      }

      this.log('Full cycle completed');
      this.log(`Summary: ${summary.successfulChannels}/${summary.totalChannels} successful, ${summary.totalPostsCreated} posts created`);

    } catch (error) {
      this.logError('Fatal error in full cycle', error);
    }

    return summary;
  }

  /**
   * Обработка одного канала
   */
  async processChannel(
    channel: Channel,
    options?: { parseMode?: 'new' | 'old' }
  ): Promise<OrchestratorResult> {
    this.log(`Processing channel: ${channel.name}`);

    const result: OrchestratorResult = {
      channelId: channel.id,
      channelName: channel.name,
      success: false,
      stats: {
        parsedItems: 0,
        newItems: 0,
        tokensUsed: 0,
        costUSD: 0,
      },
    };

    try {
      // Пытаемся "захватить" канал (защита от параллельных запусков)
      const started = await this.tryStartChannelRun(channel.id);
      if (!started) {
        result.success = true;
        this.log(`Skip: channel already running (${channel.name})`);
        return result;
      }

      // 1. Получаем источники канала
      const sources = await this.getChannelSources(channel.id);
      if (sources.length === 0) {
        result.error = 'Нет активных источников';
        await this.updateChannelStatus(channel.id, 'stopped', result.error);
        return result;
      }

      this.log(`Found ${sources.length} active sources`);

      // 2. ПАРСИНГ - Parser Agent
      this.log('Step 1: Parsing content...');
      const parserResult = await this.parserAgent.execute({
        channelId: channel.id,
        sources,
        parseMode: options?.parseMode,
      });

      if (!parserResult.success || !parserResult.data) {
        result.error = parserResult.error || 'Ошибка парсинга';
        await this.updateChannelStatus(channel.id, 'error', result.error);
        return result;
      }

      const parserOutput: ParserOutput = parserResult.data;
      result.stats.parsedItems = parserOutput.totalParsed;
      result.stats.newItems = parserOutput.newContent;

      this.log(`Parsed ${parserOutput.totalParsed} items, ${parserOutput.newContent} new`);

      // Если нет нового контента - пропускаем
      if (parserOutput.newContent === 0) {
        result.success = true;
        await this.updateChannelStatus(channel.id, 'stopped');
        await this.updateChannelLastRun(channel.id);
        return result;
      }

      // 3. ПЛАНИРОВАНИЕ - Planner Agent
      this.log('Step 2: Planning post...');
      const plannerResult = await this.plannerAgent.execute({
        channelId: channel.id,
        channelName: channel.name,
        channelTopic: channel.topic,
        channelDescription: channel.description || undefined,
        parsedContent: parserOutput.parsedContent,
      });

      if (!plannerResult.success || !plannerResult.data) {
        result.error = plannerResult.error || 'Ошибка планирования';
        await this.updateChannelStatus(channel.id, 'error', result.error);
        return result;
      }

      const plannerOutput: PlannerOutput = plannerResult.data;
      result.stats.tokensUsed += plannerResult.tokensUsed || 0;
      result.stats.costUSD += plannerResult.costUSD || 0;

      this.log(`Plan created: ${plannerOutput.plan.mainTopic}`);

      // 4. НАПИСАНИЕ - Writer Agent
      this.log('Step 3: Writing post...');

      // Подготавливаем контент для Writer Agent
      const sourceContents = parserOutput.parsedContent
        .filter(c => plannerOutput.contentIds.includes(c.id || ''))
        .map(c => ({
          id: c.id || '',
          content: c.content,
          url: c.url,
        }));

      const writerResult = await this.writerAgent.execute({
        channelId: channel.id,
        channelName: channel.name,
        channelTopic: channel.topic,
        plan: plannerOutput.plan,
        sourceContents,
      });

      if (!writerResult.success || !writerResult.data) {
        result.error = writerResult.error || 'Ошибка написания поста';
        await this.updateChannelStatus(channel.id, 'error', result.error);
        return result;
      }

      const writerOutput: WriterOutput = writerResult.data;
      result.stats.tokensUsed += writerResult.tokensUsed || 0;
      result.stats.costUSD += writerResult.costUSD || 0;

      this.log(`Post written: ${writerOutput.post.title}`);

      // 5. СОХРАНЕНИЕ поста в БД
      this.log('Step 4: Saving post...');
      const postId = await this.savePost(channel.id, writerOutput, plannerOutput);

      if (!postId) {
        result.error = 'Ошибка сохранения поста';
        await this.updateChannelStatus(channel.id, 'error', result.error);
        return result;
      }

      result.postId = postId;
      result.success = true;

      // Подбираем и сохраняем изображения (если есть)
      await this.attachImagesToPost(channel, postId, parserOutput, plannerOutput, writerOutput);

      // Помечаем использованный контент
      await this.markContentAsUsed(plannerOutput.contentIds);

      // Логируем AI операцию
      await this.logAIGeneration(channel.id, postId, plannerOutput, writerOutput, result.stats);

      // Обновляем статус канала
      await this.updateChannelStatus(channel.id, 'stopped');
      await this.updateChannelLastRun(channel.id);

      this.log(`Successfully created post ${postId} for channel ${channel.name}`);

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      result.error = errorMsg;
      this.logError(`Failed to process channel ${channel.name}`, error);
      await this.updateChannelStatus(channel.id, 'error', errorMsg);
    }

    return result;
  }

  /**
   * Получение AI-enabled каналов
   */
  private async getEnabledChannels(): Promise<Channel[]> {
    try {
      const { data, error } = await (supabaseAdmin
        .from('channels') as any)
        .select('id, name, topic, description, ai_enabled, ai_status')
        .eq('ai_enabled', true)
        .eq('is_active', true);

      if (error) throw error;
      return data || [];
    } catch (error) {
      this.logError('Failed to get enabled channels', error);
      return [];
    }
  }

  /**
   * Получение активных источников канала
   */
  private async getChannelSources(channelId: string): Promise<Source[]> {
    try {
      const { data, error } = await (supabaseAdmin
        .from('sources') as any)
        .select('id, url, type, name, parsing_config')
        .eq('channel_id', channelId)
        .eq('is_active', true);

      if (error) throw error;
      return (data || []).map((s: any) => ({
        id: s.id,
        url: s.url,
        type: s.type as 'telegram' | 'website' | 'rss',
        name: s.name,
        parsing_config: s.parsing_config,
      }));
    } catch (error) {
      this.logError('Failed to get channel sources', error);
      return [];
    }
  }

  /**
   * Сохранение поста в БД
   */
  private async savePost(
    channelId: string,
    writerOutput: WriterOutput,
    plannerOutput: PlannerOutput
  ): Promise<string | null> {
    try {
      // Конвертируем Markdown в Tiptap JSON
      const tiptapContent = markdownToTiptap(writerOutput.post.content);

      const { data, error } = await (supabaseAdmin
        .from('posts') as any)
        .insert({
          channel_id: channelId,
          title: writerOutput.post.title || null,
          content: tiptapContent,
          plain_text: writerOutput.post.plainText,
          status: 'pending',
          ai_generated: true,
          source_content_ids: writerOutput.contentIds,
          generation_prompt: JSON.stringify(plannerOutput.plan),
          original_content: {
            plan: plannerOutput.plan,
            contentIds: writerOutput.contentIds,
          },
        })
        .select('id')
        .single();

      if (error) {
        this.logError('Failed to save post', error);
        return null;
      }

      return data?.id;
    } catch (error) {
      this.logError('Failed to save post', error);
      return null;
    }
  }

  /**
   * Подбор и сохранение изображений для поста
   */
  private async attachImagesToPost(
    channel: Channel,
    postId: string,
    parserOutput: ParserOutput,
    plannerOutput: PlannerOutput,
    writerOutput: WriterOutput
  ): Promise<void> {
    try {
      const availableImages = parserOutput.parsedContent
        .filter(c => plannerOutput.contentIds.includes(c.id || ''))
        .flatMap(c => (c.images || []).map(img => ({
          url: img.url,
          alt: img.alt,
          sourceUrl: c.url,
        })))
        .filter(img => !!img.url);

      if (availableImages.length === 0) {
        return;
      }

      const title = writerOutput.post.title || plannerOutput.plan.mainTopic || '';
      const plainText = writerOutput.post.plainText || '';

      const imageResult = await this.imageAgent.execute({
        postTitle: title,
        postContent: plainText,
        channelTopic: channel.topic,
        availableImages,
      });

      const selected = imageResult.success && imageResult.data?.selectedImages?.length
        ? imageResult.data.selectedImages.slice(0, 1)
        : [];

      const uniqueUrls = new Set<string>();
      const rows = selected
        .map(img => ({
          url: img.url,
          sourceUrl: img.sourceUrl,
          alt: availableImages.find(a => a.url === img.url)?.alt,
        }))
        .filter(img => {
          if (!img.url || uniqueUrls.has(img.url)) return false;
          uniqueUrls.add(img.url);
          return true;
        })
        .slice(0, 1)
        .map((img, index) => ({
          post_id: postId,
          url: img.url,
          alt_text: img.alt || null,
          position: index,
          source_type: 'ai_found',
          source_url: img.sourceUrl || null,
        }));

      if (rows.length === 0) return;

      const { error } = await (supabaseAdmin
        .from('post_images') as any)
        .insert(rows);

      if (error) {
        this.logError('Failed to save post images', error);
      }
    } catch (error) {
      this.logError('Failed to attach images to post', error);
    }
  }

  /**
   * Пометка контента как использованного
   */
  private async markContentAsUsed(contentIds: string[]): Promise<void> {
    if (contentIds.length === 0) return;

    try {
      await (supabaseAdmin
        .from('parsed_content') as any)
        .update({ used_in_posts: true })
        .in('id', contentIds);
    } catch (error) {
      this.logError('Failed to mark content as used', error);
    }
  }

  /**
   * Логирование AI генерации
   */
  private async logAIGeneration(
    channelId: string,
    postId: string,
    plannerOutput: PlannerOutput,
    writerOutput: WriterOutput,
    stats: OrchestratorResult['stats']
  ): Promise<void> {
    try {
      await (supabaseAdmin
        .from('ai_generation_logs') as any)
        .insert({
          channel_id: channelId,
          post_id: postId,
          action_type: 'generate',
          prompt: JSON.stringify({
            plan: plannerOutput.plan,
            contentIds: plannerOutput.contentIds,
          }),
          model: 'anthropic/claude-sonnet-4-5-20250514',
          tokens_used: stats.tokensUsed,
          cost_usd: stats.costUSD,
          success: true,
        });
    } catch (error) {
      this.logError('Failed to log AI generation', error);
    }
  }

  /**
   * Обновление статуса канала
   */
  private async updateChannelStatus(
    channelId: string,
    status: 'stopped' | 'running' | 'error',
    errorMessage?: string
  ): Promise<void> {
    try {
      await (supabaseAdmin
        .from('channels') as any)
        .update({
          ai_status: status,
          ai_error_message: errorMessage || null,
        })
        .eq('id', channelId);
    } catch (error) {
      this.logError('Failed to update channel status', error);
    }
  }

  private async tryStartChannelRun(channelId: string): Promise<boolean> {
    try {
      const { data, error } = await (supabaseAdmin
        .from('channels') as any)
        .update({
          ai_status: 'running',
          ai_error_message: null,
        })
        .eq('id', channelId)
        .in('ai_status', ['stopped', 'error'])
        .select('id');

      if (error) {
        this.logError('Failed to acquire channel run lock', error);
        return true;
      }

      return Array.isArray(data) && data.length > 0;
    } catch (error) {
      this.logError('Failed to acquire channel run lock', error);
      return true;
    }
  }

  /**
   * Обновление времени последнего запуска
   */
  private async updateChannelLastRun(channelId: string): Promise<void> {
    try {
      await (supabaseAdmin
        .from('channels') as any)
        .update({
          ai_last_run_at: new Date().toISOString(),
        })
        .eq('id', channelId);
    } catch (error) {
      this.logError('Failed to update channel last run', error);
    }
  }

  /**
   * Логирование
   */
  private log(message: string): void {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [Orchestrator] ${message}`);
  }

  private logError(message: string, error?: unknown): void {
    const timestamp = new Date().toISOString();
    console.error(`[${timestamp}] [Orchestrator] ERROR: ${message}`, error || '');
  }
}

// Singleton instance
let orchestrator: Orchestrator | null = null;

export function getOrchestrator(): Orchestrator {
  if (!orchestrator) {
    orchestrator = new Orchestrator();
  }
  return orchestrator;
}
