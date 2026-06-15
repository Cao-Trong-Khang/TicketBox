export type Concert = {
  id: string;
  title: string;
  artistName: string | null;
  description: string | null;
  venueName: string;
  venueAddress: string | null;
  bannerUrl: string | null;
  startsAt: string;
  endsAt: string | null;
  minPriceVnd: number | null;
};

export type GetConcertsResponse = Concert[];

export type ConcertDetail = {
  id: string;
  title: string;
  artistName: string | null;
  description: string | null;
  venueName: string;
  venueAddress: string | null;
  bannerUrl: string | null;
  seatingSvg: string | null;
  startsAt: string;
  endsAt: string | null;
};

export type TicketType = {
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
