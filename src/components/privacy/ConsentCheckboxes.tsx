import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Link } from 'react-router-dom';

interface ConsentCheckboxesProps {
  termsAccepted: boolean;
  privacyAccepted: boolean;
  marketingAccepted: boolean;
  onTermsChange: (checked: boolean) => void;
  onPrivacyChange: (checked: boolean) => void;
  onMarketingChange: (checked: boolean) => void;
  errors?: {
    terms?: string;
    privacy?: string;
  };
}

export function ConsentCheckboxes({
  termsAccepted,
  privacyAccepted,
  marketingAccepted,
  onTermsChange,
  onPrivacyChange,
  onMarketingChange,
  errors,
}: ConsentCheckboxesProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-start space-x-2">
        <Checkbox
          id="terms"
          checked={termsAccepted}
          onCheckedChange={onTermsChange}
          className={errors?.terms ? 'border-destructive' : ''}
        />
        <div className="grid gap-1.5 leading-none">
          <Label
            htmlFor="terms"
            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
          >
            Aceito os{' '}
            <Link to="/terms" className="text-primary hover:underline" target="_blank">
              Termos de Uso
            </Link>{' '}
            <span className="text-destructive">*</span>
          </Label>
          {errors?.terms && (
            <p className="text-xs text-destructive">{errors.terms}</p>
          )}
        </div>
      </div>

      <div className="flex items-start space-x-2">
        <Checkbox
          id="privacy"
          checked={privacyAccepted}
          onCheckedChange={onPrivacyChange}
          className={errors?.privacy ? 'border-destructive' : ''}
        />
        <div className="grid gap-1.5 leading-none">
          <Label
            htmlFor="privacy"
            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
          >
            Li e aceito a{' '}
            <Link to="/privacy-policy" className="text-primary hover:underline" target="_blank">
              Política de Privacidade
            </Link>{' '}
            <span className="text-destructive">*</span>
          </Label>
          {errors?.privacy && (
            <p className="text-xs text-destructive">{errors.privacy}</p>
          )}
        </div>
      </div>

      <div className="flex items-start space-x-2">
        <Checkbox
          id="marketing"
          checked={marketingAccepted}
          onCheckedChange={onMarketingChange}
        />
        <div className="grid gap-1.5 leading-none">
          <Label
            htmlFor="marketing"
            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
          >
            Aceito receber comunicações de marketing e novidades (opcional)
          </Label>
        </div>
      </div>
    </div>
  );
}
