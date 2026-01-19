# Telegram Bots - AI Система Управления Контентом

## Описание Проекта

Это **админ панель** для управления Telegram каналами с AI-генерацией контента на разные тематики.

### Как Это Работает

1. **Управление Каналами**: Создаются Telegram каналы на разные тематики
2. **Парсинг Контента**: AI парсит контент из:
   - Указанных платформ и сайтов
   - Исходных Telegram каналов (ссылки предоставляет пользователь)
3. **Генерация Постов**: AI анализирует спарсенную информацию и пишет посты
4. **Просмотр в Админ Панели**: Готовые посты появляются в админ панели для проверки
5. **Редактирование Постов**: Пользователь может:
   - Редактировать посты через встроенный редактор
   - Выделить часть текста и попросить AI заменить/изменить её
   - Дать инструкции для замены текста (например, "замени это на...")

---

## Правила Разработки

### 1. Постоянно Обновлять Этот Файл
**ВАЖНО**: Файл CLAUDE.md должен постоянно дополняться в процессе разработки:
- Добавлять новые функции по мере их реализации
- Документировать архитектурные решения
- Отслеживать API endpoints и структуры данных
- Записывать связи между компонентами
- Фиксировать важные паттерны и соглашения

### 2. Компонентная Архитектура
**Все файлы должны быть разделены на маленькие, управляемые компоненты:**
- Разбивать большие файлы на маленькие, сфокусированные модули
- Каждый компонент должен иметь одну ответственность
- Избегать монолитных файлов
- Создавать логическое разделение задач

---

## Технологический Стек

### Frontend
- **Next.js 16.1.3** - React фреймворк с App Router
- **React 19.2.3** - UI библиотека
- **TypeScript 5** - Статическая типизация
- **Tailwind CSS 4** - Утилит-первый CSS фреймворк
- **Tiptap 2.27** - Rich Text Editor
- **date-fns 3.6** - Работа с датами
- **clsx 2.1** - Утилита для классов

### Backend
- **Supabase** - Backend as a Service (PostgreSQL + Auth)
- **bcryptjs 2.4** - Хеширование паролей
- **nanoid 5.1** - Генерация уникальных ID

### DevTools
- **tsx 4.21** - Запуск TypeScript скриптов
- **ESLint 9** - Линтинг кода

---

## Архитектура

### Структура Проекта

```
/app
  /auth/login                    # Страница логина
  /dashboard                     # История постов
  /editor/[postId]              # Редактор постов
  /api
    /auth                        # API аутентификации
    /posts                       # API постов
    /channels                    # API каналов

/components
  /ui                            # Базовые UI компоненты
  /layout                        # Layout компоненты

/lib
  /supabase                      # Supabase клиенты
  /utils                         # Утилиты

/styles                          # Глобальные стили

/scripts                         # CLI скрипты

/supabase                        # SQL миграции
```

### Принципы Архитектуры

1. **Компонентная структура** - каждый файл < 200 строк
2. **Server/Client разделение** - использование Server Components где возможно
3. **API Routes** - RESTful API через Next.js route handlers
4. **Типобезопасность** - строгие TypeScript типы для всего
5. **Middleware** - защита роутов через middleware

---

## Схема Базы Данных

### Таблица `users`
```sql
id           UUID PRIMARY KEY
email        TEXT UNIQUE NOT NULL
password_hash TEXT NOT NULL
role         TEXT DEFAULT 'admin'
created_at   TIMESTAMP DEFAULT NOW()
```

### Таблица `invite_tokens`
```sql
id          UUID PRIMARY KEY
token       TEXT UNIQUE NOT NULL
used        BOOLEAN DEFAULT FALSE
used_by     UUID FK -> users.id
created_at  TIMESTAMP DEFAULT NOW()
expires_at  TIMESTAMP NOT NULL
```
**Индексы**: token, used

### Таблица `channels`
```sql
id             UUID PRIMARY KEY
name           TEXT NOT NULL
telegram_link  TEXT NOT NULL
topic          TEXT NOT NULL
description    TEXT
is_active      BOOLEAN DEFAULT TRUE
created_at     TIMESTAMP DEFAULT NOW()
updated_at     TIMESTAMP DEFAULT NOW()
```
**Индексы**: is_active

