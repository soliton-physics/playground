/** KaTeX, loaded the first time a formula is shown. */
type Katex = typeof import('katex').default;

let loading: Promise<Katex> | undefined;

function katex(): Promise<Katex> {
  loading ??= Promise.all([import('katex'), import('katex/dist/katex.min.css')]).then(([module]) => module.default);
  return loading;
}

/** Typesets `tex` into `holder`; the latest call for a holder wins when several are waiting. */
export function tex(holder: HTMLElement, source: string, display = false): void {
  const ticket = String(Math.random());
  holder.dataset.tex = ticket;
  void katex().then((k) => {
    if (holder.dataset.tex === ticket) k.render(source, holder, { displayMode: display, throwOnError: false });
  });
}
