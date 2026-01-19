/**
 * Parser Factory
 * Фабрика для создания парсеров в зависимости от типа источника
 */

import { TelegramParser, TelegramParserConfig, TelegramParseResult } from './telegram';
import { WebsiteParser, WebsiteParserConfig, WebsiteParseResult } from './website';
import { RSSParser, RSSParserConfig, RSSParseResult } from './rss';

// ============================================================================
// Типы
// ============================================================================

export type SourceType = 'telegram' | 'website' | 'rss';

export type ParseResult = TelegramParseResult | WebsiteParseResult | RSSParseResult;

export interface Source {
  id: string;
  type: SourceType;
  url: string;
  last_content_hash?: string;
  parsing_config?: any;
}

export interface ParseOptions {
  maxItems?: number;
  lastPublishedDate?: Date;
  lastMessageId?: number;
}

export interface ParseResponse {
  results: ParseResult[];
  lastMessageId?: number | null;
}

// ============================================================================
// Parser Factory
// ============================================================================

export class ParserFactory {
  private telegramConfig?: TelegramParserConfig;
  private websiteConfig?: WebsiteParserConfig;
  private rssConfig?: RSSParserConfig;

  constructor(config?: {
    telegram?: TelegramParserConfig;
    website?: WebsiteParserConfig;
    rss?: RSSParserConfig;
  }) {
    this.telegramConfig = config?.telegram;
    this.websiteConfig = config?.website;
    this.rssConfig = config?.rss;
  }

  /**
   * Парсинг источника
   * Возвращает результаты и опционально lastMessageId для Telegram
   */
  async parseSource(source: Source, options?: ParseOptions): Promise<ParseResponse> {
    switch (source.type) {
      case 'telegram':
        return this.parseTelegram(source, options);

      case 'website':
        return this.parseWebsite(source, options);

      case 'rss':
        return this.parseRSS(source, options);

      default:
        throw new Error(`Unknown source type: ${source.type}`);
    }
  }

  /**
   * Парсинг Telegram канала через MTProto
   */
  private async parseTelegram(source: Source, options?: ParseOptions): Promise<ParseResponse> {
    // Проверяем наличие MTProto конфигурации
    if (!this.telegramConfig?.apiId || !this.telegramConfig?.apiHash) {
      throw new Error(
        'Telegram API credentials not configured. Run: npm run telegram-auth'
      );
    }

    const parser = new TelegramParser(this.telegramConfig);

    // Извлекаем lastMessageId из parsing_config если есть
    const lastMessageId = options?.lastMessageId || source.parsing_config?.lastMessageId;

    const { results, lastMessageId: newLastMessageId } = await parser.parse(
      source.url,
      lastMessageId,
      options?.maxItems || 20
    );

    return {
      results,
      lastMessageId: newLastMessageId,
    };
  }

  /**
   * Парсинг веб-сайта (новостной ленты)
   */
  private async parseWebsite(source: Source, options?: ParseOptions): Promise<ParseResponse> {
    // Объединяем конфиг из factory и source.parsing_config
    const config: WebsiteParserConfig = {
      ...this.websiteConfig,
      mode: source.parsing_config?.mode || 'feed', // По умолчанию режим ленты
      maxArticles: options?.maxItems || source.parsing_config?.maxArticles || 5,
      selectors: {
        ...this.websiteConfig?.selectors,
        ...source.parsing_config?.selectors,
      },
    };

    const parser = new WebsiteParser(config);

    // Используем parseFeed для получения всех статей из ленты
    const results = await parser.parseFeed(source.url);

    return { results };
  }

  /**
   * Парсинг RSS ленты
   */
  private async parseRSS(source: Source, options?: ParseOptions): Promise<ParseResponse> {
    const config = {
      ...this.rssConfig,
      maxItems: options?.maxItems || this.rssConfig?.maxItems || 50,
    };

    const parser = new RSSParser(config);

    const results = await parser.parse(source.url, options?.lastPublishedDate);

    return { results };
  }

  /**
   * Определение типа источника по URL
   */
  static detectSourceType(url: string): SourceType {
    // Telegram
    if (url.includes('t.me') || url.includes('telegram.me') || url.startsWith('@')) {
      return 'telegram';
    }

    // RSS (по расширению или keywords в URL)
    if (
      url.includes('rss') ||
      url.includes('feed') ||
      url.includes('atom') ||
      url.endsWith('.xml') ||
      url.endsWith('.rss')
    ) {
      return 'rss';
    }

    // По умолчанию - website
    return 'website';
  }

  /**
   * Валидация URL источника
   */
  static validateSourceUrl(url: string, type: SourceType): boolean {
    try {
      if (type === 'telegram') {
        // Telegram username или URL
        return /^(@[\w_]+|https?:\/\/(t\.me|telegram\.me)\/[\w_]+)$/.test(url);
      }

      if (type === 'website' || type === 'rss') {
        // Валидный HTTP/HTTPS URL
        const urlObj = new URL(url);
        return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
      }

      return false;
    } catch (error) {
      return false;
    }
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let parserFactory: ParserFactory | null = null;

/**
 * Получить инстанс Parser Factory
 */
export function getParserFactory(config?: {
  telegram?: TelegramParserConfig;
  website?: WebsiteParserConfig;
  rss?: RSSParserConfig;
}): ParserFactory {
  if (!parserFactory) {
    // Получаем конфигурацию из переменных окружения
    const defaultConfig = {
      telegram: {
        apiId: parseInt(process.env.TELEGRAM_API_ID || '0', 10),
        apiHash: process.env.TELEGRAM_API_HASH || '',
        sessionString: process.env.TELEGRAM_SESSION || '',
      },
      website: {
        timeout: 30000,
      },
      rss: {
        timeout: 30000,
        maxItems: 50,
      },
    };

    parserFactory = new ParserFactory({ ...defaultConfig, ...config });
  }

  return parserFactory;
}

/**
 * Сброс singleton (для тестов)
 */
export function resetParserFactory(): void {
  parserFactory = null;
}
