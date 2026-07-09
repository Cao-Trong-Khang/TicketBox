import { PaymentEntity } from './payment.entity';
import type { PaymentEntityProps } from './payment.entity';
import type { PaymentProviderName, PaymentStatus } from './payment.types';

export type PaymentDatabaseRow = {
  id: string;
  order_id: string;
  provider: PaymentProviderName;
  transaction_id: string;
  amount: string | number;
  status: PaymentStatus;
  created_at: Date | string;
  updated_at: Date | string;
};

export interface PaymentDatabaseClient {
  query<T extends Record<string, unknown> = Record<string, unknown>>(
    sql: string,
    params?: ReadonlyArray<unknown>,
  ): Promise<{ rows: T[] }>;
}

export interface PaymentRepository {
  create(payment: PaymentEntity): Promise<PaymentEntity>;
  findById(id: string): Promise<PaymentEntity | null>;
  findByOrderAndProvider(
    orderId: string,
    provider: PaymentProviderName,
  ): Promise<PaymentEntity | null>;
  updateStatus(id: string, status: PaymentStatus, transactionId?: string): Promise<PaymentEntity>;
}

export class PostgreSqlPaymentRepository implements PaymentRepository {
  constructor(private readonly databaseClient: PaymentDatabaseClient) {}

  async create(payment: PaymentEntity): Promise<PaymentEntity> {
    const result = await this.databaseClient.query<PaymentDatabaseRow>(
      `
        INSERT INTO payments (
          id,
          order_id,
          provider,
          transaction_id,
          amount,
          status,
          created_at,
          updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id, order_id, provider, transaction_id, amount, status, created_at, updated_at
      `,
      [
        payment.id,
        payment.orderId,
        payment.provider,
        payment.transactionId,
        payment.amount,
        payment.status,
        payment.createdAt,
        payment.updatedAt,
      ],
    );

    return this.mapRowToEntity(result.rows[0]);
  }

  async findById(id: string): Promise<PaymentEntity | null> {
    const result = await this.databaseClient.query<PaymentDatabaseRow>(
      `
        SELECT id, order_id, provider, transaction_id, amount, status, created_at, updated_at
        FROM payments
        WHERE id = $1
        LIMIT 1
      `,
      [id],
    );

    return result.rows[0] ? this.mapRowToEntity(result.rows[0]) : null;
  }

  async findByOrderAndProvider(
    orderId: string,
    provider: PaymentProviderName,
  ): Promise<PaymentEntity | null> {
    const result = await this.databaseClient.query<PaymentDatabaseRow>(
      `
        SELECT id, order_id, provider, transaction_id, amount, status, created_at, updated_at
        FROM payments
        WHERE order_id = $1 AND provider = $2
        LIMIT 1
      `,
      [orderId, provider],
    );

    return result.rows[0] ? this.mapRowToEntity(result.rows[0]) : null;
  }

  async updateStatus(id: string, status: PaymentStatus, transactionId?: string): Promise<PaymentEntity> {
    const result = await this.databaseClient.query<PaymentDatabaseRow>(
      `
        UPDATE payments
        SET
          status = $2,
          transaction_id = COALESCE($3, transaction_id),
          updated_at = NOW()
        WHERE id = $1
        RETURNING id, order_id, provider, transaction_id, amount, status, created_at, updated_at
      `,
      [id, status, transactionId ?? null],
    );

    return this.mapRowToEntity(result.rows[0]);
  }

  private mapRowToEntity(row: PaymentDatabaseRow): PaymentEntity {
    const props: PaymentEntityProps = {
      id: row.id,
      orderId: row.order_id,
      provider: row.provider,
      transactionId: row.transaction_id,
      amount: Number(row.amount),
      status: row.status,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };

    return PaymentEntity.fromDatabase(props);
  }
}