### Таблица `posts`
```sql
id            UUID PRIMARY KEY
channel_id    UUID FK -> channels.id
title         TEXT
content       JSONB NOT NULL
plain_text    TEXT NOT NULL
status        TEXT CHECK (pending, published, rejected, draft)
scheduled_at  TIMESTAMP
published_at  TIMESTAMP
created_at    TIMESTAMP DEFAULT NOW()
updated_at    TIMESTAMP DEFAULT NOW()
```
**Индексы**: channel_id, status, created_at DESC, plain_text (GIN)

### Таблица `sources`
```sql
id              UUID PRIMARY KEY
channel_id      UUID FK -> channels.id
name            TEXT NOT NULL
type            TEXT CHECK (telegram, website, rss)
url             TEXT NOT NULL
last_parsed_at  TIMESTAMP
is_active       BOOLEAN DEFAULT TRUE
created_at      TIMESTAMP DEFAULT NOW()
updated_at      TIMESTAMP DEFAULT NOW()
```
**Индексы**: channel_id

### Таблица `channel_analytics`
```sql
id                UUID PRIMARY KEY
channel_id        UUID FK -> channels.id
date              DATE NOT NULL
subscribers_count INTEGER DEFAULT 0
subscribers_gained INTEGER DEFAULT 0
subscribers_lost  INTEGER DEFAULT 0
views_total       INTEGER DEFAULT 0
posts_published   INTEGER DEFAULT 0
created_at        TIMESTAMP DEFAULT NOW()
```
**Индексы**: channel_id, date DESC
**Уникальность**: channel_id + date

### Таблица `post_analytics`
```sql
id                  UUID PRIMARY KEY
post_id             UUID FK -> posts.id
telegram_message_id BIGINT
views_count         INTEGER DEFAULT 0
reactions_count     INTEGER DEFAULT 0
forwards_count      INTEGER DEFAULT 0
shares_count        INTEGER DEFAULT 0
created_at          TIMESTAMP DEFAULT NOW()
updated_at          TIMESTAMP DEFAULT NOW()
```
**Индексы**: post_id, views_count DESC

### Таблица `telegram_sessions`
```sql
id              UUID PRIMARY KEY
session_string  TEXT NOT NULL
phone_number    TEXT
is_active       BOOLEAN DEFAULT TRUE
created_at      TIMESTAMP DEFAULT NOW()
updated_at      TIMESTAMP DEFAULT NOW()
```

---

## API Endpoints

### Аутентификация

#### `POST /api/auth/verify-token`
Проверка инвайт-токена
```json
Request: { "token": "string" }
Response: { "valid": true, "token": "string" }
```

#### `POST /api/auth/login`
Вход в систему
```json
Request: {
  "token": "string",
  "email": "string",
  "password": "string"
}
Response: {
  "success": true,
  "user": { "id", "email", "role" }
}
```

#### `POST /api/auth/logout`
Выход из системы
```json
Response: { "success": true }
```

#### `GET /api/auth/me`
Получение текущего пользователя
```json
Response: {
  "user": { "id", "email", "role", "created_at" }
}
```

### Посты

#### `GET /api/posts`
Получение списка постов с фильтрацией
```
Query Params:
  - channel_id: UUID (опционально)
  - status: string (опционально)
  - search: string (опционально)
  - sort_by: string (default: created_at)
  - sort_order: asc|desc (default: desc)
  - page: number (default: 1)
  - limit: number (default: 20)

Response: {
  "posts": [...],
  "pagination": {
    "page", "limit", "total", "totalPages"
  }
}
```

#### `POST /api/posts`
Создание нового поста
```json
Request: {
  "channel_id": "UUID",
  "title": "string" (optional),
  "content": JSON,
  "plain_text": "string",
  "status": "draft|pending|published|rejected"
}
Response: { "post": {...} }
```

