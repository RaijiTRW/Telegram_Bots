/**
 * Planner Agent
 * Агент отвечающий за анализ контента и планирование поста
 */

import { BaseAgent, AgentResult } from './base-agent';
import { ParsedContent } from './parser-agent';
import { loadAgentSettings, AgentSettings } from './settings-loader';

export interface PlannerInput {
  channelId: string;
  channelName: string;
  channelTopic: string;
  channelDescription?: string;
  parsedContent: ParsedContent[];
}

export interface ContentSelection {
  contentId: string;
  title?: string;
  relevanceScore: number;
  keyPoints: string[];
  sourceUrl: string;
}

export interface PostPlan {
  mainTopic: string;
  angle: string;
  targetAudience: string;
  tone: string;
  keyPoints: string[];
  selectedContent: ContentSelection[];
  suggestedStructure: {
    hook: string;
    body: string[];
    conclusion: string;
  };
  estimatedLength: 'short' | 'medium' | 'long';
}

export interface PlannerOutput {
  channelId: string;
  plan: PostPlan;
  contentIds: string[];
  reasoning: string;
}

export class PlannerAgent extends BaseAgent {
  constructor() {
    super({
      name: 'PlannerAgent',
      description: 'Анализирует контент и создает план поста',
      maxTokens: 2000,
      temperature: 0.7,
    });
  }

  /**
   * Создание плана поста на основе спарсенного контента
   */
  async execute(input: PlannerInput): Promise<AgentResult<PlannerOutput>> {
    this.log(`Creating post plan for channel: ${input.channelName}`);
    this.log(`Content items to analyze: ${input.parsedContent.length}`);

    // Фильтруем только новый контент
    const newContent = input.parsedContent.filter(c => c.isNew);

    if (newContent.length === 0) {
      this.log('No new content to plan');
      return {
        success: false,
        error: 'Нет нового контента для планирования поста',
      };
    }

    try {
      // Загружаем настройки из БД
      const settings = await loadAgentSettings('planner');
      this.log(`Loaded settings: maxTokens=${settings.maxTokens}, temperature=${settings.temperature}`);

      const systemPrompt = this.buildSystemPrompt(settings);
      const userPrompt = this.buildUserPrompt(input, newContent);

      this.log('Calling AI for post planning...');
      const response = await this.callAI(systemPrompt, userPrompt, {
        maxTokens: settings.maxTokens,
        temperature: settings.temperature,
      });

      // Парсим JSON ответ
      const plan = this.parseAIResponse(response.content);

      if (!plan) {
        return {
          success: false,
          error: 'Не удалось распарсить план от AI',
          tokensUsed: response.tokensUsed,
          costUSD: response.costUSD,
        };
      }

      // Получаем ID контента который будет использован
      const contentIds = plan.selectedContent
        .map(c => c.contentId)
        .filter((id): id is string => !!id);

      const output: PlannerOutput = {
        channelId: input.channelId,
        plan,
        contentIds,
        reasoning: `Выбрано ${contentIds.length} источников для поста на тему "${plan.mainTopic}"`,
      };

      this.log(`Plan created: ${plan.mainTopic}`);
      this.log(`Selected ${contentIds.length} content items`);

      return {
        success: true,
        data: output,
        tokensUsed: response.tokensUsed,
        costUSD: response.costUSD,
      };

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      this.logError('Failed to create post plan', error);

      return {
        success: false,
        error: errorMsg,
      };
    }
  }

  /**
   * Системный промпт для планировщика
   * Использует настройки из БД или дефолт
   */
  private buildSystemPrompt(settings: AgentSettings): string {
    // Используем системный промпт из настроек
    // Добавляем JSON формат ответа
    return `${settings.systemPrompt}

Отвечай ТОЛЬКО в формате JSON без дополнительного текста:

{
  "mainTopic": "Главная тема поста",
  "angle": "Уникальный угол подачи материала",
  "targetAudience": "Целевая аудитория",
  "tone": "Тон поста (информативный/развлекательный/аналитический/мотивирующий)",
  "keyPoints": ["Ключевой пункт 1", "Ключевой пункт 2", "Ключевой пункт 3"],
  "selectedContent": [
    {
      "contentId": "ID контента",
      "title": "Заголовок",
      "relevanceScore": 0.9,
      "keyPoints": ["Что взять из этого источника"],
      "sourceUrl": "URL источника"
    }
  ],
  "suggestedStructure": {
    "hook": "Захватывающее начало поста",
    "body": ["Основной пункт 1", "Основной пункт 2"],
    "conclusion": "Заключение/призыв к действию"
  },
  "estimatedLength": "medium"
}`;
  }

  /**
   * Пользовательский промпт с данными
   */
  private buildUserPrompt(input: PlannerInput, content: ParsedContent[]): string {
    const contentSummary = content.map((c, i) => `
[Контент ${i + 1}]
ID: ${c.id || 'unknown'}
Источник: ${c.sourceName} (${c.sourceType})
Заголовок: ${c.title || 'Без заголовка'}
URL: ${c.url}
Контент (первые 500 символов):
${c.content.substring(0, 500)}...
`).join('\n---\n');

    return `Проанализируй контент для канала и создай план поста.

КАНАЛ:
- Название: ${input.channelName}
- Тематика: ${input.channelTopic}
${input.channelDescription ? `- Описание: ${input.channelDescription}` : ''}

ДОСТУПНЫЙ КОНТЕНТ (${content.length} источников):
${contentSummary}

Создай план поста, выбрав наиболее интересный и релевантный контент для данного канала.
Учитывай тематику канала при выборе материалов.
Выбери 1-3 наиболее подходящих источника для создания одного качественного поста.`;
  }

  /**
   * Парсинг JSON ответа от AI
   */
  private parseAIResponse(content: string): PostPlan | null {
    try {
      // Пробуем найти JSON в ответе
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        this.logError('No JSON found in AI response');
        return null;
      }

      const parsed = JSON.parse(jsonMatch[0]);

      // Валидация обязательных полей
      if (!parsed.mainTopic || !parsed.selectedContent) {
        this.logError('Missing required fields in plan');
        return null;
      }

      return parsed as PostPlan;
    } catch (error) {
      this.logError('Failed to parse AI response as JSON', error);
      return null;
    }
  }
}

// Singleton instance
let plannerAgent: PlannerAgent | null = null;

export function getPlannerAgent(): PlannerAgent {
  if (!plannerAgent) {
    plannerAgent = new PlannerAgent();
  }
  return plannerAgent;
}
