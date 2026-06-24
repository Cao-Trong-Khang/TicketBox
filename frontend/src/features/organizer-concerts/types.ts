export type OrganizerConcertListItem = {
  id: string;
  status: string;
  title: string;
  artistName: string | null;
  venueName: string;
  startsAt: string;
  endsAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type OrganizerConcertDetail = {
  id: string;
  status: string;
  title: string;
  artistName: string | null;
  description: string | null;
  venueName: string;
  venueAddress: string | null;
  bannerUrl: string | null;
  seatingSvg: string | null;
  startsAt: string;
  endsAt: string | null;
  createdAt: string;
  updatedAt: string;
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
  saleStartAt?: string;
  saleEndAt?: string;
};

export type OrganizerTicketTypeFormValues = {
  code: string;
  name: string;
  priceVnd: string;
  totalQuantity: string;
  perUserLimit: string;
  saleStartAt: string;
  saleEndAt: string;
};
