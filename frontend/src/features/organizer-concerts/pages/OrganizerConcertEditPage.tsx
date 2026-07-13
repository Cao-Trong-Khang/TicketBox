import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { Alert } from '../../../components/ui/Alert';
import { Button } from '../../../components/ui/Button';
import { ApiError } from '../../../lib/api-client';
import {
  createOrganizerTicketType,
  getOrganizerConcertDetail,
  getOrganizerTicketTypes,
  uploadConcertBanner,
  updateOrganizerConcert,
  updateOrganizerTicketType,
} from '../api';
import { OrganizerConcertForm } from '../components/OrganizerConcertForm';
import { ArtistBioPanel } from '../../artist-bio/components/ArtistBioPanel';
import { isOrganizerConcertReadonly } from '../concert-lifecycle';
import { OrganizerTicketTypeForm } from '../components/OrganizerTicketTypeForm';
import { toConcertFormValues } from '../form-helpers';
import {
  formatTicketTypePrice,
  sortTicketTypes,
  toTicketTypeFormValues,
} from '../ticket-type-helpers';
import {
  OrganizerConcertDetail,
  OrganizerConcertPayload,
  OrganizerTicketType,
  OrganizerTicketTypePayload,
} from '../types';

export function OrganizerConcertEditPage() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const missingId = !id;
  const [concert, setConcert] = useState<OrganizerConcertDetail | null>(null);
  const [ticketTypes, setTicketTypes] = useState<OrganizerTicketType[]>([]);
  const [ticketTypesError, setTicketTypesError] = useState<ApiError | null>(null);
  const [ticketTypesLoading, setTicketTypesLoading] = useState(!missingId);
  const [loadError, setLoadError] = useState<ApiError | null>(
    missingId ? { status: 404, message: 'Không tìm thấy concert organizer.' } : null,
  );
  const [actionError, setActionError] = useState<ApiError | null>(null);
  const [ticketActionError, setTicketActionError] = useState<ApiError | null>(null);
  const [isLoading, setIsLoading] = useState(!missingId);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isTicketSubmitting, setIsTicketSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(
    typeof location.state === 'object' && location.state !== null && 'feedback' in location.state
      ? String(location.state.feedback)
      : null,
  );
  const [ticketFeedback, setTicketFeedback] = useState<string | null>(null);
  const [formMode, setFormMode] = useState<{ kind: 'create' } | { kind: 'edit'; ticketTypeId: string }>({ kind: 'create' });
  useEffect(() => {
    let isActive = true;

    if (!id) {
      return;
    }

    Promise.all([
      getOrganizerConcertDetail(id),
      getOrganizerTicketTypes(id),
    ])
      .then(([concertData, ticketTypeData]) => {
        if (!isActive) {
          return;
        }

        setConcert(concertData);
        setTicketTypes(sortTicketTypes(Array.isArray(ticketTypeData) ? ticketTypeData : []));
        setLoadError(null);
        setIsLoading(false);
        setTicketTypesLoading(false);
        setTicketTypesError(null);
      })
      .catch((err: unknown) => {
        if (!isActive) {
          return;
        }

        setLoadError(toApiError(err));
        setIsLoading(false);
        setTicketTypesLoading(false);
        setTicketTypesError(toApiError(err));
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
    setTicketTypesLoading(true);
    setTicketTypesError(null);

    try {
      const [concertData, ticketTypeData] = await Promise.all([
        getOrganizerConcertDetail(id),
        getOrganizerTicketTypes(id),
      ]);
      setConcert(concertData);
      setTicketTypes(sortTicketTypes(Array.isArray(ticketTypeData) ? ticketTypeData : []));
    } catch (err: unknown) {
      setLoadError(toApiError(err));
      setTicketTypesError(toApiError(err));
    } finally {
      setIsLoading(false);
      setTicketTypesLoading(false);
    }
  };

  const handleSubmit = async (
    payload: OrganizerConcertPayload,
    options: { selectedBannerFile: File | null; selectedArtistBioFile: File | null },
  ) => {
    if (!id) {
      return;
    }

    setActionError(null);
    setFeedback(null);
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

      const updatedConcert = await updateOrganizerConcert(id, nextPayload);
      setConcert(updatedConcert);
      setFeedback('Đã lưu thay đổi cho concert.');
    } catch (err: unknown) {
      setActionError(toApiError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateTicketType = async (payload: OrganizerTicketTypePayload) => {
    if (!id) {
      return;
    }

    setTicketActionError(null);
    setTicketFeedback(null);
    setIsTicketSubmitting(true);

    try {
      const createdTicketType = await createOrganizerTicketType(id, payload);
      setTicketTypes((current) => sortTicketTypes([...current, createdTicketType]));
      setFormMode({ kind: 'edit', ticketTypeId: createdTicketType.id });
      setTicketFeedback('Đã tạo loại vé mới. Backend hiện mặc định trạng thái INACTIVE.');
    } catch (err: unknown) {
      setTicketActionError(toApiError(err));
    } finally {
      setIsTicketSubmitting(false);
    }
  };

  const handleUpdateTicketType = async (payload: OrganizerTicketTypePayload) => {
    if (!id || formMode.kind !== 'edit') {
      return;
    }

    setTicketActionError(null);
    setTicketFeedback(null);
    setIsTicketSubmitting(true);

    try {
      const updatedTicketType = await updateOrganizerTicketType(id, formMode.ticketTypeId, payload);
      setTicketTypes((current) =>
        sortTicketTypes(
          current.map((ticketType) =>
            ticketType.id === updatedTicketType.id ? updatedTicketType : ticketType,
          ),
        ),
      );
      setTicketFeedback('Đã cập nhật loại vé.');
    } catch (err: unknown) {
      setTicketActionError(toApiError(err));
    } finally {
      setIsTicketSubmitting(false);
    }
  };

  const switchToCreate = () => {
    setTicketActionError(null);
    setTicketFeedback(null);
    setFormMode({ kind: 'create' });
  };

  const switchToEdit = (ticketTypeId: string) => {
    setTicketActionError(null);
    setTicketFeedback(null);
    setFormMode({ kind: 'edit', ticketTypeId });
  };

  const isReadonly = !concert ? true : !canEditConcert(concert);
  const readonlyMessage = concert ? getReadonlyMessage(concert) : null;
  const selectedTicketType = useMemo(() => {
    if (formMode.kind !== 'edit') {
      return null;
    }

    return ticketTypes.find((ticketType) => ticketType.id === formMode.ticketTypeId) ?? null;
  }, [formMode, ticketTypes]);
  const canMutateTicketTypes = !isReadonly;

  return (
    <section className="organizer-editor-page" aria-labelledby="organizer-edit-title">
      <div className="organizer-editor-container">
        <header className="organizer-editor-header">
          <div>
            <p className="eyebrow">Kênh organizer</p>
            <h1 id="organizer-edit-title">
              {concert ? `Chỉnh sửa ${concert.title}` : 'Chỉnh sửa concert'}
            </h1>
            <p>Cập nhật thông tin concert trong thời gian còn cho phép chỉnh sửa trước khi sự kiện diễn ra.</p>
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
                className={`organizer-status organizer-status--${getOrganizerStatusVariant(concert)}`}
              >
                {getOrganizerStatusLabel(concert)}
              </span>
            </div>

            {readonlyMessage && (
              <p className="organizer-editor-note">
                {readonlyMessage}
              </p>
            )}

            {feedback && <Alert tone="success">{feedback}</Alert>}
            {actionError && <Alert tone="error">{toEditErrorMessage(actionError)}</Alert>}

            <OrganizerConcertForm
              key={`${concert.id}-${concert.updatedAt}-${concert.status}`}
              initialValues={toConcertFormValues(concert)}
              submitLabel="Lưu thay đổi"
              isSubmitting={isSubmitting}
              isReadonly={isReadonly}
              bannerInputLabel="Replace banner"
              descriptionAssistant={() => (
                <ArtistBioPanel
                  concertId={concert.id}
                  isReadonly={isReadonly}
                />
              )}
              onSubmit={handleSubmit}
            />

            <div className="organizer-ticket-section">
              <div className="organizer-ticket-panel-header">
                <div>
                  <h2 className="organizer-section-title">Cấu hình vé</h2>
                  <p className="organizer-section-copy">
                    Quản lý các loại vé cho concert này trực tiếp tại đây.
                  </p>
                </div>
                {canMutateTicketTypes && (
                  <Button type="button" className="button-secondary" onClick={switchToCreate} disabled={isTicketSubmitting}>
                    Tạo loại vé
                  </Button>
                )}
              </div>

              {ticketFeedback && <Alert tone="success">{ticketFeedback}</Alert>}
              {ticketActionError && <Alert tone="error">{toTicketErrorMessage(ticketActionError)}</Alert>}

              {ticketTypesLoading ? (
                <p className="concerts-loading">Đang tải loại vé...</p>
              ) : ticketTypesError ? (
                <div className="concerts-error">
                  <Alert tone="error">{toTicketErrorMessage(ticketTypesError)}</Alert>
                  <Button type="button" className="alert-action" onClick={() => void handleRetry()}>
                    Thử lại
                  </Button>
                </div>
              ) : (
                <>
                  {ticketTypes.length === 0 ? (
                    <div className="organizer-dashboard-note organizer-inline-note">
                      <p>Concert này chưa có loại vé nào.</p>
                    </div>
                  ) : (
                    <div className="organizer-ticket-type-list">
                      {ticketTypes.map((ticketType) => {
                        return (
                          <article key={ticketType.id} className="organizer-ticket-type-card">
                            <div className="organizer-ticket-type-card-topline">
                              <div>
                                <h3>{ticketType.name}</h3>
                                <p className="organizer-ticket-code">{ticketType.code}</p>
                              </div>
                              <span className={`organizer-status organizer-status--${ticketType.status.toLowerCase()}`}>
                                {ticketType.status}
                              </span>
                            </div>

                            <div className="organizer-ticket-type-meta">
                              <p><strong>Giá:</strong> {formatTicketTypePrice(ticketType.priceVnd)}</p>
                              <p><strong>Tổng vé:</strong> {ticketType.totalQuantity}</p>
                              <p><strong>Đã giữ:</strong> {ticketType.reservedQuantity}</p>
                              <p><strong>Đã bán:</strong> {ticketType.soldQuantity}</p>
                              <p><strong>Còn lại:</strong> {ticketType.availableQuantity}</p>
                              <p><strong>Giới hạn/người:</strong> {ticketType.perUserLimit}</p>
                            </div>

                            <div className="organizer-concert-actions">
                              {canMutateTicketTypes ? (
                                <Button type="button" onClick={() => switchToEdit(ticketType.id)}>
                                  Sửa
                                </Button>
                              ) : (
                                <p className="organizer-editor-note">Không thể thay đổi loại vé khi concert đang diễn ra, đã kết thúc hoặc đã hủy.</p>
                              )}
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  )}

                  {canMutateTicketTypes ? (
                    <div className="organizer-editor-panel organizer-ticket-draft-panel">
                      {formMode.kind === 'create' ? (
                        <OrganizerTicketTypeForm
                          title="Tạo loại vé mới"
                          description="Các loại vé mới sẽ được tạo ở trạng thái INACTIVE cho đến khi bạn kích hoạt."
                          submitLabel="Tạo loại vé"
                          isSubmitting={isTicketSubmitting}
                          onSubmit={handleCreateTicketType}
                        />
                      ) : selectedTicketType ? (
                        <OrganizerTicketTypeForm
                          key={selectedTicketType.id + selectedTicketType.updatedAt}
                          title={`Chỉnh sửa ${selectedTicketType.name}`}
                          description="Bạn chỉ chỉnh sửa các trường cho phép."
                          initialValues={toTicketTypeFormValues(selectedTicketType)}
                          submitLabel="Lưu loại vé"
                          isSubmitting={isTicketSubmitting}
                          onSubmit={handleUpdateTicketType}
                          onCancel={switchToCreate}
                        />
                      ) : (
                        <div className="organizer-dashboard-note organizer-inline-note">
                          <p>Không tìm thấy loại vé cần chỉnh sửa.</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="organizer-dashboard-note organizer-inline-note">
                      <p>Không thể tạo hoặc chỉnh sửa loại vé khi concert đang diễn ra, đã kết thúc hoặc đã hủy.</p>
                    </div>
                  )}
                </>
              )}
            </div>
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

function toTicketErrorMessage(error: ApiError): string {
  if (error.status === 400) {
    return error.message || 'Dữ liệu loại vé chưa hợp lệ.';
  }

  if (error.status === 404) {
    return 'Không tìm thấy concert hoặc loại vé organizer này.';
  }

  if (error.status === 409) {
    return error.message || 'Loại vé đang có xung đột dữ liệu.';
  }

  return error.message || 'Không thể xử lý loại vé lúc này.';
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

function canEditConcert(concert: OrganizerConcertDetail): boolean {
  return !isOrganizerConcertReadonly(concert);
}

function getReadonlyMessage(concert: OrganizerConcertDetail): string | null {
  if (concert.status === 'CANCELLED') {
    return 'Concert đã hủy nên không thể chỉnh sửa.';
  }

  if (concert.lifecycleStatus === 'ONGOING' || concert.lifecycleStatus === 'ENDED') {
    return 'Concert đang diễn ra hoặc đã kết thúc nên không thể chỉnh sửa.';
  }

  return null;
}

function getOrganizerStatusLabel(concert: OrganizerConcertDetail): string {
  if (concert.status === 'CANCELLED') {
    return 'Đã hủy';
  }

  if (concert.lifecycleStatus === 'ONGOING') {
    return 'Đang diễn ra';
  }

  if (concert.lifecycleStatus === 'ENDED') {
    return 'Đã kết thúc';
  }

  return 'Sắp diễn ra';
}

function getOrganizerStatusVariant(concert: OrganizerConcertDetail): string {
  if (concert.status === 'CANCELLED') {
    return 'cancelled';
  }

  if (concert.lifecycleStatus === 'ONGOING') {
    return 'ongoing';
  }

  if (concert.lifecycleStatus === 'ENDED') {
    return 'ended';
  }

  return 'upcoming';
}
