import { validateTicketTypeForm } from './ticket-type-helpers';
import { OrganizerTicketTypeFormValues } from './types';
import type { OrganizerTicketTypeDraft } from './components/OrganizerTicketTypeDraftSection';

export function hasTicketDraftValidationErrors(
  drafts: OrganizerTicketTypeDraft[],
): string | null {
  if (drafts.length === 0) {
    return 'Vui lòng cấu hình ít nhất một loại vé trước khi tạo concert.';
  }

  const knownCodes = new Set<string>();

  for (const draft of drafts) {
    const values: OrganizerTicketTypeFormValues = {
      code: draft.code,
      name: draft.name,
      priceVnd: String(draft.priceVnd),
      totalQuantity: String(draft.totalQuantity),
      perUserLimit: String(draft.perUserLimit),
    };
    const validationErrors = validateTicketTypeForm(values);

    if (Object.keys(validationErrors).length > 0) {
      return 'Danh sách loại vé đang có dữ liệu chưa hợp lệ.';
    }

    const normalizedCode = draft.code.trim().toLowerCase();
    if (knownCodes.has(normalizedCode)) {
      return 'Mã loại vé đang bị trùng trong danh sách cấu hình cục bộ.';
    }

    knownCodes.add(normalizedCode);
  }

  return null;
}
