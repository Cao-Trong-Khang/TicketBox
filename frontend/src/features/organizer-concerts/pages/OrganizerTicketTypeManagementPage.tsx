import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Alert } from '../../../components/ui/Alert';
import { Button } from '../../../components/ui/Button';
import { ApiError } from '../../../lib/api-client';
import {
  activateOrganizerTicketType,
  createOrganizerTicketType,
  deactivateOrganizerTicketType,
  getOrganizerConcertDetail,
  getOrganizerTicketTypes,
  updateOrganizerTicketType,
} from '../api';
import { OrganizerTicketTypeForm } from '../components/OrganizerTicketTypeForm';
import {
  formatTicketTypePrice,
  sortTicketTypes,
  toTicketTypeFormValues,
} from '../ticket-type-helpers';
import {
  OrganizerConcertDetail,
  OrganizerTicketType,
  OrganizerTicketTypePayload,
} from '../types';

type FormMode =
  | { kind: 'create' }
  | { kind: 'edit'; ticketTypeId: string };

export function OrganizerTicketTypeManagementPage() {
  const { concertId } = useParams<{ concertId: string }>();
  const missingConcertId = !concertId;
  const [concert, setConcert] = useState<OrganizerConcertDetail | null>(null);
  const [ticketTypes, setTicketTypes] = useState<OrganizerTicketType[]>([]);
  const [loadError, setLoadError] = useState<ApiError | null>(
    missingConcertId ? { status: 404, message: 'Không tìm thấy concert organizer.' } : null,
  );
  const [actionError, setActionError] = useState<ApiError | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(!missingConcertId);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusTargetId, setStatusTargetId] = useState<string | null>(null);
  const [formMode, setFormMode] = useState<FormMode>({ kind: 'create' });

  useEffect(() => {
    let isActive = true;

    if (!concertId) {
      return;
    }

    Promise.all([
      getOrganizerConcertDetail(concertId),
      getOrganizerTicketTypes(concertId),
    ])
      .then(([concertDetail, ticketTypeList]) => {
        if (!isActive) {
          return;
        }

        setConcert(concertDetail);
        setTicketTypes(sortTicketTypes(ticketTypeList));
        setLoadError(null);
        setIsLoading(false);
      })
      .catch((error: unknown) => {
        if (!isActive) {
          return;
        }

        setLoadError(toApiError(error));
        setIsLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, [concertId]);

  const selectedTicketType = useMemo(() => {
    if (formMode.kind !== 'edit') {
      return null;
    }

    return ticketTypes.find((ticketType) => ticketType.id === formMode.ticketTypeId) ?? null;
  }, [formMode, ticketTypes]);

  const handleRetry = async () => {
    if (!concertId) {
      return;
    }

    setIsLoading(true);
    setLoadError(null);

    try {
      const [concertDetail, ticketTypeList] = await Promise.all([
        getOrganizerConcertDetail(concertId),
        getOrganizerTicketTypes(concertId),
      ]);
      setConcert(concertDetail);
      setTicketTypes(sortTicketTypes(ticketTypeList));
    } catch (error: unknown) {
      setLoadError(toApiError(error));
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreate = async (payload: OrganizerTicketTypePayload) => {
    if (!concertId) {
      return;
    }

    setActionError(null);
    setFeedback(null);
    setIsSubmitting(true);

    try {
      const createdTicketType = await createOrganizerTicketType(concertId, payload);
      setTicketTypes((current) => sortTicketTypes([...current, createdTicketType]));
      setFormMode({ kind: 'edit', ticketTypeId: createdTicketType.id });
      setFeedback('Đã tạo loại vé mới. Backend hiện mặc định trạng thái INACTIVE.');
    } catch (error: unknown) {
      setActionError(toApiError(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdate = async (payload: OrganizerTicketTypePayload) => {
    if (!concertId || formMode.kind !== 'edit') {
      return;
    }

    setActionError(null);
    setFeedback(null);
    setIsSubmitting(true);

    try {
      const updatedTicketType = await updateOrganizerTicketType(
        concertId,
        formMode.ticketTypeId,
        payload,
      );
      setTicketTypes((current) =>
        sortTicketTypes(
          current.map((ticketType) =>
            ticketType.id === updatedTicketType.id ? updatedTicketType : ticketType,
          ),
        ),
      );
      setFeedback('Đã cập nhật loại vé.');
    } catch (error: unknown) {
      setActionError(toApiError(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStatusChange = async (
    ticketType: OrganizerTicketType,
    nextStatus: 'ACTIVE' | 'INACTIVE',
  ) => {
    if (!concertId) {
      return;
    }

    setActionError(null);
    setFeedback(null);
    setStatusTargetId(ticketType.id);

    try {
      const updatedTicketType =
        nextStatus === 'ACTIVE'
          ? await activateOrganizerTicketType(concertId, ticketType.id)
          : await deactivateOrganizerTicketType(concertId, ticketType.id);
      setTicketTypes((current) =>
        sortTicketTypes(
          current.map((item) =>
            item.id === updatedTicketType.id ? updatedTicketType : item,
          ),
        ),
      );
      setFeedback(
        nextStatus === 'ACTIVE'
          ? 'Loại vé đã được kích hoạt.'
          : 'Loại vé đã được tắt bán.',
      );
    } catch (error: unknown) {
      setActionError(toApiError(error));
    } finally {
      setStatusTargetId(null);
    }
  };

  const switchToCreate = () => {
    setActionError(null);
    setFeedback(null);
    setFormMode({ kind: 'create' });
  };

  const switchToEdit = (ticketTypeId: string) => {
    setActionError(null);
    setFeedback(null);
    setFormMode({ kind: 'edit', ticketTypeId });
  };

  return (
    <section className="organizer-editor-page" aria-labelledby="organizer-ticket-type-title">
      <div className="organizer-editor-container">
        <header className="organizer-editor-header">
          <div>
            <p className="eyebrow">Kênh organizer</p>
            <h1 id="organizer-ticket-type-title">
              {concert ? `Quản lý vé - ${concert.title}` : 'Quản lý vé'}
            </h1>
            <p>Thiết lập danh sách loại vé, cập nhật giá bán và điều khiển trạng thái mở bán.</p>
          </div>
          <Link to="/organizer/concerts" className="organizer-dashboard-link">
            Quay lại dashboard
          </Link>
        </header>

        {isLoading && <p className="concerts-loading">Đang tải danh sách loại vé...</p>}

        {!isLoading && renderPageError(loadError, handleRetry)}

        {!isLoading && !loadError && concert && (
          <div className="organizer-ticket-layout">
            <div className="organizer-editor-panel organizer-ticket-list-panel">
              <div className="organizer-ticket-panel-header">
                <div>
                  <h2 className="organizer-section-title">Danh sách loại vé</h2>
                  <p className="organizer-section-copy">
                    Concert hiện có {ticketTypes.length} loại vé trong khu vực quản lý.
                  </p>
                </div>
                <Button
                  type="button"
                  className="button-secondary"
                  onClick={switchToCreate}
                  disabled={isSubmitting}
                >
                  Tạo loại vé
                </Button>
              </div>

              {feedback && <Alert tone="success">{feedback}</Alert>}
              {actionError && <Alert tone="error">{toActionErrorMessage(actionError)}</Alert>}

              {ticketTypes.length === 0 ? (
                <div className="organizer-dashboard-note organizer-inline-note">
                  <p>Concert này chưa có loại vé nào.</p>
                </div>
              ) : (
                <div className="organizer-ticket-type-list">
                  {ticketTypes.map((ticketType) => {
                    const isActive = ticketType.status === 'ACTIVE';
                    const isStatusSubmitting = statusTargetId === ticketType.id;

                    return (
                      <article key={ticketType.id} className="organizer-ticket-type-card">
                        <div className="organizer-ticket-type-card-topline">
                          <div>
                            <h3>{ticketType.name}</h3>
                            <p className="organizer-ticket-code">{ticketType.code}</p>
                          </div>
                          <span
                            className={`organizer-status organizer-status--${ticketType.status.toLowerCase()}`}
                          >
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
                          <Button type="button" onClick={() => switchToEdit(ticketType.id)}>
                            Sửa
                          </Button>

                          {!isActive && (
                            <Button
                              type="button"
                              className="button-secondary"
                              disabled={isStatusSubmitting}
                              onClick={() => void handleStatusChange(ticketType, 'ACTIVE')}
                            >
                              {isStatusSubmitting ? 'Đang xử lý...' : 'Activate'}
                            </Button>
                          )}

                          {isActive && (
                            <Button
                              type="button"
                              className="button-secondary"
                              disabled={isStatusSubmitting}
                              onClick={() => void handleStatusChange(ticketType, 'INACTIVE')}
                            >
                              {isStatusSubmitting ? 'Đang xử lý...' : 'Deactivate'}
                            </Button>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="organizer-editor-panel">
              {formMode.kind === 'create' ? (
                <OrganizerTicketTypeForm
                  title="Tạo loại vé mới"
                  description="Các loại vé mới sẽ được backend tạo ở trạng thái INACTIVE cho đến khi bạn chủ động kích hoạt."
                  submitLabel="Tạo loại vé"
                  isSubmitting={isSubmitting}
                  onSubmit={handleCreate}
                />
              ) : selectedTicketType ? (
                <OrganizerTicketTypeForm
                  key={selectedTicketType.id + selectedTicketType.updatedAt}
                  title={`Chỉnh sửa ${selectedTicketType.name}`}
                  description="Bạn chỉ chỉnh sửa các trường cho phép. Các số liệu bán vé và trạng thái được hiển thị ở danh sách bên trái."
                  initialValues={toTicketTypeFormValues(selectedTicketType)}
                  submitLabel="Lưu loại vé"
                  isSubmitting={isSubmitting}
                  onSubmit={handleUpdate}
                  onCancel={switchToCreate}
                />
              ) : (
                <div className="organizer-dashboard-note organizer-inline-note">
                  <p>Không tìm thấy loại vé cần chỉnh sửa.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function renderPageError(error: ApiError | null, onRetry: () => Promise<void>) {
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
        <p>Không tìm thấy concert hoặc loại vé organizer này.</p>
      </div>
    );
  }

  return (
    <div className="concerts-error">
      <Alert tone="error">{error.message || 'Không thể tải dữ liệu loại vé.'}</Alert>
      <Button type="button" className="alert-action" onClick={() => void onRetry()}>
        Thử lại
      </Button>
    </div>
  );
}

function toActionErrorMessage(error: ApiError): string {
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

function toApiError(error: unknown): ApiError {
  if (typeof error === 'object' && error !== null && 'message' in error) {
    return error as ApiError;
  }

  return {
    status: 0,
    message: 'Không thể xử lý loại vé lúc này.',
  };
}
