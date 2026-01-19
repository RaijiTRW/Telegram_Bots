/**
 * Content Converter
 * Конвертация контента между разными форматами:
 * - Plain Text ↔ Tiptap JSON
 * - HTML → Plain Text
 */

// ============================================================================
// Типы Tiptap JSON
// ============================================================================

export interface TiptapContent {
  type: string;
  content?: TiptapContent[];
  text?: string;
  marks?: Array<{
    type: string;
    attrs?: Record<string, any>;
  }>;
  attrs?: Record<string, any>;
}

export interface TiptapDocument {
  type: 'doc';
  content: TiptapContent[];
}

// ============================================================================
// Plain Text → Tiptap JSON
// ============================================================================

/**
 * Конвертирует plain text в Tiptap JSON формат
 * Разбивает текст на параграфы и сохраняет структуру
 */
export function plainTextToTiptap(text: string): TiptapDocument {
  // Разбиваем на параграфы (по двойным переносам строк)
  const paragraphs = text.split(/\n\s*\n/).filter((p) => p.trim().length > 0);

  const content: TiptapContent[] = paragraphs.map((paragraph) => {
    const trimmedParagraph = paragraph.trim();

    // Проверяем, является ли это заголовком (начинается с emoji или короткий текст в начале)
    const isHeading = /^[^\n]{1,60}$/.test(trimmedParagraph) && paragraphs.length > 1 && paragraph === paragraphs[0];

    if (isHeading) {
      return {
        type: 'heading',
        attrs: { level: 2 },
        content: [
          {
            type: 'text',
            text: trimmedParagraph,
          },
        ],
      };
    }

    // Обычный параграф
    // Разбиваем на строки (одиночные переносы)
    const lines = trimmedParagraph.split('\n');

    if (lines.length === 1) {
      return {
        type: 'paragraph',
        content: [
          {
            type: 'text',
            text: trimmedParagraph,
          },
        ],
      };
    }

    // Если несколько строк, создаем параграф с hard breaks
    const paragraphContent: TiptapContent[] = [];

    lines.forEach((line, index) => {
      if (line.trim()) {
        paragraphContent.push({
          type: 'text',
          text: line,
        });
      }

      // Добавляем hard break между строками (кроме последней)
      if (index < lines.length - 1) {
        paragraphContent.push({
          type: 'hardBreak',
        });
      }
    });

    return {
      type: 'paragraph',
      content: paragraphContent,
    };
  });

  return {
    type: 'doc',
    content,
  };
}

// ============================================================================
// Tiptap JSON → Plain Text
// ============================================================================

/**
 * Конвертирует Tiptap JSON в plain text
 * Извлекает весь текстовый контент с сохранением структуры
 */
export function tiptapToPlainText(doc: TiptapDocument | TiptapContent): string {
  if (!doc || !doc.content) {
    return '';
  }

  const extractText = (node: TiptapContent): string => {
    // Если это текстовая нода
    if (node.type === 'text' && node.text) {
      return node.text;
    }

    // Если это hard break
    if (node.type === 'hardBreak') {
      return '\n';
    }

    // Если есть дочерние элементы
    if (node.content && Array.isArray(node.content)) {
      const childrenText = node.content.map(extractText).join('');

      // Добавляем перенос строки после параграфов и заголовков
      if (node.type === 'paragraph' || node.type === 'heading') {
        return childrenText + '\n\n';
      }

      return childrenText;
    }

    return '';
  };

  const text = doc.content.map(extractText).join('');

  // Убираем лишние переносы строк в конце
  return text.trim();
}

// ============================================================================
// HTML → Plain Text
// ============================================================================

/**
 * Конвертирует HTML в plain text
 * Удаляет все HTML теги и сохраняет только текстовый контент
 */
export function htmlToPlainText(html: string): string {
  if (!html) {
    return '';
  }

  // Заменяем <br>, <p>, <div> на переносы строк
  let text = html.replace(/<br\s*\/?>/gi, '\n');
  text = text.replace(/<\/p>/gi, '\n\n');
  text = text.replace(/<\/div>/gi, '\n');
  text = text.replace(/<\/h[1-6]>/gi, '\n\n');
  text = text.replace(/<\/li>/gi, '\n');

  // Удаляем все остальные HTML теги
  text = text.replace(/<[^>]+>/g, '');

  // Декодируем HTML entities
  text = decodeHTMLEntities(text);

  // Убираем множественные переносы строк
  text = text.replace(/\n\s*\n\s*\n/g, '\n\n');

  // Убираем пробелы в начале и конце
  return text.trim();
}

