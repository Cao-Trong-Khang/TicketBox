import DOMPurify from 'dompurify';
import { useMemo, useState } from 'react';
import type { TicketType } from '../types';

type InteractiveSeatMapProps = {
  svgMarkup: string | null;
  ticketTypes: TicketType[];
};

type ZoneSelection = {
  code: string;
  ticketType: TicketType | null;
};

const SVG_WHITELIST = {
  tags: ['svg', 'g', 'path', 'rect', 'circle', 'ellipse', 'text', 'line', 'polyline', 'polygon'],
  attributes: [
    'id',
    'class',
    'data-zone',
    'data-ticket-code',
    'viewBox',
    'fill',
    'stroke',
    'stroke-width',
    'opacity',
    'transform',
    'x',
    'y',
    'width',
    'height',
    'd',
    'points',
    'cx',
    'cy',
    'r',
    'rx',
    'ry',
  ],
};

export function InteractiveSeatMap({ svgMarkup, ticketTypes }: InteractiveSeatMapProps) {
  const [selectedZone, setSelectedZone] = useState<ZoneSelection | null>(null);

  const sanitizedMarkup = useMemo(() => {
    if (!svgMarkup) {
      return '';
    }

    const sanitized = DOMPurify.sanitize(svgMarkup, {
      USE_PROFILES: { svg: true, svgFilters: true },
      ALLOWED_TAGS: SVG_WHITELIST.tags,
      ALLOWED_ATTR: SVG_WHITELIST.attributes,
      FORBID_TAGS: ['script', 'foreignObject', 'iframe', 'object', 'embed', 'form', 'input'],
      FORBID_ATTR: ['onload', 'onclick', 'onmouseover', 'onfocus', 'onblur', 'style'],
      ADD_ATTR: ['focusable'],
    });

    return sanitized;
  }, [svgMarkup]);

  const zones = useMemo(() => {
    if (!sanitizedMarkup) {
      return [];
    }

    const container = document.createElement('div');
    container.innerHTML = sanitizedMarkup;

    const highlightedElements = Array.from(container.querySelectorAll('*')).filter((element) => {
      const attr = element.getAttribute('data-ticket-code') ?? element.getAttribute('data-zone') ?? element.getAttribute('id');
      return Boolean(attr);
    });

    return highlightedElements.map((element) => {
      const zoneCode = normalizeZoneCode(
        element.getAttribute('data-ticket-code') ?? element.getAttribute('data-zone') ?? element.getAttribute('id') ?? '',
      );
      const ticketType = ticketTypes.find((candidate) => normalizeZoneCode(candidate.code) === zoneCode) ?? null;

      return {
        id: element.getAttribute('id') ?? zoneCode,
        zoneCode,
        element,
        ticketType,
      };
    });
  }, [sanitizedMarkup, ticketTypes]);

  const selectedTicketType = selectedZone?.ticketType ?? null;

  if (!svgMarkup) {
    return <div className="concert-seatmap-placeholder">Chưa có sơ đồ chỗ ngồi</div>;
  }

  return (
    <div className="concert-seatmap-interactive">
      <div
        className="concert-seatmap-svg"
        dangerouslySetInnerHTML={{ __html: sanitizedMarkup }}
      />
      <div className="concert-seatmap-legend" aria-label="Thông tin hạng vé">
        {zones.length === 0 ? (
          <p>Không phát hiện vùng vé nào trong sơ đồ.</p>
        ) : (
          <ul>
            {zones.map((zone) => {
              const isActive = selectedZone?.code === zone.zoneCode;
              return (
                <li key={zone.id}>
                  <button
                    type="button"
                    className={`seatmap-zone-button ${isActive ? 'seatmap-zone-button--active' : ''}`}
                    onClick={() => setSelectedZone({ code: zone.zoneCode, ticketType: zone.ticketType })}
                    onMouseEnter={() => setSelectedZone({ code: zone.zoneCode, ticketType: zone.ticketType })}
                    onFocus={() => setSelectedZone({ code: zone.zoneCode, ticketType: zone.ticketType })}
                  >
                    {zone.zoneCode}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <div className="concert-seatmap-info" aria-live="polite">
        {selectedTicketType ? (
          <>
            <h3>{selectedTicketType.name}</h3>
            <p>
              <strong>Mã vé:</strong> {selectedTicketType.code}
            </p>
            <p>
              <strong>Giá:</strong> {selectedTicketType.priceVnd.toLocaleString('vi-VN')} ₫
            </p>
            <p>
              <strong>Còn lại:</strong> {selectedTicketType.availableQuantity.toLocaleString('vi-VN')}
            </p>
            <p>
              <strong>Trạng thái:</strong> {selectedTicketType.availableQuantity > 0 ? 'Còn vé' : 'Hết vé'}
            </p>
          </>
        ) : (
          <p>Chưa cấu hình vé</p>
        )}
      </div>
    </div>
  );
}

function normalizeZoneCode(value: string): string {
  return value.trim().toUpperCase();
}
