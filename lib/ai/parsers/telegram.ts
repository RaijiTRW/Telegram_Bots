/**
 * Telegram Parser с использованием MTProto (Telegram Client API)
 * Позволяет парсить публичные каналы без необходимости быть админом
 */

import { TelegramClient, Api } from 'telegram';
import { StringSession } from 'telegram/sessions';
import { createHash } from 'crypto';
import { supabaseAdmin } from '@/lib/supabase/server';

// ============================================================================
// Типы
// ============================================================================

export interface TelegramParseResult {
  contentHash: string;
  title?: string;
  content: string;
  url: string;
  publishedAt: Date;
  metadata: {
    messageId: number;
    hasMedia: boolean;
    mediaType?: string;
    views?: number;
    imageUrl?: string;
  };
}

export interface TelegramParserConfig {
  apiId: number;
  apiHash: string;
  sessionString?: string;
}

// ============================================================================
// Singleton клиент для переиспользования соединения
// ============================================================================

let clientInstance: TelegramClient | null = null;
let clientConfig: TelegramParserConfig | null = null;

// ============================================================================
// Telegram Parser Class
// ============================================================================

export class TelegramParser {
  private apiId: number;
  private apiHash: string;
  private session: StringSession;

  constructor(config: TelegramParserConfig) {
    this.apiId = config.apiId;
    this.apiHash = config.apiHash;
    this.session = new StringSession(config.sessionString || '');

    if (!this.apiId || !this.apiHash) {
      throw new Error('Telegram API ID and API Hash are required. Get them from https://my.telegram.org');
    }
  }

  /**
   * Получение или создание клиента
   */
  private async getClient(): Promise<TelegramClient> {
    // Переиспользуем существующий клиент если он подключен
    if (clientInstance && clientInstance.connected) {
      return clientInstance;
    }

    // Создаем новый клиент
    const client = new TelegramClient(this.session, this.apiId, this.apiHash, {
      connectionRetries: 5,
      useWSS: true,
    });

    await client.connect();

    // Проверяем авторизацию
    const isAuthorized = await client.isUserAuthorized();
    if (!isAuthorized) {
      throw new Error(
        'Telegram session not authorized. Please run the auth script first: npm run telegram-auth'
      );
    }

    clientInstance = client;
    clientConfig = { apiId: this.apiId, apiHash: this.apiHash };

    return client;
  }

  /**
   * Парсинг сообщений из публичного Telegram канала
   * @param channelUrl - URL канала (https://t.me/channelname или @channelname)
   * @param lastMessageId - ID последнего обработанного сообщения (парсим только новее)
   * @param maxMessages - Максимальное количество новых сообщений
   */
  async parse(
    channelUrl: string,
    lastMessageId?: number,
    maxMessages: number = 20
  ): Promise<{ results: TelegramParseResult[]; lastMessageId: number | null }> {
    try {
      const client = await this.getClient();
      const username = this.extractUsername(channelUrl);

      // Получаем информацию о канале
      const channel = await client.getEntity(username);

      // Получаем сообщения
      const messages = await client.getMessages(channel, {
        limit: maxMessages,
        minId: lastMessageId || 0, // Только сообщения с ID больше lastMessageId
      });

      const results: TelegramParseResult[] = [];
      let newLastMessageId: number | null = lastMessageId || null;

      for (const message of messages) {
        // Пропускаем сообщения без текста
        const content = message.text || (message as any).caption || '';
        if (!content || content.trim().length < 30) {
          continue;
        }

        // Обновляем последний ID
        if (!newLastMessageId || message.id > newLastMessageId) {
          newLastMessageId = message.id;
        }

        const cleanedContent = this.cleanText(content);
        const contentHash = this.generateHash(cleanedContent);

        const mediaType = this.getMediaType(message);
        const hasMedia = !!(message.media);
        let imageUrl: string | undefined;

        if (hasMedia && mediaType === 'photo') {
          imageUrl = await this.tryDownloadAndStorePhoto(client, username, message);
        }

        results.push({
          contentHash,
          content: cleanedContent,
          url: `https://t.me/${username}/${message.id}`,
          publishedAt: new Date(message.date * 1000),
          metadata: {
            messageId: message.id,
            hasMedia,
            mediaType,
            views: (message as any).views,
            imageUrl,
          },
        });
      }

      return {
        results,
        lastMessageId: newLastMessageId,
      };
    } catch (error: any) {
      // Обработка специфичных ошибок Telegram
      if (error.message?.includes('CHANNEL_PRIVATE')) {
        throw new Error(`Канал ${channelUrl} приватный и недоступен для парсинга`);
      }
      if (error.message?.includes('USERNAME_INVALID')) {
        throw new Error(`Неверное имя канала: ${channelUrl}`);
      }
      if (error.message?.includes('session not authorized')) {
        throw error;
      }

      throw new Error(`Ошибка парсинга Telegram: ${error.message}`);
    }
  }

