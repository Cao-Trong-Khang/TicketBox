export class OrganizerTicketTypeDto {
  id!: string;
  code!: string;
  name!: string;
  priceVnd!: number;
  totalQuantity!: number;
  reservedQuantity!: number;
  soldQuantity!: number;
  availableQuantity!: number;
  perUserLimit!: number;
  saleStartAt!: string | null;
  saleEndAt!: string | null;
  status!: string;
  createdAt!: string;
  updatedAt!: string;
}