/**
 * Декодирует HTML entities
 */
function decodeHTMLEntities(text: string): string {
  const entities: Record<string, string> = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#039;': "'",
    '&nbsp;': ' ',
    '&mdash;': '—',
    '&ndash;': '–',
    '&hellip;': '…',
    '&laquo;': '«',
    '&raquo;': '»',
  };

  return text.replace(/&[a-z0-9#]+;/gi, (entity) => {
    return entities[entity.toLowerCase()] || entity;
  });
}

// ============================================================================
// Tiptap JSON Manipulation
// ============================================================================

/**
 * Заменяет фрагмент текста в Tiptap JSON
 * Используется при AI редактировании выделенного текста
 */
export function replaceTextInTiptap(
  doc: TiptapDocument,
  oldText: string,
  newText: string
): TiptapDocument {
  const replaceInNode = (node: TiptapContent): TiptapContent => {
    // Если это текстовая нода
    if (node.type === 'text' && node.text) {
      if (node.text.includes(oldText)) {
        return {
          ...node,
          text: node.text.replace(oldText, newText),
        };
      }
      return node;
    }

    // Если есть дочерние элементы
    if (node.content && Array.isArray(node.content)) {
      return {
        ...node,
        content: node.content.map(replaceInNode),
      };
    }

    return node;
  };

  return {
    ...doc,
    content: doc.content.map(replaceInNode),
  };
}

/**
 * Извлекает контекст вокруг выделенного текста
 * Используется для передачи контекста в AI при редактировании
 */
export function getTextContext(
  doc: TiptapDocument,
  selectedText: string,
  contextLength: number = 200
): { before: string; after: string } {
  const fullText = tiptapToPlainText(doc);
  const index = fullText.indexOf(selectedText);

  if (index === -1) {
    return { before: '', after: '' };
  }

  const beforeStart = Math.max(0, index - contextLength);
  const beforeText = fullText.substring(beforeStart, index).trim();

  const afterEnd = Math.min(fullText.length, index + selectedText.length + contextLength);
  const afterText = fullText.substring(index + selectedText.length, afterEnd).trim();

  return {
    before: beforeText,
    after: afterText,
  };
}

// ============================================================================
// Утилиты для парсинга
// ============================================================================

/**
 * Очищает текст от лишних пробелов и переносов строк
 */
export function cleanText(text: string): string {
  if (!text) {
    return '';
  }

  // Убираем лишние пробелы
  text = text.replace(/[ \t]+/g, ' ');

  // Убираем множественные переносы строк (оставляем максимум 2)
  text = text.replace(/\n{3,}/g, '\n\n');

  // Убираем пробелы в начале строк
  text = text.replace(/\n\s+/g, '\n');

  // Убираем пробелы в начале и конце
  return text.trim();
}

// ============================================================================
// Markdown → Tiptap JSON
// ============================================================================

/**
 * Конвертирует Markdown в Tiptap JSON формат
 * Поддерживает: жирный, курсив, списки, заголовки
 */
