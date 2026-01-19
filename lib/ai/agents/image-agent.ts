/**
 * Image Agent
 * Агент для подбора и поиска изображений для постов
 */

import { BaseAgent, AgentResult } from './base-agent';
import { loadAgentSettings, AgentSettings } from './settings-loader';

export interface ImageInput {
  postTitle: string;
  postContent: string;
  channelTopic: string;
  availableImages: {
    url: string;
    alt?: string;
    sourceUrl?: string;
  }[];
}

export interface SelectedImage {
  url: string;
  reason: string;
  sourceUrl?: string;
}

export interface ImageOutput {
  selectedImages: SelectedImage[];
  searchQueries: string[];
  needsImage: boolean;
  imageStyle: string;
}

type ImageSelectionResponse = {
  selectedImages: SelectedImage[];
  rejected?: Array<{ url: string; reason: string }> | null;
  searchQueries: string[];
  needsImage: boolean;
  imageStyle: string;
};

export class ImageAgent extends BaseAgent {
  constructor() {
    super({
      name: 'ImageAgent',
      description: 'Подбирает изображения для постов',
      maxTokens: 1000,
      temperature: 0.5,
    });
  }

  /**
   * Подбор изображений для поста
   */
  async execute(input: ImageInput): Promise<AgentResult<ImageOutput>> {
    this.log(`Selecting images for post: ${input.postTitle}`);
    this.log(`Available images: ${input.availableImages.length}`);

    try {
      // Загружаем настройки из БД
      const settings = await loadAgentSettings('image');
      this.log(`Loaded settings: maxTokens=${settings.maxTokens}, temperature=${settings.temperature}`);

      const systemPrompt = this.buildSystemPrompt(settings) + `

ВАЖНО:
- Выбери ОДНУ главную обложку (position=0).
- НЕ выбирай картинки с видимым текстом, логотипами, водяными знаками и брендингом чужих каналов/сайтов.
- Если часть картинок содержит текст/брендинг, отфильтруй их и выбери чистую.
- Если все картинки с текстом — выбери наименее проблемную и объясни почему.`;

      const response = await this.callImageSelection(systemPrompt, input, {
        maxTokens: settings.maxTokens,
        temperature: settings.temperature,
      });

      // Парсим JSON ответ
      const imageOutput = this.parseAIResponse(response.content);

      if (!imageOutput) {
        return {
          success: false,
          error: 'Не удалось распарсить ответ агента',
          tokensUsed: response.tokensUsed,
          costUSD: response.costUSD,
        };
      }

      this.log(`Selected ${imageOutput.selectedImages.length} images`);
      this.log(`Suggested ${imageOutput.searchQueries.length} search queries`);

      return {
        success: true,
        data: imageOutput,
        tokensUsed: response.tokensUsed,
        costUSD: response.costUSD,
      };

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      this.logError('Failed to select images', error);

      return {
        success: false,
        error: errorMsg,
      };
    }
  }

