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