export function markdownToTiptap(markdown: string): TiptapDocument {
  const lines = markdown.split('\n');
  const content: TiptapContent[] = [];
  let currentParagraph: TiptapContent[] = [];
  let inList = false;
  let listItems: TiptapContent[] = [];

  const flushParagraph = () => {
    if (currentParagraph.length > 0) {
      content.push({
        type: 'paragraph',
        content: currentParagraph,
      });
      currentParagraph = [];
    }
  };

  const flushList = () => {
    if (listItems.length > 0) {
      content.push({
        type: 'bulletList',
        content: listItems,
      });
      listItems = [];
      inList = false;
    }
  };

  const parseInlineMarkdown = (text: string): TiptapContent[] => {
    const result: TiptapContent[] = [];

    // Регулярное выражение для жирного и курсива
    const regex = /(\*\*\*(.+?)\*\*\*|\*\*(.+?)\*\*|\*(.+?)\*|__(.+?)__|_(.+?)_)/g;
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(text)) !== null) {
      // Текст перед форматированием
      if (match.index > lastIndex) {
        result.push({
          type: 'text',
          text: text.substring(lastIndex, match.index),
        });
      }

      // Bold + Italic
      if (match[2]) {
        result.push({
          type: 'text',
          text: match[2],
          marks: [{ type: 'bold' }, { type: 'italic' }],
        });
      }
      // Bold
      else if (match[3] || match[5]) {
        result.push({
          type: 'text',
          text: match[3] || match[5],
          marks: [{ type: 'bold' }],
        });
      }
      // Italic
      else if (match[4] || match[6]) {
        result.push({
          type: 'text',
          text: match[4] || match[6],
          marks: [{ type: 'italic' }],
        });
      }

      lastIndex = match.index + match[0].length;
    }

    // Оставшийся текст
    if (lastIndex < text.length) {
      result.push({
        type: 'text',
        text: text.substring(lastIndex),
      });
    }

    // Если ничего не распарсилось, просто вернем текст
    if (result.length === 0 && text) {
      result.push({
        type: 'text',
        text: text,
      });
    }

    return result;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmedLine = line.trim();

    // Пустая строка - завершаем текущий параграф
    if (!trimmedLine) {
      flushParagraph();
      flushList();
      continue;
    }

    // Заголовки
    const headingMatch = trimmedLine.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      flushParagraph();
      flushList();
      const level = Math.min(headingMatch[1].length, 6);
      content.push({
        type: 'heading',
        attrs: { level },
        content: parseInlineMarkdown(headingMatch[2]),
      });
      continue;
    }

    // Маркированный список
    const bulletMatch = trimmedLine.match(/^[-*+]\s+(.+)$/);
    if (bulletMatch) {
      flushParagraph();
      inList = true;
      listItems.push({
        type: 'listItem',
        content: [{
          type: 'paragraph',
          content: parseInlineMarkdown(bulletMatch[1]),
        }],
      });
      continue;
    }

    // Нумерованный список
    const numberedMatch = trimmedLine.match(/^\d+\.\s+(.+)$/);
    if (numberedMatch) {
      flushParagraph();
      // Сначала закрываем маркированный список если есть
      if (inList) {
        flushList();
      }
      // Добавляем как orderedList
      if (!content.length || content[content.length - 1]?.type !== 'orderedList') {
        content.push({
          type: 'orderedList',
          content: [],
        });
      }
      const lastList = content[content.length - 1];
      if (lastList.content) {
        lastList.content.push({
          type: 'listItem',
          content: [{
            type: 'paragraph',
            content: parseInlineMarkdown(numberedMatch[1]),
          }],
        });
      }
      continue;
    }

    // Горизонтальная линия
    if (/^[-*_]{3,}$/.test(trimmedLine)) {
      flushParagraph();
      flushList();
      content.push({
        type: 'horizontalRule',
      });
      continue;
    }

    // Обычный текст
    flushList();
    if (currentParagraph.length > 0) {
      currentParagraph.push({ type: 'hardBreak' });
    }
    currentParagraph.push(...parseInlineMarkdown(trimmedLine));
  }

  // Завершаем оставшиеся элементы
  flushParagraph();
  flushList();

  // Если контент пустой, добавляем пустой параграф
  if (content.length === 0) {
    content.push({
      type: 'paragraph',
      content: [],
    });
  }

  return {
    type: 'doc',
    content,
  };
}

/**
 * Обрезает текст до определенной длины с сохранением целых слов
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }

  const truncated = text.substring(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');

  if (lastSpace > 0) {
    return truncated.substring(0, lastSpace) + '...';
  }

  return truncated + '...';
}

/**
 * Извлекает первый параграф из текста
 */
export function extractFirstParagraph(text: string): string {
  const paragraphs = text.split(/\n\s*\n/);
  return paragraphs[0]?.trim() || '';
}

/**
 * Подсчитывает примерное количество слов в тексте
 */
export function countWords(text: string): number {
  if (!text) {
    return 0;
  }

  // Убираем лишние пробелы и разбиваем на слова
  const words = text.trim().split(/\s+/);
  return words.filter((word) => word.length > 0).length;
}
