// Извлечение plain text из JSON контента Tiptap
export function extractPlainText(content: any): string {
  if (!content || !content.content) return '';

  let text = '';

  const traverse = (node: any) => {
    if (node.type === 'text') {
      text += node.text;
    }
    if (node.content) {
      node.content.forEach(traverse);
    }
  };

  content.content.forEach(traverse);
  return text.trim();
}

// Обрезка текста до определенной длины
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
}

// Подсветка поискового запроса в тексте
export function highlightSearchQuery(text: string, query: string): string {
  if (!query) return text;
  const regex = new RegExp(`(${query})`, 'gi');
  return text.replace(regex, '<mark>$1</mark>');
}
