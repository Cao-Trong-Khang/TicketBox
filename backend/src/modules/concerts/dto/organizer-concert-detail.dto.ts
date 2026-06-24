export class OrganizerConcertDetailDto {
  id!: string;
  status!: string;
  title!: string;
  artistName!: string | null;
  description!: string | null;
  venueName!: string;
  venueAddress!: string | null;
  bannerUrl!: string | null;
  seatingSvg!: string | null;
  startsAt!: string;
  endsAt!: string | null;
  createdAt!: string;
  updatedAt!: string;
}
