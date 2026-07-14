export class ProviderInfrastructureError extends Error {
  constructor(message: string, public readonly kind: 'timeout' | 'transport' | 'provider_5xx') {
    super(message);
    this.name = 'ProviderInfrastructureError';
  }
}

export class ProviderBusinessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProviderBusinessError';
  }
}

export function isProviderInfrastructureError(error: unknown): boolean {
  return error instanceof ProviderInfrastructureError || (error instanceof Error && error.name === 'AbortError');
}

export async function fetchWithDeadline(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new ProviderInfrastructureError('Provider request timed out', 'timeout');
    }
    throw new ProviderInfrastructureError('Provider transport request failed', 'transport');
  } finally {
    clearTimeout(timer);
  }
}
