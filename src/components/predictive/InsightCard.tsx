import { Card, CardContent } from '@/components/ui/card';
import { Lightbulb, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface InsightCardProps {
  insights: string[];
  alerts?: string[];
}

export function InsightCard({ insights, alerts = [] }: InsightCardProps) {
  return (
    <Card className="bg-card border-border/50">
      <CardContent className="pt-6 space-y-4">
        {insights.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Lightbulb className="h-5 w-5 text-yellow-500" />
              <h3 className="font-semibold text-foreground">Insights da IA</h3>
            </div>
            <ul className="space-y-2">
              {insights.map((insight, index) => (
                <li 
                  key={index}
                  className="flex items-start gap-2 text-sm text-muted-foreground"
                >
                  <span className="text-primary mt-1">•</span>
                  <span>{insight}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {alerts.length > 0 && (
          <div className="pt-4 border-t border-border">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <h3 className="font-semibold text-destructive">Alertas</h3>
            </div>
            <ul className="space-y-2">
              {alerts.map((alert, index) => (
                <li 
                  key={index}
                  className={cn(
                    "flex items-start gap-2 text-sm p-2 rounded-md",
                    "bg-destructive/10 text-destructive"
                  )}
                >
                  <span className="mt-0.5">⚠️</span>
                  <span>{alert}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {insights.length === 0 && alerts.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">
            Nenhum insight disponível no momento.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
