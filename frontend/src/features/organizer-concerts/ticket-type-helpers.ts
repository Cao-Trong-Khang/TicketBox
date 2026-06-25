import {
  OrganizerTicketType,
  OrganizerTicketTypeFormValues,
  OrganizerTicketTypePayload,
} from './types';

export function createEmptyTicketTypeFormValues(): OrganizerTicketTypeFormValues {
  return {
    code: '',
    name: '',
    priceVnd: '',
    totalQuantity: '',
    perUserLimit: '',
  };
}

export function toTicketTypeFormValues(
  ticketType: OrganizerTicketType,
): OrganizerTicketTypeFormValues {
  return {
    code: ticketType.code,
    name: ticketType.name,
    priceVnd: String(ticketType.priceVnd),
    totalQuantity: String(ticketType.totalQuantity),
    perUserLimit: String(ticketType.perUserLimit),
  };
}

export function validateTicketTypeForm(
  values: OrganizerTicketTypeFormValues,
): Partial<Record<keyof OrganizerTicketTypeFormValues, string>> {
  const errors: Partial<Record<keyof OrganizerTicketTypeFormValues, string>> = {};

  if (!values.code.trim()) {
    errors.code = 'Vui lòng nhập mã loại vé.';
  }

  if (!values.name.trim()) {
    errors.name = 'Vui lòng nhập tên loại vé.';
  }

  if (!values.priceVnd.trim()) {
    errors.priceVnd = 'Vui lòng nhập giá vé.';
  } else if (!isInteger(values.priceVnd) || Number(values.priceVnd) < 0) {
    errors.priceVnd = 'Giá vé phải lớn hơn hoặc bằng 0.';
  }

  if (!values.totalQuantity.trim()) {
    errors.totalQuantity = 'Vui lòng nhập số lượng vé.';
  } else if (!isInteger(values.totalQuantity) || Number(values.totalQuantity) <= 0) {
    errors.totalQuantity = 'Số lượng vé phải lớn hơn 0.';
  }

  if (!values.perUserLimit.trim()) {
    errors.perUserLimit = 'Vui lòng nhập giới hạn mỗi người.';
  } else if (!isInteger(values.perUserLimit) || Number(values.perUserLimit) <= 0) {
    errors.perUserLimit = 'Giới hạn mỗi người phải lớn hơn 0.';
  }

  if (
    values.totalQuantity.trim() &&
    values.perUserLimit.trim() &&
    isInteger(values.totalQuantity) &&
    isInteger(values.perUserLimit) &&
    Number(values.perUserLimit) > Number(values.totalQuantity)
  ) {
    errors.perUserLimit = 'Giới hạn mỗi người không được vượt quá tổng số vé.';
  }

  return errors;
}

export function toTicketTypePayload(
  values: OrganizerTicketTypeFormValues,
): OrganizerTicketTypePayload {
  return {
    code: values.code.trim(),
    name: values.name.trim(),
    priceVnd: Number(values.priceVnd),
    totalQuantity: Number(values.totalQuantity),
    perUserLimit: Number(values.perUserLimit),
  };
}

export function formatTicketTypePrice(priceVnd: number): string {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(priceVnd);
}

export function formatTicketTypeDateTime(value: string | null): string {
  if (!value) {
    return 'Chưa cấu hình';
  }

  return new Intl.DateTimeFormat('vi-VN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(new Date(value));
}

export function sortTicketTypes(
  ticketTypes: OrganizerTicketType[],
): OrganizerTicketType[] {
  return [...ticketTypes].sort((left, right) => {
    if (left.priceVnd !== right.priceVnd) {
      return left.priceVnd - right.priceVnd;
    }

    return left.code.localeCompare(right.code, 'vi');
  });
}

function isInteger(value: string): boolean {
  return /^-?\d+$/.test(value.trim());
}
