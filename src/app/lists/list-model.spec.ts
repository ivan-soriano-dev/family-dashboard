import { ListData, applyChange, sortForDisplay } from './list-model';

const base: ListData = {
  updated: 1,
  items: [
    { id: 'a', text: 'Milk', done: false, at: 1 },
    { id: 'b', text: 'Eggs', done: true, at: 2 },
    { id: 'c', text: 'Bread', done: false, at: 3 },
  ],
};

describe('applyChange', () => {
  it('adds a cleaned item at the end without mutating the original', () => {
    const next = applyChange(base, { op: 'add', id: 'd', text: '  Olive   oil ' }, 9);
    expect(next.items.at(-1)).toEqual({ id: 'd', text: 'Olive oil', done: false, at: 9 });
    expect(base.items).toHaveLength(3);
  });

  it('toggles, edits and deletes by id', () => {
    expect(applyChange(base, { op: 'toggle', id: 'a', done: true }).items[0].done).toBe(true);
    expect(applyChange(base, { op: 'edit', id: 'c', text: 'Rye bread' }).items[2].text).toBe(
      'Rye bread',
    );
    expect(applyChange(base, { op: 'delete', id: 'b' }).items.map((i) => i.id)).toEqual(['a', 'c']);
  });

  it('removes completed items, or everything', () => {
    expect(applyChange(base, { op: 'clearDone' }).items.map((i) => i.id)).toEqual(['a', 'c']);
    expect(applyChange(base, { op: 'clear' }).items).toEqual([]);
  });
});

describe('sortForDisplay', () => {
  it('shows unchecked items first, keeping their order', () => {
    expect(sortForDisplay(base.items).map((i) => i.id)).toEqual(['a', 'c', 'b']);
  });
});
