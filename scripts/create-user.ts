#!/usr/bin/env node

import dotenv from 'dotenv';
import { resolve } from 'path';
import * as readline from 'readline';
import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';
import { nanoid } from 'nanoid';
import type { Database } from '../types/database';

// Загрузка переменных окружения из .env.local
dotenv.config({ path: resolve(process.cwd(), '.env.local') });

// Цвета для консоли
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
};

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(query: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(query, resolve);
  });
}

function log(message: string, color: keyof typeof colors = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function main() {
  log('\n╔════════════════════════════════════════════╗', 'cyan');
  log('║   Telegram Bots - Управление Админами    ║', 'cyan');
  log('╚════════════════════════════════════════════╝\n', 'cyan');

  // Проверка переменных окружения
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    log('❌ Ошибка: Отсутствуют переменные окружения SUPABASE', 'red');
    log('Создайте файл .env.local с необходимыми ключами\n', 'yellow');
    rl.close();
    process.exit(1);
  }

  const supabase = createClient<Database>(supabaseUrl, supabaseKey);

  log('Выберите действие:', 'bright');
  log('1. Создать нового пользователя', 'blue');
  log('2. Сгенерировать инвайт-токен', 'blue');
  log('3. Сгенерировать URL с токеном', 'blue');
  log('4. Выход\n', 'blue');

  const choice = await question('Введите номер действия (1-4): ');

  switch (choice.trim()) {
    case '1':
      await createUser(supabase);
      break;
    case '2':
      await generateToken(supabase);
      break;
    case '3':
      await generateTokenUrl(supabase);
      break;
    case '4':
      log('\n👋 До свидания!\n', 'cyan');
      rl.close();
      process.exit(0);
      break;
    default:
      log('\n❌ Неверный выбор\n', 'red');
      rl.close();
      process.exit(1);
  }

  rl.close();
}

async function createUser(supabase: any) {
  log('\n📝 Создание нового пользователя\n', 'bright');

  const email = await question('Email: ');
  const password = await question('Пароль: ');

  if (!email || !password) {
    log('\n❌ Email и пароль обязательны\n', 'red');
    return;
  }

  // Хешируем пароль
  const passwordHash = await bcrypt.hash(password, 10);

  // Создаем пользователя
  const { data, error } = await supabase
    .from('users')
    .insert({
      email,
      password_hash: passwordHash,
      role: 'admin',
    })
    .select()
    .single();

  if (error) {
    log(`\n❌ Ошибка создания пользователя: ${error.message}\n`, 'red');
    return;
  }

  log('\n✅ Пользователь успешно создан!', 'green');
  log(`📧 Email: ${email}`, 'green');
  log(`🔑 ID: ${data.id}\n`, 'green');
}

async function generateToken(supabase: any) {
  log('\n🎫 Генерация инвайт-токена\n', 'bright');

  const token = nanoid(32);
  const expiresInDays = await question('Срок действия токена (дней, по умолчанию 7): ');
  const days = parseInt(expiresInDays) || 7;

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + days);

  const { data, error } = await supabase
    .from('invite_tokens')
    .insert({
      token,
      expires_at: expiresAt.toISOString(),
    })
    .select()
    .single();

  if (error) {
    log(`\n❌ Ошибка создания токена: ${error.message}\n`, 'red');
    return;
  }

  log('\n✅ Токен успешно создан!', 'green');
  log(`🎫 Токен: ${token}`, 'green');
  log(`⏰ Истекает: ${expiresAt.toLocaleString('ru-RU')}\n`, 'green');
}

async function generateTokenUrl(supabase: any) {
  log('\n🔗 Генерация URL с инвайт-токеном\n', 'bright');

  const token = nanoid(32);
  const expiresInDays = await question('Срок действия токена (дней, по умолчанию 7): ');
  const days = parseInt(expiresInDays) || 7;

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + days);

  const { error } = await supabase
    .from('invite_tokens')
    .insert({
      token,
      expires_at: expiresAt.toISOString(),
    });

  if (error) {
    log(`\n❌ Ошибка создания токена: ${error.message}\n`, 'red');
    return;
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const inviteUrl = `${appUrl}/auth/login?token=${token}`;

  log('\n✅ URL успешно создан!', 'green');
  log(`🔗 Ссылка для входа:\n`, 'green');
  log(`   ${inviteUrl}`, 'cyan');
  log(`\n⏰ Истекает: ${expiresAt.toLocaleString('ru-RU')}\n`, 'green');
}

// Обработка ошибок
process.on('unhandledRejection', (error: any) => {
  log(`\n❌ Ошибка: ${error.message}\n`, 'red');
  rl.close();
  process.exit(1);
});

// Запуск
main().catch((error) => {
  log(`\n❌ Критическая ошибка: ${error.message}\n`, 'red');
  rl.close();
  process.exit(1);
});
