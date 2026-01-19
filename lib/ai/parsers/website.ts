/**
 * Website Parser
 * Парсинг контента с веб-сайтов используя Cheerio
 * Поддерживает парсинг новостных лент с переходом по ссылкам
 */

import axios from 'axios';
import * as cheerio from 'cheerio';
import { createHash } from 'crypto';
import { htmlToPlainText, cleanText } from '../content-converter';

// ============================================================================
// Типы
// ============================================================================

export interface WebsiteParseResult {
  contentHash: string;
  title?: string;
  content: string;
  url: string;
  publishedAt?: Date;
  metadata: {
    author?: string;
    description?: string;
    keywords?: string[];
    imageUrl?: string;
    images?: { url: string; alt?: string }[];
  };
}

export interface WebsiteParserConfig {
  selectors?: {
    // Селекторы для страницы статьи
    article?: string;
    title?: string;
    content?: string;
    date?: string;
    author?: string;
    // Селекторы для новостной ленты
    feedItem?: string;
    feedItemLink?: string;
  };
  // Режим парсинга: 'single' - одна страница, 'feed' - новостная лента
  mode?: 'single' | 'feed';
  // Максимальное количество статей для парсинга из ленты
  maxArticles?: number;
  // Базовый URL для относительных ссылок
  baseUrl?: string;
  userAgent?: string;
  timeout?: number;
  headers?: Record<string, string>;
  cookies?: string;
}

// ============================================================================
// Website Parser Class
// ============================================================================

export class WebsiteParser {
  private config: WebsiteParserConfig;
  private defaultSelectors = {
    // Селекторы для страницы статьи
    article: 'article, .article, .post, .entry-content, main',
    title: 'h1, .title, .post-title, .entry-title, article h1',
    content: '.content, .post-content, .entry-content, article p, main p',
    date: 'time, .date, .published, .post-date, [datetime]',
    author: '.author, .by, .post-author, [rel="author"]',
    // Селекторы для новостной ленты
    feedItem: 'article, .news-item, .post-item, .article-item, .card, .story, .feed-item, [class*="news"], [class*="article"]',
    feedItemLink: 'a[href], h2 a, h3 a, .title a, .headline a',
  };

  constructor(config: WebsiteParserConfig = {}) {
    this.config = {
      selectors: { ...this.defaultSelectors, ...config.selectors },
      mode: config.mode || 'feed', // По умолчанию режим ленты
      maxArticles: config.maxArticles || 5,
      baseUrl: config.baseUrl,
      userAgent: config.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      timeout: config.timeout || 30000,
      headers: config.headers,
      cookies: config.cookies,
    };
  }

  /**
   * Парсинг контента - автоматически определяет режим
   */
  async parse(url: string): Promise<WebsiteParseResult | null> {
    if (this.config.mode === 'feed') {
      // Пробуем сначала как ленту
      const feedResults = await this.parseFeed(url);
      if (feedResults.length > 0) {
        return feedResults[0]; // Возвращаем первую статью для совместимости
      }
    }

    // Парсим как одну страницу
    return this.parseSinglePage(url);
  }

