import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

interface UseStatementPollingOptions {
  onComplete?: (data: StatementData) => void;
  onError?: (error: string) => void;
  onTimeout?: (uniqueId: string) => void;
  maxAttempts?: number;
  initialIntervalMs?: number;
}

interface Transaction {
  id?: string;
  date: string;
  description: string;
  amount: number;
  document?: string;
}

interface StatementData {
  credits: Transaction[];
  debits: Transaction[];
  totalCredits: number;
  totalDebits: number;
}

// Backoff strategy: starts at 5s, increases to 10s, then 15s after certain attempts
function getPollingInterval(attempt: number, initialInterval: number): number {
  if (attempt < 6) return initialInterval;      // First 30s: every 5s
  if (attempt < 12) return initialInterval * 2; // Next 60s: every 10s
  return initialInterval * 3;                   // After: every 15s
}

export function useStatementPolling(options: UseStatementPollingOptions = {}) {
  const { 
    onComplete, 
    onError,
    onTimeout,
    maxAttempts = 40, // ~5 minutes with backoff (more time for bank processing)
    initialIntervalMs = 5000 
  } = options;

  const [isPolling, setIsPolling] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [status, setStatus] = useState<string | null>(null);
  const [data, setData] = useState<StatementData | null>(null);
  const [lastUniqueId, setLastUniqueId] = useState<string | null>(null);
  const timeoutRef = useRef<number | null>(null);
  const uniqueIdRef = useRef<string | null>(null);
  const bankAccountIdRef = useRef<string | null>(null);

  const stopPolling = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setIsPolling(false);
  }, []);

  const checkStatus = useCallback(async () => {
    if (!uniqueIdRef.current) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        stopPolling();
        onError?.("Você precisa estar logado para acessar o extrato");
        return;
      }

      const { data: response, error } = await supabase.functions.invoke("plugbank-get-statement", {
        body: {
          uniqueId: uniqueIdRef.current,
          bankAccountId: bankAccountIdRef.current,
        },
      });

      if (error) {
        // Try to extract the real error message from the response
        let errorMsg = error.message;
        if (error.message?.includes("non-2xx") && response?.error) {
          errorMsg = response.error;
        }
        throw new Error(errorMsg);
      }

      setStatus(response.status);

      if (response.isCompleted) {
        stopPolling();
        const statementData: StatementData = {
          credits: response.credits || [],
          debits: response.debits || [],
          totalCredits: response.totalCredits || 0,
          totalDebits: response.totalDebits || 0,
        };
        setData(statementData);
        onComplete?.(statementData);
      } else {
        const currentAttempts = attempts + 1;
        setAttempts(currentAttempts);
        
        if (currentAttempts >= maxAttempts) {
          stopPolling();
          // Don't treat as error - bank is still processing
          const uniqueId = uniqueIdRef.current;
          setLastUniqueId(uniqueId);
          onTimeout?.(uniqueId || "");
        } else {
          // Schedule next check with backoff
          const nextInterval = getPollingInterval(currentAttempts, initialIntervalMs);
          timeoutRef.current = window.setTimeout(checkStatus, nextInterval);
        }
      }
    } catch (error) {
      stopPolling();
      const errorMsg = error instanceof Error ? error.message : "Erro ao buscar extrato";
      onError?.(errorMsg);
    }
  }, [attempts, maxAttempts, initialIntervalMs, onComplete, onError, onTimeout, stopPolling]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const requestStatement = async (
    accountHash: string,
    startDate: string,
    endDate: string,
    bankAccountId?: string,
    companyId?: string
  ): Promise<{ success: boolean; error?: string; uniqueId?: string }> => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        return { success: false, error: "Você precisa estar logado para acessar o extrato" };
      }

      setAttempts(0);
      setStatus("REQUESTING");
      setData(null);
      setLastUniqueId(null);

      const { data: response, error } = await supabase.functions.invoke("plugbank-request-statement", {
        body: {
          accountHash,
          startDate,
          endDate,
          bankAccountId,
          companyId,
        },
      });

      if (error) {
        // Try to extract the real error message from the response
        let errorMsg = error.message;
        if (error.message?.includes("non-2xx") && response?.error) {
          errorMsg = response.error;
        }
        throw new Error(errorMsg);
      }

      if (!response.success) {
        if (response.needsConsent) {
          return { success: false, error: response.error };
        }
        throw new Error(response.error || "Erro ao solicitar extrato");
      }

      uniqueIdRef.current = response.uniqueId;
      bankAccountIdRef.current = bankAccountId || null;
      setStatus(response.status);
      setLastUniqueId(response.uniqueId);
      setIsPolling(true);
      
      // Start first check after initial interval
      timeoutRef.current = window.setTimeout(checkStatus, initialIntervalMs);

      return { success: true, uniqueId: response.uniqueId };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Erro ao solicitar extrato";
      return { success: false, error: errorMsg };
    }
  };

  // Resume polling for an existing protocol
  const resumePolling = (uniqueId: string, bankAccountId?: string) => {
    uniqueIdRef.current = uniqueId;
    bankAccountIdRef.current = bankAccountId || null;
    setAttempts(0);
    setStatus("PROCESSING");
    setIsPolling(true);
    
    // Start checking immediately
    checkStatus();
  };

  // Calculate estimated time remaining
  const getEstimatedTimeRemaining = (): string => {
    const remainingAttempts = maxAttempts - attempts;
    if (remainingAttempts <= 0) return "0s";
    
    // Rough estimate based on current backoff stage
    let totalSeconds = 0;
    for (let i = attempts; i < maxAttempts; i++) {
      totalSeconds += getPollingInterval(i, initialIntervalMs) / 1000;
    }
    
    if (totalSeconds > 60) {
      return `~${Math.ceil(totalSeconds / 60)}min`;
    }
    return `~${Math.ceil(totalSeconds)}s`;
  };

  return {
    requestStatement,
    resumePolling,
    stopPolling,
    isPolling,
    attempts,
    maxAttempts,
    status,
    data,
    lastUniqueId,
    progress: Math.round((attempts / maxAttempts) * 100),
    estimatedTimeRemaining: getEstimatedTimeRemaining(),
  };
}