  /**
   * Извлечение username из URL
   */
  private extractUsername(input: string): string {
    let username = input
      .replace(/^https?:\/\/t\.me\//, '')
      .replace(/^@/, '')
      .replace(/\/$/, '')
      .split('/')[0]; // Убираем всё после первого слеша

    return username;
  }

  /**
   * Очистка текста от лишних символов
   */
  private cleanText(text: string): string {
    return text
      .replace(/\n{3,}/g, '\n\n') // Убираем лишние переносы
      .replace(/\s{2,}/g, ' ') // Убираем двойные пробелы
      .trim();
  }

  /**
   * Определение типа медиа
   */
  private getMediaType(message: any): string | undefined {
    if (!message.media) return undefined;

    const mediaClass = message.media.className;
    if (mediaClass === 'MessageMediaPhoto') return 'photo';
    if (mediaClass === 'MessageMediaDocument') {
      const doc = message.media.document;
      if (doc?.mimeType?.startsWith('video/')) return 'video';
      if (doc?.mimeType?.startsWith('audio/')) return 'audio';
      return 'document';
    }
    if (mediaClass === 'MessageMediaWebPage') return 'webpage';

    return 'other';
  }

  /**
   * Генерация SHA-256 хеша
   */
  private generateHash(content: string): string {
    return createHash('sha256').update(content).digest('hex');
  }

  private static readonly IMAGE_BUCKET =
    process.env.SUPABASE_IMAGES_BUCKET ||
    process.env.SUPABASE_STORAGE_BUCKET ||
    'images';

  private static readonly MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10MB
  private static readonly ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

  private ensureBucketOnce: Promise<void> | null = null;
  private async ensureImageBucketExists() {
    if (this.ensureBucketOnce) return this.ensureBucketOnce;

    this.ensureBucketOnce = (async () => {
      const { data: bucket, error } = await supabaseAdmin.storage.getBucket(TelegramParser.IMAGE_BUCKET);

      if (!error) {
        if (bucket && bucket.public === false) {
          const { error: updateError } = await supabaseAdmin.storage.updateBucket(TelegramParser.IMAGE_BUCKET, {
            public: true,
            allowedMimeTypes: TelegramParser.ALLOWED_IMAGE_TYPES,
            fileSizeLimit: TelegramParser.MAX_IMAGE_BYTES,
          });
          if (updateError) throw updateError;
        }
        return;
      }

      const status = (error as any).status ?? Number((error as any).statusCode);
      const message = (error as any).message ?? '';
      const isNotFound = status === 404 || /not found/i.test(message);
      if (!isNotFound) throw error;

      const { error: createError } = await supabaseAdmin.storage.createBucket(TelegramParser.IMAGE_BUCKET, {
        public: true,
        allowedMimeTypes: TelegramParser.ALLOWED_IMAGE_TYPES,
        fileSizeLimit: TelegramParser.MAX_IMAGE_BYTES,
      });
      if (createError) throw createError;
    })();

    return this.ensureBucketOnce;
  }

  private async tryDownloadAndStorePhoto(
    client: TelegramClient,
    username: string,
    message: any
  ): Promise<string | undefined> {
    try {
      await this.ensureImageBucketExists();

      const downloaded = await client.downloadMedia(message, {});
      if (!downloaded || typeof downloaded === 'string') return undefined;
      if (!Buffer.isBuffer(downloaded) || downloaded.length === 0) return undefined;
      if (downloaded.length > TelegramParser.MAX_IMAGE_BYTES) return undefined;

      const storagePath = `telegram-images/${username}/${message.id}.jpg`;

      const { error } = await supabaseAdmin.storage
        .from(TelegramParser.IMAGE_BUCKET)
        .upload(storagePath, downloaded, {
          contentType: 'image/jpeg',
          cacheControl: '3600',
          upsert: false,
        });

      // Если файл уже существует — считаем это успехом
      if (error) {
        const msg = (error as any).message ?? '';
        const status = (error as any).status ?? Number((error as any).statusCode);
        const alreadyExists = status === 409 || /exists/i.test(msg);
        if (!alreadyExists) {
          return undefined;
        }
      }

      const { data: urlData } = supabaseAdmin.storage
        .from(TelegramParser.IMAGE_BUCKET)
        .getPublicUrl(storagePath);

      return urlData.publicUrl;
    } catch {
      return undefined;
    }
  }

  /**
   * Получение текущей session string для сохранения
   */
  getSessionString(): string {
    return this.session.save();
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createTelegramParser(config?: Partial<TelegramParserConfig>): TelegramParser {
  const apiId = config?.apiId || parseInt(process.env.TELEGRAM_API_ID || '0', 10);
  const apiHash = config?.apiHash || process.env.TELEGRAM_API_HASH || '';
  const sessionString = config?.sessionString || process.env.TELEGRAM_SESSION || '';

  return new TelegramParser({
    apiId,
    apiHash,
    sessionString,
  });
}

// ============================================================================
// Функция для закрытия соединения (при необходимости)
// ============================================================================

export async function disconnectTelegram(): Promise<void> {
  if (clientInstance && clientInstance.connected) {
    await clientInstance.disconnect();
    clientInstance = null;
  }
}
