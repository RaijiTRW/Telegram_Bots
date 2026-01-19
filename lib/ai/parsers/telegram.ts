/**
 * Telegram Parser с использованием MTProto (Telegram Client API)
 * Позволяет парсить публичные каналы без необходимости быть админом
 */

import { TelegramClient, Api } from 'telegram';
import { createHash } from 'crypto';
import { supabaseAdmin } from '@/lib/supabase/server';
import { getTelegramClient, isAuthorized as isTelegramAuthorized, disconnectClient } from '@/lib/telegram/client';

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
}

type TelegramResolveOptions = {
  allowJoinViaInvite?: boolean;
  direction?: 'new' | 'old';
};

// ============================================================================
// Telegram Parser Class
// ============================================================================

export class TelegramParser {
  private apiId: number;
  private apiHash: string;

  constructor(config: TelegramParserConfig) {
    this.apiId = config.apiId;
    this.apiHash = config.apiHash;

    if (!this.apiId || !this.apiHash) {
      throw new Error('Telegram API ID and API Hash are required. Get them from https://my.telegram.org');
    }
  }

  /**
   * Получение или создание клиента
   */
  private async getClient(): Promise<TelegramClient> {
    const authorized = await isTelegramAuthorized();
    if (!authorized) {
      throw new Error(
        'Telegram аккаунт (User API) не подключен или не авторизован. Подключите его в разделе «Настройки Telegram».'
      );
    }

    return await getTelegramClient();
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
    maxMessages: number = 20,
    options?: TelegramResolveOptions
  ): Promise<{ results: TelegramParseResult[]; lastMessageId: number | null }> {
    try {
      const client = await this.getClient();
      let ref = this.extractTelegramRef(channelUrl);
      if (ref.type === 'username' && ref.value.startsWith('+') && ref.value.length > 1) {
        ref = { type: 'invite', value: ref.value.slice(1) };
      }

      // Получаем entity канала (username / invite)
      const resolved = await this.resolveChannelEntity(client, ref, options);
      const channel = resolved.entity;
      const channelSlug = resolved.slug;

      const direction: 'new' | 'old' = options?.direction === 'old' ? 'old' : 'new';

      // Получаем сообщения
      const messages = await client.getMessages(channel, this.buildGetMessagesParams(direction, lastMessageId, maxMessages));

      const results: TelegramParseResult[] = [];
      let newLastMessageId: number | null = null;

      for (const message of messages) {
        // Пропускаем сообщения без текста
        const content = (message as any).message || (message as any).text || (message as any).caption || '';
        if (!content || content.trim().length < 5) {
          continue;
        }

        // Обновляем cursor ID (new: max id, old: min id)
        if (!newLastMessageId) {
          newLastMessageId = message.id;
        } else if (direction === 'new') {
          if (message.id > newLastMessageId) newLastMessageId = message.id;
        } else {
          if (message.id < newLastMessageId) newLastMessageId = message.id;
        }

        const cleanedContent = this.cleanText(content);
        const contentHash = this.generateHash(cleanedContent);

        const mediaType = this.getMediaType(message);
        const hasMedia = !!(message.media);
        let imageUrl: string | undefined;

        if (hasMedia && (mediaType === 'photo' || mediaType === 'webpage')) {
          imageUrl = await this.tryDownloadAndStorePhoto(client, channelSlug, message);
        }

        results.push({
          contentHash,
          content: cleanedContent,
          url: this.buildMessageUrl(channelSlug, channel as any, message.id),
          publishedAt:
            (message as any).date instanceof Date
              ? ((message as any).date as Date)
              : new Date(Number((message as any).date || 0) * 1000),
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
        lastMessageId: newLastMessageId ?? (lastMessageId || null),
      };
    } catch (error: any) {
      // Обработка специфичных ошибок Telegram
      if (error.message?.includes('CHANNEL_PRIVATE')) {
        throw new Error(`Канал ${channelUrl} приватный и недоступен для парсинга`);
      }
      if (error.message?.includes('USERNAME_INVALID')) {
        throw new Error(`Неверное имя канала: ${channelUrl}`);
      }
      if (
        error.message?.includes('session not authorized') ||
        error.message?.includes('не подключен') ||
        error.message?.includes('не авторизован')
      ) {
        throw error;
      }

      throw new Error(`Ошибка парсинга Telegram: ${error.message}`);
    }
  }

  private buildGetMessagesParams(
    direction: 'new' | 'old',
    cursorMessageId: number | undefined,
    limit: number
  ): Record<string, unknown> {
    if (direction === 'old') {
      return cursorMessageId
        ? {
            limit,
            maxId: cursorMessageId, // сообщения с ID меньше cursorMessageId
          }
        : {
            limit,
          };
    }

    return cursorMessageId
      ? {
          limit,
          minId: cursorMessageId, // сообщения с ID больше cursorMessageId
        }
      : {
          limit,
        };
  }

  /**
   * Извлечение ссылки на канал (username или invite hash)
   */
  private extractTelegramRef(input: string): { type: 'username'; value: string } | { type: 'invite'; value: string } {
    const raw = String(input || '').trim();

    const tryParseUrl = (value: string): string | null => {
      try {
        const normalized = value.startsWith('http://') || value.startsWith('https://') ? value : `https://${value}`;
        const u = new URL(normalized);
        if (!/(^|\.)t\.me$|(^|\.)telegram\.me$/i.test(u.hostname)) return null;
        const path = decodeURIComponent(u.pathname || '').replace(/^\/+/, '');
        return path || null;
      } catch {
        return null;
      }
    };

    const parsedPath = tryParseUrl(raw);
    if (parsedPath) {
      // /+HASH or /%2BHASH (decoded already)
      if (parsedPath.startsWith('+') && parsedPath.length > 1) {
        return { type: 'invite', value: parsedPath.slice(1).split(/[/?#]/)[0] };
      }
      if (parsedPath.toLowerCase().startsWith('joinchat/')) {
        return { type: 'invite', value: parsedPath.slice('joinchat/'.length).split(/[/?#]/)[0] };
      }
      // username/<message_id> -> username
      const username = parsedPath.split('/')[0];
      if (username) return { type: 'username', value: username.replace(/^@/, '') };
    }

    // Invite links:
    // - https://t.me/+HASH
    // - https://t.me/joinchat/HASH
    // - https://t.me/%2BHASH
    // - t.me/+HASH
    // - t.me/joinchat/HASH
    // - +HASH
    const mInvite =
      raw.match(/^(?:https?:\/\/)?(?:t\.me|telegram\.me)\/\+([A-Za-z0-9_-]+)(?:[/?#].*)?$/) ||
      raw.match(/^(?:https?:\/\/)?(?:t\.me|telegram\.me)\/joinchat\/([A-Za-z0-9_-]+)(?:[/?#].*)?$/) ||
      raw.match(/^(?:https?:\/\/)?(?:t\.me|telegram\.me)\/%2B([A-Za-z0-9_-]+)(?:[/?#].*)?$/i) ||
      raw.match(/^\+([A-Za-z0-9_-]+)$/);

    if (mInvite?.[1]) {
      return { type: 'invite', value: mInvite[1] };
    }

    // Username or @username
    const username = raw
      .replace(/^https?:\/\/t\.me\//, '')
      .replace(/^https?:\/\/telegram\.me\//, '')
      .replace(/^(?:t\.me|telegram\.me)\//, '')
      .replace(/^@/, '')
      .replace(/\/$/, '')
      .split('/')[0];

    // If the input looks like an invite but didn't match above (edge cases)
    if (username.startsWith('+') && /^[+][A-Za-z0-9_-]+$/.test(username)) {
      return { type: 'invite', value: username.slice(1) };
    }

    return { type: 'username', value: username };
  }

  private async resolveChannelEntity(
    client: TelegramClient,
    ref: { type: 'username'; value: string } | { type: 'invite'; value: string },
    options?: TelegramResolveOptions
  ): Promise<{ entity: any; slug: string }> {
    if (ref.type === 'username') {
      const username = ref.value;
      const entity = await client.getEntity(username);
      return { entity, slug: username };
    }

    const hash = ref.value;
    const checked = await client.invoke(new Api.messages.CheckChatInvite({ hash }));

    // Already joined: we can use the chat directly.
    if ((checked as any).chat) {
      const chat = (checked as any).chat;
      try {
        const entity = await client.getEntity(chat);
        const slug = this.slugFromEntity(entity);
        return { entity, slug };
      } catch {
        const slug = this.slugFromEntity(chat);
        return { entity: chat, slug };
      }
    }

    // Not joined yet — require explicit allowJoinViaInvite.
    if (!options?.allowJoinViaInvite) {
      throw new Error(
        'Это приватный Telegram-канал по инвайту. Чтобы парсить его, аккаунт Telegram (User API) должен быть подписан/вступить. ' +
        'Либо включите allowJoinViaInvite в parsing_config источника.'
      );
    }

    const imported = await client.invoke(new Api.messages.ImportChatInvite({ hash }));
    const chats: any[] = (imported as any).chats || [];
    const chat = chats.find(c => c?.className?.includes('Channel')) || chats[0];
    if (!chat) {
      throw new Error('Не удалось вступить по инвайту или получить чат');
    }

    try {
      const entity = await client.getEntity(chat);
      const slug = this.slugFromEntity(entity);
      return { entity, slug };
    } catch {
      const slug = this.slugFromEntity(chat);
      return { entity: chat, slug };
    }
  }

  private slugFromEntity(entity: any): string {
    const username = String((entity as any)?.username || '').trim();
    if (username) return username;
    const id = Number((entity as any)?.id || 0);
    if (Number.isFinite(id) && id > 0) return `c/${id}`;
    return 'c/unknown';
  }

  private buildMessageUrl(channelSlug: string, entity: any, messageId: number): string {
    if (!channelSlug) return String(messageId);
    // If we already have username
    if (!channelSlug.startsWith('c/')) {
      return `https://t.me/${channelSlug}/${messageId}`;
    }

    // Private channel/group permalink format: https://t.me/c/<internal_id>/<msg_id>
    const id = Number((entity as any)?.id || 0);
    const internalId = Number.isFinite(id) && id > 0 ? String(id) : channelSlug.replace(/^c\//, '');
    return `https://t.me/c/${internalId}/${messageId}`;
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
      if (doc?.mimeType?.startsWith('image/')) return 'photo';
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

      const media = (message as any)?.media || (message as any)?.photo || message;
      const downloaded = await client.downloadMedia(media, {});
      if (!downloaded || typeof downloaded === 'string') return undefined;
      const buffer = this.toBuffer(downloaded);
      if (!buffer || buffer.length === 0) return undefined;
      if (buffer.length > TelegramParser.MAX_IMAGE_BYTES) return undefined;

      const detected = this.detectImageType(buffer);
      if (!detected) return undefined;
      if (!TelegramParser.ALLOWED_IMAGE_TYPES.includes(detected.contentType)) return undefined;

      const storagePath = `telegram-images/${username}/${message.id}.${detected.ext}`;

      const { error } = await supabaseAdmin.storage
        .from(TelegramParser.IMAGE_BUCKET)
        .upload(storagePath, buffer, {
          contentType: detected.contentType,
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

  private toBuffer(value: unknown): Buffer | null {
    if (!value) return null;
    if (Buffer.isBuffer(value)) return value;
    if (value instanceof Uint8Array) return Buffer.from(value);
    if (value instanceof ArrayBuffer) return Buffer.from(new Uint8Array(value));
    return null;
  }

  private detectImageType(buffer: Buffer): { contentType: string; ext: string } | null {
    if (buffer.length < 12) return null;

    // JPEG: FF D8 FF
    if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
      return { contentType: 'image/jpeg', ext: 'jpg' };
    }

    // PNG: 89 50 4E 47 0D 0A 1A 0A
    if (
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47 &&
      buffer[4] === 0x0d &&
      buffer[5] === 0x0a &&
      buffer[6] === 0x1a &&
      buffer[7] === 0x0a
    ) {
      return { contentType: 'image/png', ext: 'png' };
    }

    // GIF: 47 49 46 38
    if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x38) {
      return { contentType: 'image/gif', ext: 'gif' };
    }

    // WebP: "RIFF"...."WEBP"
    if (
      buffer[0] === 0x52 &&
      buffer[1] === 0x49 &&
      buffer[2] === 0x46 &&
      buffer[3] === 0x46 &&
      buffer[8] === 0x57 &&
      buffer[9] === 0x45 &&
      buffer[10] === 0x42 &&
      buffer[11] === 0x50
    ) {
      return { contentType: 'image/webp', ext: 'webp' };
    }

    return null;
  }

  /**
   * (Устарело) Ранее использовалось для сохранения TELEGRAM_SESSION в env.
   * Теперь сессия хранится в таблице telegram_sessions.
   */
  getSessionString(): string {
    return '';
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createTelegramParser(config?: Partial<TelegramParserConfig>): TelegramParser {
  const apiId = config?.apiId || parseInt(process.env.TELEGRAM_API_ID || '0', 10);
  const apiHash = config?.apiHash || process.env.TELEGRAM_API_HASH || '';

  return new TelegramParser({
    apiId,
    apiHash,
  });
}

// ============================================================================
// Функция для закрытия соединения (при необходимости)
// ============================================================================

export async function disconnectTelegram(): Promise<void> {
  await disconnectClient();
}
