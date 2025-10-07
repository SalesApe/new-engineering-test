export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

interface ApiRequestOptions extends RequestInit {
  method?: HttpMethod
  body?: BodyInit | null
}

export async function apiFetch<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const { headers, body, method = 'GET', ...rest } = options
  const finalHeaders = new Headers(headers ?? {})

  if (body) {
    if (!finalHeaders.has('Content-Type')) {
      finalHeaders.set('Content-Type', 'application/json')
    }
  } else {
    finalHeaders.delete('Content-Type')
  }

  const response = await fetch(`/api/${path}`, {
    method,
    body,
    credentials: 'same-origin',
    headers: finalHeaders,
    ...rest,
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(text || response.statusText)
  }

  if (response.status === 204) {
    return undefined as T
  }

  return (await response.json()) as T
}
