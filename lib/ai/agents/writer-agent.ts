/**
 * Writer Agent
 * Агент отвечающий за написание поста на основе плана
 */

import { BaseAgent, AgentResult } from './base-agent';
import { PostPlan } from './planner-agent';
import { loadAgentSettings, AgentSettings, selectRandomLength, PostLength } from './settings-loader';

export interface WriterInput {
  channelId: string;
  channelName: string;
  channelTopic: string;
  plan: PostPlan;
  sourceContents: {
    id: string;
    content: string;
    url: string;
  }[];
}

export interface GeneratedPost {
  title: string;
  content: string;
  plainText: string;
  hashtags: string[];
  estimatedReadTime: number;
}

export interface WriterOutput {
  channelId: string;
  post: GeneratedPost;
  contentIds: string[];
  tokensUsed?: number;
  costUSD?: number;
}

export class WriterAgent extends BaseAgent {
  constructor() {
    super({
      name: 'WriterAgent',
      description: 'Создает посты на основе плана',
      maxTokens: 3000,
      temperature: 0.8,
    });
  }

  /**
   * Создание поста на основе плана
   */
  async execute(input: WriterInput): Promise<AgentResult<WriterOutput>> {
    this.log(`Writing post for channel: ${input.channelName}`);
    this.log(`Topic: ${input.plan.mainTopic}`);

    try {
      // Загружаем настройки из БД
      const settings = await loadAgentSettings('writer');
      this.log(`Loaded settings: maxTokens=${settings.maxTokens}, temperature=${settings.temperature}`);

      // Выбираем случайную длину поста если вариативность включена
      const selectedLength = settings.lengthVariationEnabled
        ? selectRandomLength(settings)
        : (input.plan.estimatedLength as PostLength || 'medium');

      this.log(`Selected post length: ${selectedLength} (variation: ${settings.lengthVariationEnabled ? 'enabled' : 'disabled'})`);

      const systemPrompt = this.buildSystemPrompt(input, settings, selectedLength);
      const userPrompt = this.buildUserPrompt(input);

      this.log('Calling AI to write post...');
      const response = await this.callAI(systemPrompt, userPrompt, {
        maxTokens: settings.maxTokens,
        temperature: settings.temperature,
      });

      // Парсим JSON ответ
      const generatedPost = this.parseAIResponse(response.content);

      if (!generatedPost) {
        return {
          success: false,
          error: 'Не удалось распарсить сгенерированный пост',
          tokensUsed: response.tokensUsed,
          costUSD: response.costUSD,
        };
      }

      const output: WriterOutput = {
        channelId: input.channelId,
        post: generatedPost,
        contentIds: input.sourceContents.map(c => c.id),
        tokensUsed: response.tokensUsed,
        costUSD: response.costUSD,
      };

      this.log(`Post created: ${generatedPost.title}`);
      this.log(`Length: ${generatedPost.plainText.length} characters`);

      return {
        success: true,
        data: output,
        tokensUsed: response.tokensUsed,
        costUSD: response.costUSD,
      };

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      this.logError('Failed to write post', error);

      return {
        success: false,
        error: errorMsg,
      };
    }
  }

  /**
   * Системный промпт для писателя
   * Использует настройки из БД
   */
  private buildSystemPrompt(input: WriterInput, settings: AgentSettings, selectedLength: PostLength): string {
    return `${settings.systemPrompt}

КАНАЛ: ${input.channelName}
ТЕМАТИКА: ${input.channelTopic}

ТРЕБОВАНИЯ К ПОСТУ:
1. Стиль: ${input.plan.tone}
2. Целевая аудитория: ${input.plan.targetAudience}
3. Длина: ${this.getLengthDescription(selectedLength)}

Отвечай ТОЛЬКО в формате JSON без дополнительного текста:

{
  "title": "Заголовок поста (опционально, можно пустую строку)",
  "content": "Полный текст поста в формате Markdown",
  "plainText": "Текст поста без форматирования",
  "hashtags": ["хештег1", "хештег2"],
  "estimatedReadTime": 2
}`;
  }

  /**
   * Пользовательский промпт с данными
   */
  private buildUserPrompt(input: WriterInput): string {
    const sourcesText = input.sourceContents.map((source, i) => `
[Источник ${i + 1}]
URL: ${source.url}
Контент:
${source.content.substring(0, 1000)}...
`).join('\n---\n');

    return `Напиши пост на основе следующего плана:

ПЛАН ПОСТА:
- Главная тема: ${input.plan.mainTopic}
- Угол подачи: ${input.plan.angle}
- Ключевые пункты:
${input.plan.keyPoints.map(p => `  • ${p}`).join('\n')}

СТРУКТУРА:
- Начало (hook): ${input.plan.suggestedStructure.hook}
- Основная часть:
${input.plan.suggestedStructure.body.map(b => `  • ${b}`).join('\n')}
- Заключение: ${input.plan.suggestedStructure.conclusion}

ИСХОДНЫЕ МАТЕРИАЛЫ:
${sourcesText}

Напиши качественный, уникальный пост, используя эту информацию.`;
  }

  /**
   * Описание длины поста
   */
  private getLengthDescription(length: 'short' | 'medium' | 'long'): string {
    switch (length) {
      case 'short':
        return 'Короткий пост (до 500 символов)';
      case 'medium':
        return 'Средний пост (500-1500 символов)';
      case 'long':
        return 'Длинный пост (1500+ символов)';
      default:
        return 'Средний пост (500-1500 символов)';
    }
  }

  /**
   * Парсинг JSON ответа от AI
   */
  private parseAIResponse(content: string): GeneratedPost | null {
    try {
      // Пробуем найти JSON в ответе
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        this.logError('No JSON found in AI response');
        return null;
      }

      const parsed = JSON.parse(jsonMatch[0]);

      // Валидация обязательных полей
      if (!parsed.content || !parsed.plainText) {
        this.logError('Missing required fields in generated post');
        return null;
      }

      return {
        title: parsed.title || '',
        content: parsed.content,
        plainText: parsed.plainText,
        hashtags: Array.isArray(parsed.hashtags) ? parsed.hashtags : [],
        estimatedReadTime: parsed.estimatedReadTime || 1,
      };
    } catch (error) {
      this.logError('Failed to parse AI response as JSON', error);
      return null;
    }
  }
}

// Singleton instance
let writerAgent: WriterAgent | null = null;

export function getWriterAgent(): WriterAgent {
  if (!writerAgent) {
    writerAgent = new WriterAgent();
  }
  return writerAgent;
}
