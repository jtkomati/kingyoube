import { Entity } from '@/domain/shared/Entity';

// Matches the database enum: transaction_type = "RECEIVABLE" | "PAYABLE"
export type TransactionType = 'RECEIVABLE' | 'PAYABLE';

export interface TransactionProps {
  type: TransactionType;
  description?: string;
  grossAmount: number;
  discountAmount: number;
  netAmount: number;
  categoryId: string;
  customerId?: string;
  supplierId?: string;
  dueDate: Date;
  paymentDate?: Date;
  invoiceNumber?: string;
  invoiceStatus?: string;
  companyId: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export class Transaction extends Entity<TransactionProps> {
  private constructor(props: TransactionProps, id: string) {
    super(props, id);
  }

  public static create(props: TransactionProps, id: string): Transaction {
    return new Transaction(props, id);
  }

  // Getters
  get type(): TransactionType {
    return this.props.type;
  }

  get description(): string | undefined {
    return this.props.description;
  }

  get grossAmount(): number {
    return this.props.grossAmount;
  }

  get discountAmount(): number {
    return this.props.discountAmount;
  }

  get netAmount(): number {
    return this.props.netAmount;
  }

  get categoryId(): string {
    return this.props.categoryId;
  }

  get customerId(): string | undefined {
    return this.props.customerId;
  }

  get supplierId(): string | undefined {
    return this.props.supplierId;
  }

  get dueDate(): Date {
    return this.props.dueDate;
  }

  get paymentDate(): Date | undefined {
    return this.props.paymentDate;
  }

  get invoiceNumber(): string | undefined {
    return this.props.invoiceNumber;
  }

  get invoiceStatus(): string | undefined {
    return this.props.invoiceStatus;
  }

  get companyId(): string {
    return this.props.companyId;
  }

  get createdBy(): string {
    return this.props.createdBy;
  }

  get isReceivable(): boolean {
    return this.props.type === 'RECEIVABLE';
  }

  get isPayable(): boolean {
    return this.props.type === 'PAYABLE';
  }

  get isPaid(): boolean {
    return this.props.paymentDate !== undefined;
  }

  get isOverdue(): boolean {
    if (this.isPaid) return false;
    return new Date() > this.props.dueDate;
  }

  // Business methods
  public markAsPaid(paymentDate: Date = new Date()): void {
    this.props.paymentDate = paymentDate;
    this.props.updatedAt = new Date();
  }

  public updateCategory(categoryId: string): void {
    this.props.categoryId = categoryId;
    this.props.updatedAt = new Date();
  }

  public updateInvoiceStatus(status: string, invoiceNumber?: string): void {
    this.props.invoiceStatus = status;
    if (invoiceNumber) {
      this.props.invoiceNumber = invoiceNumber;
    }
    this.props.updatedAt = new Date();
  }

  public toDTO(): TransactionProps & { id: string } {
    return {
      id: this._id,
      ...this.props,
    };
  }
}