#### `GET /api/posts/[id]`
Получение поста по ID
```json
Response: {
  "post": {
    "id", "title", "content", "plain_text",
    "status", "created_at", "updated_at",
    "channels": { "id", "name", "topic", "telegram_link" }
  }
}
```

#### `PATCH /api/posts/[id]`
Обновление поста
```json
Request: {
  "title"?: "string",
  "content"?: JSON,
  "plain_text"?: "string",
  "status"?: "string",
  "published_at"?: "timestamp"
}
Response: { "post": {...} }
```

#### `DELETE /api/posts/[id]`
Удаление поста
```json
Response: { "success": true }
```

### Каналы

#### `GET /api/channels`
Получение списка каналов
```json
Response: {
  "channels": [{
    "id", "name", "telegram_link",
    "topic", "description", "is_active",
    "created_at", "updated_at"
  }]
}
```

#### `POST /api/channels`
Создание нового канала
```json
Request: {
  "name": "string",
  "telegram_link": "string" (API токен от @BotFather),
  "topic": "string",
  "description": "string" (optional)
}
Response: { "channel": {...} }
Errors:
  - 400: Валидация не пройдена (отсутствуют обязательные поля)
  - 400: Неверный формат API токена
```

#### `PATCH /api/channels/[id]`
Обновление канала
```json
Request: {
  "name"?: "string",
  "telegram_link"?: "string",
  "topic"?: "string",
  "description"?: "string",
  "is_active"?: boolean
}
Response: { "channel": {...} }
```

#### `DELETE /api/channels/[id]`
Удаление канала
```json
Response: { "success": true }
```

### Источники

#### `GET /api/sources`
Получение списка источников
```json
Response: {
  "sources": [{
    "id", "name", "type", "url", "channel_id",
    "is_active", "last_parsed_at",
    "created_at", "updated_at",
    "channels": { "name", "topic" }
  }]
}
```

#### `POST /api/sources`
Создание нового источника
```json
Request: {
  "name": "string",
  "type": "telegram | website | rss",
  "url": "string" (URL источника),
  "channel_id": "UUID"
}
Response: { "source": {...} }
Errors:
  - 400: Валидация не пройдена (отсутствуют обязательные поля)
  - 400: Неверный тип источника
  - 400: Неверный формат URL
```

#### `PATCH /api/sources/[id]`
Обновление источника
```json
Request: {
  "name"?: "string",
  "type"?: "string",
  "url"?: "string",
  "is_active"?: boolean
}
Response: { "source": {...} }
```

#### `DELETE /api/sources/[id]`
Удаление источника
```json
Response: { "success": true }
```

### Аналитика

#### `GET /api/analytics/channels`
Получение общей аналитики по всем каналам
```
Query Params:
  - period: today|week|month|year (default: week)

Response: {
  "period": "week",
  "startDate": "2025-01-12",
  "endDate": "2025-01-19",
  "totalSubscribers": 12450,
  "subscribersGained": 234,
  "totalViews": 45200,
  "totalPosts": 156,
  "channels": [{
    "id", "name", "subscribers", "gained", "posts"
  }]
}
```

#### `POST /api/analytics/sync`
Синхронизация статистики с Telegram
```json
Response: {
  "success": true,
  "synced": 3,
  "failed": 0,
  "errors": [],
  "message": "Синхронизировано 3 каналов"
}
```

### Telegram Авторизация

#### `GET /api/telegram/status`
Получение статуса подключения Telegram
```json
Response: {
  "connected": true,
  "authorized": true,
  "phoneNumber": "+79991234567"
}
```

#### `POST /api/telegram/auth`
Отправка кода авторизации
```json
Request: { "phoneNumber": "+79991234567" }
Response: {
  "success": true,
  "phoneCodeHash": "abc123...",
  "message": "Код отправлен на указанный номер"
}
```

#### `POST /api/telegram/verify`
Подтверждение кода авторизации
```json
Request: {
  "phoneNumber": "+79991234567",
  "phoneCode": "12345",
  "phoneCodeHash": "abc123...",
  "password": "2fa-password" (optional)
}
Response: {
  "success": true,
  "message": "Telegram успешно подключен"
}
```

---

## Структура Компонентов

