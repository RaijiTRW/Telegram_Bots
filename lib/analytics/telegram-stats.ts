import { Api } from 'telegram';
import { getTelegramClient, isAuthorized } from '@/lib/telegram/client';
import { supabaseAdmin } from '@/lib/supabase/server';

interface ChannelStats {
  subscribers: number;
  subscribersGained: number;
  subscribersLost: number;
  viewsPerPost: number;
  sharesPerPost: number;
  reactionsPerPost: number;
}

interface PostStats {
  views: number;
  forwards: number;
  reactions: number;
}

interface ChannelAnalyticsRow {
  date: string;
  subscribers_count: number | null;
  subscribers_gained: number | null;
  subscribers_lost: number | null;
  views_total: number | null;
  posts_published: number | null;
}

interface ReactionBreakdownItem {
  reaction: string;
  count: number;
}

interface TelegramPostAnalyticsRow {
  channel_id: string;
  telegram_message_id: number;
  posted_at: string;
  text: string | null;
  views_count: number;
  reactions_count: number;
  forwards_count: number;
  reactions_breakdown: ReactionBreakdownItem[] | null;
}

/**
 * Получить статистику канала через TDLib
 */
export async function getChannelStats(channelUsername: string): Promise<ChannelStats | null> {
  const authorized = await isAuthorized();
  if (!authorized) {
    console.log('Telegram не авторизован');
    return null;
  }

  try {
    const client = await getTelegramClient();

    // Получить entity канала
    const channel = await client.getEntity(normalizeChannelRef(channelUsername));

    // Получить статистику канала
    const stats = await client.invoke(
      new Api.stats.GetBroadcastStats({
        channel: channel,
      })
    );

    return {
      subscribers: stats.followers?.current || 0,
      subscribersGained: stats.followers?.current
        ? stats.followers.current - (stats.followers.previous || stats.followers.current)
        : 0,
      subscribersLost: 0, // Вычисляется отдельно
      viewsPerPost: stats.viewsPerPost?.current || 0,
      sharesPerPost: stats.sharesPerPost?.current || 0,
      reactionsPerPost: stats.reactionsPerPost?.current || 0,
    };
  } catch (error) {
    console.error('Ошибка получения статистики канала:', error);
    return null;
  }
}

/**
 * Получить статистику поста через TDLib
 */
export async function getPostStats(
  channelUsername: string,
  messageId: number
): Promise<PostStats | null> {
  const authorized = await isAuthorized();
  if (!authorized) {
    console.log('Telegram не авторизован');
    return null;
  }

  try {
    const client = await getTelegramClient();

    // Получить entity канала
    const channel = await client.getEntity(normalizeChannelRef(channelUsername));

    // Получить статистику сообщения
    const stats = await client.invoke(
      new Api.stats.GetMessageStats({
        channel: channel,
        msgId: messageId,
      })
    );

    // Парсинг графика просмотров для получения текущего значения
    let views = 0;
    if (stats.viewsGraph && 'json' in stats.viewsGraph) {
      try {
        const graphData = JSON.parse((stats.viewsGraph as any).json || '{}');
        if (graphData.columns && graphData.columns.length > 1) {
          const viewsColumn = graphData.columns[1];
          if (Array.isArray(viewsColumn) && viewsColumn.length > 1) {
            views = viewsColumn[viewsColumn.length - 1] || 0;
          }
        }
      } catch {}
    }

    return {
      views,
      forwards: 0, // Требует отдельного запроса
      reactions: 0, // Требует отдельного запроса
    };
  } catch (error) {
    console.error('Ошибка получения статистики поста:', error);
    return null;
  }
}

/**
 * Получить количество подписчиков канала
 */
export async function getSubscribersCount(channelUsername: string): Promise<number | null> {
  const authorized = await isAuthorized();
  if (!authorized) {
    return null;
  }

  try {
    const client = await getTelegramClient();
    const channel = await client.getEntity(normalizeChannelRef(channelUsername));

    const fullChannel = await client.invoke(
      new Api.channels.GetFullChannel({
        channel: channel,
      })
    );

    return (fullChannel.fullChat as any).participantsCount || 0;
  } catch (error) {
    console.error('Ошибка получения количества подписчиков:', error);
    return null;
  }
}

