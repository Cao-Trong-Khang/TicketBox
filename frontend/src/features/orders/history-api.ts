import { apiFetch } from '../../lib/api-client';
import { OrderHistoryItem } from './history-types';

export type OrderHistoryDataSource = {
  listOrders: () => Promise<OrderHistoryItem[]>;
};

export const orderHistoryDataSource: OrderHistoryDataSource = {
  listOrders: () => apiFetch<OrderHistoryItem[]>('/orders/history'),
};