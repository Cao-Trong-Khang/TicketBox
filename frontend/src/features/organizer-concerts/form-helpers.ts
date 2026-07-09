import DOMPurify from 'dompurify';
import {
  OrganizerConcertDetail,
  OrganizerConcertFormValues,
  OrganizerConcertPayload,
} from './types';

export const BANNER_MAX_FILE_SIZE = 5_242_880;
export const SEATING_SVG_MAX_FILE_SIZE = 200 * 1024;
const ALLOWED_BANNER_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const ALLOWED_BANNER_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp']);
const ALLOWED_SEATING_SVG_MIME_TYPES = new Set(['image/svg+xml']);
const ALLOWED_SEATING_SVG_EXTENSIONS = new Set(['svg']);

export function createEmptyConcertFormValues(): OrganizerConcertFormValues {
  return {
    title: '',
    artistName: '',
    description: '',
    venueName: '',
    venueAddress: '',
    bannerUrl: '',
    seatingSvg: '',
    startsAt: '',
    endsAt: '',
    performanceStartAt: '',
  };
}

export function toConcertFormValues(
  concert: OrganizerConcertDetail,
): OrganizerConcertFormValues {
  return {
    title: concert.title,
    artistName: concert.artistName ?? '',
    description: concert.description ?? '',
    venueName: concert.venueName,
    venueAddress: concert.venueAddress ?? '',
    bannerUrl: concert.bannerUrl ?? '',
    seatingSvg: concert.seatingSvg ?? '',
    startsAt: isoToDateTimeLocalValue(concert.startsAt),
    endsAt: isoToDateTimeLocalValue(concert.endsAt),
    performanceStartAt: isoToDateTimeLocalValue(concert.performanceStartAt),
  };
}

export function validateConcertForm(
  values: OrganizerConcertFormValues,
): Partial<Record<keyof OrganizerConcertFormValues, string>> {
  const errors: Partial<Record<keyof OrganizerConcertFormValues, string>> = {};

  if (!values.title.trim()) {
    errors.title = 'Vui lòng nhập tên concert.';
  }

  if (!values.artistName.trim()) {
    errors.artistName = 'Vui lòng nhập tên nghệ sĩ.';
  }

  if (!values.venueName.trim()) {
    errors.venueName = 'Vui lòng nhập địa điểm.';
  }

  if (!values.venueAddress.trim()) {
    errors.venueAddress = 'Vui lòng nhập địa chỉ địa điểm.';
  }

  if (!values.startsAt) {
    errors.startsAt = 'Vui lòng chọn thời gian bắt đầu mở bán vé.';
  }

  if (!values.endsAt) {
    errors.endsAt = 'Vui lòng chọn thời gian kết thúc mở bán vé.';
  }

  if (!values.performanceStartAt) {
    errors.performanceStartAt = 'Vui lòng chọn thời gian bắt đầu concert.';
  }

  if (values.startsAt && values.endsAt) {
    const start = new Date(values.startsAt);
    const end = new Date(values.endsAt);

    if (start >= end) {
      errors.endsAt = 'Kết thúc mở bán vé phải sau bắt đầu mở bán vé.';
    }
  }

  if (values.endsAt && values.performanceStartAt) {
    const saleEnd = new Date(values.endsAt);
    const performanceStart = new Date(values.performanceStartAt);

    if (saleEnd >= performanceStart) {
      errors.performanceStartAt = 'Thời gian bắt đầu concert phải sau thời gian kết thúc mở bán vé.';
    }
  }

  return errors;
}

export function toConcertPayload(
  values: OrganizerConcertFormValues,
): OrganizerConcertPayload {
  return {
    title: values.title.trim(),
    artistName: values.artistName.trim(),
    description: normalizeOptionalText(values.description),
    venueName: values.venueName.trim(),
    venueAddress: values.venueAddress.trim(),
    bannerUrl: normalizeOptionalText(values.bannerUrl),
    seatingSvg: normalizeOptionalText(values.seatingSvg),
    startsAt: dateTimeLocalValueToIso(values.startsAt),
    endsAt: dateTimeLocalValueToIso(values.endsAt),
    performanceStartAt: dateTimeLocalValueToIso(values.performanceStartAt),
  };
}

export function validateBannerFile(file: File): { valid: boolean; error?: string } {
  const extension = file.name.split('.').pop()?.toLowerCase() ?? '';

  if (!ALLOWED_BANNER_EXTENSIONS.has(extension)) {
    return {
      valid: false,
      error: 'Chỉ chấp nhận file JPEG, PNG hoặc WebP.',
    };
  }

  if (!ALLOWED_BANNER_MIME_TYPES.has(file.type.toLowerCase())) {
    return {
      valid: false,
      error: 'Chỉ chấp nhận file JPEG, PNG hoặc WebP.',
    };
  }

  if (file.size > BANNER_MAX_FILE_SIZE) {
    return {
      valid: false,
      error: 'File phải nhỏ hơn hoặc bằng 5 MB.',
    };
  }

  return { valid: true };
}

export function createBannerPreviewUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
        return;
      }

      reject(new Error('Không thể đọc file xem trước.'));
    };

    reader.onerror = () => {
      reject(new Error('Không thể đọc file xem trước.'));
    };

    reader.readAsDataURL(file);
  });
}

export function validateSeatingSvgFile(file: File): { valid: boolean; error?: string } {
  const extension = file.name.split('.').pop()?.toLowerCase() ?? '';

  if (!ALLOWED_SEATING_SVG_EXTENSIONS.has(extension)) {
    return {
      valid: false,
      error: 'Chỉ chấp nhận file SVG.',
    };
  }

  if (!ALLOWED_SEATING_SVG_MIME_TYPES.has(file.type.toLowerCase())) {
    return {
      valid: false,
      error: 'Chỉ chấp nhận file SVG.',
    };
  }

  if (file.size > SEATING_SVG_MAX_FILE_SIZE) {
    return {
      valid: false,
      error: 'File SVG phải nhỏ hơn hoặc bằng 200 KB.',
    };
  }

  return { valid: true };
}

export function createSeatingSvgPreviewMarkup(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result === 'string') {
        const sanitized = DOMPurify.sanitize(reader.result, {
          USE_PROFILES: { svg: true, svgFilters: true },
          ALLOWED_TAGS: ['svg', 'g', 'path', 'rect', 'circle', 'ellipse', 'text', 'line', 'polyline', 'polygon'],
          ALLOWED_ATTR: ['id', 'class', 'data-zone', 'data-ticket-code', 'viewBox', 'fill', 'stroke', 'stroke-width', 'opacity', 'transform', 'x', 'y', 'width', 'height', 'd', 'points', 'cx', 'cy', 'r', 'rx', 'ry'],
          FORBID_TAGS: ['script', 'foreignObject', 'iframe', 'object', 'embed', 'form', 'input'],
          FORBID_ATTR: ['onload', 'onclick', 'onmouseover', 'onfocus', 'onblur', 'style'],
        });

        resolve(sanitized);
        return;
      }

      reject(new Error('Không thể đọc file SVG xem trước.'));
    };

    reader.onerror = () => {
      reject(new Error('Không thể đọc file SVG xem trước.'));
    };

    reader.readAsText(file);
  });
}

export function isoToDateTimeLocalValue(isoString: string | null): string {
  if (!isoString) {
    return '';
  }

  const date = new Date(isoString);
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());

  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export function dateTimeLocalValueToIso(value: string): string {
  return new Date(value).toISOString();
}

function normalizeOptionalText(value: string): string | undefined {
  const normalized = value.trim();
  return normalized ? normalized : undefined;
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}