/**
 * Синхронизировать статистику всех каналов
 */
export async function syncAllChannelsStats(): Promise<{
  synced: number;
  failed: number;
  errors: string[];
  postsSynced: number;
  postsFailed: number;
  telegramPostsSynced: number;
  telegramPostsFailed: number;
}> {
  const authorized = await isAuthorized();
  if (!authorized) {
    return {
      synced: 0,
      failed: 0,
      errors: ['Telegram не авторизован'],
      postsSynced: 0,
      postsFailed: 0,
      telegramPostsSynced: 0,
      telegramPostsFailed: 0,
    };
  }

  const { data: channels, error } = await (supabaseAdmin
    .from('channels') as any)
    .select('id, telegram_chat_id, name')
    .eq('is_active', true);

  if (error || !channels) {
    return {
      synced: 0,
      failed: 0,
      errors: ['Ошибка загрузки каналов'],
      postsSynced: 0,
      postsFailed: 0,
      telegramPostsSynced: 0,
      telegramPostsFailed: 0,
    };
  }

  const client = await getTelegramClient();
  let synced = 0;
  let failed = 0;
  let postsSynced = 0;
  let postsFailed = 0;
  let telegramPostsSynced = 0;
  let telegramPostsFailed = 0;
  const errors: string[] = [];
  const today = new Date().toISOString().split('T')[0];
  const subscribersTimelineDays = 90;

  for (const channel of channels) {
    if (!channel.telegram_chat_id) {
      errors.push(`Канал ${channel.name}: нет telegram_chat_id`);
      failed++;
      continue;
    }

    try {
      const channelEntity = await client.getEntity(normalizeChannelRef(channel.telegram_chat_id));

      // 1) Подписчики (самое надежное)
      const subscribers = await getSubscribersCountWithClient(client, channelEntity);
      if (subscribers === null) {
        errors.push(`Канал ${channel.name}: не удалось получить подписчиков (Telegram User API)`);
        failed++;
        continue;
      }

      // 1.1) Бекфилл дневной истории подписчиков из Telegram графика (для линейного графика)
      const timeline = await getSubscribersTimelineFromTelegram(client, channelEntity);
      if (timeline.length > 0) {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - subscribersTimelineDays);
        const cutoffDate = cutoff.toISOString().slice(0, 10);
        // Важно: НЕ перезаписываем строку за "сегодня", иначе мы теряем базу для
        // подсчета +/− внутри дня (saveChannelStats аккумулирует дельты).
        const filtered = timeline.filter(p => p.date >= cutoffDate && p.date < today);

        if (filtered.length > 0) {
          const rows = filtered.map((p, idx) => {
            const prev = idx > 0 ? filtered[idx - 1].subscribers : null;
            const gained = prev === null ? 0 : Math.max(0, p.subscribers - prev);
            const lost = prev === null ? 0 : Math.max(0, prev - p.subscribers);
            return {
              channel_id: channel.id,
              date: p.date,
              subscribers_count: p.subscribers,
              subscribers_gained: gained,
              subscribers_lost: lost,
            };
          });

          const { error: upsertError } = await (supabaseAdmin
            .from('channel_analytics') as any)
            .upsert(rows, { onConflict: 'channel_id,date' });

          if (upsertError) {
            errors.push(`Канал ${channel.name}: не удалось сохранить историю подписчиков (${upsertError.message || String(upsertError)})`);
          }
        }
      }

      // 2) Синхронизация постов канала напрямую из Telegram (для просмотров/реакций)
      const tgSync = await syncTelegramChannelPosts(channel.id, channel.telegram_chat_id);
      telegramPostsSynced += tgSync.synced;
      telegramPostsFailed += tgSync.failed;
      if (tgSync.errors.length > 0) {
        errors.push(...tgSync.errors.map(e => `Канал ${channel.name}: ${e}`));
      }

      // 3) Синхронизация статистики постов приложения (если есть telegram_message_id)
      const postSync = await syncChannelPostsAnalytics(channel.id, channel.telegram_chat_id);
      postsSynced += postSync.synced;
      postsFailed += postSync.failed;
      if (postSync.errors.length > 0) {
        errors.push(...postSync.errors.map(e => `Канал ${channel.name}: ${e}`));
      }

      await saveChannelStats(channel.id, today, {
        subscribers_count: subscribers,
      });

      synced++;
    } catch (error: any) {
      errors.push(`Канал ${channel.name}: ${error.message}`);
      failed++;
    }

    // Пауза между запросами чтобы не превысить лимиты
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  return { synced, failed, errors, postsSynced, postsFailed, telegramPostsSynced, telegramPostsFailed };
}

