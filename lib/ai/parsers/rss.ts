/**
 * RSS Parser
 * Парсинг RSS/Atom лент используя rss-parser
 */

import Parser from 'rss-parser';
import { createHash } from 'crypto';
import { htmlToPlainText, cleanText } from '../content-converter';

// ============================================================================
// Типы
// ============================================================================

export interface RSSParseResult {
  contentHash: string;
  title?: string;
  content: string;
  url: string;
  publishedAt?: Date;
  metadata: {
    author?: string;
    categories?: string[];
    guid?: string;
    imageUrl?: string;
    images?: { url: string; alt?: string }[];
  };
}

export interface RSSParserConfig {
  timeout?: number;
  maxItems?: number;
}

// ============================================================================
// RSS Parser Class
// ============================================================================

export class RSSParser {
  private parser: Parser;
  private config: RSSParserConfig;

  constructor(config: RSSParserConfig = {}) {
    this.config = {
      timeout: config.timeout || 30000,
      maxItems: config.maxItems || 50,
    };

    this.parser = new Parser({
      timeout: this.config.timeout,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; TelegramBotParser/1.0)',
      },
    });
  }

  /**
   * Парсинг RSS ленты
   */
  async parse(feedUrl: string, lastPublishedDate?: Date): Promise<RSSParseResult[]> {
    try {
      // Парсим RSS ленту
      const feed = await this.parser.parseURL(feedUrl);

      if (!feed.items || feed.items.length === 0) {
        return [];
      }

      const results: RSSParseResult[] = [];

      for (const item of feed.items) {
        // Пропускаем если нет контента
        if (!item.content && !item.contentSnippet && !item.summary) {
          continue;
        }

        // Извлекаем дату публикации
        const publishedAt = this.extractDate(item);

        // Если есть lastPublishedDate, пропускаем старые записи
        if (lastPublishedDate && publishedAt && publishedAt <= lastPublishedDate) {
          continue;
        }

        // Извлекаем контент
        const content = this.extractContent(item);

        if (!content || content.trim().length < 50) {
          // Пропускаем очень короткий контент
          continue;
        }

        const cleanedContent = cleanText(content);
        const stableId =
          this.canonicalizeUrl(item.link) ||
          item.guid ||
          `${feedUrl}#${item.title || ''}`;
        const contentHash = this.generateHash(stableId);

        const images = this.extractImages(item);
        const imageUrl = images[0]?.url;

        results.push({
          contentHash,
          title: item.title,
          content: cleanedContent,
          url: item.link || item.guid || feedUrl,
          publishedAt,
          metadata: {
            author: item.creator || item.author,
            categories: item.categories,
            guid: item.guid,
            imageUrl,
            images: images.length > 0 ? images : undefined,
          },
        });

        // Не превышаем максимальное количество
        if (results.length >= this.config.maxItems!) {
          break;
        }
      }

      // Сортируем по дате (новые первые)
      results.sort((a, b) => {
        if (!a.publishedAt) return 1;
        if (!b.publishedAt) return -1;
        return b.publishedAt.getTime() - a.publishedAt.getTime();
      });

      return results;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to parse RSS feed: ${error.message}`);
      }

      throw error;
    }
  }

  /**
   * Извлечение контента из RSS item
   */
  private extractContent(item: any): string {
    // Приоритет: content:encoded > content > contentSnippet > summary > description
    let content = '';

    if (item['content:encoded']) {
      content = item['content:encoded'];
    } else if (item.content) {
      content = item.content;
    } else if (item.contentSnippet) {
      content = item.contentSnippet;
    } else if (item.summary) {
      content = item.summary;
    } else if (item.description) {
      content = item.description;
    }

    // Если контент в HTML формате, конвертируем в plain text
    if (content.includes('<')) {
      content = htmlToPlainText(content);
    }

    return content;
  }

  private extractImages(item: any): Array<{ url: string; alt?: string }> {
    const urls: string[] = [];

    const pushUrl = (u?: string) => {
      if (!u || typeof u !== 'string') return;
      const url = u.trim();
      if (!url) return;
      if (urls.includes(url)) return;
      urls.push(url);
    };

    // enclosure
    if (item.enclosure?.url) {
      const type = String(item.enclosure.type || '').toLowerCase();
      if (type.startsWith('image/')) {
        pushUrl(item.enclosure.url);
      } else if (/\.(png|jpe?g|webp|gif)(\\?|#|$)/i.test(String(item.enclosure.url))) {
        pushUrl(item.enclosure.url);
      }
    }

    // media:content / media:thumbnail (rss-parser often maps them to plain fields)
    pushUrl(item['media:thumbnail']?.url);
    pushUrl(item['media:content']?.url);

    // Try to parse from HTML
    const html = item['content:encoded'] || item.content || item.summary || item.description || '';
    if (typeof html === 'string' && html.includes('<img')) {
      const matches = [...html.matchAll(/<img[^>]+src=[\"']([^\"']+)[\"'][^>]*>/gi)];
      for (const m of matches) {
        pushUrl(m?.[1]);
        if (urls.length >= 5) break;
      }
    }

    return urls.map((url) => ({ url }));
  }

  /**
   * Извлечение даты публикации
   */
  private extractDate(item: any): Date | undefined {
    // Пробуем разные поля с датой
    const dateString = item.pubDate || item.published || item.isoDate || item.date;

    if (!dateString) {
      return undefined;
    }

    const date = new Date(dateString);

    if (isNaN(date.getTime())) {
      return undefined;
    }

    return date;
  }

  /**
   * Генерация SHA-256 хеша контента
   */
  private generateHash(content: string): string {
    return createHash('sha256').update(content).digest('hex');
  }

  private canonicalizeUrl(url?: string): string | null {
    if (!url) return null;
    try {
      const u = new URL(url);
      u.hash = '';

      const trackingKeys = [
        'utm_source',
        'utm_medium',
        'utm_campaign',
        'utm_term',
        'utm_content',
        'utm_id',
        'gclid',
        'fbclid',
        'yclid',
        'mc_cid',
        'mc_eid',
      ];

      for (const key of trackingKeys) {
        u.searchParams.delete(key);
      }
      u.searchParams.delete('ref');

      if ([...u.searchParams.keys()].length === 0) {
        u.search = '';
      }

      if (u.pathname !== '/' && u.pathname.endsWith('/')) {
        u.pathname = u.pathname.replace(/\/+$/, '');
      }

      return u.toString();
    } catch {
      return null;
    }
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Создание инстанса RSS парсера
 */
export function createRSSParser(config?: RSSParserConfig): RSSParser {
  return new RSSParser(config);
}
