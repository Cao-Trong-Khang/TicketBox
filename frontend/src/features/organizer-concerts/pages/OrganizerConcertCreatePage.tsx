import { Link, useNavigate } from 'react-router-dom';
import { Alert } from '../../../components/ui/Alert';
import { OrganizerConcertForm } from '../components/OrganizerConcertForm';
import { OrganizerTicketTypeDraftSection, OrganizerTicketTypeDraft } from '../components/OrganizerTicketTypeDraftSection';
import { activateOrganizerTicketType, createOrganizerConcert, createOrganizerTicketType, uploadConcertBanner } from '../api';
import { hasTicketDraftValidationErrors } from '../ticket-type-draft-helpers';
import { OrganizerConcertPayload, OrganizerTicketTypePayload } from '../types';
import { ApiError } from '../../../lib/api-client';
import { useState } from 'react';
import { uploadArtistDocument } from '../../artist-bio/api';

export function OrganizerConcertCreatePage() {
  const navigate = useNavigate();
  const [error, setError] = useState<ApiError | null>(null);
  const [ticketDrafts, setTicketDrafts] = useState<OrganizerTicketTypeDraft[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (
    payload: OrganizerConcertPayload,
    options: { selectedBannerFile: File | null; selectedArtistBioFile: File | null },
  ) => {
    setError(null);

    const ticketValidationError = hasTicketDraftValidationErrors(ticketDrafts);
    if (ticketValidationError) {
      setError({
        status: 400,
        message: ticketValidationError,
      });
      return;
    }

    setIsSubmitting(true);

    try {
      let nextPayload = payload;

      if (options.selectedBannerFile) {
        const uploadResponse = await uploadConcertBanner(options.selectedBannerFile);
        nextPayload = {
          ...payload,
          bannerUrl: uploadResponse.bannerUrl,
        };
      }

      const createdConcert = await createOrganizerConcert(nextPayload);

      if (!createdConcert.id) {
        navigate('/organizer/concerts');
        return;
      }

      const ticketSetup = async () => {
        for (const draft of ticketDrafts) {
          const createdTicketType = await createOrganizerTicketType(createdConcert.id, {
            code: draft.code,
            name: draft.name,
            priceVnd: draft.priceVnd,
            totalQuantity: draft.totalQuantity,
            perUserLimit: draft.perUserLimit,
          });

          await activateOrganizerTicketType(createdConcert.id, createdTicketType.id);
        }
      };
      const ticketResult = ticketDrafts.length > 0
        ? ticketSetup()
        : Promise.resolve();
      const bioResult = options.selectedArtistBioFile
        ? uploadArtistDocument(createdConcert.id, options.selectedArtistBioFile)
        : Promise.resolve(null);
      const [tickets, biography] = await Promise.allSettled([ticketResult, bioResult]);
      const messages = ['Concert đã được tạo và hiển thị công khai.'];
      if (tickets.status === 'rejected') messages.push('Một số loại vé chưa hoàn tất; vui lòng kiểm tra lại bên dưới.');
      if (biography.status === 'rejected') messages.push('Press kit chưa được tải lên; bạn có thể thử lại trong phần AI Artist Bio.');
      if (biography.status === 'fulfilled' && options.selectedArtistBioFile) messages.push('AI Artist Bio đã được xếp hàng xử lý.');
      navigate(`/organizer/concerts/${createdConcert.id}/edit`, {
        state: { feedback: messages.join(' ') },
      });
    } catch (err: unknown) {
      setError(toApiError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddDraft = (payload: OrganizerTicketTypePayload) => {
    setTicketDrafts((current) => [
      ...current,
      {
        ...payload,
        localId: `draft-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      },
    ]);

    return true;
  };

  const handleRemoveDraft = (localId: string) => {
    setTicketDrafts((current) => current.filter((draft) => draft.localId !== localId));
  };

  return (
    <section className="organizer-editor-page" aria-labelledby="organizer-create-title">
      <div className="organizer-editor-container">
        <header className="organizer-editor-header">
          <div>
            <p className="eyebrow">Kênh organizer</p>
            <h1 id="organizer-create-title">Tạo concert mới</h1>
            <p>Tạo concert và đưa lên public ngay khi hoàn tất thông tin cùng cấu hình vé ban đầu.</p>
          </div>
          <Link to="/organizer/concerts" className="organizer-dashboard-link">
            Quay lại dashboard
          </Link>
        </header>

        {renderAuthOrErrorState(error)}

        {!isAccessError(error) && (
          <div className="organizer-editor-panel">
            {error && error.status !== 401 && error.status !== 403 && (
              <Alert tone="error">
                {toCreateErrorMessage(error)}
              </Alert>
            )}

            <OrganizerConcertForm
              submitLabel="Tạo concert"
              isSubmitting={isSubmitting}
              bannerInputLabel="Chọn banner concert"
              showArtistBioUpload
              onSubmit={handleSubmit}
            >
              <OrganizerTicketTypeDraftSection
                drafts={ticketDrafts}
                isDisabled={isSubmitting}
                onAddDraft={handleAddDraft}
                onRemoveDraft={handleRemoveDraft}
              />
            </OrganizerConcertForm>
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