  /**
   * Парсинг новостной ленты - возвращает массив статей
   */
  async parseFeed(url: string): Promise<WebsiteParseResult[]> {
    try {
      console.log(`[WebsiteParser] Parsing feed: ${url}`);

      // Получаем HTML главной страницы/ленты
      const html = await this.fetchHTML(url);
      if (!html) {
        console.log(`[WebsiteParser] Failed to fetch feed page`);
        return [];
      }

      const $ = cheerio.load(html) as cheerio.CheerioAPI;

      // Извлекаем базовый URL
      const baseUrl = this.config.baseUrl || new URL(url).origin;

      // Находим ссылки на статьи (+ по возможности дату из карточки/URL)
      const articleCandidates = this.extractArticleCandidates($, baseUrl);
      const articleLinks = articleCandidates.map(c => c.url);
      console.log(`[WebsiteParser] Found ${articleCandidates.length} article candidates`);

      if (articleCandidates.length === 0) {
        // Если ссылок не найдено, парсим страницу как есть
        const singleResult = await this.parseSinglePage(url);
        return singleResult ? [singleResult] : [];
      }

      // Сортируем кандидатов так, чтобы сначала идти к самым новым
      articleCandidates.sort((a, b) => {
        const at = a.publishedAt?.getTime();
        const bt = b.publishedAt?.getTime();
        if (Number.isFinite(bt as any) && Number.isFinite(at as any)) {
          if (bt !== at) return (bt as number) - (at as number);
        } else if (Number.isFinite(bt as any)) {
          return -1;
        } else if (Number.isFinite(at as any)) {
          return 1;
        }

        // больше уверенность — выше
        if (b.confidence !== a.confidence) return b.confidence - a.confidence;
        // fallback: порядок на странице
        return a.order - b.order;
      });

      // Берем чуть больше кандидатов, чтобы на динамичных страницах отфильтровать пустые/короткие статьи
      const maxToTry = Math.max(this.config.maxArticles! * 4, this.config.maxArticles!);
      const linksToProcess = articleCandidates.slice(0, maxToTry).map(c => c.url);

      // Парсим каждую статью
      const results: WebsiteParseResult[] = [];

      for (const link of linksToProcess) {
        try {
          console.log(`[WebsiteParser] Parsing article: ${link}`);
          const articleResult = await this.parseSinglePage(link);

          if (articleResult && articleResult.content.length >= 100) {
            results.push(articleResult);
          }

          if (results.length >= this.config.maxArticles!) {
            break;
          }

          // Небольшая задержка между запросами
          await this.delay(500);
        } catch (error) {
          console.error(`[WebsiteParser] Error parsing article ${link}:`, error);
        }
      }

      console.log(`[WebsiteParser] Successfully parsed ${results.length} articles`);
      return results;
    } catch (error) {
      console.error(`[WebsiteParser] Error parsing feed:`, error);
      return [];
    }
  }

  /**
   * Кандидаты статей из новостной ленты (url + дата, если удалось)
   */
  private extractArticleCandidates(
    $: cheerio.CheerioAPI,
    baseUrl: string
  ): Array<{ url: string; publishedAt?: Date; confidence: number; order: number }> {
    const items: Array<{ url: string; publishedAt?: Date; confidence: number; order: number }> = [];
    const seenUrls = new Set<string>();

    const feedItemSelector = this.config.selectors!.feedItem!;
    const linkSelector = this.config.selectors!.feedItemLink!;

    // Сначала пробуем найти элементы ленты
    const feedItems = $(feedItemSelector);

    if (feedItems.length > 0) {
      feedItems.each((idx, item) => {
        const $item = $(item);
        const linkElement = $item.find(linkSelector).first();
        const href = linkElement.attr('href');

        if (href) {
          const absoluteUrl = this.resolveUrl(href, baseUrl);
          if (absoluteUrl && this.isValidArticleUrl(absoluteUrl, baseUrl) && !seenUrls.has(absoluteUrl)) {
            seenUrls.add(absoluteUrl);
            const publishedAt = this.extractDateFromFeedItem($item);
            const urlDate = publishedAt ? undefined : this.extractDateFromUrl(absoluteUrl);
            const finalDate = publishedAt || urlDate;
            const urlLooksLikeArticle = this.looksLikeArticleUrl(absoluteUrl);
            const confidence = (publishedAt ? 3 : urlDate ? 2 : 0) + (urlLooksLikeArticle ? 1 : 0);

            items.push({
              url: absoluteUrl,
              publishedAt: finalDate,
              confidence,
              order: idx,
            });
          }
        }
      });
    }

    // Если не нашли через элементы ленты, ищем все подходящие ссылки
    if (items.length === 0) {
      let order = 0;
      $('a[href]').each((_, el) => {
        const href = $(el).attr('href');
        if (href) {
          const absoluteUrl = this.resolveUrl(href, baseUrl);
          if (absoluteUrl && this.isValidArticleUrl(absoluteUrl, baseUrl) && !seenUrls.has(absoluteUrl)) {
            // Проверяем что это похоже на ссылку на статью
            if (this.looksLikeArticleUrl(absoluteUrl)) {
              seenUrls.add(absoluteUrl);
              const urlDate = this.extractDateFromUrl(absoluteUrl);
              items.push({
                url: absoluteUrl,
                publishedAt: urlDate,
                confidence: urlDate ? 1 : 0,
                order: order++,
              });
            }
          }
        }
      });
    }

    return items;
  }