async function syncTelegramChannelPosts(
  channelId: string,
  channelIdentifier: string,
  limit: number = 50
): Promise<{ synced: number; failed: number; errors: string[] }> {
  const authorized = await isAuthorized();
  if (!authorized) return { synced: 0, failed: 0, errors: ['Telegram не авторизован'] };

  try {
    const client = await getTelegramClient();
    const entity = await client.getEntity(normalizeChannelRef(channelIdentifier));
    const messages: any[] = await client.getMessages(entity, { limit });

    const rows: TelegramPostAnalyticsRow[] = [];
    for (const m of messages || []) {
      const id = Number(m?.id);
      const date = Number(m?.date);
      if (!Number.isFinite(id) || id <= 0) continue;
      if (!Number.isFinite(date) || date <= 0) continue;

      const postedAt = new Date(date * 1000).toISOString();
      const text = String(m?.message || m?.text || (m as any)?.caption || '').slice(0, 4000) || null;

      const views = Number(m?.views || 0);
      const forwards = Number(m?.forwards || 0);
      const { total, breakdown } = extractReactions(m);

      rows.push({
        channel_id: channelId,
        telegram_message_id: id,
        posted_at: postedAt,
        text,
        views_count: Number.isFinite(views) ? views : 0,
        reactions_count: total,
        forwards_count: Number.isFinite(forwards) ? forwards : 0,
        reactions_breakdown: breakdown,
      });
    }

    if (rows.length === 0) return { synced: 0, failed: 0, errors: [] };

    const { error } = await (supabaseAdmin
      .from('telegram_post_analytics') as any)
      .upsert(rows, { onConflict: 'channel_id,telegram_message_id' });

    if (error) {
      return { synced: 0, failed: rows.length, errors: [String(error.message || error)] };
    }

    return { synced: rows.length, failed: 0, errors: [] };
  } catch (e: any) {
    return { synced: 0, failed: 0, errors: [e?.message || 'Ошибка синка Telegram постов'] };
  }
}

async function syncChannelPostsAnalytics(
  channelId: string,
  channelIdentifier: string
): Promise<{ synced: number; failed: number; errors: string[] }> {
  const errors: string[] = [];
  let synced = 0;
  let failed = 0;

  const authorized = await isAuthorized();
  if (!authorized) {
    return { synced: 0, failed: 0, errors: ['Telegram не авторизован'] };
  }

  const client = await getTelegramClient();
  const channelEntity = await client.getEntity(normalizeChannelRef(channelIdentifier));

  // Берем только относительно свежие посты, чтобы не гонять сотни запросов
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);

  const { data: posts, error: postsError } = await (supabaseAdmin
    .from('posts') as any)
    .select('id, title, plain_text, published_at')
    .eq('channel_id', channelId)
    .eq('status', 'published')
    .not('published_at', 'is', null)
    .gte('published_at', cutoff.toISOString())
    .order('published_at', { ascending: false })
    .limit(50);

  if (postsError) {
    return { synced: 0, failed: 0, errors: ['ошибка загрузки постов для синка'] };
  }

  const postIds: string[] = (posts || []).map((p: any) => p.id).filter(Boolean);
  if (postIds.length === 0) return { synced: 0, failed: 0, errors: [] };

  const { data: analyticsRows, error: analyticsError } = await (supabaseAdmin
    .from('post_analytics') as any)
    .select('post_id, telegram_message_id')
    .in('post_id', postIds)
    .limit(1000);

  if (analyticsError) {
    return { synced: 0, failed: 0, errors: ['ошибка загрузки post_analytics'] };
  }

  const analyticsByPostId = new Map<string, any>();
  for (const row of analyticsRows || []) {
    if (row?.post_id) analyticsByPostId.set(row.post_id, row);
  }

  for (const post of posts || []) {
    try {
      const postId = post.id as string;
      let messageId = Number(analyticsByPostId.get(postId)?.telegram_message_id);

      // Бекфилл message_id для старых постов
      if (!Number.isFinite(messageId) || messageId <= 0) {
        const recovered = await findTelegramMessageIdForPost(client, channelEntity as any, {
          title: post.title,
          plainText: post.plain_text,
          publishedAt: post.published_at,
        });

        if (!recovered) {
          continue;
        }

        messageId = recovered;
        await (supabaseAdmin
          .from('post_analytics') as any)
          .upsert(
            { post_id: postId, telegram_message_id: messageId },
            { onConflict: 'post_id' }
          );
      }

      const stats = await getPostStatsByMessageWithClient(client, channelEntity as any, messageId);
      if (!stats) {
        failed++;
        continue;
      }

      await savePostAnalytics(postId, messageId, stats);
      synced++;
    } catch (e: any) {
      failed++;
      errors.push(`пост ${post?.id}: ${e?.message || 'ошибка'}`);
    }

    await new Promise(resolve => setTimeout(resolve, 500));
  }

  return { synced, failed, errors };
}

