import { useMemo, useState } from 'react';
import { Alert } from '../../../components/ui/Alert';
import { Button } from '../../../components/ui/Button';
import { OrganizerTicketTypeForm } from './OrganizerTicketTypeForm';
import { formatTicketTypePrice } from '../ticket-type-helpers';
import { OrganizerTicketTypePayload } from '../types';

type OrganizerTicketTypeDraft = OrganizerTicketTypePayload & {
  localId: string;
};

type OrganizerTicketTypeDraftSectionProps = {
  drafts: OrganizerTicketTypeDraft[];
  isDisabled?: boolean;
  onAddDraft: (payload: OrganizerTicketTypePayload) => boolean;
  onRemoveDraft: (localId: string) => void;
};

export function OrganizerTicketTypeDraftSection({
  drafts,
  isDisabled = false,
  onAddDraft,
  onRemoveDraft,
}: OrganizerTicketTypeDraftSectionProps) {
  const [formInstance, setFormInstance] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const knownCodes = useMemo(
    () => new Set(drafts.map((draft) => draft.code.trim().toLowerCase())),
    [drafts],
  );

  const handleSubmit = async (payload: OrganizerTicketTypePayload) => {
    const normalizedCode = payload.code.trim().toLowerCase();

    if (knownCodes.has(normalizedCode)) {
      setError('Mã loại vé đang bị trùng trong danh sách cấu hình cục bộ.');
      return;
    }

    setError(null);
    const added = onAddDraft(payload);

    if (added) {
      setFormInstance((current) => current + 1);
    }
  };

  return (
    <section className="organizer-ticket-draft-section" aria-labelledby="organizer-ticket-draft-title">
      <div className="organizer-ticket-panel-header">
        <div>
          <h2 id="organizer-ticket-draft-title" className="organizer-section-title">
            Cấu hình vé
          </h2>
          <p className="organizer-section-copy">
            Thêm ít nhất một loại vé trước khi tạo concert. Các loại vé sẽ được tạo và kích hoạt tự động sau khi concert được tạo thành công.
          </p>
        </div>
      </div>

      {error && <Alert tone="error">{error}</Alert>}

      <div className="organizer-editor-panel organizer-ticket-draft-panel">
        <OrganizerTicketTypeForm
          key={formInstance}
          title="Thêm loại vé cục bộ"
          description="Thiết lập các loại vé cơ bản cho concert mới. Bạn có thể thêm nhiều loại vé trước khi gửi form cuối cùng."
          renderAsNestedSection
          submitLabel="Thêm loại vé"
          isSubmitting={isDisabled}
          onSubmit={handleSubmit}
        />
      </div>

      <div className="organizer-editor-panel organizer-ticket-draft-panel">
        <div>
          <h3 className="organizer-section-title">Danh sách loại vé sẽ tạo</h3>
          <p className="organizer-section-copy">
            Hiện có {drafts.length} loại vé trong cấu hình cục bộ.
          </p>
        </div>

        {drafts.length === 0 ? (
          <div className="organizer-inline-note organizer-dashboard-note">
            <p>Chưa có loại vé nào trong cấu hình cục bộ.</p>
          </div>
        ) : (
          <div className="organizer-ticket-type-list">
            {drafts.map((draft) => (
              <article key={draft.localId} className="organizer-ticket-type-card">
                <div className="organizer-ticket-type-card-topline">
                  <div>
                    <h3>{draft.name}</h3>
                    <p className="organizer-ticket-code">{draft.code}</p>
                  </div>
                </div>

                <div className="organizer-ticket-type-meta">
                  <p><strong>Giá:</strong> {formatTicketTypePrice(draft.priceVnd)}</p>
                  <p><strong>Tổng vé:</strong> {draft.totalQuantity}</p>
                  <p><strong>Giới hạn/người:</strong> {draft.perUserLimit}</p>
                </div>

                <div className="organizer-concert-actions">
                  <Button
                    type="button"
                    className="button-secondary"
                    disabled={isDisabled}
                    onClick={() => onRemoveDraft(draft.localId)}
                  >
                    Xóa
                  </Button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
export type { OrganizerTicketTypeDraft };
