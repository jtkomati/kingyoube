/**
 * Sistema de Logging Estruturado - Fase 3: Observabilidade
 * Níveis: debug < info < warn < error
 */

import { supabase } from '@/integrations/supabase/client';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  level: LogLevel;
  message: string;
  context?: Record<string, unknown>;
  error_stack?: string;
  function_name?: string;
  duration_ms?: number;
}

interface LogConfig {
  minLevel: LogLevel;
  batchSize: number;
  flushInterval: number;
  enableConsole: boolean;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

// Configuração padrão
const defaultConfig: LogConfig = {
  minLevel: (localStorage.getItem('log_level') as LogLevel) || 'info',
  batchSize: 10,
  flushInterval: 5000, // 5 segundos
  enableConsole: import.meta.env.DEV,
};

class Logger {
  private config: LogConfig;
  private buffer: LogEntry[] = [];
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private userId: string | null = null;
  private organizationId: string | null = null;
  private requestId: string;

  constructor(config: Partial<LogConfig> = {}) {
    this.config = { ...defaultConfig, ...config };
    this.requestId = this.generateRequestId();
    this.setupAutoFlush();
    this.setupUnloadHandler();
  }

  private generateRequestId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private setupAutoFlush(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    this.flushTimer = setInterval(() => {
      this.flush();
    }, this.config.flushInterval);
  }

  private setupUnloadHandler(): void {
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => {
        this.flush(true);
      });
    }
  }

  setUser(userId: string | null, organizationId: string | null): void {
    this.userId = userId;
    this.organizationId = organizationId;
  }

  setLevel(level: LogLevel): void {
    this.config.minLevel = level;
    localStorage.setItem('log_level', level);
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[this.config.minLevel];
  }

  private formatMessage(entry: LogEntry): string {
    const timestamp = new Date().toISOString();
    return `[${timestamp}] [${entry.level.toUpperCase()}] ${entry.message}`;
  }

  private log(entry: LogEntry): void {
    if (!this.shouldLog(entry.level)) return;

    // Console output em dev
    if (this.config.enableConsole) {
      const formattedMessage = this.formatMessage(entry);
      const consoleMethod = entry.level === 'debug' ? 'log' : entry.level;
      console[consoleMethod](formattedMessage, entry.context || '');
    }

    // Adiciona ao buffer para envio
    this.buffer.push({
      ...entry,
      context: {
        ...entry.context,
        page_url: typeof window !== 'undefined' ? window.location.pathname : undefined,
        user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
      },
    });

    // Flush imediato para erros
    if (entry.level === 'error' || this.buffer.length >= this.config.batchSize) {
      this.flush();
    }
  }

  debug(message: string, context?: Record<string, unknown>): void {
    this.log({ level: 'debug', message, context });
  }

  info(message: string, context?: Record<string, unknown>): void {
    this.log({ level: 'info', message, context });
  }

  warn(message: string, context?: Record<string, unknown>): void {
    this.log({ level: 'warn', message, context });
  }

  error(message: string, error?: Error | unknown, context?: Record<string, unknown>): void {
    const errorStack = error instanceof Error ? error.stack : undefined;
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    this.log({
      level: 'error',
      message: `${message}${errorMessage ? `: ${errorMessage}` : ''}`,
      context,
      error_stack: errorStack,
    });
  }

  // Log de performance para funções
  startTimer(functionName: string): () => void {
    const startTime = performance.now();
    return () => {
      const duration = Math.round(performance.now() - startTime);
      this.info(`Function completed: ${functionName}`, {
        function_name: functionName,
        duration_ms: duration,
      });
    };
  }

  async flush(sync = false): Promise<void> {
    if (this.buffer.length === 0) return;

    const logsToSend = [...this.buffer];
    this.buffer = [];

    const payload = {
      logs: logsToSend.map(log => ({
        ...log,
        user_id: this.userId,
        organization_id: this.organizationId,
        request_id: this.requestId,
        source: 'frontend' as const,
      })),
    };

    try {
      if (sync && typeof navigator !== 'undefined' && 'sendBeacon' in navigator) {
        // Usar sendBeacon para envio síncrono no unload
        const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/log-ingestion`;
        navigator.sendBeacon(url, JSON.stringify(payload));
      } else {
        await supabase.functions.invoke('log-ingestion', {
          body: payload,
        });
      }
    } catch (error) {
      // Fallback para console em caso de erro
      console.error('Failed to send logs:', error);
      // Recoloca os logs no buffer para tentar novamente
      this.buffer = [...logsToSend, ...this.buffer].slice(0, 100);
    }
  }

  // Resetar request ID (útil para nova sessão)
  newSession(): void {
    this.requestId = this.generateRequestId();
  }
}

// Singleton instance
export const logger = new Logger();

// Helper para criar logger com contexto específico
export function createContextLogger(context: Record<string, unknown>) {
  return {
    debug: (message: string, extra?: Record<string, unknown>) => 
      logger.debug(message, { ...context, ...extra }),
    info: (message: string, extra?: Record<string, unknown>) => 
      logger.info(message, { ...context, ...extra }),
    warn: (message: string, extra?: Record<string, unknown>) => 
      logger.warn(message, { ...context, ...extra }),
    error: (message: string, error?: Error | unknown, extra?: Record<string, unknown>) => 
      logger.error(message, error, { ...context, ...extra }),
  };
}

export default logger;