async function getViewsForDay(channelId: string, date: string): Promise<number> {
  const start = `${date}T00:00:00.000Z`;
  const end = `${date}T23:59:59.999Z`;

  const { data: tgPosts } = await (supabaseAdmin
    .from('telegram_post_analytics') as any)
    .select('views_count')
    .eq('channel_id', channelId)
    .gte('posted_at', start)
    .lte('posted_at', end)
    .limit(2000);

  return (tgPosts || []).reduce((sum: number, a: any) => sum + (a.views_count || 0), 0);
}

async function savePostAnalytics(
  postId: string,
  telegramMessageId: number,
  stats: PostStats & { reactionsBreakdown: ReactionBreakdownItem[] }
): Promise<void> {
  const baseRow = {
    post_id: postId,
    telegram_message_id: telegramMessageId,
    views_count: stats.views,
    reactions_count: stats.reactions,
    forwards_count: stats.forwards,
  };

  // Backward-compatible: if migration 009 is not applied, reactions_breakdown column won't exist.
  const { error } = await (supabaseAdmin
    .from('post_analytics') as any)
    .upsert(
      {
        ...baseRow,
        reactions_breakdown: stats.reactionsBreakdown,
      },
      { onConflict: 'post_id' }
    );

  if (!error) return;

  const msg = String(error.message || error);
  if (msg.toLowerCase().includes('reactions_breakdown') || msg.toLowerCase().includes('column')) {
    const { error: fallbackError } = await (supabaseAdmin
      .from('post_analytics') as any)
      .upsert(baseRow, { onConflict: 'post_id' });

    if (fallbackError) {
      throw new Error(`Failed to upsert post_analytics: ${fallbackError.message || String(fallbackError)}`);
    }
    return;
  }

  throw new Error(`Failed to upsert post_analytics: ${msg}`);
}

async function getPostStatsByMessage(
  channelIdentifier: string,
  messageId: number
): Promise<(PostStats & { reactionsBreakdown: ReactionBreakdownItem[] }) | null> {
  const authorized = await isAuthorized();
  if (!authorized) return null;

  try {
    const client = await getTelegramClient();
    const channel = await client.getEntity(normalizeChannelRef(channelIdentifier));
    return await getPostStatsByMessageWithClient(client, channel as any, messageId);
  } catch (error) {
    console.error('Ошибка получения статистики сообщения:', error);
    return null;
  }
}

async function getPostStatsByMessageWithClient(
  client: any,
  channelEntity: any,
  messageId: number
): Promise<(PostStats & { reactionsBreakdown: ReactionBreakdownItem[] }) | null> {
  const messages = await client.getMessages(channelEntity, { ids: [messageId] });
  const msg = Array.isArray(messages) ? messages[0] : messages;
  if (!msg) return null;

  const views = Number((msg as any).views || 0);
  const forwards = Number((msg as any).forwards || 0);
  const { total, breakdown } = extractReactions(msg);

  return {
    views: Number.isFinite(views) ? views : 0,
    forwards: Number.isFinite(forwards) ? forwards : 0,
    reactions: total,
    reactionsBreakdown: breakdown,
  };
}

