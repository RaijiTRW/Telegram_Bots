/**
 * Base Agent
 * Базовый класс для всех AI агентов
 */

import { getOpenRouterClient, AIResponse } from '../openrouter-client';

export interface AgentConfig {
  name: string;
  description: string;
  maxTokens?: number;
  temperature?: number;
}

export interface AgentMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | Array<{ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }>;
}

export interface AgentResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  tokensUsed?: number;
  costUSD?: number;
}

export abstract class BaseAgent {
  protected config: AgentConfig;
  protected client = getOpenRouterClient();

  constructor(config: AgentConfig) {
    this.config = {
      maxTokens: 4000,
      temperature: 0.7,
      ...config,
    };
  }

  /**
   * Имя агента
   */
  get name(): string {
    return this.config.name;
  }

  /**
   * Описание агента
   */
  get description(): string {
    return this.config.description;
  }

  /**
   * Выполнение агента - должен быть реализован в наследниках
   */
  abstract execute(input: unknown): Promise<AgentResult>;

  /**
   * Вызов AI с кастомным промптом
   */
  protected async callAI(
    systemPrompt: string,
    userPrompt: string,
    options?: { maxTokens?: number; temperature?: number; model?: string }
  ): Promise<AIResponse> {
    const messages: AgentMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ];

    return this.client.chat(messages, {
      maxTokens: options?.maxTokens || this.config.maxTokens,
      temperature: options?.temperature || this.config.temperature,
      model: options?.model,
    });
  }

  /**
   * Логирование действий агента
   */
  protected log(message: string, data?: unknown): void {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${this.name}] ${message}`, data || '');
  }

  /**
   * Логирование ошибок агента
   */
  protected logError(message: string, error?: unknown): void {
    const timestamp = new Date().toISOString();
    console.error(`[${timestamp}] [${this.name}] ERROR: ${message}`, error || '');
  }
}
