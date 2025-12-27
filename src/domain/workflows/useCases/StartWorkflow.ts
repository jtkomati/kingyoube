import { Result } from '@/domain/shared/Result';
import { WorkflowRepository, WorkflowInstance } from '../repositories/WorkflowRepository';

export interface StartWorkflowInput {
  workflowName: string;
  entityId: string;
  entityType: 'INVOICE' | 'TRANSACTION' | 'CONTRACT' | 'PAYMENT';
  companyId: string;
  startedBy: string;
}

export class StartWorkflow {
  constructor(private repository: WorkflowRepository) {}

  async execute(input: StartWorkflowInput): Promise<Result<WorkflowInstance>> {
    // 1. Find workflow definition
    const definitionResult = await this.repository.findDefinitionByName(input.workflowName);
    
    if (definitionResult.isFailure) {
      return Result.fail(definitionResult.error!);
    }

    const definition = definitionResult.getValue();

    // 2. Validate entity type matches
    if (definition.entityType !== input.entityType) {
      return Result.fail(`Workflow ${input.workflowName} is for ${definition.entityType}, not ${input.entityType}`);
    }

    // 3. Check if instance already exists
    const existingResult = await this.repository.findInstanceByEntityId(input.entityId, input.workflowName);
    
    if (existingResult.isSuccess && existingResult.getValue() !== null) {
      return Result.fail('Workflow already started for this entity');
    }

    // 4. Get initial state
    const initialState = definition.states[0];
    
    if (!initialState) {
      return Result.fail('Workflow has no defined states');
    }

    // 5. Create instance
    const instanceResult = await this.repository.createInstance(
      definition.id,
      input.entityId,
      input.entityType,
      initialState,
      input.companyId,
      input.startedBy
    );

    return instanceResult;
  }
}