async function findTelegramMessageIdForPost(
  client: any,
  channelEntity: any,
  post: { title?: string | null; plainText?: string | null; publishedAt?: string | null }
): Promise<number | null> {
  const publishedAt = post.publishedAt ? new Date(post.publishedAt) : null;

  const baseText = String(post.title || post.plainText || '').trim();
  if (!baseText) return null;

  const query = baseText.replace(/\s+/g, ' ').slice(0, 32);
  if (!query) return null;

  // 1) server-side search
  try {
    const candidates: any[] = [];
    for await (const m of client.iterMessages(channelEntity, { search: query, limit: 10 })) {
      candidates.push(m);
    }
    const best = pickBestMessageCandidate(candidates, query, publishedAt);
    if (best?.id) return best.id;
  } catch {
    // ignore and try fallback
  }

  // 2) fallback: scan around publication date
  if (publishedAt) {
    try {
      const offsetDate = new Date(publishedAt.getTime() + 60 * 60 * 1000);
      const messages = await client.getMessages(channelEntity, { limit: 30, offsetDate });
      const best = pickBestMessageCandidate(messages as any, query, publishedAt);
      if (best?.id) return best.id;
    } catch {
      // ignore
    }
  }

  return null;
}

function pickBestMessageCandidate(messages: any[], query: string, publishedAt: Date | null) {
  const q = query.toLowerCase();
  let best: any = null;
  let bestScore = -Infinity;

  for (const m of messages || []) {
    const text = String(m?.text || m?.message || '').toLowerCase();
    if (!text) continue;

    let score = 0;
    if (text.includes(q)) score += 10;

    if (publishedAt && typeof m?.date === 'number') {
      const dt = new Date(m.date * 1000);
      const diff = Math.abs(dt.getTime() - publishedAt.getTime());
      const day = 24 * 60 * 60 * 1000;
      score += Math.max(0, 5 - (diff / day) * 5);
    }

    if (score > bestScore) {
      bestScore = score;
      best = m;
    }
  }

  return bestScore > 0 ? best : null;
}

function normalizeChannelRef(ref: string): string {
  return String(ref || '').trim();
}

function extractReactions(message: any): { total: number; breakdown: ReactionBreakdownItem[] } {
  const reactions = message?.reactions;
  const results = reactions?.results;

  if (!Array.isArray(results)) {
    return { total: 0, breakdown: [] };
  }

  const breakdown: ReactionBreakdownItem[] = [];
  let total = 0;

  for (const r of results) {
    const count = Number(r?.count || 0);
    if (!Number.isFinite(count) || count <= 0) continue;

    const reaction = normalizeReaction(r?.reaction);
    breakdown.push({ reaction, count });
    total += count;
  }

  breakdown.sort((a, b) => b.count - a.count);
  return { total, breakdown };
}

function normalizeReaction(reaction: any): string {
  if (!reaction) return 'unknown';
  if (typeof reaction === 'string') return reaction;
  if (typeof reaction?.emoticon === 'string') return reaction.emoticon;
  if (typeof reaction?.documentId === 'string' || typeof reaction?.documentId === 'number') {
    return `custom:${String(reaction.documentId)}`;
  }
  try {
    return JSON.stringify(reaction);
  } catch {
    return 'unknown';
  }
}

/**
 * Сохранить статистику канала в БД
 */