  private extractDateFromFeedItem($item: any): Date | undefined {
    // Common patterns: <time datetime="...">, elements with [datetime], or date-like text
    const time = $item.find('time').first();
    const datetime = time.attr('datetime') || time.attr('content') || '';
    const dateFromDatetime = this.parseDateMaybe(datetime);
    if (dateFromDatetime) return dateFromDatetime;

    const anyDatetime = $item.find('[datetime]').first().attr('datetime') || '';
    const dateFromAnyDatetime = this.parseDateMaybe(anyDatetime);
    if (dateFromAnyDatetime) return dateFromAnyDatetime;

    const dateText = $item.find('.date, .time, .published, .post-date, [class*="date"], [class*="time"]').first().text();
    const dateFromText = this.parseDateMaybe(dateText);
    if (dateFromText) return dateFromText;

    return undefined;
  }

  private parseDateMaybe(value: string): Date | undefined {
    const v = String(value || '').trim();
    if (!v) return undefined;

    // 1) Native parse (ISO / RFC)
    const d = new Date(v);
    if (!isNaN(d.getTime())) return d;

    // 2) dd.mm.yyyy [hh:mm]
    const m1 = v.match(/(\d{1,2})[.\-\/](\d{1,2})[.\-\/](20\d{2})(?:[,\s]+(\d{1,2}):(\d{2}))?/);
    if (m1) {
      const day = Number(m1[1]);
      const month = Number(m1[2]);
      const year = Number(m1[3]);
      const hh = Number(m1[4] || 0);
      const mm = Number(m1[5] || 0);
      const dt = new Date(Date.UTC(year, month - 1, day, hh, mm));
      if (!isNaN(dt.getTime())) return dt;
    }

    // 3) "сегодня" / "вчера" [hh:mm]
    const lower = v.toLowerCase();
    const m2 = lower.match(/\b(сегодня|вчера)\b(?:[,\s]+(\d{1,2}):(\d{2}))?/i);
    if (m2) {
      const base = new Date();
      base.setHours(0, 0, 0, 0);
      if (m2[1] === 'вчера') {
        base.setDate(base.getDate() - 1);
      }
      const hh = Number(m2[2] || 0);
      const mm = Number(m2[3] || 0);
      const dt = new Date(base.getTime());
      dt.setHours(hh, mm, 0, 0);
      if (!isNaN(dt.getTime())) return dt;
    }

    // 4) Russian month names (genitive): "19 января 2026"
    const months: Record<string, number> = {
      'янв': 1, 'января': 1, 'январь': 1,
      'фев': 2, 'февраля': 2, 'февраль': 2,
      'мар': 3, 'марта': 3, 'март': 3,
      'апр': 4, 'апреля': 4, 'апрель': 4,
      'май': 5, 'мая': 5,
      'июн': 6, 'июня': 6, 'июнь': 6,
      'июл': 7, 'июля': 7, 'июль': 7,
      'авг': 8, 'августа': 8, 'август': 8,
      'сен': 9, 'сентября': 9, 'сентябрь': 9,
      'окт': 10, 'октября': 10, 'октябрь': 10,
      'ноя': 11, 'ноября': 11, 'ноябрь': 11,
      'дек': 12, 'декабря': 12, 'декабрь': 12,
    };
    const m3 = lower.match(/(\d{1,2})\s+([а-яё]+)\s+(20\d{2})(?:[,\s]+(\d{1,2}):(\d{2}))?/i);
    if (m3) {
      const day = Number(m3[1]);
      const monthName = String(m3[2] || '').slice(0, 9);
      const month = months[monthName] || months[monthName.slice(0, 3)];
      const year = Number(m3[3]);
      const hh = Number(m3[4] || 0);
      const mm = Number(m3[5] || 0);
      if (month) {
        const dt = new Date(Date.UTC(year, month - 1, day, hh, mm));
        if (!isNaN(dt.getTime())) return dt;
      }
    }

    // 5) "17 января, 1:07" (год не указан) — используем текущий год с поправкой на границу года
    const m4 = lower.match(/(\d{1,2})\s+([а-яё]+)[,\s]+(\d{1,2}):(\d{2})/i);
    if (m4) {
      const day = Number(m4[1]);
      const monthName = String(m4[2] || '').slice(0, 9);
      const month = months[monthName] || months[monthName.slice(0, 3)];
      const hh = Number(m4[3] || 0);
      const mm = Number(m4[4] || 0);
      if (month) {
        const now = new Date();
        const nowMonth = now.getMonth() + 1;
        let year = now.getFullYear();
        // если месяц "в будущем" (например, сейчас январь, а дата декабрь) — это прошлый год
        if (month > nowMonth + 1) year -= 1;
        const dt = new Date(Date.UTC(year, month - 1, day, hh, mm));
        if (!isNaN(dt.getTime())) return dt;
      }
    }

    return undefined;
  }

