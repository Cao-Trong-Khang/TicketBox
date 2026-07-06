export class OrganizerConcertRevenueConcertDto {
  id!: string;
  status!: string;
  lifecycleStatus!: string;
  title!: string;
  artistName!: string | null;
  venueName!: string;
  venueAddress!: string | null;
  bannerUrl!: string | null;
  startsAt!: string;
  endsAt!: string | null;
  performanceStartAt!: string;
}

export class OrganizerConcertRevenueSummaryDto {
  totalRevenueVnd!: number;
  totalSoldQuantity!: number;
  totalReservedQuantity!: number;
  totalAvailableQuantity!: number;
  totalTicketQuantity!: number;
  soldRate!: number;
  paidOrderCount!: number;
}

export class OrganizerConcertRevenueTicketTypeDto {
  id!: string;
  code!: string;
  name!: string;
  priceVnd!: number;
  totalQuantity!: number;
  reservedQuantity!: number;
  soldQuantity!: number;
  availableQuantity!: number;
  revenueVnd!: number;
  soldRate!: number;
  status!: string;
}

export class OrganizerConcertRevenueDto {
  concert!: OrganizerConcertRevenueConcertDto;
  summary!: OrganizerConcertRevenueSummaryDto;
  ticketTypes!: OrganizerConcertRevenueTicketTypeDto[];
}
