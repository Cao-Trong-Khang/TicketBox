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
