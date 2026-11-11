/** Scenes travel in the URL hash, compressed, so a link reproduces a sandbox without a server. */

const SAVE_KEY = 'soliton-sandbox';

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text: string): Uint8Array<ArrayBuffer> {
  const binary = atob(text.replace(/-/g, '+').replace(/_/g, '/'));
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function pipe(bytes: Uint8Array<ArrayBuffer>, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const writer = stream.writable.getWriter();
  void writer.write(bytes);
  void writer.close();
  return new Uint8Array(await new Response(stream.readable).arrayBuffer());
}

export async function encodeScene(json: string): Promise<string> {
  const compact = JSON.stringify(JSON.parse(json));
  return toBase64Url(await pipe(new TextEncoder().encode(compact) as Uint8Array<ArrayBuffer>, new CompressionStream('deflate-raw')));
}

export async function decodeScene(code: string): Promise<string> {
  return new TextDecoder().decode(await pipe(fromBase64Url(code), new DecompressionStream('deflate-raw')));
}

/** The scene carried by the current URL, if any. */
export async function sceneFromUrl(): Promise<string | undefined> {
  const code = new URLSearchParams(location.hash.slice(1)).get('scene');
  if (!code) return undefined;
  try {
    return await decodeScene(code);
  } catch {
    return undefined;
  }
}

export async function shareLink(json: string | undefined): Promise<string> {
  const url = new URL(location.href);
  if (json) {
    url.search = '?mode=mechanics&sandbox';
    url.hash = `scene=${await encodeScene(json)}`;
  }
  return url.toString();
}

export function saveSandbox(json: string): void {
  try {
    localStorage.setItem(SAVE_KEY, json);
  } catch {
    /* storage unavailable */
  }
}

export function loadSandbox(): string | undefined {
  try {
    return localStorage.getItem(SAVE_KEY) ?? undefined;
  } catch {
    return undefined;
  }
}

export function downloadScene(json: string, title: string): void {
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
  link.download = `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'scene'}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
}
