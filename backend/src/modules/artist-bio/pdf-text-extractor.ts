import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { pathToFileURL } from 'url';
import { getArtistBioConfig } from '../../config/app.config';
import { PDF_EXTRACTION_FAILURE } from './artist-bio.types';

export class PdfTextExtractionError extends Error {}

type PdfJsTextItem = { str: string; hasEOL?: boolean };
type PdfJsPage = {
  getTextContent(params?: unknown): Promise<{ items: unknown[] }>;
  cleanup(): void;
};
type PdfJsDocument = {
  numPages: number;
  getPage(pageNumber: number): Promise<PdfJsPage>;
  destroy(): Promise<void>;
};
type PdfJsLoadingTask = {
  promise: Promise<PdfJsDocument>;
  destroy(): Promise<void>;
};
type PdfJsModule = {
  getDocument(source: unknown): PdfJsLoadingTask;
  GlobalWorkerOptions?: { workerSrc: string };
  VerbosityLevel?: { ERRORS?: number };
};
const importEsm = new Function('specifier', 'return import(specifier)') as (specifier: string) => Promise<PdfJsModule>;
const pdfJsBuildUrl = pathToFileURL(require.resolve('pdfjs-dist/legacy/build/pdf.mjs')).href;
const pdfJsWorkerUrl = pathToFileURL(require.resolve('pdfjs-dist/legacy/build/pdf.worker.mjs')).href;

@Injectable()
export class PdfTextExtractor {
  private readonly logger = new Logger(PdfTextExtractor.name);
  private readonly minimumCharacters: number;

  constructor(configService: ConfigService) {
    this.minimumCharacters = getArtistBioConfig(configService).pdfMinTextChars;
  }

  assertValidPdf(fileName: string, mimeType: string, data: Buffer): void {
    const extensionValid = fileName.toLowerCase().endsWith('.pdf');
    const mimeValid = mimeType === 'application/pdf';
    const signatureValid = data.subarray(0, 5).toString('ascii') === '%PDF-';
    if (!extensionValid || !mimeValid || !signatureValid) {
      throw new BadRequestException('Only valid PDF files are accepted');
    }
  }

  async extract(data: Buffer): Promise<string> {
    ensurePdfJsPolyfills();

    let loadingTask: PdfJsLoadingTask | undefined;
    let document: PdfJsDocument | undefined;
    try {
      const pdfjs = await importEsm(pdfJsBuildUrl);
      if (pdfjs.GlobalWorkerOptions) pdfjs.GlobalWorkerOptions.workerSrc = pdfJsWorkerUrl;
      loadingTask = pdfjs.getDocument({
        data: new Uint8Array(data),
        disableWorker: true,
        disableFontFace: true,
        isImageDecoderSupported: false,
        isOffscreenCanvasSupported: false,
        useSystemFonts: false,
        verbosity: pdfjs.VerbosityLevel?.ERRORS,
      });
      document = await loadingTask.promise;

      const pageTexts: string[] = [];
      for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
        const page = await document.getPage(pageNumber);
        try {
          const content = await page.getTextContent({ includeMarkedContent: false, disableNormalization: false });
          pageTexts.push(this.textItemsToString(content.items));
        } finally {
          page.cleanup();
        }
      }

      const cleaned = this.clean(pageTexts.join('\n'));
      if (cleaned.length < this.minimumCharacters) throw new PdfTextExtractionError(PDF_EXTRACTION_FAILURE);
      return cleaned;
    } catch (error) {
      if (error instanceof PdfTextExtractionError) throw error;
      this.logger.warn(`PDF text extraction failed: ${errorMessage(error)}`);
      throw new PdfTextExtractionError(PDF_EXTRACTION_FAILURE);
    } finally {
      try {
        if (document) await document.destroy();
        else if (loadingTask) await loadingTask.destroy();
      } catch {
        // Ignore cleanup failures after extraction has already succeeded or failed.
      }
    }
  }

  private textItemsToString(items: unknown[]): string {
    const parts: string[] = [];
    for (const item of items) {
      if (!isPdfJsTextItem(item)) continue;
      parts.push(item.str);
      if (item.hasEOL) parts.push('\n');
    }
    return parts.join(' ');
  }

  clean(text: string): string {
    const printable = Array.from(text, (character) => {
      const code = character.charCodeAt(0);
      return (code < 32 && ![9, 10, 13].includes(code)) || code === 127 ? ' ' : character;
    }).join('');
    return printable.replace(/\s+/g, ' ').trim();
  }
}

