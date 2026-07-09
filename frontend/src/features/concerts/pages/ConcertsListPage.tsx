import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert } from '../../../components/ui/Alert';
import { Button } from '../../../components/ui/Button';
import { ApiError } from '../../../lib/api-client';
import { getConcerts } from '../api';
import { ConcertCard } from '../components/ConcertCard';
import { Concert } from '../types';

export function ConcertsListPage() {
  const navigate = useNavigate();
  const [concerts, setConcerts] = useState<Concert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);

  useEffect(() => {
    let isActive = true;

    getConcerts()
      .then((data) => {
        if (!isActive) {
          return;
        }

        setConcerts(data);
        setIsLoading(false);
      })
      .catch((err: unknown) => {
        if (!isActive) {
          return;
        }

        setError(toApiError(err));
        setIsLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, []);

  const fetchConcerts = async () => {
    setIsLoading(true);
    setError(null);

    try {
      setConcerts(await getConcerts());
    } catch (err: unknown) {
      setError(toApiError(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleNavigate = (id: string) => {
    navigate(`/concerts/${id}`);
  };

  return (
    <section className="concerts-page" aria-labelledby="concerts-title">
      <div className="concerts-container">
        <header className="concerts-header">
          <p className="eyebrow">TicketBox</p>
          <h1 id="concerts-title">Concert sắp diễn ra</h1>
          <p>Khám phá các đêm diễn đã mở bán và chọn sự kiện bạn muốn tham gia.</p>
        </header>

        {isLoading && <p className="concerts-loading">Đang tải danh sách concert...</p>}

        {!isLoading && error && (
          <div className="concerts-error">
            <Alert tone="error">{error.message || 'Không thể tải danh sách concert.'}</Alert>
            <Button type="button" className="alert-action" onClick={fetchConcerts}>
              Thử lại
            </Button>
          </div>
        )}

        {!isLoading && !error && concerts.length === 0 && (
          <p className="concerts-empty">Không có concert nào hiện tại.</p>
        )}

        {!isLoading && !error && concerts.length > 0 && (
          <div className="concerts-grid">
            {concerts.map((concert) => (
              <ConcertCard key={concert.id} concert={concert} onNavigate={handleNavigate} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function toApiError(error: unknown): ApiError {
  if (typeof error === 'object' && error !== null && 'message' in error) {
    return error as ApiError;
  }

  return {
    status: 0,
    message: 'Không thể tải danh sách concert.',
  };
}
