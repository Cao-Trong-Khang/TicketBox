export class OrganizerConcertListItemDto {
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
  createdAt!: string;
  updatedAt!: string;
}
