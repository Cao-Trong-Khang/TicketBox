import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Alert } from '../../../components/ui/Alert';
import { getOrganizerConcertDetail } from '../../organizer-concerts/api';
import { isOrganizerConcertReadonly } from '../../organizer-concerts/concert-lifecycle';
import { ArtistBioPanel } from '../components/ArtistBioPanel';

export function ArtistBioAdminPage() {
  const { concertId } = useParams<{ concertId: string }>();
  const [isReadonly, setIsReadonly] = useState(false);

  useEffect(() => {
    if (!concertId) return;
    getOrganizerConcertDetail(concertId)
      .then((concert) => {
        if (concert && typeof concert === 'object' && 'lifecycleStatus' in concert) {
          setIsReadonly(isOrganizerConcertReadonly(concert));
        }
      })
      .catch(() => undefined);
  }, [concertId]);

  if (!concertId) return <Alert tone={'error'}>Concert không hợp lệ.</Alert>;

  return <section className={'artist-bio-admin'}><ArtistBioPanel concertId={concertId} isReadonly={isReadonly} /></section>;
}
