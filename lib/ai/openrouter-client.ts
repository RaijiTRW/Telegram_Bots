/**
 * OpenRouter API Client
 * Интеграция с OpenRouter для использования Claude Sonnet 4.5
 */

import axios, { AxiosError } from 'axios';

// ============================================================================
// Типы
// ============================================================================

export interface OpenRouterConfig {
  apiKey: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface GeneratePostParams {
  topic: string;
  description: string;
  sourceContent: Array<{
    title?: string;
    content: string;
    url?: string;
  }>;
}

export interface EditTextParams {
  originalText: string;
  instruction: string;
  context?: string;
}

export interface RegeneratePostParams {
  originalPrompt: string;
  newInstruction?: string;
  sourceContent: Array<{
    title?: string;
    content: string;
    url?: string;
  }>;
}

export interface AIResponse {
  content: string;
  tokensUsed: number;
  costUSD: number;
  model: string;
}

export type OpenRouterMessageContent =
  | string
  | Array<
      | { type: 'text'; text: string }
      | { type: 'image_url'; image_url: { url: string } }
    >;

export interface OpenRouterAPIResponse {
  id: string;
  model: string;
  choices: Array<{
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

// ============================================================================
// OpenRouter Client Class
// ============================================================================

export class OpenRouterClient {
  private apiKey: string;
  private model: string;
  private maxTokens: number;
  private temperature: number;
  private baseURL = 'https://openrouter.ai/api/v1';

  constructor(config: OpenRouterConfig) {
    this.apiKey = config.apiKey;
    this.model = config.model || process.env.AI_MODEL || 'anthropic/claude-sonnet-4.5';
    this.maxTokens = config.maxTokens || parseInt(process.env.AI_MAX_TOKENS || '4000');
    this.temperature = config.temperature || parseFloat(process.env.AI_TEMPERATURE || '0.7');

    if (!this.apiKey) {
      throw new Error('OpenRouter API key is required');
    }
  }

  /**
   * Генерация поста из источников контента
   */
  async generatePost(params: GeneratePostParams): Promise<AIResponse> {
    const { topic, description, sourceContent } = params;

    // Формируем промпт для генерации поста
    const prompt = this.buildGeneratePostPrompt(topic, description, sourceContent);

    // Вызываем OpenRouter API
    const response = await this.callAPI(prompt);

    return response;
  }

  /**
   * Редактирование выделенного фрагмента текста
   */
  async editText(params: EditTextParams): Promise<AIResponse> {
    const { originalText, instruction, context } = params;

    // Формируем промпт для редактирования
    const prompt = this.buildEditTextPrompt(originalText, instruction, context);

    // Вызываем OpenRouter API
    const response = await this.callAPI(prompt);

    return response;
  }

  /**
   * Пересоздание всего поста
   */
  async regeneratePost(params: RegeneratePostParams): Promise<AIResponse> {
    const { originalPrompt, newInstruction, sourceContent } = params;

    // Формируем промпт для пересоздания
    const prompt = this.buildRegeneratePostPrompt(originalPrompt, newInstruction, sourceContent);

    // Вызываем OpenRouter API
    const response = await this.callAPI(prompt);

    return response;
  }

  /**
   * Общий метод chat для работы с агентами
   * Поддерживает system/user/assistant сообщения
   */
  async chat(
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: OpenRouterMessageContent }>,
    options?: { maxTokens?: number; temperature?: number; model?: string }
  ): Promise<AIResponse> {
    try {
      const model = options?.model || this.model;
      const response = await axios.post<OpenRouterAPIResponse>(
        `${this.baseURL}/chat/completions`,
        {
          model,
          messages,
          max_tokens: options?.maxTokens || this.maxTokens,
          temperature: options?.temperature || this.temperature,
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
            'X-Title': 'Telegram Bots Admin Panel',
          },
          timeout: 120000,
        }
      );

      const choice = response.data.choices[0];
      const content = choice.message.content;
      const tokensUsed = response.data.usage.total_tokens;

      const inputTokens = response.data.usage.prompt_tokens;
      const outputTokens = response.data.usage.completion_tokens;
      const costUSD = (inputTokens * 3 + outputTokens * 15) / 1000000;

      return {
        content,
        tokensUsed,
        costUSD,
        model,
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError;

        if (axiosError.response?.status === 429) {
          throw new Error('Rate limit exceeded. Please try again later.');
        }
        if (axiosError.response?.status === 401) {
          throw new Error('Invalid OpenRouter API key.');
        }
        if (axiosError.response?.status === 402) {
          throw new Error('Insufficient credits on OpenRouter account.');
        }

        const errorMessage = (axiosError.response?.data as any)?.error?.message || axiosError.message;
        throw new Error(`OpenRouter API error: ${errorMessage}`);
      }
      throw error;
    }
  }

  /**
   * Вызов OpenRouter API
   */
  private async callAPI(prompt: string): Promise<AIResponse> {
    try {
      const response = await axios.post<OpenRouterAPIResponse>(
        `${this.baseURL}/chat/completions`,
        {
          model: this.model,
          messages: [
            {
              role: 'user',
              content: prompt,
            },
          ],
          max_tokens: this.maxTokens,
          temperature: this.temperature,
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
            'X-Title': 'Telegram Bots Admin Panel',
          },
          timeout: 120000, // 2 минуты
        }
      );

      const choice = response.data.choices[0];
      const content = choice.message.content;
      const tokensUsed = response.data.usage.total_tokens;

      // Расчет стоимости (примерная для Claude Sonnet 4.5)
      // Input: $3 per 1M tokens, Output: $15 per 1M tokens
      const inputTokens = response.data.usage.prompt_tokens;
      const outputTokens = response.data.usage.completion_tokens;
      const costUSD = (inputTokens * 3 + outputTokens * 15) / 1000000;

      return {
        content,
        tokensUsed,
        costUSD,
        model: this.model,
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError;

        // Обработка ошибок OpenRouter
        if (axiosError.response?.status === 429) {
          throw new Error('Rate limit exceeded. Please try again later.');
        }

        if (axiosError.response?.status === 401) {
          throw new Error('Invalid OpenRouter API key.');
        }

        if (axiosError.response?.status === 402) {
          throw new Error('Insufficient credits on OpenRouter account.');
        }

        const errorMessage = (axiosError.response?.data as any)?.error?.message || axiosError.message;
        throw new Error(`OpenRouter API error: ${errorMessage}`);
      }

      throw error;
    }
  }