async function saveChannelStats(
  channelId: string,
  date: string,
  stats: {
    subscribers_count: number;
  }
): Promise<void> {
  const { data: existingToday } = await (supabaseAdmin
    .from('channel_analytics') as any)
    .select('subscribers_count, subscribers_gained, subscribers_lost')
    .eq('channel_id', channelId)
    .eq('date', date)
    .limit(1);

  let subscribersGained = 0;
  let subscribersLost = 0;

  if (existingToday?.[0]) {
    const prevCount = Number(existingToday[0].subscribers_count || 0);
    const delta = Number(stats.subscribers_count) - prevCount;
    const prevGained = Number(existingToday[0].subscribers_gained || 0);
    const prevLost = Number(existingToday[0].subscribers_lost || 0);
    subscribersGained = prevGained + Math.max(0, delta);
    subscribersLost = prevLost + Math.max(0, -delta);
  } else {
    const { data: prevStats } = await (supabaseAdmin
      .from('channel_analytics') as any)
      .select('subscribers_count')
      .eq('channel_id', channelId)
      .lt('date', date)
      .order('date', { ascending: false })
      .limit(1);

    const previousSubscribers = Number(prevStats?.[0]?.subscribers_count ?? stats.subscribers_count);
    subscribersGained = Math.max(0, stats.subscribers_count - previousSubscribers);
    subscribersLost = Math.max(0, previousSubscribers - stats.subscribers_count);
  }

  const dayStart = `${date}T00:00:00.000Z`;
  const dayEnd = `${date}T23:59:59.999Z`;

  const { data: tgPosts } = await (supabaseAdmin
    .from('telegram_post_analytics') as any)
    .select('views_count')
    .eq('channel_id', channelId)
    .gte('posted_at', dayStart)
    .lte('posted_at', dayEnd)
    .limit(2000);

  const postsCount = (tgPosts || []).length;
  const viewsTotal = (tgPosts || []).reduce((sum: number, r: any) => sum + (r.views_count || 0), 0);

  // Upsert статистики
  const { error } = await (supabaseAdmin
    .from('channel_analytics') as any)
    .upsert(
      {
        channel_id: channelId,
        date,
        subscribers_count: stats.subscribers_count,
        subscribers_gained: subscribersGained,
        subscribers_lost: subscribersLost,
        views_total: viewsTotal,
        posts_published: postsCount || 0,
      },
      {
        onConflict: 'channel_id,date',
      }
    );
  if (error) {
    throw new Error(`Failed to upsert channel_analytics: ${error.message || String(error)}`);
  }
}

async function getSubscribersCountWithClient(client: any, channelEntity: any): Promise<number | null> {
  try {
    const fullChannel = await client.invoke(
      new Api.channels.GetFullChannel({
        channel: channelEntity,
      })
    );

    return Number((fullChannel.fullChat as any).participantsCount || 0);
  } catch (error) {
    console.error('Ошибка получения количества подписчиков:', error);
    return null;
  }
}

type SubscribersTimelinePoint = { date: string; subscribers: number };

async function getSubscribersTimelineFromTelegram(
  client: any,
  channelEntity: any
): Promise<SubscribersTimelinePoint[]> {
  try {
    const stats = await client.invoke(
      new Api.stats.GetBroadcastStats({
        channel: channelEntity,
      })
    );

    const graph = (stats as any)?.followersGraph;
    const json = await resolveStatsGraphJson(client, graph);
    if (!json) return [];

    const points = extractDailySeriesFromStatsGraphJson(json);
    return points;
  } catch {
    return [];
  }
}

async function resolveStatsGraphJson(client: any, graph: any): Promise<string | null> {
  if (!graph) return null;

  // StatsGraph
  if (typeof graph?.json === 'string' && graph.json.length > 0) {
    return graph.json;
  }

  // StatsGraphAsync
  if (typeof graph?.token === 'string' && graph.token.length > 0) {
    try {
      const loaded = await client.invoke(
        new Api.stats.LoadAsyncGraph({
          token: graph.token,
        })
      );
      if (typeof (loaded as any)?.json === 'string' && (loaded as any).json.length > 0) {
        return (loaded as any).json;
      }
    } catch {
      return null;
    }
  }

  return null;
}

function extractDailySeriesFromStatsGraphJson(json: string): SubscribersTimelinePoint[] {
  let graphData: any = null;
  try {
    graphData = JSON.parse(json);
  } catch {
    return [];
  }

  const columns: any[] = Array.isArray(graphData?.columns) ? graphData.columns : [];
  if (columns.length < 2) return [];

  const types = graphData?.types && typeof graphData.types === 'object' ? graphData.types : {};
  const xKey = Object.keys(types).find(k => types[k] === 'x') || 'x';
  const yKey =
    Object.keys(types).find(k => types[k] === 'line' && k !== xKey) ||
    Object.keys(types).find(k => k !== xKey) ||
    null;

  if (!yKey) return [];

  const xColumn = columns.find((c: any) => Array.isArray(c) && c[0] === xKey);
  const yColumn = columns.find((c: any) => Array.isArray(c) && c[0] === yKey);

  if (!Array.isArray(xColumn) || !Array.isArray(yColumn)) return [];

  const xValues = xColumn.slice(1).map((v: any) => Number(v)).filter((v: number) => Number.isFinite(v));
  const yValues = yColumn.slice(1).map((v: any) => Number(v)).filter((v: number) => Number.isFinite(v));
  const len = Math.min(xValues.length, yValues.length);
  if (len <= 0) return [];

  const byDate = new Map<string, number>();
  for (let i = 0; i < len; i++) {
    const x = xValues[i];
    const y = yValues[i];
    const ms = x > 2e10 ? x : x * 1000;
    const date = new Date(ms).toISOString().slice(0, 10);
    byDate.set(date, Math.max(0, Math.round(y)));
  }

  return Array.from(byDate.entries())
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
    .map(([date, subscribers]) => ({ date, subscribers }));
}

