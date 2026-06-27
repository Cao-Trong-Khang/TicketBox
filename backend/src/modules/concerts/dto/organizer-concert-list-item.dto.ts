export class OrganizerConcertListItemDto {
  id!: string;
  status!: string;
  lifecycleStatus!: string;
  title!: string;
  artistName!: string | null;
  venueName!: string;
  startsAt!: string;
  endsAt!: string | null;
  createdAt!: string;
  updatedAt!: string;
}