function isPdfJsTextItem(item: unknown): item is PdfJsTextItem {
  return typeof item === 'object' && item !== null && 'str' in item && typeof (item as { str: unknown }).str === 'string';
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function ensurePdfJsPolyfills(): void {
  const target = globalThis as Record<string, unknown>;

  // Vercel's Node runtime does not provide canvas globals; text extraction does not need real rendering.
  target.DOMMatrix ??= SimpleDOMMatrix;
  target.ImageData ??= SimpleImageData;
  target.Path2D ??= NoopPath2D;
}

type MatrixLike = { a?: number; b?: number; c?: number; d?: number; e?: number; f?: number };

class SimpleDOMMatrix {
  a = 1;
  b = 0;
  c = 0;
  d = 1;
  e = 0;
  f = 0;
  m11 = 1;
  m12 = 0;
  m21 = 0;
  m22 = 1;
  m41 = 0;
  m42 = 0;
  is2D = true;

  constructor(init?: number[] | MatrixLike) {
    if (Array.isArray(init)) {
      this.assign(init[0] ?? 1, init[1] ?? 0, init[2] ?? 0, init[3] ?? 1, init[4] ?? 0, init[5] ?? 0);
    } else if (init && typeof init === 'object') {
      this.assign(init.a ?? 1, init.b ?? 0, init.c ?? 0, init.d ?? 1, init.e ?? 0, init.f ?? 0);
    }
  }

  multiplySelf(other?: MatrixLike): this {
    const matrix = toMatrix(other);
    return this.assign(
      this.a * matrix.a + this.c * matrix.b,
      this.b * matrix.a + this.d * matrix.b,
      this.a * matrix.c + this.c * matrix.d,
      this.b * matrix.c + this.d * matrix.d,
      this.a * matrix.e + this.c * matrix.f + this.e,
      this.b * matrix.e + this.d * matrix.f + this.f,
    );
  }

  preMultiplySelf(other?: MatrixLike): this {
    const matrix = toMatrix(other);
    return this.assign(
      matrix.a * this.a + matrix.c * this.b,
      matrix.b * this.a + matrix.d * this.b,
      matrix.a * this.c + matrix.c * this.d,
      matrix.b * this.c + matrix.d * this.d,
      matrix.a * this.e + matrix.c * this.f + matrix.e,
      matrix.b * this.e + matrix.d * this.f + matrix.f,
    );
  }

  translate(x = 0, y = 0): SimpleDOMMatrix {
    return this.clone().multiplySelf({ a: 1, b: 0, c: 0, d: 1, e: x, f: y });
  }

  scale(x = 1, y = x): SimpleDOMMatrix {
    return this.clone().multiplySelf({ a: x, b: 0, c: 0, d: y, e: 0, f: 0 });
  }

  invertSelf(): this {
    const determinant = this.a * this.d - this.b * this.c;
    if (!determinant) return this.assign(Number.NaN, Number.NaN, Number.NaN, Number.NaN, Number.NaN, Number.NaN);
    return this.assign(
      this.d / determinant,
      -this.b / determinant,
      -this.c / determinant,
      this.a / determinant,
      (this.c * this.f - this.d * this.e) / determinant,
      (this.b * this.e - this.a * this.f) / determinant,
    );
  }

  private clone(): SimpleDOMMatrix {
    return new SimpleDOMMatrix(this);
  }

  private assign(a: number, b: number, c: number, d: number, e: number, f: number): this {
    this.a = this.m11 = a;
    this.b = this.m12 = b;
    this.c = this.m21 = c;
    this.d = this.m22 = d;
    this.e = this.m41 = e;
    this.f = this.m42 = f;
    return this;
  }
}

class SimpleImageData {
  data: Uint8ClampedArray;
  width: number;
  height: number;

  constructor(dataOrWidth: Uint8ClampedArray | number, width?: number, height?: number) {
    if (typeof dataOrWidth === 'number') {
      this.width = dataOrWidth;
      this.height = width ?? 0;
      this.data = new Uint8ClampedArray(this.width * this.height * 4);
    } else {
      this.data = dataOrWidth;
      this.width = width ?? 0;
      this.height = height ?? 0;
    }
  }
}

class NoopPath2D {
  constructor(_path?: string | NoopPath2D) {}
  addPath(_path: NoopPath2D, _transform?: SimpleDOMMatrix): void {}
}

function toMatrix(matrix?: MatrixLike): Required<MatrixLike> {
  return {
    a: matrix?.a ?? 1,
    b: matrix?.b ?? 0,
    c: matrix?.c ?? 0,
    d: matrix?.d ?? 1,
    e: matrix?.e ?? 0,
    f: matrix?.f ?? 0,
  };
}
