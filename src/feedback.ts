import { el } from './ui';
import { pageview } from './analytics';

/*
 * "Something wrong? An idea?" A short note, written in the playground, with the page it was written on attached, so
 * the report says exactly which scene and settings it is about. With a Web3Forms access key it goes straight to the
 * inbox from the page; without one, it opens the visitor's email app, or can be copied.
 */
const ADDRESS = 'developer.zang.000@gmail.com';
/** Web3Forms' public access key: it only lets a form deliver to the inbox it was made for. */
const INBOX = import.meta.env.VITE_WEB3FORMS_KEY as string | undefined;
const KINDS = [
  ['wrong', 'Something looks wrong'],
  ['idea', 'An idea'],
  ['thanks', 'It helped'],
] as const;

let dialog: HTMLDialogElement | null = null;

function build(): HTMLDialogElement {
  const kinds = el('div', { class: 'feedback-kinds', role: 'radiogroup', 'aria-label': 'What is it about?' });
  KINDS.forEach(([value, label], i) => {
    const input = el('input', { type: 'radio', name: 'feedback-kind', value }) as HTMLInputElement;
    input.checked = i === 0;
    kinds.append(el('label', { class: 'feedback-kind' }, [input, el('span', { text: label })]));
  });
  const message = el('textarea', {
    name: 'message',
    rows: 5,
    required: true,
    placeholder: 'What did you see, or what would make this better for your class?',
  }) as HTMLTextAreaElement;
  const reply = el('input', {
    type: 'email',
    name: 'email',
    class: 'feedback-reply',
    placeholder: 'Your email, if you would like a reply (optional)',
    autocomplete: 'email',
  }) as HTMLInputElement;
  reply.hidden = !INBOX;
  const context = el('p', { class: 'feedback-context' });
  const status = el('p', { class: 'feedback-status', role: 'status' });
  const send = el('button', { type: 'submit', class: 'feedback-send', text: INBOX ? 'Send' : 'Send by email' });
  const copy = el('button', { type: 'button', class: 'feedback-copy', text: 'Copy instead' });
  const cancel = el('button', { type: 'button', class: 'feedback-cancel', text: 'Cancel' });
  const form = el('form', { method: 'dialog', class: 'feedback-form' }, [
    el('h2', { text: 'Tell us what you think' }),
    kinds,
    message,
    reply,
    context,
    status,
    el('div', { class: 'feedback-actions' }, [cancel, copy, send]),
  ]);
  const box = el('dialog', { class: 'feedback', 'aria-label': 'Feedback' }, [form]) as HTMLDialogElement;

  const kind = () => (form.querySelector<HTMLInputElement>('input[name="feedback-kind"]:checked')?.value ?? 'wrong') as string;
  const text = () => `${message.value.trim()}\n\n---\nAbout: ${KINDS.find(([v]) => v === kind())?.[1]}\nPage: ${document.title}\nLink: ${location.href}\n`;
  const subject = () => `Soliton feedback: ${document.title.replace(/ \| Soliton.*$/, '')}`;
  const done = (how: string) => {
    pageview(`/feedback/${kind()}/${how}`);
    status.textContent = '';
    message.value = '';
    reply.value = '';
    box.close();
  };

  /** Straight to the inbox. Returns false when it could not be sent, so the visitor can be offered another way. */
  const deliver = async (): Promise<boolean> => {
    try {
      const response = await fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          access_key: INBOX,
          subject: subject(),
          from_name: 'Soliton playground',
          ...(reply.value.trim() ? { email: reply.value.trim(), replyto: reply.value.trim() } : {}),
          kind: KINDS.find(([v]) => v === kind())?.[1],
          message: text(),
        }),
      });
      return response.ok && ((await response.json()) as { success?: boolean }).success === true;
    } catch {
      return false;
    }
  };

  box.addEventListener('toggle', () => {
    if (!box.open) return;
    context.textContent = `We'll include the page you're on, "${document.title.replace(/ \| Soliton.*$/, '')}", and its link, so we see exactly what you saw.`;
    status.textContent = '';
    message.focus();
  });
  cancel.addEventListener('click', () => box.close());
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!message.value.trim()) {
      status.textContent = 'Write a line or two first.';
      message.focus();
      return;
    }
    if (!INBOX) {
      location.href = `mailto:${ADDRESS}?subject=${encodeURIComponent(subject())}&body=${encodeURIComponent(text())}`;
      done('email');
      return;
    }
    send.disabled = true;
    status.textContent = 'Sending…';
    void deliver().then((sent) => {
      send.disabled = false;
      if (sent) {
        status.textContent = 'Sent. Thank you!';
        window.setTimeout(() => done('sent'), 1200);
      } else {
        status.textContent = `Couldn't send just now. Use "Copy instead", or email ${ADDRESS}.`;
      }
    });
  });
  copy.addEventListener('click', async () => {
    if (!message.value.trim()) {
      status.textContent = 'Write a line or two first.';
      message.focus();
      return;
    }
    try {
      await navigator.clipboard.writeText(`${subject()}\n\n${text()}`);
      status.textContent = `Copied. Paste it into an email to ${ADDRESS}.`;
      pageview(`/feedback/${kind()}/copied`);
    } catch {
      status.textContent = `Couldn't copy. Please email ${ADDRESS}.`;
    }
  });
  // A click on the backdrop closes it, as a click outside any popover does.
  box.addEventListener('click', (e) => e.target === box && box.close());
  document.body.append(box);
  return box;
}

export function openFeedback(): void {
  dialog ??= build();
  dialog.showModal();
}
