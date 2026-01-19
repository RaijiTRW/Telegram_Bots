/**
 * Settings Loader
 * Загружает настройки агентов из базы данных
 */

import { supabaseAdmin } from '@/lib/supabase/server';

export type AgentName = 'planner' | 'writer' | 'image';

export type PostLength = 'short' | 'medium' | 'long';

export interface LengthWeights {
  short: number;
  medium: number;
  long: number;
}

export interface AgentSettings {
  systemPrompt: string;
  maxTokens: number;
  temperature: number;
  // Writer-specific settings for length variation
  lengthVariationEnabled?: boolean;
  minLength?: PostLength;
  maxLength?: PostLength;
  lengthWeights?: LengthWeights;
}

// Дефолтные настройки на случай если БД недоступна
const DEFAULT_SETTINGS: Record<AgentName, AgentSettings> = {
  planner: {
    systemPrompt: `Ты - AI планировщик контента для Telegram каналов. Твоя задача - анализировать спарсенный контент и создавать план для поста.

Ты должен:
1. Проанализировать предоставленный контент
2. Выбрать наиболее интересные и релевантные материалы
3. Определить главную тему и угол подачи
4. Создать структуру будущего поста

Отвечай ТОЛЬКО в формате JSON без дополнительного текста.`,
    maxTokens: 2000,
    temperature: 0.7,
  },
  writer: {
    systemPrompt: `Ты - профессиональный копирайтер для Telegram каналов. Твоя задача - написать качественный пост на основе предоставленного плана.

ПРАВИЛА НАПИСАНИЯ:
- Используй захватывающее начало (hook)
- Структурируй текст для легкого чтения
- Добавляй emoji где уместно (не перегружай)
- Заканчивай призывом к действию или вопросом к аудитории
- Текст должен быть уникальным, не копируй дословно из источников
- Пиши на русском языке

Отвечай ТОЛЬКО в формате JSON без дополнительного текста.`,
    maxTokens: 3000,
    temperature: 0.8,
    lengthVariationEnabled: true,
    minLength: 'short',
    maxLength: 'long',
    lengthWeights: { short: 30, medium: 50, long: 20 },
  },
  image: {
    systemPrompt: `Ты - AI агент для подбора изображений к постам Telegram каналов.

Твоя задача:
1. Анализировать тему и содержание поста
2. Подбирать релевантные изображения из предоставленных источников
3. Если изображений нет - предлагать поисковые запросы для их поиска

Критерии выбора изображений:
- Изображение должно соответствовать теме поста
- Предпочтительны яркие, качественные изображения
- Избегай стоковых фото с водяными знаками
- Минимальное разрешение 800x600

Отвечай ТОЛЬКО в формате JSON:
{
  "selectedImages": [{"url": "...", "reason": "почему выбрано"}],
  "searchQueries": ["запрос для поиска 1", "запрос 2"],
  "needsImage": true/false,
  "imageStyle": "описание желаемого стиля изображения"
}`,
    maxTokens: 1000,
    temperature: 0.5,
  },
};

// Кеш настроек (обновляется каждые 5 минут)
let settingsCache: Record<AgentName, AgentSettings> | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 минут

/**
 * Загрузка настроек агента из БД
 */
export async function loadAgentSettings(agentName: AgentName): Promise<AgentSettings> {
  try {
    // Проверяем кеш
    const now = Date.now();
    if (settingsCache && (now - cacheTimestamp) < CACHE_TTL) {
      return settingsCache[agentName] || DEFAULT_SETTINGS[agentName];
    }

    // Загружаем все настройки из БД
    const { data, error } = await (supabaseAdmin
      .from('ai_agent_settings') as any)
      .select('agent_name, system_prompt, max_tokens, temperature, length_variation_enabled, min_length, max_length, length_weights');

    if (error) {
      console.error('[SettingsLoader] Failed to load settings:', error);
      return DEFAULT_SETTINGS[agentName];
    }

    // Обновляем кеш
    settingsCache = { ...DEFAULT_SETTINGS };

    for (const row of data || []) {
      const name = row.agent_name as AgentName;
      if (name in settingsCache) {
        settingsCache[name] = {
          systemPrompt: row.system_prompt || DEFAULT_SETTINGS[name].systemPrompt,
          maxTokens: row.max_tokens || DEFAULT_SETTINGS[name].maxTokens,
          temperature: parseFloat(row.temperature) || DEFAULT_SETTINGS[name].temperature,
          // Writer-specific settings
          lengthVariationEnabled: row.length_variation_enabled ?? DEFAULT_SETTINGS[name].lengthVariationEnabled,
          minLength: row.min_length || DEFAULT_SETTINGS[name].minLength,
          maxLength: row.max_length || DEFAULT_SETTINGS[name].maxLength,
          lengthWeights: row.length_weights || DEFAULT_SETTINGS[name].lengthWeights,
        };
      }
    }

    cacheTimestamp = now;

    return settingsCache[agentName] || DEFAULT_SETTINGS[agentName];
  } catch (error) {
    console.error('[SettingsLoader] Error loading settings:', error);
    return DEFAULT_SETTINGS[agentName];
  }
}

/**
 * Очистка кеша настроек (для использования после обновления)
 */
export function clearSettingsCache(): void {
  settingsCache = null;
  cacheTimestamp = 0;
}

/**
 * Получение дефолтных настроек
 */
export function getDefaultSettings(agentName: AgentName): AgentSettings {
  return DEFAULT_SETTINGS[agentName];
}

/**
 * Выбор случайной длины поста на основе весов
 */
export function selectRandomLength(settings: AgentSettings): PostLength {
  if (!settings.lengthVariationEnabled) {
    return 'medium'; // Дефолт если вариативность выключена
  }

  const weights = settings.lengthWeights || { short: 30, medium: 50, long: 20 };
  const minLength = settings.minLength || 'short';
  const maxLength = settings.maxLength || 'long';

  // Фильтруем длины по min/max
  const lengthOrder: PostLength[] = ['short', 'medium', 'long'];
  const minIndex = lengthOrder.indexOf(minLength);
  const maxIndex = lengthOrder.indexOf(maxLength);

  const availableLengths = lengthOrder.slice(minIndex, maxIndex + 1);

  // Собираем веса только для доступных длин
  const availableWeights: { length: PostLength; weight: number }[] = [];
  let totalWeight = 0;

  for (const length of availableLengths) {
    const weight = weights[length] || 0;
    if (weight > 0) {
      availableWeights.push({ length, weight });
      totalWeight += weight;
    }
  }

  // Если нет доступных весов, возвращаем средний
  if (availableWeights.length === 0 || totalWeight === 0) {
    return availableLengths.includes('medium') ? 'medium' : availableLengths[0];
  }

  // Выбираем случайную длину на основе весов
  let random = Math.random() * totalWeight;

  for (const { length, weight } of availableWeights) {
    random -= weight;
    if (random <= 0) {
      return length;
    }
  }

  return availableWeights[availableWeights.length - 1].length;
}