function listDates(startDate: string, endDate: string): string[] {
  const start = new Date(`${startDate}T00:00:00.000Z`);
  const end = new Date(`${endDate}T00:00:00.000Z`);
  const dates: string[] = [];

  if (!(start instanceof Date) || isNaN(start.getTime())) return dates;
  if (!(end instanceof Date) || isNaN(end.getTime())) return dates;

  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    dates.push(new Date(d).toISOString().slice(0, 10));
  }

  return dates;
}

/**
 * Получить статистику канала из БД за период
 */
export async function getChannelStatsFromDB(
  channelId: string,
  startDate: string,
  endDate: string
): Promise<{
  totalSubscribers: number;
  subscribersGained: number;
  subscribersLost: number;
  totalViews: number;
  totalPosts: number;
  dailyStats: ChannelAnalyticsRow[];
  baseSubscribers: number;
}> {
  const { data: stats } = await (supabaseAdmin
    .from('channel_analytics') as any)
    .select('*')
    .eq('channel_id', channelId)
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date', { ascending: true });

  const { data: baseStats } = await (supabaseAdmin
    .from('channel_analytics') as any)
    .select('subscribers_count')
    .eq('channel_id', channelId)
    .lt('date', startDate)
    .order('date', { ascending: false })
    .limit(1);

  const baseSubscribers = Number(baseStats?.[0]?.subscribers_count || 0);

  const typedStats = (stats || []) as ChannelAnalyticsRow[];
  const latestStats = typedStats.length > 0 ? typedStats[typedStats.length - 1] : null;
  const totals = typedStats.reduce(
    (acc: { subscribersGained: number; subscribersLost: number }, stat) => ({
      subscribersGained: acc.subscribersGained + (stat.subscribers_gained || 0),
      subscribersLost: acc.subscribersLost + (stat.subscribers_lost || 0),
    }),
    { subscribersGained: 0, subscribersLost: 0 }
  );

  const rangeStart = `${startDate}T00:00:00.000Z`;
  const rangeEnd = `${endDate}T23:59:59.999Z`;

  const { data: tgPosts } = await (supabaseAdmin
    .from('telegram_post_analytics') as any)
    .select('views_count')
    .eq('channel_id', channelId)
    .gte('posted_at', rangeStart)
    .lte('posted_at', rangeEnd)
    .limit(5000);

  const totalViews = (tgPosts || []).reduce((sum: number, r: any) => sum + (r.views_count || 0), 0);
  const totalPosts = (tgPosts || []).length;

  return {
    totalSubscribers: latestStats?.subscribers_count || 0,
    subscribersGained: totals.subscribersGained,
    subscribersLost: totals.subscribersLost,
    totalViews,
    totalPosts,
    dailyStats: typedStats,
    baseSubscribers,
  };
}

/**
 * Получить общую статистику всех каналов
 */
