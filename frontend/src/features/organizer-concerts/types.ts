export type OrganizerConcertLifecycleStatus = 'UPCOMING' | 'ONGOING' | 'ENDED' | string;

export type OrganizerConcertListItem = {
  id: string;
  status: string;
  lifecycleStatus: OrganizerConcertLifecycleStatus;
  title: string;
  artistName: string | null;
  venueName: string;
  venueAddress: string | null;
  bannerUrl: string | null;
  startsAt: string;
  endsAt: string | null;
  performanceStartAt: string;
  createdAt: string;
  updatedAt: string;
};

export type OrganizerConcertDetail = {
  id: string;
  status: string;
  lifecycleStatus: OrganizerConcertLifecycleStatus;
  title: string;
  artistName: string | null;
  description: string | null;
  venueName: string;
  venueAddress: string | null;
  bannerUrl: string | null;
  seatingSvg: string | null;
  startsAt: string;
  endsAt: string | null;
  performanceStartAt: string;
  createdAt: string;
  updatedAt: string;
};

export type OrganizerConcertRevenueConcert = {
  id: string;
  status: string;
  lifecycleStatus: OrganizerConcertLifecycleStatus;
  title: string;
  artistName: string | null;
  venueName: string;
  venueAddress: string | null;
  bannerUrl: string | null;
  startsAt: string;
  endsAt: string | null;
  performanceStartAt: string;
};

export type OrganizerConcertRevenueSummary = {
  totalRevenueVnd: number;
  totalSoldQuantity: number;
  totalReservedQuantity: number;
  totalAvailableQuantity: number;
  totalTicketQuantity: number;
  soldRate: number;
  paidOrderCount: number;
};

export type OrganizerConcertRevenueTicketType = {
  id: string;
  code: string;
  name: string;
  priceVnd: number;
  totalQuantity: number;
  reservedQuantity: number;
  soldQuantity: number;
  availableQuantity: number;
  revenueVnd: number;
  soldRate: number;
  status: string;
};

export type OrganizerConcertRevenue = {
  concert: OrganizerConcertRevenueConcert;
  summary: OrganizerConcertRevenueSummary;
  ticketTypes: OrganizerConcertRevenueTicketType[];
};

export type OrganizerConcertPayload = {
  title: string;
  artistName: string;
  description?: string;
  venueName: string;
  venueAddress: string;
  bannerUrl?: string;
  seatingSvg?: string;
  startsAt: string;
  endsAt: string;
  performanceStartAt: string;
};

export type OrganizerConcertFormValues = {
  title: string;
  artistName: string;
  description: string;
  venueName: string;
  venueAddress: string;
  bannerUrl: string;
  seatingSvg: string;
  startsAt: string;
  endsAt: string;
  performanceStartAt: string;
};

export type BannerUploadResponse = {
  bannerUrl: string;
};

export type OrganizerTicketTypeStatus = 'ACTIVE' | 'INACTIVE' | string;

export type OrganizerTicketType = {
  id: string;
  code: string;
  name: string;
  priceVnd: number;
  totalQuantity: number;
  reservedQuantity: number;
  soldQuantity: number;
  availableQuantity: number;
  perUserLimit: number;
  saleStartAt: string | null;
  saleEndAt: string | null;
  status: OrganizerTicketTypeStatus;
  createdAt: string;
  updatedAt: string;
};

export type OrganizerTicketTypePayload = {
  code: string;
  name: string;
  priceVnd: number;
  totalQuantity: number;
  perUserLimit: number;
};

export type OrganizerTicketTypeFormValues = {
  code: string;
  name: string;
  priceVnd: string;
  totalQuantity: string;
  perUserLimit: string;
};
