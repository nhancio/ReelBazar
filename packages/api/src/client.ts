import { API_BASE_URL } from '@reelbazaar/config';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

const DEFAULT_FETCH_TIMEOUT_MS = 25_000;

interface RequestOptions {
  headers?: Record<string, string>;
  body?: unknown;
  params?: Record<string, string>;
  /** Override default timeout (ms). Pass 0 to disable. */
  timeoutMs?: number;
}

let authToken: string | null = null;

function buildUrl(path: string): URL {
  const base = API_BASE_URL.endsWith('/') ? API_BASE_URL.slice(0, -1) : API_BASE_URL;
  const target = `${base}${path}`;

  if (/^https?:\/\//i.test(target)) {
    return new URL(target);
  }

  // A relative base only resolves against a page origin. On iOS/Android there is no
  // document, so the default '/api/v1' would silently resolve to http://localhost and every
  // request would fail with a confusing network error. Fail loudly with the actual fix.
  if (typeof window === 'undefined' || !window.location?.origin) {
    throw new Error(
      `API_BASE_URL is relative ("${API_BASE_URL}") but this platform has no page origin to ` +
        'resolve it against. Set EXPO_PUBLIC_API_URL to an absolute URL (e.g. ' +
        'https://app.rava.one/api/v1) in apps/app/.env.'
    );
  }

  return new URL(target, window.location.origin);
}

export function setAuthToken(token: string | null) {
  authToken = token;
}

export function getAuthToken(): string | null {
  return authToken;
}

async function request<T>(method: HttpMethod, path: string, options: RequestOptions = {}): Promise<T> {
  const url = buildUrl(path);

  if (options.params) {
    Object.entries(options.params).forEach(([key, value]) => {
      url.searchParams.append(key, value);
    });
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  const timeoutMs = options.timeoutMs ?? DEFAULT_FETCH_TIMEOUT_MS;
  const controller = new AbortController();
  const timeoutId =
    timeoutMs > 0
      ? globalThis.setTimeout(() => controller.abort(), timeoutMs)
      : undefined;

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      method,
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });
  } catch (e: unknown) {
    if (e instanceof Error && e.name === 'AbortError') {
      throw new Error(
        timeoutMs > 0
          ? `Request timed out after ${timeoutMs / 1000}s. Check your connection or try again.`
          : 'Request was cancelled.'
      );
    }
    throw e instanceof Error ? e : new Error(String(e));
  } finally {
    if (timeoutId !== undefined) globalThis.clearTimeout(timeoutId);
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: response.statusText }));
    throw new Error(error.message || `Request failed: ${response.status}`);
  }

  if (response.status === 204) return undefined as T;
  return response.json();
}

export const api = {
  get: <T>(path: string, options?: RequestOptions) => request<T>('GET', path, options),
  post: <T>(path: string, options?: RequestOptions) => request<T>('POST', path, options),
  put: <T>(path: string, options?: RequestOptions) => request<T>('PUT', path, options),
  patch: <T>(path: string, options?: RequestOptions) => request<T>('PATCH', path, options),
  delete: <T>(path: string, options?: RequestOptions) => request<T>('DELETE', path, options),
};

/**
 * A file picked on iOS/Android. React Native has no `File`/`Blob` for on-disk media, so
 * FormData accepts this `{ uri, name, type }` shape instead and streams from the path.
 */
export interface NativeUploadSource {
  uri: string;
  name: string;
  type: string;
}

/** Whatever the current platform's file picker hands back. */
export type UploadSource = File | NativeUploadSource;

export async function uploadFile(
  path: string,
  file: UploadSource,
  additionalFields?: Record<string, string>,
  onProgress?: (percent: number) => void
): Promise<{ url: string }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const url = buildUrl(path).toString();
    const formData = new FormData();

    // `File` goes through untouched on web; the native descriptor is passed as-is, which
    // React Native's FormData understands but TypeScript's DOM lib does not.
    formData.append('file', file as unknown as Blob);
    if (additionalFields) {
      Object.entries(additionalFields).forEach(([key, value]) => {
        formData.append(key, value);
      });
    }

    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable && onProgress) {
        const percent = Math.round((event.loaded / event.total) * 100);
        onProgress(percent);
      }
    });

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText));
        } catch (e) {
          resolve({ url: '' } as any);
        }
      } else {
        try {
          const error = JSON.parse(xhr.responseText);
          reject(new Error(error.message || 'Upload failed'));
        } catch (e) {
          reject(new Error(`Upload failed with status ${xhr.status}`));
        }
      }
    });

    xhr.addEventListener('error', () => reject(new Error('Network error during upload')));
    xhr.open('POST', url);
    
    if (authToken) {
      xhr.setRequestHeader('Authorization', `Bearer ${authToken}`);
    }
    
    xhr.send(formData);
  });
}
