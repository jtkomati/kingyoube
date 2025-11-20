import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, ChevronRight, ExternalLink, Shield } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface BradescoConsentModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function BradescoConsentModal({ open, onClose, onSuccess }: BradescoConsentModalProps) {
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [permissions, setPermissions] = useState({
    saldos: true,
    extratos: true,
    cadastrais: true,
  });

  const handlePermissionChange = (key: keyof typeof permissions) => {
    setPermissions(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleContinue = () => {
    if (step === 1) {
      setStep(2);
    } else if (step === 2) {
      // Simular redirecionamento
      setTimeout(() => {
        setStep(3);
        toast({
          title: "Autorização concedida",
          description: "Sua conta Bradesco foi conectada com sucesso.",
        });
      }, 2000);
    } else if (step === 3) {
      onSuccess();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-red-600 text-white p-2 rounded-lg">
              <Shield className="h-5 w-5" />
            </div>
            <DialogTitle>Conectar Bradesco</DialogTitle>
          </div>
          <DialogDescription>
            Autorize o acesso aos seus dados bancários de forma segura
          </DialogDescription>
        </DialogHeader>

        {/* Stepper */}
        <div className="flex items-center justify-between mb-6">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center flex-1">
              <div className={`flex items-center justify-center w-8 h-8 rounded-full ${
                s <= step ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
              }`}>
                {s < step ? <CheckCircle2 className="h-5 w-5" /> : s}
              </div>
              {s < 3 && (
                <div className={`flex-1 h-1 mx-2 ${
                  s < step ? 'bg-primary' : 'bg-muted'
                }`} />
              )}
            </div>
          ))}
        </div>

        {/* Step 1: Seleção de Dados */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="space-y-3">
              <p className="text-sm font-medium">Selecione os dados que deseja compartilhar:</p>
              
              <div className="flex items-center space-x-2 p-3 rounded-lg border">
                <Checkbox
                  id="saldos"
                  checked={permissions.saldos}
                  onCheckedChange={() => handlePermissionChange('saldos')}
                />
                <Label htmlFor="saldos" className="flex-1 cursor-pointer">
                  <div className="font-medium">Saldos em Conta</div>
                  <div className="text-xs text-muted-foreground">
                    Visualize seus saldos em tempo real
                  </div>
                </Label>
                <Badge variant="secondary">Recomendado</Badge>
              </div>

              <div className="flex items-center space-x-2 p-3 rounded-lg border">
                <Checkbox
                  id="extratos"
                  checked={permissions.extratos}
                  onCheckedChange={() => handlePermissionChange('extratos')}
                />
                <Label htmlFor="extratos" className="flex-1 cursor-pointer">
                  <div className="font-medium">Extratos e Transações</div>
                  <div className="text-xs text-muted-foreground">
                    Sincronize automaticamente suas movimentações
                  </div>
                </Label>
                <Badge variant="secondary">Recomendado</Badge>
              </div>

              <div className="flex items-center space-x-2 p-3 rounded-lg border">
                <Checkbox
                  id="cadastrais"
                  checked={permissions.cadastrais}
                  onCheckedChange={() => handlePermissionChange('cadastrais')}
                />
                <Label htmlFor="cadastrais" className="flex-1 cursor-pointer">
                  <div className="font-medium">Dados Cadastrais</div>
                  <div className="text-xs text-muted-foreground">
                    Informações básicas da sua conta
                  </div>
                </Label>
              </div>
            </div>

            <div className="bg-muted p-3 rounded-lg text-xs text-muted-foreground">
              <Shield className="h-4 w-4 inline mr-1" />
              Seus dados são protegidos por criptografia de ponta a ponta
            </div>
          </div>
        )}

        {/* Step 2: Aviso de Redirecionamento */}
        {step === 2 && (
          <div className="space-y-4 py-6">
            <div className="flex flex-col items-center text-center gap-4">
              <div className="bg-red-100 text-red-600 p-4 rounded-full">
                <ExternalLink className="h-8 w-8" />
              </div>
              <div className="space-y-2">
                <h3 className="font-semibold text-lg">Redirecionamento Seguro</h3>
                <p className="text-sm text-muted-foreground max-w-md">
                  Você será levado ao ambiente seguro do Bradesco para autorizar o acesso aos dados selecionados.
                  Este é um processo oficial do Open Finance Brasil.
                </p>
              </div>
              <div className="bg-muted p-4 rounded-lg text-sm space-y-2">
                <p className="font-medium">Dados que serão compartilhados:</p>
                <div className="space-y-1 text-muted-foreground">
                  {permissions.saldos && <div>• Saldos em Conta</div>}
                  {permissions.extratos && <div>• Extratos e Transações</div>}
                  {permissions.cadastrais && <div>• Dados Cadastrais</div>}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Sucesso */}
        {step === 3 && (
          <div className="space-y-4 py-6">
            <div className="flex flex-col items-center text-center gap-4">
              <div className="bg-green-100 text-green-600 p-4 rounded-full">
                <CheckCircle2 className="h-12 w-12" />
              </div>
              <div className="space-y-2">
                <h3 className="font-semibold text-xl text-green-600">Conta Conectada com Sucesso!</h3>
                <p className="text-sm text-muted-foreground max-w-md">
                  Sua conta Bradesco foi conectada. Agora você pode visualizar seus dados financeiros e realizar conciliações automáticas.
                </p>
              </div>
              <div className="grid grid-cols-3 gap-4 w-full mt-4">
                <div className="p-3 rounded-lg bg-muted text-center">
                  <div className="text-2xl font-bold text-primary">3</div>
                  <div className="text-xs text-muted-foreground">Permissões</div>
                </div>
                <div className="p-3 rounded-lg bg-muted text-center">
                  <div className="text-2xl font-bold text-primary">12</div>
                  <div className="text-xs text-muted-foreground">Meses de validade</div>
                </div>
                <div className="p-3 rounded-lg bg-muted text-center">
                  <div className="text-2xl font-bold text-primary">✓</div>
                  <div className="text-xs text-muted-foreground">Sincronizado</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t">
          {step < 3 && (
            <Button variant="outline" onClick={onClose}>
              Cancelar
            </Button>
          )}
          <Button 
            onClick={handleContinue}
            disabled={step === 1 && !Object.values(permissions).some(Boolean)}
          >
            {step === 1 && 'Continuar'}
            {step === 2 && (
              <>
                Ir para o Bradesco
                <ChevronRight className="ml-1 h-4 w-4" />
              </>
            )}
            {step === 3 && 'Concluir'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
