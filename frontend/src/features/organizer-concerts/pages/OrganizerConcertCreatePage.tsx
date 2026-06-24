import { Link, useNavigate } from 'react-router-dom';
import { Alert } from '../../../components/ui/Alert';
import { OrganizerConcertForm } from '../components/OrganizerConcertForm';
import { createOrganizerConcert } from '../api';
import { OrganizerConcertPayload } from '../types';
import { ApiError } from '../../../lib/api-client';
import { useState } from 'react';

export function OrganizerConcertCreatePage() {
  const navigate = useNavigate();
  const [error, setError] = useState<ApiError | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (payload: OrganizerConcertPayload) => {
    setError(null);
    setIsSubmitting(true);

    try {
      const createdConcert = await createOrganizerConcert(payload);
      navigate(
        createdConcert.id
          ? `/organizer/concerts/${createdConcert.id}/edit`
          : '/organizer/concerts',
      );
    } catch (err: unknown) {
      setError(toApiError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="organizer-editor-page" aria-labelledby="organizer-create-title">
      <div className="organizer-editor-container">
        <header className="organizer-editor-header">
          <div>
            <p className="eyebrow">Kênh organizer</p>
            <h1 id="organizer-create-title">Tạo concert mới</h1>
            <p>Bắt đầu bằng một bản nháp concert để tiếp tục hoàn thiện và publish sau.</p>
          </div>
          <Link to="/organizer/concerts" className="organizer-dashboard-link">
            Quay lại dashboard
          </Link>
        </header>

        {renderAuthOrErrorState(error)}

        {!isAccessError(error) && (
          <div className="organizer-editor-panel">
            {error && error.status !== 401 && error.status !== 403 && (
              <Alert tone="error">{toCreateErrorMessage(error)}</Alert>
            )}

            <OrganizerConcertForm
              submitLabel="Tạo concert"
              isSubmitting={isSubmitting}
              onSubmit={handleSubmit}
            />
          </div>
        )}
      </div>
    </section>
  );
}

function renderAuthOrErrorState(error: ApiError | null) {
  if (!error || (error.status !== 401 && error.status !== 403)) {
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

  return (
    <div className="organizer-dashboard-note">
      <p>Tài khoản này không có quyền organizer</p>
    </div>
  );
}

function isAccessError(error: ApiError | null): boolean {
  return error?.status === 401 || error?.status === 403;
}

function toCreateErrorMessage(error: ApiError): string {
  if (error.status === 400) {
    return error.message || 'Dữ liệu concert chưa hợp lệ.';
  }

  if (error.status === 409) {
    return 'Concert này đang có xung đột dữ liệu. Vui lòng thử lại.';
  }

  return error.message || 'Không thể tạo concert lúc này.';
}

function toApiError(error: unknown): ApiError {
  if (typeof error === 'object' && error !== null && 'message' in error) {
    return error as ApiError;
  }

  return {
    status: 0,
    message: 'Không thể tạo concert lúc này.',
  };
}