  private extractDateFromUrl(url: string): Date | undefined {
    try {
      const u = new URL(url);
      const path = u.pathname;

      // /YYYY/MM/DD/
      const m1 = path.match(/\/(20\d{2})[\/\-](\d{1,2})[\/\-](\d{1,2})(?:\/|$)/);
      if (m1) {
        const y = Number(m1[1]);
        const mo = Number(m1[2]);
        const d = Number(m1[3]);
        const dt = new Date(Date.UTC(y, mo - 1, d));
        if (!isNaN(dt.getTime())) return dt;
      }

      // YYYYMMDD
      const m2 = path.match(/(20\d{2})(\d{2})(\d{2})/);
      if (m2) {
        const y = Number(m2[1]);
        const mo = Number(m2[2]);
        const d = Number(m2[3]);
        const dt = new Date(Date.UTC(y, mo - 1, d));
        if (!isNaN(dt.getTime())) return dt;
      }

      return undefined;
    } catch {
      return undefined;
    }
  }

  /**
   * Проверяет, похож ли URL на ссылку на статью
   */
  private looksLikeArticleUrl(url: string): boolean {
    try {
      const urlObj = new URL(url);
      const path = urlObj.pathname;

      // Исключаем главную страницу и служебные страницы
      if (path === '/' || path === '') return false;
      if (path.match(/^\/(about|contact|privacy|terms|login|register|search|tag|category|author)/i)) return false;
      if (path.match(/\.(jpg|png|gif|css|js|ico|pdf)$/i)) return false;

      // Признаки статьи: длинный путь, содержит цифры (ID или дату), содержит слова
      const hasNumbers = /\d+/.test(path);
      const hasWords = path.split('/').some(segment => segment.length > 10);
      const hasNewsPattern = /\/(news|article|post|story|blog|p|id)\//i.test(path);

      return hasNumbers || hasWords || hasNewsPattern;
    } catch {
      return false;
    }
  }

