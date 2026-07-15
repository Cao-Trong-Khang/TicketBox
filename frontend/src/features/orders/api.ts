import { apiFetch } from '../../lib/api-client';
import { CreateOrderRequest, CreateOrderResponse } from './types';

export function createOrder(request: CreateOrderRequest): Promise<CreateOrderResponse> {
  return apiFetch<CreateOrderResponse>('/orders', {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

export function getOrder(orderId: string): Promise<CreateOrderResponse> {
  return apiFetch<CreateOrderResponse>(`/orders/${encodeURIComponent(orderId)}`);
}
