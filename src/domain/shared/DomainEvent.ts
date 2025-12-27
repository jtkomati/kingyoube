/**
 * Base interface for domain events
 */
export interface DomainEvent {
  readonly occurredAt: Date;
  readonly eventType: string;
  readonly aggregateId: string;
}

/**
 * Domain event dispatcher for pub/sub pattern
 */
type EventHandler<T extends DomainEvent> = (event: T) => void | Promise<void>;

class DomainEventsDispatcher {
  private static handlers: Map<string, EventHandler<DomainEvent>[]> = new Map();
  private static markedAggregates: Map<string, DomainEvent[]> = new Map();

  public static register<T extends DomainEvent>(
    eventType: string,
    handler: EventHandler<T>
  ): void {
    const handlers = this.handlers.get(eventType) || [];
    handlers.push(handler as EventHandler<DomainEvent>);
    this.handlers.set(eventType, handlers);
  }

  public static clearHandlers(): void {
    this.handlers.clear();
  }

  public static markAggregateForDispatch(aggregateId: string, event: DomainEvent): void {
    const events = this.markedAggregates.get(aggregateId) || [];
    events.push(event);
    this.markedAggregates.set(aggregateId, events);
  }

  public static async dispatchEventsForAggregate(aggregateId: string): Promise<void> {
    const events = this.markedAggregates.get(aggregateId) || [];
    
    for (const event of events) {
      await this.dispatch(event);
    }
    
    this.markedAggregates.delete(aggregateId);
  }

  public static async dispatch(event: DomainEvent): Promise<void> {
    const handlers = this.handlers.get(event.eventType) || [];
    
    for (const handler of handlers) {
      await handler(event);
    }
  }
}

export const DomainEvents = DomainEventsDispatcher;
