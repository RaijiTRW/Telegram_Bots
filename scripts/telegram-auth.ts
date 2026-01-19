/**
 * Скрипт авторизации в Telegram для получения session string
 * Запуск: npm run telegram-auth
 *
 * После успешной авторизации скопируйте session string в .env.local:
 * TELEGRAM_SESSION=полученная_строка
 */

import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';
import * as readline from 'readline';

// ============================================================================
// Утилита для чтения ввода
// ============================================================================

function createReadlineInterface() {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

async function question(rl: readline.Interface, prompt: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      resolve(answer);
    });
  });
}

// ============================================================================
// Главная функция
// ============================================================================

async function main() {
  const rl = createReadlineInterface();

  console.log('\n========================================');
  console.log('  Telegram MTProto Авторизация');
  console.log('========================================\n');

  console.log('Для работы парсера Telegram каналов нужны:');
  console.log('1. API ID и API Hash - получите на https://my.telegram.org');
  console.log('2. Номер телефона вашего Telegram аккаунта\n');

  // Получаем API ID
  const apiIdStr = await question(rl, 'Введите API ID: ');
  const apiId = parseInt(apiIdStr, 10);

  if (isNaN(apiId) || apiId <= 0) {
    console.error('Ошибка: Неверный API ID');
    rl.close();
    process.exit(1);
  }

  // Получаем API Hash
  const apiHash = await question(rl, 'Введите API Hash: ');

  if (!apiHash || apiHash.length < 10) {
    console.error('Ошибка: Неверный API Hash');
    rl.close();
    process.exit(1);
  }

  // Создаем клиент с пустой сессией
  const session = new StringSession('');
  const client = new TelegramClient(session, apiId, apiHash, {
    connectionRetries: 5,
  });

  console.log('\nПодключение к Telegram...');

  await client.start({
    phoneNumber: async () => {
      return await question(rl, 'Введите номер телефона (в формате +7...): ');
    },
    password: async () => {
      return await question(rl, 'Введите пароль 2FA (если есть, иначе Enter): ');
    },
    phoneCode: async () => {
      return await question(rl, 'Введите код из Telegram: ');
    },
    onError: (err) => {
      console.error('Ошибка:', err.message);
    },
  });

  console.log('\n✅ Авторизация успешна!\n');

  // Получаем session string
  const sessionString = client.session.save() as unknown as string;

  console.log('========================================');
  console.log('  Ваш SESSION STRING:');
  console.log('========================================\n');
  console.log(sessionString);
  console.log('\n========================================\n');

  console.log('Добавьте эти переменные в .env.local:\n');
  console.log(`TELEGRAM_API_ID=${apiId}`);
  console.log(`TELEGRAM_API_HASH=${apiHash}`);
  console.log(`TELEGRAM_SESSION=${sessionString}`);
  console.log('');

  // Отключаемся
  await client.disconnect();
  rl.close();

  console.log('✅ Готово! Теперь парсер сможет читать публичные Telegram каналы.\n');
}

// Запуск
main().catch((error) => {
  console.error('Критическая ошибка:', error);
  process.exit(1);
});
