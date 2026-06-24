import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Alert } from '../../../components/ui/Alert';
import { Button } from '../../../components/ui/Button';
import { ApiError } from '../../../lib/api-client';
import {
  getOrganizerConcertDetail,
  publishOrganizerConcert,
  updateOrganizerConcert,
} from '../api';
import { OrganizerConcertForm } from '../components/OrganizerConcertForm';
import { toConcertFormValues } from '../form-helpers';
import { OrganizerConcertDetail, OrganizerConcertPayload } from '../types';

export function OrganizerConcertEditPage() {
  const { id } = useParams<{ id: string }>();
  const missingId = !id;
  const [concert, setConcert] = useState<OrganizerConcertDetail | null>(null);
  const [loadError, setLoadError] = useState<ApiError | null>(
    missingId ? { status: 404, message: 'Không tìm thấy concert organizer.' } : null,
  );
  const [actionError, setActionError] = useState<ApiError | null>(null);
  const [isLoading, setIsLoading] = useState(!missingId);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;

    if (!id) {
      return;
    }

    getOrganizerConcertDetail(id)
      .then((data) => {
        if (!isActive) {
          return;
        }

        setConcert(data);
        setLoadError(null);
        setIsLoading(false);
      })
      .catch((err: unknown) => {
        if (!isActive) {
          return;
        }

        setLoadError(toApiError(err));
        setIsLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, [id]);

  const handleRetry = async () => {
    if (!id) {
      return;
    }

    setIsLoading(true);
    setLoadError(null);

    try {
      setConcert(await getOrganizerConcertDetail(id));
    } catch (err: unknown) {
      setLoadError(toApiError(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (payload: OrganizerConcertPayload) => {
    if (!id) {
      return;
    }

    setActionError(null);
    setFeedback(null);
    setIsSubmitting(true);

    try {
      const updatedConcert = await updateOrganizerConcert(id, payload);
      setConcert(updatedConcert);
      setFeedback('Đã lưu thay đổi cho concert.');
    } catch (err: unknown) {
      setActionError(toApiError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePublish = async () => {
    if (!id) {
      return;
    }

    setActionError(null);
    setFeedback(null);
    setIsPublishing(true);

    try {
      const publishedConcert = await publishOrganizerConcert(id);
      setConcert((current) =>
        current
          ? {
              ...current,
              ...publishedConcert,
              status: publishedConcert.status || 'PUBLISHED',
            }
          : publishedConcert,
      );
      setFeedback('Concert đã được publish.');
    } catch (err: unknown) {
      setActionError(toApiError(err));
    } finally {
      setIsPublishing(false);
    }
  };

  const isPublished = concert?.status === 'PUBLISHED';

  return (
    <section className="organizer-editor-page" aria-labelledby="organizer-edit-title">
      <div className="organizer-editor-container">
        <header className="organizer-editor-header">
          <div>
            <p className="eyebrow">Kênh organizer</p>
            <h1 id="organizer-edit-title">
              {concert ? `Chỉnh sửa ${concert.title}` : 'Chỉnh sửa concert'}
            </h1>
            <p>Hoàn thiện thông tin concert, cập nhật bản nháp và publish khi đã sẵn sàng.</p>
          </div>
          <Link to="/organizer/concerts" className="organizer-dashboard-link">
            Quay lại dashboard
          </Link>
        </header>

        {isLoading && <p className="concerts-loading">Đang tải concert organizer...</p>}

        {!isLoading && renderEditState(loadError, handleRetry)}

        {!isLoading && !loadError && concert && (
          <div className="organizer-editor-panel">
            <div className="organizer-editor-topbar">
              <span
                className={`organizer-status organizer-status--${concert.status.toLowerCase()}`}
              >
                {concert.status}
              </span>

              {concert.status === 'DRAFT' && (
                <Button
                  type="button"
                  onClick={handlePublish}
                  disabled={isSubmitting || isPublishing}
                >
                  {isPublishing ? 'Đang publish...' : 'Publish concert'}
                </Button>
              )}
            </div>

            {isPublished && (
              <p className="organizer-editor-note">
                Concert đã publish, chưa hỗ trợ chỉnh sửa trong MVP.
              </p>
            )}

            {feedback && <Alert tone="success">{feedback}</Alert>}
            {actionError && <Alert tone="error">{toEditErrorMessage(actionError)}</Alert>}

            <OrganizerConcertForm
              key={`${concert.id}-${concert.updatedAt}-${concert.status}`}
              initialValues={toConcertFormValues(concert)}
              submitLabel="Lưu thay đổi"
              isSubmitting={isSubmitting}
              isReadonly={isPublished || isPublishing}
              onSubmit={handleSubmit}
            />
          </div>
        )}
      </div>
    </section>
  );
}

function renderEditState(
  error: ApiError | null,
  onRetry: () => Promise<void>,
) {
  if (!error) {
    return null;
  }

  if (error.status === 401) {
    return (
      <div className="organizer-dashboard-note">
        <p>Vui lòng đăng nhập để truy cập kênh organizer</p>
        <Link to="/login" className="organizer-dashboard-link">
          Đi đến đăng nhập
        </Link>
      </div>
    );
  }

  if (error.status === 403) {
    return (
      <div className="organizer-dashboard-note">
        <p>Tài khoản này không có quyền organizer</p>
      </div>
    );
  }

  if (error.status === 404) {
    return (
      <div className="organizer-dashboard-note">
        <p>Không tìm thấy concert organizer này.</p>
      </div>
    );
  }

  return (
    <div className="concerts-error">
      <Alert tone="error">{toEditErrorMessage(error)}</Alert>
      <Button type="button" className="alert-action" onClick={() => void onRetry()}>
        Thử lại
      </Button>
    </div>
  );
}

function toEditErrorMessage(error: ApiError): string {
  if (error.status === 400) {
    return error.message || 'Concert chưa sẵn sàng cho thao tác này.';
  }

  if (error.status === 409) {
    return error.message || 'Concert đang ở trạng thái không thể cập nhật.';
  }

  if (error.status === 404) {
    return 'Không tìm thấy concert organizer này.';
  }

  return error.message || 'Không thể tải hoặc cập nhật concert lúc này.';
}

function toApiError(error: unknown): ApiError {
  if (typeof error === 'object' && error !== null && 'message' in error) {
    return error as ApiError;
  }

  return {
    status: 0,
    message: 'Không thể tải hoặc cập nhật concert lúc này.',
  };
}