### UI Компоненты (`/components/ui`)
- **Button.tsx** - Кнопка (4 варианта, 3 размера, loading state)
- **Input.tsx** - Поле ввода (с label, error, helper text)
- **Card.tsx** - Карточка (2 варианта, 4 размера padding)
- **Badge.tsx** - Бейдж (5 вариантов цвета, 3 размера)
- **Modal.tsx** - Модальное окно (4 размера, ESC закрытие)
- **Loader.tsx** - Индикатор загрузки (3 размера)
- **Select.tsx** - Выпадающий список (с label, error)

### Layout Компоненты (`/components/layout`)
- **Sidebar.tsx** - Боковая навигация (logo, меню, профиль пользователя)
  - Фиксированная слева (width: 288px)
  - Навигация: Dashboard, Каналы, Источники, Аналитика
  - Подсветка активной страницы
  - Информация о пользователе внизу

### Страница Логина (`/app/auth/login`)
- **LoginForm.tsx** - Форма входа (2 шага: токен + credentials)

### Dashboard (`/app/dashboard`)
- **PostList.tsx** - Список постов (загрузка, фильтры, состояние)
- **PostCard.tsx** - Карточка поста (превью, статус, даты)
- **Filters.tsx** - Фильтры (канал, статус, сортировка)
- **SearchBar.tsx** - Поиск с debounce (300ms)
- **StatusBadge.tsx** - Бейдж статуса поста

### Редактор (`/app/editor/[postId]`)
- **RichEditor.tsx** - Tiptap редактор (автосохранение, выделение)
- **EditorToolbar.tsx** - Панель инструментов (жирный, курсив, списки, заголовки)
- **AIModal.tsx** - AI модалка при выделении (инпут для инструкций)
- **ActionButtons.tsx** - Действия (сохранить, пересоздать, опубликовать)

### Каналы (`/app/channels`)
- **ChannelsList.tsx** - Список каналов (загрузка, пустое состояние, кнопка добавления)
  - Отображает каналы в grid-сетке
  - Счетчик количества каналов
  - Skeleton loader при загрузке
  - Empty state с призывом добавить первый канал
- **ChannelCard.tsx** - Карточка канала (информация, действия)
  - Название канала и тематика
  - Статус (активен/неактивен)
  - Описание канала
  - API токен с кнопкой копирования
  - Кнопки активации/деактивации и удаления
- **AddChannelModal.tsx** - Модальное окно создания канала
  - Форма с полями: название, API токен, тематика, описание
  - Валидация обязательных полей
  - Подсказки для пользователя
  - Обработка ошибок

### Источники (`/app/sources`)
- **SourcesList.tsx** - Список источников (загрузка, пустое состояние, кнопка добавления)
  - Отображает источники в grid-сетке
  - Счетчик количества источников
  - Skeleton loader при загрузке
  - Empty state с призывом добавить первый источник
- **SourceCard.tsx** - Карточка источника (информация, действия)
  - Название источника и тип (Telegram, Веб-сайт, RSS)
  - Привязанный канал (badge)
  - Статус (активен/неактивен)
  - URL с кнопкой копирования
  - Информация о последнем парсинге
  - Кнопки активации/деактивации и удаления
- **AddSourceModal.tsx** - Модальное окно создания источника
  - Форма с полями: название, тип, URL, выбор канала
  - Dropdown для выбора типа источника (Telegram/Website/RSS)
  - Select для выбора канала
  - Динамическая подсказка для URL в зависимости от типа
  - Валидация URL формата
  - Обработка ошибок

### Аналитика (`/app/analytics`)
- **page.tsx** - Главная страница аналитики
  - Выбор периода (сегодня, неделя, месяц, год)
  - Карточки с общей статистикой
  - Таблица статистики по каналам
  - Кнопка синхронизации с Telegram
- **components/StatsCards.tsx** - Карточки с числами
  - Подписчики (текущее + прирост)
  - Просмотры
  - Количество постов
- **components/ChannelStats.tsx** - Таблица статистики каналов
  - Название канала
  - Количество подписчиков
  - Прирост за период
  - Количество постов