export async function getAllChannelsStats(
  startDate: string,
  endDate: string
): Promise<{
  totalSubscribers: number;
  subscribersGained: number;
  subscribersLost: number;
  totalViews: number;
  totalPosts: number;
  subscribersTimeline: Array<{
    date: string;
    subscribers: number;
    gained: number;
    lost: number;
  }>;
  channels: Array<{
    id: string;
    name: string;
    subscribers: number;
    gained: number;
    lost: number;
    posts: number;
  }>;
}> {
  // Получить все активные каналы
  const { data: channels } = await (supabaseAdmin
    .from('channels') as any)
    .select('id, name')
    .eq('is_active', true);

  if (!channels || channels.length === 0) {
    return {
      totalSubscribers: 0,
      subscribersGained: 0,
      subscribersLost: 0,
      totalViews: 0,
      totalPosts: 0,
      subscribersTimeline: [],
      channels: [],
    };
  }

  const days = listDates(startDate, endDate);
  const timeline = days.map(date => ({ date, subscribers: 0, gained: 0, lost: 0 }));
  const timelineByDate = new Map<string, { date: string; subscribers: number; gained: number; lost: number }>();
  for (const t of timeline) timelineByDate.set(t.date, t);

  let totalSubscribers = 0;
  let subscribersGained = 0;
  let subscribersLost = 0;
  let totalViews = 0;
  let totalPosts = 0;
  const channelStats = [];

  for (const channel of channels) {
    const stats = await getChannelStatsFromDB(channel.id, startDate, endDate);

    totalSubscribers += stats.totalSubscribers;
    subscribersGained += stats.subscribersGained;
    subscribersLost += stats.subscribersLost;
    totalViews += stats.totalViews;
    totalPosts += stats.totalPosts;

    const dailyByDate = new Map<string, ChannelAnalyticsRow>();
    for (const row of stats.dailyStats) {
      if (row?.date) dailyByDate.set(row.date, row);
    }

    let lastSubscribers = stats.baseSubscribers;
    for (const date of days) {
      const row = dailyByDate.get(date);
      if (row && row.subscribers_count !== null && row.subscribers_count !== undefined) {
        lastSubscribers = Number(row.subscribers_count || 0);
      }

      const t = timelineByDate.get(date);
      if (!t) continue;
      t.subscribers += lastSubscribers;
      t.gained += Number(row?.subscribers_gained || 0);
      t.lost += Number(row?.subscribers_lost || 0);
    }

    channelStats.push({
      id: channel.id,
      name: channel.name,
      subscribers: stats.totalSubscribers,
      gained: stats.subscribersGained,
      lost: stats.subscribersLost,
      posts: stats.totalPosts,
    });
  }

  return {
    totalSubscribers,
    subscribersGained,
    subscribersLost,
    totalViews,
    totalPosts,
    subscribersTimeline: timeline,
    channels: channelStats,
  };
}

export async function syncPostsAnalyticsByPostIds(
  postIds: string[],
  limit: number = 20
): Promise<{ synced: number; failed: number; errors: string[] }> {
  const authorized = await isAuthorized();
  if (!authorized) {
    return { synced: 0, failed: 0, errors: ['Telegram не авторизован'] };
  }

  const ids = postIds.filter(Boolean).slice(0, Math.max(1, limit));
  if (ids.length === 0) return { synced: 0, failed: 0, errors: [] };

  const { data: posts, error: postsError } = await (supabaseAdmin
    .from('posts') as any)
    .select('id, channels(telegram_chat_id, name)')
    .in('id', ids);

  if (postsError) {
    return { synced: 0, failed: 0, errors: ['Ошибка загрузки постов'] };
  }

  const channelByPostId = new Map<string, string>();
  for (const p of posts || []) {
    const chatId = p.channels?.telegram_chat_id;
    if (p.id && typeof chatId === 'string' && chatId.length > 0) {
      channelByPostId.set(p.id, chatId);
    }
  }

  const { data: analyticsRows, error: analyticsError } = await (supabaseAdmin
    .from('post_analytics') as any)
    .select('post_id, telegram_message_id')
    .in('post_id', ids)
    .not('telegram_message_id', 'is', null);

  if (analyticsError) {
    return { synced: 0, failed: 0, errors: ['Ошибка загрузки post_analytics'] };
  }

  let synced = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const row of analyticsRows || []) {
    try {
      const postId = row.post_id as string;
      const messageId = Number(row.telegram_message_id);
      const channelRef = channelByPostId.get(postId);

      if (!channelRef || !Number.isFinite(messageId) || messageId <= 0) {
        continue;
      }

      const stats = await getPostStatsByMessage(channelRef, messageId);
      if (!stats) {
        failed++;
        continue;
      }

      await savePostAnalytics(postId, messageId, stats);
      synced++;
    } catch (e: any) {
      failed++;
      errors.push(e?.message || 'Ошибка синка поста');
    }

    await new Promise(resolve => setTimeout(resolve, 300));
  }

  return { synced, failed, errors };
}
