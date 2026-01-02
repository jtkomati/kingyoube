import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

interface UseStatementPollingOptions {
  onComplete?: (data: StatementData) => void;
  onError?: (error: string) => void;
  maxAttempts?: number;
  intervalMs?: number;
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

export function useStatementPolling(options: UseStatementPollingOptions = {}) {
  const { 
    onComplete, 
    onError, 
    maxAttempts = 12, // 1 minute with 5s intervals
    intervalMs = 5000 
  } = options;

  const [isPolling, setIsPolling] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [status, setStatus] = useState<string | null>(null);
  const [data, setData] = useState<StatementData | null>(null);
  const intervalRef = useRef<number | null>(null);
  const uniqueIdRef = useRef<string | null>(null);
  const bankAccountIdRef = useRef<string | null>(null);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
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

      if (error) throw new Error(error.message);

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
      } else if (attempts >= maxAttempts) {
        stopPolling();
        const errorMsg = "Tempo limite excedido. O banco está demorando para responder.";
        onError?.(errorMsg);
      } else {
        setAttempts((prev) => prev + 1);
      }
    } catch (error) {
      stopPolling();
      const errorMsg = error instanceof Error ? error.message : "Erro ao buscar extrato";
      onError?.(errorMsg);
    }
  }, [attempts, maxAttempts, onComplete, onError, stopPolling]);

  useEffect(() => {
    if (isPolling && !intervalRef.current) {
      intervalRef.current = window.setInterval(checkStatus, intervalMs);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isPolling, checkStatus, intervalMs]);

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

      const { data: response, error } = await supabase.functions.invoke("plugbank-request-statement", {
        body: {
          accountHash,
          startDate,
          endDate,
          bankAccountId,
          companyId,
        },
      });

      if (error) throw new Error(error.message);

      if (!response.success) {
        if (response.needsConsent) {
          return { success: false, error: response.error };
        }
        throw new Error(response.error || "Erro ao solicitar extrato");
      }

      uniqueIdRef.current = response.uniqueId;
      bankAccountIdRef.current = bankAccountId || null;
      setStatus(response.status);
      setIsPolling(true);

      return { success: true, uniqueId: response.uniqueId };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Erro ao solicitar extrato";
      return { success: false, error: errorMsg };
    }
  };

  return {
    requestStatement,
    stopPolling,
    isPolling,
    attempts,
    maxAttempts,
    status,
    data,
    progress: Math.round((attempts / maxAttempts) * 100),
  };
}
