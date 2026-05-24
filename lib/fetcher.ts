// Lightweight JSON fetch helper used by client components.
export interface ApiOptions extends Omit<RequestInit, "body"> {
  json?: unknown;
}

export async function api<T = unknown>(path: string, opts: ApiOptions = {}): Promise<T> {
  const { json, headers, ...rest } = opts;
  const res = await fetch(path, {
    method: opts.method || (json ? "POST" : "GET"),
    cache: "no-store",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(headers || {}),
    },
    body: json !== undefined ? JSON.stringify(json) : undefined,
    ...rest,
  });
  const text = await res.text();
  const data = text ? safeJson(text) : null;
  if (!res.ok) {
    const message = (data && typeof data === "object" && "error" in data && typeof (data as { error?: unknown }).error === "string"
      ? (data as { error: string }).error
      : `Request failed (${res.status})`);
    const err = new Error(message) as Error & { status?: number; data?: unknown };
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data as T;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