  /**
   * Построение промпта для генерации поста
   */
  private buildGeneratePostPrompt(
    topic: string,
    description: string,
    sourceContent: Array<{ title?: string; content: string; url?: string }>
  ): string {
    const sourcesText = sourceContent
      .map((source, index) => {
        let text = `\n### Источник ${index + 1}\n`;
        if (source.title) text += `**Заголовок:** ${source.title}\n`;
        if (source.url) text += `**URL:** ${source.url}\n`;
        text += `**Контент:**\n${source.content}\n`;
        return text;
      })
      .join('\n---\n');

    return `Ты — профессиональный копирайтер для Telegram каналов. Твоя задача — создать качественный пост на основе предоставленных источников.

**Тематика канала:** ${topic}
**Описание канала:** ${description}

**Требования к посту:**
1. Пост должен быть интересным и привлекательным для читателей Telegram
2. Используй информацию из источников ниже, но не копируй её дословно
3. Адаптируй стиль под тематику канала
4. Длина поста: 300-800 слов
5. Используй emoji где уместно, но не переборщи (2-4 emoji на весь пост)
6. Структурируй текст с помощью абзацев для лучшей читаемости
7. Добавь краткий и цепляющий заголовок в начале
8. Пиши на русском языке

**Источники контента:**
${sourcesText}

**Важно:**
- Не используй markdown форматирование (без **, *, #, и т.д.)
- Пиши простым текстом, готовым для публикации в Telegram
- Сохраняй естественный разговорный стиль

Создай пост:`;
  }

  /**
   * Построение промпта для редактирования текста
   */
  private buildEditTextPrompt(
    originalText: string,
    instruction: string,
    context?: string
  ): string {
    let prompt = `Ты — редактор текстов для Telegram каналов. Твоя задача — отредактировать выделенный фрагмент текста согласно инструкции пользователя.

**Выделенный текст:**
"""
${originalText}
"""

**Инструкция:**
${instruction}
`;

    if (context) {
      prompt += `
**Контекст (остальная часть поста):**
"""
${context}
"""
`;
    }

    prompt += `
**Требования:**
1. Отредактируй ТОЛЬКО выделенный текст
2. Верни ТОЛЬКО отредактированную версию, без дополнительных комментариев
3. Сохрани стиль и тон оригинального текста
4. Не добавляй markdown форматирование
5. Пиши на русском языке

Отредактированный текст:`;

    return prompt;
  }

  /**
   * Построение промпта для пересоздания поста
   */
  private buildRegeneratePostPrompt(
    originalPrompt: string,
    newInstruction: string | undefined,
    sourceContent: Array<{ title?: string; content: string; url?: string }>
  ): string {
    const sourcesText = sourceContent
      .map((source, index) => {
        let text = `\n### Источник ${index + 1}\n`;
        if (source.title) text += `**Заголовок:** ${source.title}\n`;
        if (source.url) text += `**URL:** ${source.url}\n`;
        text += `**Контент:**\n${source.content}\n`;
        return text;
      })
      .join('\n---\n');

    let prompt = `Ты — профессиональный копирайтер для Telegram каналов. Твоя задача — ПЕРЕСОЗДАТЬ пост на основе исходных данных.

**Оригинальный промпт:**
${originalPrompt}
`;

    if (newInstruction) {
      prompt += `
**Дополнительная инструкция для пересоздания:**
${newInstruction}
`;
    }

    prompt += `
**Источники контента:**
${sourcesText}

**Требования:**
1. Создай НОВУЮ версию поста, используя те же источники
2. Учти дополнительную инструкцию (если есть)
3. Длина поста: 300-800 слов
4. Используй emoji где уместно (2-4 emoji на весь пост)
5. Структурируй текст с помощью абзацев
6. Добавь краткий и цепляющий заголовок
7. Не используй markdown форматирование
8. Пиши на русском языке

Создай новую версию поста:`;

    return prompt;
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let openRouterClient: OpenRouterClient | null = null;

/**
 * Получить инстанс OpenRouter клиента
 */
export function getOpenRouterClient(): OpenRouterClient {
  if (!openRouterClient) {
    const apiKey = process.env.OPENROUTER_API_KEY;

    if (!apiKey) {
      throw new Error('OPENROUTER_API_KEY environment variable is not set');
    }

    openRouterClient = new OpenRouterClient({
      apiKey,
      model: process.env.AI_MODEL,
      maxTokens: process.env.AI_MAX_TOKENS ? parseInt(process.env.AI_MAX_TOKENS) : undefined,
      temperature: process.env.AI_TEMPERATURE ? parseFloat(process.env.AI_TEMPERATURE) : undefined,
    });
  }

  return openRouterClient;
}

/**
 * Сброс singleton (для тестов)
 */
export function resetOpenRouterClient(): void {
  openRouterClient = null;
}
