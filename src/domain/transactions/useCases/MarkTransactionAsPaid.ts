import { Result } from '@/domain/shared/Result';
import { DomainEvents } from '@/domain/shared/DomainEvent';
import { Transaction, TransactionType } from '../entities/Transaction';
import { TransactionRepository } from '../repositories/TransactionRepository';

export interface MarkAsPaidInput {
  transactionId: string;
  paymentDate?: Date;
}

export interface TransactionPaidEvent {
  occurredAt: Date;
  eventType: 'TRANSACTION_PAID';
  aggregateId: string;
  transactionId: string;
  type: TransactionType;
  amount: number;
  paymentDate: Date;
  companyId: string;
}

export class MarkTransactionAsPaid {
  constructor(private repository: TransactionRepository) {}

  async execute(input: MarkAsPaidInput): Promise<Result<Transaction>> {
    // 1. Find transaction
    const findResult = await this.repository.findById(input.transactionId);
    
    if (findResult.isFailure) {
      return Result.fail(findResult.error!);
    }

    const transaction = findResult.getValue();

    // 2. Business validation
    if (transaction.isPaid) {
      return Result.fail('Transação já foi paga');
    }

    // 3. Apply domain logic
    const paymentDate = input.paymentDate || new Date();
    transaction.markAsPaid(paymentDate);

    // 4. Persist
    const updateResult = await this.repository.update(transaction);

    if (updateResult.isFailure) {
      return Result.fail(updateResult.error!);
    }

    const updatedTransaction = updateResult.getValue();

    // 5. Dispatch domain event
    const event: TransactionPaidEvent = {
      occurredAt: new Date(),
      eventType: 'TRANSACTION_PAID',
      aggregateId: updatedTransaction.id,
      transactionId: updatedTransaction.id,
      type: updatedTransaction.type,
      amount: updatedTransaction.netAmount,
      paymentDate,
      companyId: updatedTransaction.companyId,
    };

    DomainEvents.markAggregateForDispatch(updatedTransaction.id, event);
    await DomainEvents.dispatchEventsForAggregate(updatedTransaction.id);

    return Result.ok(updatedTransaction);
  }
}