  private async callImageSelection(
    systemPrompt: string,
    input: ImageInput,
    options?: { maxTokens?: number; temperature?: number }
  ) {
    const maxImages = 6;
    const images = input.availableImages.filter(i => !!i.url).slice(0, maxImages);
    const text = this.buildUserPrompt(input, images);

    const imageParts = await Promise.all(
      images.map(async (img) => {
        const url = String(img.url || '').trim();
        if (!url) return null;
        return await this.asVisionImageUrl(url);
      })
    );

    // Multimodal prompt: текст + изображения (по возможности inline data URL, иначе remote URL)
    const userContent: Array<{ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }> = [
      { type: 'text', text },
      ...imageParts.filter(Boolean) as Array<{ type: 'image_url'; image_url: { url: string } }>,
    ];

    const model = this.pickVisionModel();

    return this.client.chat(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
      ],
      {
        maxTokens: options?.maxTokens || this.config.maxTokens,
        temperature: options?.temperature || this.config.temperature,
        model,
      }
    );
  }

  private pickVisionModel(): string | undefined {
    if (process.env.AI_IMAGE_MODEL && process.env.AI_IMAGE_MODEL.trim().length > 0) {
      return process.env.AI_IMAGE_MODEL.trim();
    }

    // Если общий AI_MODEL — Claude, а vision нужен для картинок, используем дефолтный vision-модель.
    const m = (process.env.AI_MODEL || '').trim();
    if (m.startsWith('anthropic/')) return 'openai/gpt-4o-mini';
    return m || 'openai/gpt-4o-mini';
  }

  private async asVisionImageUrl(url: string): Promise<{ type: 'image_url'; image_url: { url: string } } | null> {
    // Стараемся инлайнить картинку (data URL), чтобы модель точно "видела" ее,
    // даже если по прямой ссылке есть hotlink/CORS/закрытый доступ.
    const MAX_BYTES = 1_500_000; // ~1.5MB
    const TIMEOUT_MS = 12_000;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (!res.ok) {
        return { type: 'image_url', image_url: { url } };
      }

      const contentTypeHeader = res.headers.get('content-type') || '';
      const mime = contentTypeHeader.split(';')[0].trim() || this.guessMime(url) || 'image/jpeg';

      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.byteLength === 0) return { type: 'image_url', image_url: { url } };
      if (buf.byteLength > MAX_BYTES) return { type: 'image_url', image_url: { url } };

      const b64 = buf.toString('base64');
      return { type: 'image_url', image_url: { url: `data:${mime};base64,${b64}` } };
    } catch {
      return { type: 'image_url', image_url: { url } };
    }
  }

  private guessMime(url: string): string | null {
    const u = url.toLowerCase();
    if (u.endsWith('.png')) return 'image/png';
    if (u.endsWith('.webp')) return 'image/webp';
    if (u.endsWith('.gif')) return 'image/gif';
    if (u.endsWith('.jpg') || u.endsWith('.jpeg')) return 'image/jpeg';
    return null;
  }

  /**
   * Системный промпт
   */
  private buildSystemPrompt(settings: AgentSettings): string {
    return settings.systemPrompt;
  }

  /**
   * Пользовательский промпт с данными
   */
  private buildUserPrompt(input: ImageInput, images: ImageInput['availableImages']): string {
    const availableImagesText = images.length > 0
      ? images.map((img, i) => `${i + 1}. ${img.url}${img.alt ? ` (${img.alt})` : ''}${img.sourceUrl ? ` | источник: ${img.sourceUrl}` : ''}`).join('\n')
      : 'Нет доступных изображений';

    return `Подбери изображение(я) для поста:

ТЕМАТИКА КАНАЛА: ${input.channelTopic}

ЗАГОЛОВОК ПОСТА: ${input.postTitle}

СОДЕРЖАНИЕ ПОСТА:
${input.postContent.substring(0, 1500)}

ДОСТУПНЫЕ ИЗОБРАЖЕНИЯ:
${availableImagesText}

ПРАВИЛА:
1) Выбери ОДНУ главную обложку (лучшее изображение).
2) Отбрасывай изображения, если на них есть видимый текст, логотип, watermark, название чужого канала/сайта.
3) Если есть 2+ изображения — оставь только чистое и релевантное.
4) Если подходящего изображения нет — верни selectedImages: [] и предложи searchQueries.

Отвечай ТОЛЬКО JSON, без текста вокруг.`;
  }

  /**
   * Парсинг JSON ответа от AI
   */
  private parseAIResponse(content: string): ImageOutput | null {
    try {
      // Пробуем найти JSON в ответе
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        this.logError('No JSON found in AI response');
        return null;
      }

      const parsed = JSON.parse(jsonMatch[0]) as ImageSelectionResponse;

      return {
        selectedImages: Array.isArray(parsed.selectedImages) ? parsed.selectedImages.slice(0, 1) : [],
        searchQueries: Array.isArray(parsed.searchQueries) ? parsed.searchQueries : [],
        needsImage: parsed.needsImage ?? true,
        imageStyle: parsed.imageStyle || '',
      };
    } catch (error) {
      this.logError('Failed to parse AI response as JSON', error);
      return null;
    }
  }

  /**
   * Поиск изображений через веб-поиск (используя Unsplash API или аналог)
   */
  async searchImages(query: string, limit: number = 5): Promise<string[]> {
    // TODO: Интеграция с Unsplash API или другим сервисом изображений
    // Пока возвращаем пустой массив
    this.log(`Searching images for query: ${query}`);

    // Заглушка - в будущем здесь будет реальный поиск
    return [];
  }
}

// Singleton instance
let imageAgent: ImageAgent | null = null;

export function getImageAgent(): ImageAgent {
  if (!imageAgent) {
    imageAgent = new ImageAgent();
  }
  return imageAgent;
}
