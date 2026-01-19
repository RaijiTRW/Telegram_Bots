/**
 * Parser Agent
 * Агент отвечающий за парсинг контента из источников
 */

import { BaseAgent, AgentResult } from './base-agent';
import { getParserFactory, ParseResult, Source } from '../parsers/factory';
import { supabaseAdmin } from '@/lib/supabase/server';

export interface ParserInput {
  channelId: string;
  sources: Source[];
  parseMode?: 'new' | 'old';
}

export interface ParsedImage {
  url: string;
  alt?: string;
  width?: number;
  height?: number;
}

export interface ParsedContent {
  id?: string;
  sourceId: string;
  sourceName: string;
  sourceType: string;
  title?: string;
  content: string;
  url: string;
  contentHash: string;
  publishedAt?: Date;
  isNew: boolean;
  images: ParsedImage[];
}

export interface ParserOutput {
  channelId: string;
  parsedContent: ParsedContent[];
  totalParsed: number;
  newContent: number;
  errors: string[];
}

export class ParserAgent extends BaseAgent {
  constructor() {
    super({
      name: 'ParserAgent',
      description: 'Парсит контент из источников (Telegram, веб-сайты, RSS)',
    });
  }

  /**
   * Выполнение парсинга для канала
   */
  async execute(input: ParserInput): Promise<AgentResult<ParserOutput>> {
    this.log(`Starting parsing for channel ${input.channelId}`);
    this.log(`Sources to parse: ${input.sources.length}`);

    const output: ParserOutput = {
      channelId: input.channelId,
      parsedContent: [],
      totalParsed: 0,
      newContent: 0,
      errors: [],
    };

    try {
      const parserFactory = getParserFactory();

      for (const source of input.sources) {
        try {
          this.log(`Parsing source: ${source.url} (${source.type})`);

          const { results, lastMessageId } = await parserFactory.parseSource(source, {
            maxItems: 10,
            parseMode: input.parseMode,
          });

          this.log(`Got ${results.length} results from ${source.url}`);

          // Обрабатываем результаты
          for (const result of results) {
            const parsedItem = await this.processParseResult(source, result);
            if (parsedItem) {
              output.parsedContent.push(parsedItem);
              output.totalParsed++;
              if (parsedItem.isNew) {
                output.newContent++;
              }
            }
          }

          // Обновляем lastMessageId для Telegram источников
          if (lastMessageId && source.type === 'telegram') {
            await this.updateSourceLastMessageId(source.id, lastMessageId, input.parseMode, source.parsing_config);
          }

          // Обновляем время последнего парсинга
          await this.updateSourceLastParsed(source.id);

        } catch (sourceError) {
          const errorMsg = `Error parsing ${source.url}: ${sourceError instanceof Error ? sourceError.message : 'Unknown error'}`;
          this.logError(errorMsg);
          output.errors.push(errorMsg);
        }
      }

      this.log(`Parsing complete. Total: ${output.totalParsed}, New: ${output.newContent}`);

      return {
        success: true,
        data: output,
      };

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      this.logError('Fatal error during parsing', error);

      return {
        success: false,
        error: errorMsg,
        data: output,
      };
    }
  }

  /**
   * Обработка одного результата парсинга
   */
  private async processParseResult(
    source: Source,
    result: ParseResult
  ): Promise<ParsedContent | null> {
    // 1) Если запись уже есть в parsed_content, считаем "новой" только если её НЕ использует ни один пост
    const existing = await this.getExistingParsedContent(source.id, result.contentHash);
    if (existing?.id) {
      const available = await this.isParsedContentAvailable(existing.id);
      if (!available) {
        this.log(`Skipping already-used content: ${result.contentHash.substring(0, 16)}...`);
        return null;
      }

      // Если посты удалили — делаем контент снова доступным
      await this.resetParsedContentUsedFlag(existing.id);

      const fallbackImages = this.extractImages(result);
      const hasExistingImages = Array.isArray(existing.images) && existing.images.length > 0;
      const images = hasExistingImages ? existing.images! : fallbackImages;

      if (!hasExistingImages && fallbackImages.length > 0) {
        await this.updateParsedContentImages(existing.id, fallbackImages);
      }

      return {
        id: existing.id,
        sourceId: source.id,
        sourceName: source.url,
        sourceType: source.type,
        title: existing.title || ('title' in result ? result.title : undefined),
        content: existing.content || result.content,
        url: existing.url || result.url,
        contentHash: result.contentHash,
        publishedAt: existing.publishedAt || ('publishedAt' in result ? result.publishedAt : undefined),
        isNew: true,
        images,
      };
    }

    // 2) Новая запись — сохраняем
    const images = this.extractImages(result);
    const savedId = await this.saveParsedContent(source.id, result, images);
    if (!savedId) return null;

    return {
      id: savedId,
      sourceId: source.id,
      sourceName: source.url,
      sourceType: source.type,
      title: 'title' in result ? result.title : undefined,
      content: result.content,
      url: result.url,
      contentHash: result.contentHash,
      publishedAt: 'publishedAt' in result ? result.publishedAt : undefined,
      isNew: true,
      images,
    };
  }

