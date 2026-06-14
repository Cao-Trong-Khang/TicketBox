export type PublicTicketTypeDto = {
  id: string;
  code: string;
  name: string;
  priceVnd: number;
  totalQuantity: number;
  availableQuantity: number;
  perUserLimit: number;
  saleStartAt: string;
  saleEndAt: string | null;
};
