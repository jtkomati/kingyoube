import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useBusinessRules } from '@/hooks/useBusinessRules';
import { BusinessRule, BusinessRuleFormData, RULE_CONTEXTS } from '@/types/business-rules';
import { useLanguage } from '@/contexts/LanguageContext';
import { t } from '@/lib/translations';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { JsonEditor } from '@/components/admin/JsonEditor';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, Pencil, Trash2, Cog, History } from 'lucide-react';

const CONTEXT_COLORS: Record<string, string> = {
  financeiro: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  faturamento: 'bg-green-500/10 text-green-600 border-green-500/20',
  tesouraria: 'bg-purple-500/10 text-purple-600 border-purple-500/20',
  compras: 'bg-orange-500/10 text-orange-600 border-orange-500/20',
  cobranca: 'bg-red-500/10 text-red-600 border-red-500/20',
  contabilidade: 'bg-cyan-500/10 text-cyan-600 border-cyan-500/20',
};

export default function BusinessRulesAdmin() {
  const { language } = useLanguage();
  const [activeContext, setActiveContext] = useState('all');
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<BusinessRule | null>(null);
  const [deleteConfirmRule, setDeleteConfirmRule] = useState<BusinessRule | null>(null);
  
  const { 
    rules, 
    isLoading, 
    createRule, 
    updateRule, 
    deleteRule, 
    toggleActive,
    isCreating,
    isUpdating,
  } = useBusinessRules(activeContext);

  const [formData, setFormData] = useState<BusinessRuleFormData>({
    rule_name: '',
    description: '',
    context: 'financeiro',
    logic: {},
    is_active: true,
  });

  const tr = (key: string) => t(language, 'businessRules', key);

  const handleOpenCreate = () => {
    setEditingRule(null);
    setFormData({
      rule_name: '',
      description: '',
      context: 'financeiro',
      logic: {},
      is_active: true,
    });
    setIsSheetOpen(true);
  };

  const handleOpenEdit = (rule: BusinessRule) => {
    setEditingRule(rule);
    setFormData({
      rule_name: rule.rule_name,
      description: rule.description,
      context: rule.context,
      logic: rule.logic,
      is_active: rule.is_active,
    });
    setIsSheetOpen(true);
  };

  const handleSave = async () => {
    try {
      if (editingRule) {
        await updateRule({ id: editingRule.id, data: formData });
      } else {
        await createRule(formData);
      }
      setIsSheetOpen(false);
    } catch {
      // Error handled in hook
    }
  };

  const handleDelete = async () => {
    if (deleteConfirmRule) {
      await deleteRule(deleteConfirmRule.id);
      setDeleteConfirmRule(null);
    }
  };

  const getContextLabel = (context: string) => {
    const found = RULE_CONTEXTS.find(c => c.value === context);
    return found ? tr(found.labelKey) : context;
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <Cog className="h-8 w-8 text-primary" />
              {tr('title')}
            </h1>
            <p className="text-muted-foreground mt-1">{tr('subtitle')}</p>
          </div>
          <Button onClick={handleOpenCreate}>
            <Plus className="h-4 w-4 mr-2" />
            {tr('newRule')}
          </Button>
        </div>

        {/* Context Tabs */}
        <Tabs value={activeContext} onValueChange={setActiveContext}>
          <TabsList>
            <TabsTrigger value="all">{tr('allContexts')}</TabsTrigger>
            {RULE_CONTEXTS.map((ctx) => (
              <TabsTrigger key={ctx.value} value={ctx.value}>
                {tr(ctx.labelKey)}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value={activeContext} className="mt-4">
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : rules.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Cog className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>{tr('noRules')}</p>
              </div>
            ) : (
              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{tr('ruleName')}</TableHead>
                      <TableHead>{tr('context')}</TableHead>
                      <TableHead className="text-center">{tr('version')}</TableHead>
                      <TableHead className="text-center">{tr('status')}</TableHead>
                      <TableHead className="text-right">{tr('actions')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rules.map((rule) => (
                      <TableRow key={rule.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium font-mono text-sm">{rule.rule_name}</p>
                            <p className="text-xs text-muted-foreground line-clamp-1">
                              {rule.description}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant="outline" 
                            className={CONTEXT_COLORS[rule.context] || ''}
                          >
                            {getContextLabel(rule.context)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
                            <History className="h-3 w-3" />
                            v{rule.version}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <Switch
                            checked={rule.is_active}
                            onCheckedChange={(checked) => 
                              toggleActive({ id: rule.id, isActive: checked })
                            }
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleOpenEdit(rule)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setDeleteConfirmRule(rule)}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Edit/Create Sheet */}
        <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
          <SheetContent className="sm:max-w-lg overflow-y-auto">
            <SheetHeader>
              <SheetTitle>
                {editingRule ? tr('editRule') : tr('createRule')}
              </SheetTitle>
              <SheetDescription>
                {editingRule 
                  ? tr('editRuleDescription') 
                  : tr('createRuleDescription')
                }
              </SheetDescription>
            </SheetHeader>

            <div className="space-y-4 py-6">
              <div className="space-y-2">
                <Label htmlFor="rule_name">{tr('ruleName')}</Label>
                <Input
                  id="rule_name"
                  value={formData.rule_name}
                  onChange={(e) => 
                    setFormData(prev => ({ 
                      ...prev, 
                      rule_name: e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '_')
                    }))
                  }
                  placeholder="PAYMENT_APPROVAL_LIMIT"
                  className="font-mono"
                />
                <p className="text-xs text-muted-foreground">
                  {tr('ruleNameHint')}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">{tr('description')}</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => 
                    setFormData(prev => ({ ...prev, description: e.target.value }))
                  }
                  placeholder={tr('descriptionPlaceholder')}
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="context">{tr('context')}</Label>
                <Select
                  value={formData.context}
                  onValueChange={(value) => 
                    setFormData(prev => ({ ...prev, context: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RULE_CONTEXTS.map((ctx) => (
                      <SelectItem key={ctx.value} value={ctx.value}>
                        {tr(ctx.labelKey)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="is_active">{tr('active')}</Label>
                <Switch
                  id="is_active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) => 
                    setFormData(prev => ({ ...prev, is_active: checked }))
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>{tr('logic')}</Label>
                <JsonEditor
                  value={formData.logic}
                  onChange={(logic) => setFormData(prev => ({ ...prev, logic }))}
                />
                <p className="text-xs text-muted-foreground">
                  {tr('logicHint')}
                </p>
              </div>

              {editingRule && (
                <div className="pt-4 border-t text-xs text-muted-foreground space-y-1">
                  <p>{tr('version')}: {editingRule.version}</p>
                  <p>{tr('createdAt')}: {new Date(editingRule.created_at).toLocaleString()}</p>
                  <p>{tr('updatedAt')}: {new Date(editingRule.updated_at).toLocaleString()}</p>
                </div>
              )}
            </div>

            <SheetFooter>
              <Button
                variant="outline"
                onClick={() => setIsSheetOpen(false)}
              >
                {tr('cancel')}
              </Button>
              <Button
                onClick={handleSave}
                disabled={
                  isCreating || 
                  isUpdating || 
                  !formData.rule_name || 
                  !formData.description
                }
              >
                {isCreating || isUpdating ? tr('saving') : tr('save')}
              </Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>

        {/* Delete Confirmation */}
        <AlertDialog 
          open={!!deleteConfirmRule} 
          onOpenChange={() => setDeleteConfirmRule(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{tr('deleteConfirmTitle')}</AlertDialogTitle>
              <AlertDialogDescription>
                {tr('deleteConfirmDescription').replace(
                  '{rule}', 
                  deleteConfirmRule?.rule_name || ''
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{tr('cancel')}</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {tr('delete')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  );
}