  /**
   * Извлечение изображений из результата парсинга
   */
  private extractImages(result: ParseResult): ParsedImage[] {
    const images: ParsedImage[] = [];

    // Для веб-сайтов - извлекаем из metadata.imageUrl
    if ('metadata' in result && result.metadata) {
      const meta = result.metadata as { imageUrl?: string; images?: ParsedImage[] };

      // Массив изображений (если есть)
      if (Array.isArray(meta.images)) {
        images.push(...meta.images);
      }
      // Одиночное изображение
      else if (meta.imageUrl) {
        images.push({ url: meta.imageUrl });
      }
    }

    // Для Telegram - проверяем наличие медиа
    if ('metadata' in result && result.metadata) {
      const meta = result.metadata as { hasMedia?: boolean; mediaType?: string; imageUrl?: string };
      if (meta.hasMedia && meta.mediaType === 'photo' && meta.imageUrl) {
        images.push({ url: meta.imageUrl });
      }
    }

    return images;
  }

  /**
   * Проверка дубликата контента
   */
  private async getExistingParsedContent(
    sourceId: string,
    contentHash: string
  ): Promise<{
    id: string;
    title: string | null;
    content: string;
    url: string | null;
    publishedAt: Date | null;
    images: ParsedImage[] | null;
  } | null> {
    try {
      const { data, error } = await (supabaseAdmin
        .from('parsed_content') as any)
        .select('id, title, content, url, published_at, images')
        .eq('source_id', sourceId)
        .eq('content_hash', contentHash)
        .limit(1);

      if (error) return null;
      const row = data?.[0];
      if (!row?.id) return null;

      return {
        id: row.id,
        title: row.title ?? null,
        content: row.content,
        url: row.url ?? null,
        publishedAt: row.published_at ? new Date(row.published_at) : null,
        images: row.images ?? null,
      };
    } catch {
      return null;
    }
  }

  private async isParsedContentAvailable(contentId: string): Promise<boolean> {
    try {
      const { data, error } = await (supabaseAdmin
        .from('posts') as any)
        .select('id')
        .contains('source_content_ids', [contentId])
        .limit(1);

      if (error) return true;
      return !(Array.isArray(data) && data.length > 0);
    } catch {
      return true;
    }
  }

  private async resetParsedContentUsedFlag(contentId: string): Promise<void> {
    try {
      await (supabaseAdmin
        .from('parsed_content') as any)
        .update({ used_in_posts: false })
        .eq('id', contentId);
    } catch {
      // ignore
    }
  }

  private async updateParsedContentImages(contentId: string, images: ParsedImage[]): Promise<void> {
    try {
      await (supabaseAdmin
        .from('parsed_content') as any)
        .update({ images })
        .eq('id', contentId);
    } catch {
      // ignore
    }
  }

  /**
   * Сохранение спарсенного контента
   */
  private async saveParsedContent(
    sourceId: string,
    result: ParseResult,
    images: ParsedImage[]
  ): Promise<string | undefined> {
    try {
      const { data, error } = await (supabaseAdmin
        .from('parsed_content') as any)
        .insert({
          source_id: sourceId,
          content_hash: result.contentHash,
          title: 'title' in result ? result.title : null,
          content: result.content,
          url: result.url,
          published_at: 'publishedAt' in result ? result.publishedAt : null,
          metadata: 'metadata' in result ? result.metadata : null,
          images: images.length > 0 ? images : [],
        })
        .select('id')
        .single();

      if (error) {
        this.logError('Failed to save parsed content', error);
        return undefined;
      }

      this.log(`Saved content with ${images.length} images`);
      return data?.id;
    } catch (error) {
      this.logError('Failed to save parsed content', error);
      return undefined;
    }
  }

  /**
   * Обновление lastMessageId для Telegram источника
   */
  private async updateSourceLastMessageId(
    sourceId: string,
    lastMessageId: number,
    parseMode: 'new' | 'old' | undefined,
    currentConfig?: unknown
  ): Promise<void> {
    try {
      const key = parseMode === 'old' ? 'backfillMessageId' : 'lastMessageId';
      await (supabaseAdmin
        .from('sources') as any)
        .update({
          parsing_config: {
            ...(typeof currentConfig === 'object' && currentConfig ? (currentConfig as Record<string, unknown>) : {}),
            [key]: lastMessageId,
          },
        })
        .eq('id', sourceId);
    } catch (error) {
      this.logError('Failed to update lastMessageId', error);
    }
  }

  /**
   * Обновление времени последнего парсинга
   */
  private async updateSourceLastParsed(sourceId: string): Promise<void> {
    try {
      await (supabaseAdmin
        .from('sources') as any)
        .update({
          last_parsed_at: new Date().toISOString(),
        })
        .eq('id', sourceId);
    } catch (error) {
      this.logError('Failed to update last_parsed_at', error);
    }
  }
}

// Singleton instance
let parserAgent: ParserAgent | null = null;

export function getParserAgent(): ParserAgent {
  if (!parserAgent) {
    parserAgent = new ParserAgent();
  }
  return parserAgent;
}