  /**
   * Проверка валидности URL статьи
   */
  private isValidArticleUrl(url: string, baseUrl: string): boolean {
    try {
      const urlObj = new URL(url);
      const baseUrlObj = new URL(baseUrl);

      // Должен быть тот же домен или поддомен
      if (!urlObj.hostname.endsWith(baseUrlObj.hostname.replace('www.', ''))) {
        return false;
      }

      // HTTP или HTTPS
      if (urlObj.protocol !== 'http:' && urlObj.protocol !== 'https:') {
        return false;
      }

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Преобразование относительного URL в абсолютный
   */
  private resolveUrl(href: string, baseUrl: string): string | null {
    try {
      // Уже абсолютный URL
      if (href.startsWith('http://') || href.startsWith('https://')) {
        return href;
      }

      // Протокол-независимый URL
      if (href.startsWith('//')) {
        return 'https:' + href;
      }

      // Относительный URL
      return new URL(href, baseUrl).toString();
    } catch {
      return null;
    }
  }

  /**
   * Задержка между запросами
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Парсинг одной страницы (статьи)
   */
  async parseSinglePage(url: string): Promise<WebsiteParseResult | null> {
    try {
      // Получаем HTML страницы
      const html = await this.fetchHTML(url);

      if (!html) {
        return null;
      }

      // Парсим HTML с Cheerio
      const $ = cheerio.load(html) as cheerio.CheerioAPI;

      // Извлекаем данные
      const title = this.extractTitle($);
      const content = this.extractContent($);
      const date = this.extractDate($);
      const author = this.extractAuthor($);
      const metadata = this.extractMetadata($);

      if (!content || content.trim().length < 100) {
        // Контент слишком короткий или пустой
        return null;
      }

      const cleanedContent = cleanText(content);
      const contentHash = this.generateHash(this.canonicalizeUrl(url) || cleanedContent);

      return {
        contentHash,
        title,
        content: cleanedContent,
        url,
        publishedAt: date,
        metadata: {
          author,
          description: metadata.description,
          keywords: metadata.keywords,
          imageUrl: metadata.image,
          images: metadata.images,
        },
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`Failed to fetch website: ${error.message}`);
      }

      throw error;
    }
  }

  /**
   * Получение HTML страницы
   */
  private async fetchHTML(url: string): Promise<string | null> {
    try {
      const extraHeaders = this.config.headers || {};
      const cookieHeader =
        typeof this.config.cookies === 'string' && this.config.cookies.trim().length > 0
          ? this.config.cookies.trim()
          : undefined;

      const response = await axios.get(url, {
        headers: {
          'User-Agent': this.config.userAgent!,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
          'Accept-Encoding': 'gzip, deflate, br',
          'Cache-Control': 'no-cache',
          ...(cookieHeader ? { Cookie: cookieHeader } : {}),
          ...extraHeaders,
        },
        timeout: this.config.timeout,
        maxRedirects: 5,
      });

      return response.data;
    } catch (error) {
      console.error(`Error fetching ${url}:`, error);
      return null;
    }
  }

  /**
   * Извлечение заголовка
   */
  private extractTitle($: cheerio.CheerioAPI): string | undefined {
    const selector = this.config.selectors!.title!;

    // Пробуем селектор из конфига
    let title = $(selector).first().text().trim();

    // Если не нашли, пробуем meta og:title
    if (!title) {
      title = $('meta[property="og:title"]').attr('content') || '';
    }

    // Если не нашли, пробуем <title>
    if (!title) {
      title = $('title').first().text().trim();
    }

    return title || undefined;
  }

  /**
   * Извлечение основного контента
   */
  private extractContent($: cheerio.CheerioAPI): string {
    const contentSelector = this.config.selectors!.content!;
    const articleSelector = this.config.selectors!.article!;

    // Пробуем найти article контейнер
    const articleContainer = $(articleSelector).first();

    if (articleContainer.length > 0) {
      // Удаляем скрипты, стили, рекламу, навигацию
      articleContainer.find('script, style, nav, header, footer, .ad, .advertisement, .social, .share, .related, .comments, aside').remove();

      // Извлекаем текст
      const html = articleContainer.html() || '';
      return htmlToPlainText(html);
    }

    // Если не нашли article, пробуем селектор контента
    const contentElements = $(contentSelector);

    if (contentElements.length > 0) {
      const texts = contentElements.map((_, el) => {
        return $(el).text().trim();
      }).get();

      return texts.join('\n\n');
    }

    // Последняя попытка: извлекаем все параграфы из body
    const paragraphs = $('body p').map((_, el) => {
      return $(el).text().trim();
    }).get();

    return paragraphs.join('\n\n');
  }

  /**
   * Извлечение даты публикации
   */
  private extractDate($: cheerio.CheerioAPI): Date | undefined {
    const dateSelector = this.config.selectors!.date!;

    // Пробуем селектор из конфига
    const timeElement = $(dateSelector).first();

    if (timeElement.length > 0) {
      const datetime = timeElement.attr('datetime') || timeElement.text();

      const date = new Date(datetime);

      if (!isNaN(date.getTime())) {
        return date;
      }
    }

    // Пробуем meta published_time
    const metaPublished = $('meta[property="article:published_time"]').attr('content');

    if (metaPublished) {
      const date = new Date(metaPublished);

      if (!isNaN(date.getTime())) {
        return date;
      }
    }

    return undefined;
  }

  /**
   * Извлечение автора
   */
  private extractAuthor($: cheerio.CheerioAPI): string | undefined {
    const authorSelector = this.config.selectors!.author!;

    // Пробуем селектор из конфига
    let author = $(authorSelector).first().text().trim();

    // Если не нашли, пробуем meta author
    if (!author) {
      author = $('meta[name="author"]').attr('content') || '';
    }

    // Если не нашли, пробуем meta article:author
    if (!author) {
      author = $('meta[property="article:author"]').attr('content') || '';
    }

    return author || undefined;
  }

  /**
   * Извлечение метаданных
   */
  private extractMetadata($: cheerio.CheerioAPI): {
    description?: string;
    keywords?: string[];
    image?: string;
    images?: { url: string; alt?: string }[];
  } {
    // Description
    let description = $('meta[name="description"]').attr('content');

    if (!description) {
      description = $('meta[property="og:description"]').attr('content');
    }

    // Keywords
    const keywordsContent = $('meta[name="keywords"]').attr('content');
    const keywords = keywordsContent?.split(',').map((k) => k.trim()).filter(Boolean);

    // Main image (og:image)
    let image = $('meta[property="og:image"]').attr('content');

    if (!image) {
      image = $('meta[name="twitter:image"]').attr('content');
    }

    // Extract all images from article content
    const images: { url: string; alt?: string }[] = [];
    const seenUrls = new Set<string>();

    // Add og:image first
    if (image && !seenUrls.has(image)) {
      seenUrls.add(image);
      images.push({ url: image });
    }

    // Find images in article content
    const articleSelector = this.config.selectors!.article!;
    const articleContainer = $(articleSelector).first();

    const imgElements = articleContainer.length > 0
      ? articleContainer.find('img')
      : $('article img, .content img, main img');

    imgElements.each((_, img) => {
      const $img = $(img);
      let src = $img.attr('src') || $img.attr('data-src') || $img.attr('data-lazy-src');

      if (!src) return;

      // Make absolute URL
      if (src.startsWith('//')) {
        src = 'https:' + src;
      } else if (src.startsWith('/')) {
        try {
          const baseUrl = this.config.baseUrl || '';
          src = new URL(src, baseUrl).toString();
        } catch {
          return;
        }
      }

      // Skip small images, icons, tracking pixels
      const width = parseInt($img.attr('width') || '0', 10);
      const height = parseInt($img.attr('height') || '0', 10);
      if ((width > 0 && width < 200) || (height > 0 && height < 150)) {
        return;
      }

      // Skip common non-content images
      if (src.includes('logo') || src.includes('icon') || src.includes('avatar') ||
          src.includes('ad') || src.includes('tracking') || src.includes('pixel') ||
          src.includes('badge') || src.includes('button')) {
        return;
      }

      if (!seenUrls.has(src)) {
        seenUrls.add(src);
        images.push({
          url: src,
          alt: $img.attr('alt') || undefined,
        });
      }
    });

    return {
      description,
      keywords,
      image,
      images: images.length > 0 ? images : undefined,
    };
  }

  /**
   * Генерация SHA-256 хеша контента
   */
  private generateHash(content: string): string {
    return createHash('sha256').update(content).digest('hex');
  }

  /**
   * Канонизация URL для стабильного дедупа (убираем хеш и трекинг-параметры)
   */
  private canonicalizeUrl(url: string): string | null {
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

      // Некоторые сайты используют "ref" для трекинга
      u.searchParams.delete('ref');

      // Убираем пустой query
      if ([...u.searchParams.keys()].length === 0) {
        u.search = '';
      }

      // Нормализуем pathname (убираем лишний слеш в конце кроме корня)
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
 * Создание инстанса Website парсера
 */
export function createWebsiteParser(config?: WebsiteParserConfig): WebsiteParser {
  return new WebsiteParser(config);
}
