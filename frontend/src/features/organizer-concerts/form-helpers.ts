import {
  OrganizerConcertDetail,
  OrganizerConcertFormValues,
  OrganizerConcertPayload,
} from './types';

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
    errors.startsAt = 'Vui lòng chọn thời gian bắt đầu.';
  }

  if (!values.endsAt) {
    errors.endsAt = 'Vui lòng chọn thời gian kết thúc.';
  }

  if (values.startsAt && values.endsAt) {
    const start = new Date(values.startsAt);
    const end = new Date(values.endsAt);

    if (start >= end) {
      errors.endsAt = 'Thời gian kết thúc phải sau thời gian bắt đầu.';
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
  };
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
