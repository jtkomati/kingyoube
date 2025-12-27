import { supabase } from '@/integrations/supabase/client';
import { Transaction, TransactionProps, TransactionType } from '../entities/Transaction';
import { Result } from '@/domain/shared/Result';

export interface CreateTransactionDTO {
  type: TransactionType;
  description?: string;
  grossAmount: number;
  discountAmount?: number;
  netAmount: number;
  categoryId: string;
  customerId?: string;
  supplierId?: string;
  dueDate: Date;
  paymentDate?: Date;
  companyId: string;
  createdBy: string;
}

export interface TransactionFilters {
  companyId?: string;
  type?: TransactionType;
  categoryId?: string;
  customerId?: string;
  supplierId?: string;
  startDate?: Date;
  endDate?: Date;
  isPaid?: boolean;
  isOverdue?: boolean;
}

export class TransactionRepository {
  async findById(id: string): Promise<Result<Transaction>> {
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      return Result.fail(`Transaction not found: ${error?.message || 'Unknown error'}`);
    }

    return Result.ok(this.mapToEntity(data));
  }

  async findMany(filters: TransactionFilters = {}): Promise<Result<Transaction[]>> {
    let query = supabase.from('transactions').select('*');

    if (filters.companyId) {
      query = query.eq('company_id', filters.companyId);
    }
    if (filters.type) {
      query = query.eq('type', filters.type);
    }
    if (filters.categoryId) {
      query = query.eq('category_id', filters.categoryId);
    }
    if (filters.customerId) {
      query = query.eq('customer_id', filters.customerId);
    }
    if (filters.supplierId) {
      query = query.eq('supplier_id', filters.supplierId);
    }
    if (filters.startDate) {
      query = query.gte('due_date', filters.startDate.toISOString());
    }
    if (filters.endDate) {
      query = query.lte('due_date', filters.endDate.toISOString());
    }
    if (filters.isPaid !== undefined) {
      if (filters.isPaid) {
        query = query.not('payment_date', 'is', null);
      } else {
        query = query.is('payment_date', null);
      }
    }

    const { data, error } = await query.order('due_date', { ascending: false });

    if (error) {
      return Result.fail(`Failed to fetch transactions: ${error.message}`);
    }

    const transactions = (data || []).map(this.mapToEntity);
    
    // Filter overdue in memory if needed
    if (filters.isOverdue !== undefined) {
      const now = new Date();
      return Result.ok(
        transactions.filter(t => 
          filters.isOverdue ? (!t.isPaid && t.dueDate < now) : (t.isPaid || t.dueDate >= now)
        )
      );
    }

    return Result.ok(transactions);
  }

  async create(dto: CreateTransactionDTO): Promise<Result<Transaction>> {
    const { data, error } = await supabase
      .from('transactions')
      .insert({
        type: dto.type,
        description: dto.description,
        gross_amount: dto.grossAmount,
        discount_amount: dto.discountAmount || 0,
        net_amount: dto.netAmount,
        category_id: dto.categoryId,
        customer_id: dto.customerId,
        supplier_id: dto.supplierId,
        due_date: dto.dueDate.toISOString().split('T')[0],
        payment_date: dto.paymentDate?.toISOString().split('T')[0],
        company_id: dto.companyId,
        created_by: dto.createdBy,
      })
      .select()
      .single();

    if (error || !data) {
      return Result.fail(`Failed to create transaction: ${error?.message || 'Unknown error'}`);
    }

    return Result.ok(this.mapToEntity(data));
  }

  async update(transaction: Transaction): Promise<Result<Transaction>> {
    const dto = transaction.toDTO();

    const { data, error } = await supabase
      .from('transactions')
      .update({
        description: dto.description,
        gross_amount: dto.grossAmount,
        discount_amount: dto.discountAmount,
        net_amount: dto.netAmount,
        category_id: dto.categoryId,
        customer_id: dto.customerId,
        supplier_id: dto.supplierId,
        due_date: dto.dueDate instanceof Date ? dto.dueDate.toISOString().split('T')[0] : dto.dueDate,
        payment_date: dto.paymentDate ? (dto.paymentDate instanceof Date ? dto.paymentDate.toISOString().split('T')[0] : dto.paymentDate) : null,
        invoice_number: dto.invoiceNumber,
        invoice_status: dto.invoiceStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', dto.id)
      .select()
      .single();

    if (error || !data) {
      return Result.fail(`Failed to update transaction: ${error?.message || 'Unknown error'}`);
    }

    return Result.ok(this.mapToEntity(data));
  }

  async delete(id: string): Promise<Result<void>> {
    const { error } = await supabase
      .from('transactions')
      .delete()
      .eq('id', id);

    if (error) {
      return Result.fail(`Failed to delete transaction: ${error.message}`);
    }

    return Result.ok();
  }

  private mapToEntity(data: Record<string, unknown>): Transaction {
    const props: TransactionProps = {
      type: data.type as TransactionType,
      description: data.description as string | undefined,
      grossAmount: Number(data.gross_amount),
      discountAmount: Number(data.discount_amount),
      netAmount: Number(data.net_amount),
      categoryId: data.category_id as string,
      customerId: data.customer_id as string | undefined,
      supplierId: data.supplier_id as string | undefined,
      dueDate: new Date(data.due_date as string),
      paymentDate: data.payment_date ? new Date(data.payment_date as string) : undefined,
      invoiceNumber: data.invoice_number as string | undefined,
      invoiceStatus: data.invoice_status as string | undefined,
      companyId: data.company_id as string,
      createdBy: data.created_by as string,
      createdAt: new Date(data.created_at as string),
      updatedAt: new Date(data.updated_at as string),
    };

    return Transaction.create(props, data.id as string);
  }
}
