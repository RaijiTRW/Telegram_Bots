# Настройка Supabase

## Шаги для настройки базы данных

### 1. Создайте проект в Supabase
1. Зайдите на [supabase.com](https://supabase.com)
2. Создайте новый проект
3. Запомните пароль базы данных

### 2. Получите ключи API
1. Перейдите в `Settings` → `API`
2. Скопируйте:
   - `Project URL` (NEXT_PUBLIC_SUPABASE_URL)
   - `anon public` key (NEXT_PUBLIC_SUPABASE_ANON_KEY)
   - `service_role` key (SUPABASE_SERVICE_ROLE_KEY) - **НИКОМУ НЕ ПОКАЗЫВАЙТЕ!**

### 3. Создайте .env.local файл
```bash
cp .env.example .env.local
```

Заполните переменные окружения:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 4. Выполните миграцию базы данных
1. Перейдите в `SQL Editor` в панели Supabase
2. Создайте новый запрос
3. Скопируйте содержимое файла `migrations/001_initial_schema.sql`
4. Вставьте и выполните запрос

### 5. Проверьте создание таблиц
Перейдите в `Table Editor` и убедитесь что созданы таблицы:
- users
- invite_tokens
- channels
- posts
- sources

## Готово!
Теперь ваша база данных настроена и готова к использованию.
