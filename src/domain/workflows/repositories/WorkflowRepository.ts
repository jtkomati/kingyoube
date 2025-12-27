import { supabase } from '@/integrations/supabase/client';
import { Result } from '@/domain/shared/Result';

export interface WorkflowDefinition {
  id: string;
  name: string;
  entityType: 'INVOICE' | 'TRANSACTION' | 'CONTRACT' | 'PAYMENT';
  description?: string;
  states: string[];
  transitions: WorkflowTransition[];
  isActive: boolean;
  companyId?: string;
}

export interface WorkflowTransition {
  from: string;
  to: string;
  action: string;
  roles: string[];
}

export interface WorkflowInstance {
  id: string;
  workflowId: string;
  entityId: string;
  entityType: string;
  currentState: string;
  metadata: Record<string, unknown>;
  companyId?: string;
  startedBy?: string;
  startedAt: Date;
  completedAt?: Date;
}

export interface WorkflowHistoryEntry {
  id: string;
  instanceId: string;
  fromState?: string;
  toState: string;
  action: string;
  userId?: string;
  notes?: string;
  createdAt: Date;
}

export class WorkflowRepository {
  async findDefinitionByName(name: string): Promise<Result<WorkflowDefinition>> {
    const { data, error } = await supabase
      .from('workflow_definitions')
      .select('*')
      .eq('name', name)
      .eq('is_active', true)
      .single();

    if (error || !data) {
      return Result.fail(`Workflow not found: ${error?.message || 'Unknown error'}`);
    }

    return Result.ok(this.mapDefinition(data));
  }

  async findDefinitionsByEntityType(entityType: string): Promise<Result<WorkflowDefinition[]>> {
    const { data, error } = await supabase
      .from('workflow_definitions')
      .select('*')
      .eq('entity_type', entityType)
      .eq('is_active', true);

    if (error) {
      return Result.fail(`Failed to fetch workflows: ${error.message}`);
    }

    return Result.ok((data || []).map(this.mapDefinition));
  }

  async findInstanceByEntityId(entityId: string, workflowName?: string): Promise<Result<WorkflowInstance | null>> {
    let query = supabase
      .from('workflow_instances')
      .select('*, workflow_definitions(name)')
      .eq('entity_id', entityId);

    if (workflowName) {
      query = query.eq('workflow_definitions.name', workflowName);
    }

    const { data, error } = await query.maybeSingle();

    if (error) {
      return Result.fail(`Failed to fetch workflow instance: ${error.message}`);
    }

    if (!data) {
      return Result.ok(null);
    }

    return Result.ok(this.mapInstance(data));
  }

  async createInstance(
    workflowId: string,
    entityId: string,
    entityType: string,
    initialState: string,
    companyId: string,
    startedBy: string
  ): Promise<Result<WorkflowInstance>> {
    const { data, error } = await supabase
      .from('workflow_instances')
      .insert({
        workflow_id: workflowId,
        entity_id: entityId,
        entity_type: entityType,
        current_state: initialState,
        company_id: companyId,
        started_by: startedBy,
      })
      .select()
      .single();

    if (error || !data) {
      return Result.fail(`Failed to create workflow instance: ${error?.message || 'Unknown error'}`);
    }

    return Result.ok(this.mapInstance(data));
  }

  async transition(
    instanceId: string,
    toState: string,
    action: string,
    notes?: string
  ): Promise<Result<{ fromState: string; toState: string }>> {
    const { data, error } = await supabase.rpc('workflow_transition', {
      p_instance_id: instanceId,
      p_to_state: toState,
      p_action: action,
      p_notes: notes,
    });

    if (error) {
      return Result.fail(`Transition failed: ${error.message}`);
    }

    const result = data as { success: boolean; error?: string; from_state?: string; to_state?: string };

    if (!result.success) {
      return Result.fail(result.error || 'Transition failed');
    }

    return Result.ok({
      fromState: result.from_state!,
      toState: result.to_state!,
    });
  }

  async getHistory(instanceId: string): Promise<Result<WorkflowHistoryEntry[]>> {
    const { data, error } = await supabase
      .from('workflow_history')
      .select('*')
      .eq('instance_id', instanceId)
      .order('created_at', { ascending: true });

    if (error) {
      return Result.fail(`Failed to fetch history: ${error.message}`);
    }

    return Result.ok((data || []).map(this.mapHistory));
  }

  private mapDefinition(data: Record<string, unknown>): WorkflowDefinition {
    return {
      id: data.id as string,
      name: data.name as string,
      entityType: data.entity_type as WorkflowDefinition['entityType'],
      description: data.description as string | undefined,
      states: (typeof data.states === 'string' ? JSON.parse(data.states) : data.states) as string[],
      transitions: (typeof data.transitions === 'string' ? JSON.parse(data.transitions) : data.transitions) as WorkflowTransition[],
      isActive: data.is_active as boolean,
      companyId: data.company_id as string | undefined,
    };
  }

  private mapInstance(data: Record<string, unknown>): WorkflowInstance {
    return {
      id: data.id as string,
      workflowId: data.workflow_id as string,
      entityId: data.entity_id as string,
      entityType: data.entity_type as string,
      currentState: data.current_state as string,
      metadata: (data.metadata || {}) as Record<string, unknown>,
      companyId: data.company_id as string | undefined,
      startedBy: data.started_by as string | undefined,
      startedAt: new Date(data.started_at as string),
      completedAt: data.completed_at ? new Date(data.completed_at as string) : undefined,
    };
  }

  private mapHistory(data: Record<string, unknown>): WorkflowHistoryEntry {
    return {
      id: data.id as string,
      instanceId: data.instance_id as string,
      fromState: data.from_state as string | undefined,
      toState: data.to_state as string,
      action: data.action as string,
      userId: data.user_id as string | undefined,
      notes: data.notes as string | undefined,
      createdAt: new Date(data.created_at as string),
    };
  }
}
