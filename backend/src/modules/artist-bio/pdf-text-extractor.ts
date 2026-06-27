import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PDFParse } from 'pdf-parse';
import { getArtistBioConfig } from '../../config/app.config';
import { PDF_EXTRACTION_FAILURE } from './artist-bio.types';

export class PdfTextExtractionError extends Error {}

@Injectable()
export class PdfTextExtractor {
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
    const parser = new PDFParse({ data: new Uint8Array(data) });
    try {
      const result = await parser.getText();
      const cleaned = this.clean(result.text);
      if (cleaned.length < this.minimumCharacters) throw new PdfTextExtractionError(PDF_EXTRACTION_FAILURE);
      return cleaned;
    } finally {
      await parser.destroy();
    }
  }

  clean(text: string): string {
    const printable = Array.from(text, (character) => {
      const code = character.charCodeAt(0);
      return (code < 32 && ![9, 10, 13].includes(code)) || code === 127 ? ' ' : character;
    }).join('');
    return printable.replace(/\s+/g, ' ').trim();
  }
}
