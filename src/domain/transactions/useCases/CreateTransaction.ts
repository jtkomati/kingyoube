import { Result } from '@/domain/shared/Result';
import { DomainEvents } from '@/domain/shared/DomainEvent';
import { Transaction, TransactionType } from '../entities/Transaction';
import { TransactionRepository, CreateTransactionDTO } from '../repositories/TransactionRepository';

export interface CreateTransactionInput {
  type: TransactionType;
  description?: string;
  grossAmount: number;
  discountAmount?: number;
  categoryId: string;
  customerId?: string;
  supplierId?: string;
  dueDate: Date;
  paymentDate?: Date;
  companyId: string;
  createdBy: string;
}

export interface TransactionCreatedEvent {
  occurredAt: Date;
  eventType: 'TRANSACTION_CREATED';
  aggregateId: string;
  transactionId: string;
  type: TransactionType;
  amount: number;
  companyId: string;
}

export class CreateTransaction {
  constructor(private repository: TransactionRepository) {}

  async execute(input: CreateTransactionInput): Promise<Result<Transaction>> {
    // 1. Business validation
    if (input.grossAmount <= 0) {
      return Result.fail('O valor bruto deve ser positivo');
    }

    if (!input.categoryId) {
      return Result.fail('Categoria é obrigatória');
    }

    if (!input.dueDate) {
      return Result.fail('Data de vencimento é obrigatória');
    }

    if (input.type === 'RECEIVABLE' && !input.customerId) {
      // Receivables may not have a customer in some cases
    }

    if (input.type === 'PAYABLE' && !input.supplierId) {
      // Payables may not have a supplier in some cases
    }

    // 2. Calculate net amount
    const discountAmount = input.discountAmount || 0;
    const netAmount = input.grossAmount - discountAmount;

    if (netAmount < 0) {
      return Result.fail('O valor líquido não pode ser negativo');
    }

    // 3. Create DTO
    const dto: CreateTransactionDTO = {
      type: input.type,
      description: input.description,
      grossAmount: input.grossAmount,
      discountAmount,
      netAmount,
      categoryId: input.categoryId,
      customerId: input.customerId,
      supplierId: input.supplierId,
      dueDate: input.dueDate,
      paymentDate: input.paymentDate,
      companyId: input.companyId,
      createdBy: input.createdBy,
    };

    // 4. Persist
    const result = await this.repository.create(dto);

    if (result.isFailure) {
      return Result.fail(result.error!);
    }

    const transaction = result.getValue();

    // 5. Dispatch domain event
    const event: TransactionCreatedEvent = {
      occurredAt: new Date(),
      eventType: 'TRANSACTION_CREATED',
      aggregateId: transaction.id,
      transactionId: transaction.id,
      type: transaction.type,
      amount: transaction.netAmount,
      companyId: transaction.companyId,
    };

    DomainEvents.markAggregateForDispatch(transaction.id, event);
    await DomainEvents.dispatchEventsForAggregate(transaction.id);

    return Result.ok(transaction);
  }
}
