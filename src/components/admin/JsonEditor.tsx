import { useState, useEffect, useCallback } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { AlertCircle, Check, Minimize2, Maximize2 } from 'lucide-react';

interface JsonEditorProps {
  value: Record<string, any>;
  onChange: (value: Record<string, any>) => void;
  className?: string;
  disabled?: boolean;
}

export function JsonEditor({ value, onChange, className, disabled }: JsonEditorProps) {
  const [textValue, setTextValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isValid, setIsValid] = useState(true);

  useEffect(() => {
    try {
      setTextValue(JSON.stringify(value, null, 2));
      setError(null);
      setIsValid(true);
    } catch {
      setTextValue('{}');
    }
  }, [value]);

  const handleChange = useCallback((newValue: string) => {
    setTextValue(newValue);
    
    try {
      const parsed = JSON.parse(newValue);
      setError(null);
      setIsValid(true);
      onChange(parsed);
    } catch (e) {
      setError((e as Error).message);
      setIsValid(false);
    }
  }, [onChange]);

  const handleFormat = useCallback(() => {
    try {
      const parsed = JSON.parse(textValue);
      setTextValue(JSON.stringify(parsed, null, 2));
      setError(null);
      setIsValid(true);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [textValue]);

  const handleMinify = useCallback(() => {
    try {
      const parsed = JSON.parse(textValue);
      setTextValue(JSON.stringify(parsed));
      setError(null);
      setIsValid(true);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [textValue]);

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isValid ? (
            <span className="flex items-center gap-1 text-xs text-green-600">
              <Check className="h-3 w-3" />
              JSON válido
            </span>
          ) : (
            <span className="flex items-center gap-1 text-xs text-destructive">
              <AlertCircle className="h-3 w-3" />
              JSON inválido
            </span>
          )}
        </div>
        <div className="flex gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleFormat}
            disabled={disabled}
            className="h-7 px-2 text-xs"
          >
            <Maximize2 className="h-3 w-3 mr-1" />
            Formatar
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleMinify}
            disabled={disabled}
            className="h-7 px-2 text-xs"
          >
            <Minimize2 className="h-3 w-3 mr-1" />
            Minificar
          </Button>
        </div>
      </div>
      
      <Textarea
        value={textValue}
        onChange={(e) => handleChange(e.target.value)}
        disabled={disabled}
        className={cn(
          'font-mono text-sm min-h-[200px] resize-y',
          'bg-muted/50 border-2',
          !isValid && 'border-destructive focus-visible:ring-destructive',
          isValid && 'border-border'
        )}
        placeholder='{"key": "value"}'
      />
      
      {error && (
        <p className="text-xs text-destructive flex items-start gap-1">
          <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />
          <span className="break-all">{error}</span>
        </p>
      )}
    </div>
  );
}
