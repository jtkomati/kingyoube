/**
 * Rate Limiter para Edge Functions
 * Implementação simples em memória com janela deslizante
 */

interface RateLimitEntry {
  count: number;
  firstRequest: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

interface RateLimitConfig {
  windowMs: number;  // Janela de tempo em ms
  maxRequests: number; // Máximo de requisições por janela
}

const DEFAULT_CONFIG: RateLimitConfig = {
  windowMs: 60 * 1000, // 1 minuto
  maxRequests: 10,     // 10 requisições por minuto
};

/**
 * Verifica se um identificador excedeu o rate limit
 * @param identifier - Identificador único (IP, userId, etc.)
 * @param config - Configuração opcional de rate limiting
 * @returns true se excedeu o limite, false caso contrário
 */
export function isRateLimited(
  identifier: string,
  config: RateLimitConfig = DEFAULT_CONFIG
): boolean {
  const now = Date.now();
  const entry = rateLimitStore.get(identifier);

  // Limpar entradas expiradas periodicamente
  if (rateLimitStore.size > 1000) {
    cleanupExpiredEntries(config.windowMs);
  }

  if (!entry) {
    // Primeira requisição
    rateLimitStore.set(identifier, { count: 1, firstRequest: now });
    return false;
  }

  // Verificar se a janela expirou
  if (now - entry.firstRequest > config.windowMs) {
    // Reset para nova janela
    rateLimitStore.set(identifier, { count: 1, firstRequest: now });
    return false;
  }

  // Incrementar contador
  entry.count++;

  // Verificar limite
  if (entry.count > config.maxRequests) {
    return true;
  }

  return false;
}

/**
 * Limpa entradas expiradas do store
 */
function cleanupExpiredEntries(windowMs: number): void {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now - entry.firstRequest > windowMs) {
      rateLimitStore.delete(key);
    }
  }
}

/**
 * Obtém informações de rate limit para um identificador
 */
export function getRateLimitInfo(
  identifier: string,
  config: RateLimitConfig = DEFAULT_CONFIG
): { remaining: number; resetIn: number } {
  const entry = rateLimitStore.get(identifier);
  
  if (!entry) {
    return { remaining: config.maxRequests, resetIn: 0 };
  }

  const now = Date.now();
  const elapsed = now - entry.firstRequest;
  
  if (elapsed > config.windowMs) {
    return { remaining: config.maxRequests, resetIn: 0 };
  }

  return {
    remaining: Math.max(0, config.maxRequests - entry.count),
    resetIn: config.windowMs - elapsed,
  };
}

/**
 * Cria uma resposta HTTP 429 (Too Many Requests)
 */
export function createRateLimitResponse(
  corsHeaders: Record<string, string>,
  retryAfterSeconds: number = 60
): Response {
  return new Response(
    JSON.stringify({
      error: 'Limite de requisições excedido',
      message: `Por favor, aguarde ${retryAfterSeconds} segundos antes de tentar novamente.`,
      retryAfter: retryAfterSeconds,
    }),
    {
      status: 429,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Retry-After': String(retryAfterSeconds),
      },
    }
  );
}
