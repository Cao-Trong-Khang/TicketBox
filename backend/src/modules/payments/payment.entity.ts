import type { PaymentProviderName, PaymentStatus } from './payment.types';

export type PaymentEntityProps = {
  id: string;
  orderId: string;
  provider: PaymentProviderName;
  transactionId: string;
  amount: number;
  status: PaymentStatus;
  createdAt: Date;
  updatedAt: Date;
};

export class PaymentEntity {
  readonly id: string;
  readonly orderId: string;
  readonly provider: PaymentProviderName;
  readonly transactionId: string;
  readonly amount: number;
  readonly status: PaymentStatus;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  constructor(props: PaymentEntityProps) {
    this.id = props.id;
    this.orderId = props.orderId;
    this.provider = props.provider;
    this.transactionId = props.transactionId;
    this.amount = props.amount;
    this.status = props.status;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  static fromDatabase(row: PaymentEntityProps): PaymentEntity {
    return new PaymentEntity(row);
  }
}
