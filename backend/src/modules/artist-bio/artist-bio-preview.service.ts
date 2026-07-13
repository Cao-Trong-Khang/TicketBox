import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ArtistBioAiProvider, AiProviderError } from './artist-bio-ai.provider';
import { PDF_MAX_BYTES } from './artist-bio.types';
import { PdfTextExtractionError, PdfTextExtractor } from './pdf-text-extractor';

type UploadedPdf = { originalname: string; mimetype: string; size: number; buffer: Buffer };

@Injectable()
export class ArtistBioPreviewService {
  constructor(
    private readonly pdfExtractor: PdfTextExtractor,
    private readonly ai: ArtistBioAiProvider,
  ) {}

  async generate(file?: UploadedPdf, previousBio?: string): Promise<{ generated_bio: string }> {
    if (!file) throw new BadRequestException('PDF file is required');
    if (file.size > PDF_MAX_BYTES) throw new BadRequestException('PDF must not exceed 10 MB');

    const fileName = decodeUploadedFileName(file.originalname);
    this.pdfExtractor.assertValidPdf(fileName, file.mimetype, file.buffer);

    try {
      const extractedText = await this.pdfExtractor.extract(file.buffer);
      const generatedBio = (await this.ai.generate(extractedText, previousBio)).trim();
      if (!generatedBio) throw new ServiceUnavailableException('AI provider returned an empty biography');
      return { generated_bio: generatedBio };
    } catch (error) {
      if (error instanceof PdfTextExtractionError) throw new BadRequestException(error.message);
      if (error instanceof AiProviderError) throw new ServiceUnavailableException(error.message);
      throw error;
    }
  }
}

function decodeUploadedFileName(fileName: string): string {
  const decoded = Buffer.from(fileName, 'latin1').toString('utf8');
  return decoded.includes('\uFFFD') ? fileName : decoded;
}