- **components/PeriodSelector.tsx** - Переключатель периода

### Настройки Telegram (`/app/settings/telegram`)
- **page.tsx** - Страница авторизации Telegram
  - Шаг 1: Ввод номера телефона
  - Шаг 2: Ввод кода подтверждения
  - Шаг 3: Ввод 2FA пароля (если включен)
  - Успешное подключение: ссылка на аналитику

---

## Функциональность

### Аутентификация
1. Пользователь получает инвайт-токен через CLI
2. Переходит по URL с токеном: `/auth/login?token=xxx`
3. Вводит email и пароль
4. Токен проверяется и помечается как использованный
5. Создается HTTP-only куки с user_id (30 дней)

### История Постов
1. Загрузка постов через API `/api/posts`
2. Фильтрация по:
   - Каналу (dropdown)
   - Статусу (pending, published, rejected, draft)
   - Поиску по тексту (debounce 300ms)
3. Сортировка по дате (новые/старые)
4. Пагинация (20 постов на страницу)
5. Клик на пост → переход в редактор

### Редактор Постов
1. Загрузка поста через API `/api/posts/[id]`
2. Отображение:
   - Информация о канале
   - Поле заголовка
   - Rich Text редактор (Tiptap)
3. Автосохранение контента
4. Выделение текста → показ AI модалки
5. Кнопки:
   - **Сохранить** - сохранение через PATCH `/api/posts/[id]`
   - **Пересоздать** - пока заглушка
   - **Опубликовать** - изменение статуса на published

### AI Модалка (заглушка)
1. При выделении текста показывается модалка
2. Отображает выделенный текст
3. Инпут для ввода инструкций
4. Кнопка "Применить" (пока alert)
5. Закрытие по клику вне или ESC

### Управление Каналами
1. Загрузка списка каналов через API `/api/channels`
2. Отображение каналов в grid-сетке с информацией:
   - Название и тематика канала
   - Статус активности (активен/неактивен)
   - Описание канала (опционально)
   - API токен бота с функцией копирования
3. Создание нового канала:
   - Клик на кнопку "Добавить канал"
   - Открытие модального окна с формой
   - Заполнение обязательных полей: название, API токен (от @BotFather), тематика
   - Опциональное описание для AI контекста
   - Валидация формата токена (должен содержать ":" и быть длиной >20 символов)
   - POST запрос к `/api/channels`
4. Управление каналом:
   - **Активация/Деактивация** - переключение статуса через PATCH `/api/channels/[id]`
   - **Удаление** - удаление канала через DELETE `/api/channels/[id]` с подтверждением
5. AI использует всю информацию о канале (название, токен, тематику, описание) для понимания контекста и генерации подходящего контента

### Управление Источниками
1. Загрузка списка источников через API `/api/sources`
2. Отображение источников в grid-сетке с информацией:
   - Название источника и тип (Telegram канал, Веб-сайт, RSS лента)
   - Привязанный канал (badge)
   - Статус активности (активен/неактивен)
   - URL источника с функцией копирования
   - Информация о последнем парсинге (если был)
3. Создание нового источника:
   - Клик на кнопку "Добавить источник"
   - Открытие модального окна с формой
   - Заполнение полей:
     - **Название** - название источника (обязательно)
     - **Тип** - выбор из dropdown: Веб-сайт, Telegram канал, RSS лента (обязательно)
     - **URL** - ссылка на источник с валидацией формата (обязательно)
     - **Канал** - выбор канала из списка (обязательно)
   - Динамическая подсказка для URL в зависимости от выбранного типа
   - POST запрос к `/api/sources`
4. Управление источником:
   - **Активация/Деактивация** - переключение статуса через PATCH `/api/sources/[id]`
   - **Удаление** - удаление источника через DELETE `/api/sources/[id]` с подтверждением
5. AI парсит контент из активных источников для генерации постов

---

## CLI Приложение

### Запуск
```bash
npm run create-user
```

### Функции

#### 1. Создание пользователя
- Ввод email и пароля
- Хеширование пароля (bcrypt)
- Сохранение в таблицу `users`

