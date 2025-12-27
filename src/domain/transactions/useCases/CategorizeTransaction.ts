import { Result } from '@/domain/shared/Result';
import { DomainEvents } from '@/domain/shared/DomainEvent';
import { Transaction } from '../entities/Transaction';
import { TransactionRepository } from '../repositories/TransactionRepository';

export interface CategorizeTransactionInput {
  transactionId: string;
  categoryId: string;
}

export interface TransactionCategorizedEvent {
  occurredAt: Date;
  eventType: 'TRANSACTION_CATEGORIZED';
  aggregateId: string;
  transactionId: string;
  previousCategoryId: string;
  newCategoryId: string;
  companyId: string;
}

export class CategorizeTransaction {
  constructor(private repository: TransactionRepository) {}

  async execute(input: CategorizeTransactionInput): Promise<Result<Transaction>> {
    // 1. Find transaction
    const findResult = await this.repository.findById(input.transactionId);
    
    if (findResult.isFailure) {
      return Result.fail(findResult.error!);
    }

    const transaction = findResult.getValue();
    const previousCategoryId = transaction.categoryId;

    // 2. Business validation
    if (!input.categoryId) {
      return Result.fail('Categoria é obrigatória');
    }

    if (transaction.categoryId === input.categoryId) {
      return Result.fail('Transação já está nesta categoria');
    }

    // 3. Apply domain logic
    transaction.updateCategory(input.categoryId);

    // 4. Persist
    const updateResult = await this.repository.update(transaction);

    if (updateResult.isFailure) {
      return Result.fail(updateResult.error!);
    }

    const updatedTransaction = updateResult.getValue();

    // 5. Dispatch domain event
    const event: TransactionCategorizedEvent = {
      occurredAt: new Date(),
      eventType: 'TRANSACTION_CATEGORIZED',
      aggregateId: updatedTransaction.id,
      transactionId: updatedTransaction.id,
      previousCategoryId,
      newCategoryId: input.categoryId,
      companyId: updatedTransaction.companyId,
    };

    DomainEvents.markAggregateForDispatch(updatedTransaction.id, event);
    await DomainEvents.dispatchEventsForAggregate(updatedTransaction.id);

    return Result.ok(updatedTransaction);
  }
}
