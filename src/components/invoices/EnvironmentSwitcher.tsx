import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { FlaskConical, Building2, ChevronDown, Check } from "lucide-react";
import { toast } from "sonner";

interface EnvironmentSwitcherProps {
  currentEnvironment: string;
  companyId: string;
}

export const EnvironmentSwitcher = ({
  currentEnvironment,
  companyId,
}: EnvironmentSwitcherProps) => {
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingEnvironment, setPendingEnvironment] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const isSandbox = currentEnvironment === "SANDBOX" || !currentEnvironment;

  const updateEnvironmentMutation = useMutation({
    mutationFn: async (environment: string) => {
      // Check if config exists first
      const { data: existing } = await supabase
        .from("config_fiscal")
        .select("id")
        .eq("company_id", companyId)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("config_fiscal")
          .update({
            plugnotas_environment: environment,
            updated_at: new Date().toISOString(),
          })
          .eq("company_id", companyId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("config_fiscal")
          .insert({
            company_id: companyId,
            plugnotas_environment: environment,
            client_id: "pending",
            client_secret: "pending",
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fiscal-config-environment"] });
      toast.success(
        pendingEnvironment === "PRODUCTION"
          ? "Ambiente alterado para PRODUÇÃO"
          : "Ambiente alterado para SANDBOX"
      );
      setPendingEnvironment(null);
    },
    onError: (error: any) => {
      toast.error("Erro ao alterar ambiente: " + error.message);
    },
  });

  const handleEnvironmentChange = (environment: string) => {
    if (environment === "PRODUCTION") {
      setPendingEnvironment(environment);
      setShowConfirmDialog(true);
    } else {
      updateEnvironmentMutation.mutate(environment);
    }
  };

  const confirmProductionSwitch = () => {
    if (pendingEnvironment) {
      updateEnvironmentMutation.mutate(pendingEnvironment);
    }
    setShowConfirmDialog(false);
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            {isSandbox ? (
              <>
                <FlaskConical className="h-4 w-4 text-warning" />
                <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30">
                  SANDBOX
                </Badge>
              </>
            ) : (
              <>
                <Building2 className="h-4 w-4 text-success" />
                <Badge variant="outline" className="bg-success/10 text-success border-success/30">
                  PRODUÇÃO
                </Badge>
              </>
            )}
            <ChevronDown className="h-3 w-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onClick={() => handleEnvironmentChange("SANDBOX")}
            className="gap-2"
          >
            <FlaskConical className="h-4 w-4 text-warning" />
            <span>Sandbox (Testes)</span>
            {isSandbox && <Check className="h-4 w-4 ml-auto" />}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => handleEnvironmentChange("PRODUCTION")}
            className="gap-2"
          >
            <Building2 className="h-4 w-4 text-success" />
            <span>Produção (Real)</span>
            {!isSandbox && <Check className="h-4 w-4 ml-auto" />}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-destructive" />
              Confirmar Mudança para Produção
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                Você está prestes a mudar para o ambiente de <strong>PRODUÇÃO</strong>.
              </p>
              <p className="text-destructive font-medium">
                ⚠️ Notas fiscais emitidas em produção são REAIS e geram obrigações fiscais.
              </p>
              <p>
                Certifique-se de que:
              </p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Seu token de produção está configurado corretamente</li>
                <li>Os dados da empresa estão corretos</li>
                <li>Você está pronto para emitir notas fiscais válidas</li>
              </ul>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmProductionSwitch}
              className="bg-destructive hover:bg-destructive/90"
            >
              Confirmar Produção
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
