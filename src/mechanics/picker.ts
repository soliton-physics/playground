import { el } from '../ui';

export interface PickerItem {
  id: string;
  title: string;
  group: string;
}

/** A dropdown we fully control, since a native select's popup cannot be styled. */
export class ScenarioPicker {
  readonly root: HTMLDivElement;
  private readonly button: HTMLButtonElement;
  private readonly panel: HTMLDivElement;
  private readonly rows = new Map<string, HTMLButtonElement>();
  private current = '';
  private open = false;

  constructor(private readonly items: PickerItem[], private readonly onChange: (id: string) => void) {
    this.button = el('button', { type: 'button', class: 'picker-button', 'aria-haspopup': 'listbox', 'aria-expanded': 'false' }, [
      el('span', { class: 'picker-label' }, [el('span', { class: 'picker-group' }), el('span', { class: 'picker-title' })]),
      el('span', { class: 'picker-chevron', text: '⌄' }),
    ]) as HTMLButtonElement;
    this.panel = el('div', { class: 'picker-panel', role: 'listbox', hidden: true }) as HTMLDivElement;

    const groups = new Map<string, PickerItem[]>();
    for (const item of items) groups.set(item.group, [...(groups.get(item.group) ?? []), item]);
    for (const [group, members] of groups) {
      this.panel.append(el('div', { class: 'picker-heading', text: group }));
      for (const item of members) {
        const row = el('button', { type: 'button', class: 'picker-row', role: 'option', 'data-id': item.id, text: item.title }) as HTMLButtonElement;
        row.addEventListener('click', () => {
          this.select(item.id, true);
          this.toggle(false);
        });
        this.rows.set(item.id, row);
        this.panel.append(row);
      }
    }

    this.root = el('div', { class: 'picker' }, [this.button, this.panel]) as HTMLDivElement;
    this.button.addEventListener('click', () => this.toggle(!this.open));
    this.root.addEventListener('keydown', (e) => this.onKey(e));
    document.addEventListener('pointerdown', (e) => {
      if (this.open && !this.root.contains(e.target as Node)) this.toggle(false);
    });
  }

  get value(): string {
    return this.current;
  }

  set value(id: string) {
    this.select(id, false);
  }

  private select(id: string, notify: boolean): void {
    const item = this.items.find((i) => i.id === id);
    if (!item) return;
    this.current = id;
    this.button.querySelector('.picker-group')!.textContent = item.group;
    this.button.querySelector('.picker-title')!.textContent = item.title;
    for (const [rowId, row] of this.rows) {
      row.classList.toggle('selected', rowId === id);
      row.setAttribute('aria-selected', String(rowId === id));
    }
    if (notify) this.onChange(id);
  }

  private toggle(open: boolean): void {
    this.open = open;
    this.panel.hidden = !open;
    this.button.setAttribute('aria-expanded', String(open));
    if (open) {
      const selected = this.rows.get(this.current);
      selected?.scrollIntoView({ block: 'nearest' });
      selected?.focus();
    }
  }

  private onKey(e: KeyboardEvent): void {
    if (e.key === 'Escape' && this.open) {
      this.toggle(false);
      this.button.focus();
      return;
    }
    if (!this.open) {
      if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        this.toggle(true);
      }
      return;
    }
    const ids = this.items.map((i) => i.id);
    const index = ids.indexOf((document.activeElement as HTMLElement)?.dataset.id ?? this.current);
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const next = ids[(index + (e.key === 'ArrowDown' ? 1 : ids.length - 1)) % ids.length]!;
      this.rows.get(next)?.focus();
    }
  }
}
