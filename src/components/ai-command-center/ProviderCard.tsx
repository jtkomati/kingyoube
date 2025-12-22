import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ProviderStatusIndicator } from './ProviderStatusIndicator';
import { Eye, EyeOff, Save, Sparkles, Bot, Brain, Search } from 'lucide-react';
import { toast } from 'sonner';

interface ProviderCardProps {
  name: string;
  description: string;
  status: 'online' | 'degraded' | 'offline' | 'unconfigured';
  latency?: number | null;
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  requestsMonth: number;
  costMonth: number;
  provider: 'openai' | 'anthropic' | 'google' | 'perplexity';
  hasApiKey: boolean;
}

const providerIcons = {
  openai: Sparkles,
  anthropic: Bot,
  google: Brain,
  perplexity: Search,
};

const providerColors = {
  openai: 'from-emerald-500/20 to-emerald-600/10',
  anthropic: 'from-orange-500/20 to-orange-600/10',
  google: 'from-blue-500/20 to-blue-600/10',
  perplexity: 'from-purple-500/20 to-purple-600/10',
};

export function ProviderCard({
  name,
  description,
  status,
  latency,
  enabled,
  onToggle,
  requestsMonth,
  costMonth,
  provider,
  hasApiKey,
}: ProviderCardProps) {
  const [showKey, setShowKey] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  const Icon = providerIcons[provider];

  const handleUpdateKey = async () => {
    if (!apiKey.trim()) {
      toast.error('Digite uma API Key válida');
      return;
    }
    
    setIsUpdating(true);
    try {
      // Simular atualização - em produção, chamar edge function
      await new Promise(resolve => setTimeout(resolve, 1000));
      toast.success(`API Key do ${name} atualizada com sucesso`);
      setApiKey('');
    } catch (error) {
      toast.error('Erro ao atualizar API Key');
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <Card className={`relative overflow-hidden bg-gradient-to-br ${providerColors[provider]}`}>
      <div className="absolute inset-0 bg-card/80 backdrop-blur-sm" />
      <CardHeader className="relative">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Icon className="h-6 w-6 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">{name}</CardTitle>
              <CardDescription className="text-xs">{description}</CardDescription>
            </div>
          </div>
          <ProviderStatusIndicator status={status} latency={latency} />
        </div>
      </CardHeader>
      <CardContent className="relative space-y-4">
        {/* Toggle ON/OFF */}
        <div className="flex items-center justify-between">
          <Label htmlFor={`toggle-${provider}`} className="text-sm">
            Provedor Ativo
          </Label>
          <Switch
            id={`toggle-${provider}`}
            checked={enabled}
            onCheckedChange={onToggle}
            disabled={!hasApiKey}
          />
        </div>

        {/* API Key Input */}
        <div className="space-y-2">
          <Label className="text-sm">API Key</Label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={hasApiKey ? '••••••••••••••••' : 'Não configurada'}
                className="pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                onClick={() => setShowKey(!showKey)}
              >
                {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleUpdateKey}
              disabled={isUpdating || !apiKey.trim()}
            >
              <Save className="h-4 w-4" />
            </Button>
          </div>
          {!hasApiKey && (
            <p className="text-xs text-muted-foreground">
              Configure a API Key para ativar este provedor
            </p>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 pt-3 border-t border-border/50">
          <div>
            <p className="text-xs text-muted-foreground">Requisições/Mês</p>
            <p className="text-lg font-semibold">{requestsMonth.toLocaleString('pt-BR')}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Custo/Mês</p>
            <p className="text-lg font-semibold">
              ${costMonth.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </p>
          </div>
        </div>

        {/* Status Badge */}
        {!enabled && hasApiKey && (
          <Badge variant="secondary" className="absolute top-2 right-2">
            Desativado
          </Badge>
        )}
      </CardContent>
    </Card>
  );
}