#### 2. Генерация инвайт-токена
- Генерация токена (nanoid 32 символа)
- Установка срока действия (по умолчанию 7 дней)
- Сохранение в таблицу `invite_tokens`

#### 3. Генерация URL с токеном
- Генерация токена
- Создание полного URL: `{APP_URL}/auth/login?token={token}`
- Вывод ссылки для копирования

---

## Настройка и Запуск

### 1. Установка зависимостей
```bash
npm install
```

### 2. Настройка Supabase
1. Создать проект на [supabase.com](https://supabase.com)
2. Скопировать `.env.example` в `.env.local`
3. Заполнить переменные окружения:
```env
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx
SUPABASE_SERVICE_ROLE_KEY=xxx
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 3. Выполнение миграции
1. Открыть `SQL Editor` в Supabase
2. Скопировать содержимое `supabase/migrations/001_initial_schema.sql`
3. Выполнить SQL запрос

### 4. Создание первого пользователя
```bash
npm run create-user
```
Выбрать опцию 3 "Сгенерировать URL с токеном"

### 5. Запуск dev сервера
```bash
npm run dev
```
Открыть URL с токеном из предыдущего шага

---

## Статусы Постов

- **pending** - В ожидании (пост создан AI, ждет проверки)
- **published** - Опубликовано (пост одобрен и опубликован)
- **rejected** - Отклонено (пост отклонен)
- **draft** - Черновик (пост в процессе редактирования)

---

## Темная Тема

Все UI компоненты используют CSS переменные из `styles/theme.css`:

```css
--background      # Фон страницы
--foreground      # Основной текст
--surface         # Фон карточек
--surface-hover   # Hover состояние
--border          # Границы
--primary         # Акцентный цвет
--success         # Успех (зеленый)
--warning         # Предупреждение (оранжевый)
--error           # Ошибка (красный)
--text-secondary  # Вторичный текст
--text-tertiary   # Третичный текст
```

---

## Безопасность

1. **HTTP-only куки** - сессии хранятся в HTTP-only куках
2. **Middleware** - все роуты защищены middleware
3. **Хеширование паролей** - bcrypt с 10 раундами
4. **RLS Policies** - Row Level Security в Supabase
5. **Валидация** - проверка данных на клиенте и сервере
6. **CSRF защита** - через SameSite куки

---

## Следующие Шаги (TODO)

### AI Интеграция
- [ ] Подключить AI для парсинга новостей
- [ ] Реализовать генерацию постов
- [ ] Подключить AI для редактирования выделенного текста
- [ ] Добавить функцию "Пересоздать пост"

### Парсинг
- [ ] Создать парсеры для разных источников
- [ ] Настроить cron для автоматического парсинга
- [ ] Добавить фильтрацию контента

### Публикация
- [ ] Интеграция с Telegram Bot API
- [ ] Автоматическая публикация в каналы
- [ ] Планирование публикаций

### UI/UX Улучшения
- [ ] Добавить уведомления (toast)
- [ ] Реализовать drag & drop для изображений
- [ ] Добавить превью поста для Telegram
- [ ] Темы: светлая/темная переключение

### Управление
- [x] Страница управления каналами (CRUD) ✅
  - Список каналов с фильтрацией
  - Создание канала через модальное окно
  - Редактирование статуса (активация/деактивация)
  - Удаление канала с подтверждением
  - Копирование API токена
- [x] Страница управления источниками (CRUD) ✅
  - Список источников с отображением типа и канала
  - Создание источника через модальное окно
  - Выбор типа источника (Telegram/Website/RSS)
  - Привязка источника к каналу
  - Активация/деактивация источника
  - Удаление источника с подтверждением
  - Копирование URL
  - Отображение последнего парсинга
- [x] Аналитика по каналам и постам (TDLib) ✅
  - Страница аналитики с графиками
  - Статистика подписчиков (текущие, прирост, потери)
  - Статистика просмотров и постов
  - Выбор периода (день/неделя/месяц/год)
  - Синхронизация с Telegram через User API
  - Страница авторизации Telegram (/settings/telegram)
- [ ] Логи активности
