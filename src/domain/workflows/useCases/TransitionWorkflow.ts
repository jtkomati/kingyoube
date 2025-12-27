import { Result } from '@/domain/shared/Result';
import { DomainEvents } from '@/domain/shared/DomainEvent';
import { WorkflowRepository } from '../repositories/WorkflowRepository';

export interface TransitionWorkflowInput {
  entityId: string;
  toState: string;
  action: string;
  notes?: string;
}

export interface WorkflowTransitionedEvent {
  occurredAt: Date;
  eventType: 'WORKFLOW_TRANSITIONED';
  aggregateId: string;
  entityId: string;
  fromState: string;
  toState: string;
  action: string;
}

export class TransitionWorkflow {
  constructor(private repository: WorkflowRepository) {}

  async execute(input: TransitionWorkflowInput): Promise<Result<{ fromState: string; toState: string }>> {
    // 1. Find workflow instance
    const instanceResult = await this.repository.findInstanceByEntityId(input.entityId);
    
    if (instanceResult.isFailure) {
      return Result.fail(instanceResult.error!);
    }

    const instance = instanceResult.getValue();

    if (!instance) {
      return Result.fail('No workflow found for this entity');
    }

    // 2. Execute transition
    const transitionResult = await this.repository.transition(
      instance.id,
      input.toState,
      input.action,
      input.notes
    );

    if (transitionResult.isFailure) {
      return Result.fail(transitionResult.error!);
    }

    const { fromState, toState } = transitionResult.getValue();

    // 3. Dispatch domain event
    const event: WorkflowTransitionedEvent = {
      occurredAt: new Date(),
      eventType: 'WORKFLOW_TRANSITIONED',
      aggregateId: instance.id,
      entityId: input.entityId,
      fromState,
      toState,
      action: input.action,
    };

    DomainEvents.markAggregateForDispatch(instance.id, event);
    await DomainEvents.dispatchEventsForAggregate(instance.id);

    return Result.ok({ fromState, toState });
  }
}
