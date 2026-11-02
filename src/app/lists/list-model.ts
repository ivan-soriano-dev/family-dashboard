/** The two shared lists and the changes the Worker understands (see worker/worker.js). */
export type ListName = 'todo' | 'groceries';
export const LIST_NAMES: readonly ListName[] = ['todo', 'groceries'];

export interface ListItem {
  id: string;
  text: string;
  done: boolean;
  /** When the item was added (ms since 1970). */
  at: number;
}

export interface ListData {
  items: ListItem[];
  /** When the list last changed on the Worker (ms since 1970). 0 = never. */
  updated: number;
}

export type ListChange =
  | { op: 'add'; id: string; text: string }
  | { op: 'toggle'; id: string; done: boolean }
  | { op: 'edit'; id: string; text: string }
  | { op: 'delete'; id: string }
  | { op: 'clearDone' }
  | { op: 'clear' };

export const MAX_TEXT = 200;

export const emptyList = (): ListData => ({ items: [], updated: 0 });

export function cleanText(text: string): string {
  return text.replace(/\s+/g, ' ').trim().slice(0, MAX_TEXT);
}

/**
 * Applies a change locally, the same way the Worker does, so the screen updates
 * instantly. Returns a new object (never mutates), which is what signals expect.
 */
export function applyChange(list: ListData, change: ListChange, now = Date.now()): ListData {
  const items = list.items;
  switch (change.op) {
    case 'add':
      return {
        ...list,
        items: [...items, { id: change.id, text: cleanText(change.text), done: false, at: now }],
      };
    case 'toggle':
      return {
        ...list,
        items: items.map((i) => (i.id === change.id ? { ...i, done: change.done } : i)),
      };
    case 'edit':
      return {
        ...list,
        items: items.map((i) => (i.id === change.id ? { ...i, text: cleanText(change.text) } : i)),
      };
    case 'delete':
      return { ...list, items: items.filter((i) => i.id !== change.id) };
    case 'clearDone':
      return { ...list, items: items.filter((i) => !i.done) };
    case 'clear':
      return { ...list, items: [] };
  }
}

/** Unchecked items first (in the order they were added), then checked ones. */
export function sortForDisplay(items: readonly ListItem[]): ListItem[] {
  return [...items.filter((i) => !i.done), ...items.filter((i) => i.done)];
}

export function newId(): string {
  return crypto.randomUUID();
}

export function demoList(name: ListName): ListData {
  const words =
    name === 'todo'
      ? ['Book car service', 'Sign school permission slip', 'Call the plumber']
      : ['Milk', 'Bread', 'Tomatoes', 'Olive oil', 'Coffee'];
  return {
    updated: 0,
    items: words.map((text, i) => ({ id: `demo-${name}-${i}`, text, done: i === 1, at: 0 })),
  };
}
