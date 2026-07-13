import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getArtistBioConfig } from '../../config/app.config';

export type AiFailureKind = 'timeout' | 'rate_limit' | 'unavailable';
export class AiProviderError extends Error {
  constructor(readonly kind: AiFailureKind, message: string) { super(message); }
}

@Injectable()
export class ArtistBioAiProvider {
  private readonly config;

  constructor(configService: ConfigService) {
    this.config = getArtistBioConfig(configService);
  }

  async generate(cleanedText: string, previousBio?: string): Promise<string> {
    const input = cleanedText.slice(0, this.config.aiTextMaxChars);
    if (this.config.aiProvider === 'mock') {
      return `Tiểu sử nghệ sĩ: ${input.slice(0, 700)}`;
    }
    if (!this.config.aiApiKey) throw new AiProviderError('unavailable', 'AI provider is not configured');
    return this.config.aiProvider === 'gemini'
      ? this.generateGemini(input, previousBio)
      : this.generateOpenAi(input, previousBio);
  }

  private prompt(text: string, previousBio?: string): string {
    return [
      'Hãy viết tiểu sử nghệ sĩ bằng tiếng Việt cho trang concert, dựa hoàn toàn trên nội dung press kit bên dưới.',
      'Yêu cầu:',
      '- Chỉ trả về tiếng Việt.',
      '- Không bịa thêm thông tin ngoài press kit.',
      '- Giọng văn tự nhiên, thu hút, phù hợp để hiển thị công khai trên website bán vé.',
      '- Trả về văn bản thuần, không Markdown, không tiêu đề phụ.',
      '- Toàn bộ câu trả lời phải bằng tiếng Việt; không sao chép nguyên câu tiếng Anh từ press kit.',
      '- Mỗi lần tạo lại phải dùng cách diễn đạt và cấu trúc mới, nhưng vẫn giữ nguyên các dữ kiện.',
      ...(previousBio?.trim() ? [
        '- Đây là lần tạo lại. Bản mới phải khác rõ rệt bản trước về câu mở đầu, thứ tự thông tin và cách diễn đạt.',
        '- Không được chép lại nguyên văn hoặc chỉ thay một vài từ.',
        '',
        'BẢN TRƯỚC CẦN TRÁNH LẶP LẠI:',
        previousBio.trim().slice(0, 10000),
      ] : []),
      '',
      'NỘI DUNG PRESS KIT:',
      text,
    ].join('\n');
  }

  private async generateOpenAi(text: string, previousBio?: string): Promise<string> {
    const baseUrl = this.config.aiBaseUrl || 'https://api.openai.com/v1';
    const response = await this.request(`${baseUrl}/chat/completions`, {
      model: this.config.aiModel,
      messages: [{ role: 'user', content: this.prompt(text, previousBio) }],
    }, { Authorization: `Bearer ${this.config.aiApiKey}` });
    const bio = response?.choices?.[0]?.message?.content;
    if (typeof bio !== 'string' || !bio.trim()) throw new AiProviderError('unavailable', 'AI provider returned an empty biography');
    return bio.trim();
  }

  private async generateGemini(text: string, previousBio?: string): Promise<string> {
    const baseUrl = this.config.aiBaseUrl || 'https://generativelanguage.googleapis.com/v1beta';
    const url = `${baseUrl}/models/${this.config.aiModel}:generateContent?key=${encodeURIComponent(this.config.aiApiKey)}`;
    const response = await this.request(url, {
      contents: [{ parts: [{ text: this.prompt(text, previousBio) }] }],
      generationConfig: { temperature: 0.9, topP: 0.95 },
    });
    let bio = this.geminiText(response);

    if (this.isEnglishDominant(bio)) {
      const correction = await this.request(url, {
        contents: [{ parts: [{ text: [
          'Hãy viết lại toàn bộ nội dung sau bằng tiếng Việt tự nhiên.',
          'Không giữ lại câu tiếng Anh; chỉ giữ nguyên tên riêng và tên thể loại khi cần thiết.',
          'Chỉ trả về nội dung tiểu sử đã sửa, không giải thích.',
          '',
          bio,
        ].join('\n') }] }],
        generationConfig: { temperature: 0.7, topP: 0.9 },
      });
      bio = this.geminiText(correction);
    }

    if (previousBio?.trim() && this.isTooSimilar(bio, previousBio)) {
      const variation = await this.request(url, {
        contents: [{ parts: [{ text: [
          this.prompt(text, previousBio),
          '',
          'Bản vừa tạo vẫn quá giống bản trước.',
          'Hãy viết lại một phiên bản tiếng Việt mới với câu mở đầu, bố cục đoạn và thứ tự dữ kiện khác rõ rệt.',
          'Chỉ trả về tiểu sử mới.',
        ].join('\n') }] }],
        generationConfig: { temperature: 1, topP: 0.98 },
      });
      bio = this.geminiText(variation);
    }

    if (this.isEnglishDominant(bio)) {
      throw new AiProviderError('unavailable', 'Gemini did not return a Vietnamese biography');
    }
    if (previousBio?.trim() && this.isTooSimilar(bio, previousBio)) {
      throw new AiProviderError('unavailable', 'Gemini did not produce a sufficiently different biography');
    }
    return bio;
  }

  private geminiText(response: any): string {
    const bio = response?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (typeof bio !== 'string' || !bio.trim()) throw new AiProviderError('unavailable', 'AI provider returned an empty biography');
    return bio.trim();
  }

  private isEnglishDominant(text: string): boolean {
    const words = text.match(/[\p{L}]+/gu)?.length ?? 0;
    const english = text.match(/\b(the|and|with|their|from|based|formed|band|artist|music|performances|known|combines|is|are|was|were|has|have|this|that|its|they|group|independent|released|album|songs|sound|style|city|vocalist|guitarist|drummer)\b/gi)?.length ?? 0;
    const vietnamese = text.match(/\b(là|và|của|được|với|từ|những|nghệ sĩ|âm nhạc|ban nhạc|biểu diễn|thành lập)\b/gi)?.length ?? 0;
    const diacriticWords = text.match(/[\p{L}]*[ăâđêôơưáàảãạấầẩẫậắằẳẵặéèẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵ][\p{L}]*/giu)?.length ?? 0;
    if (words >= 20 && vietnamese === 0 && diacriticWords === 0) return true;
    return english >= 3 && english > vietnamese + diacriticWords;
  }

  private isTooSimilar(candidate: string, previous: string): boolean {
    const tokens = (value: string) => new Set(
      value.toLocaleLowerCase('vi')
        .normalize('NFC')
        .match(/[\p{L}\p{N}]+/gu) ?? [],
    );
    const currentTokens = tokens(candidate);
    const previousTokens = tokens(previous);
    if (currentTokens.size === 0 || previousTokens.size === 0) return false;
    let intersection = 0;
    for (const token of currentTokens) {
      if (previousTokens.has(token)) intersection += 1;
    }
    const union = new Set([...currentTokens, ...previousTokens]).size;
    return intersection / union >= 0.82;
  }

  private async request(url: string, body: unknown, headers: Record<string, string> = {}): Promise<any> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.aiTimeoutMs);
    try {
      const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body), signal: controller.signal });
      if (response.status === 429) throw new AiProviderError('rate_limit', 'AI provider rate limited the request');
      if (!response.ok) throw new AiProviderError('unavailable', 'AI provider request failed');
      return await response.json();
    } catch (error) {
      if (error instanceof AiProviderError) throw error;
      if (error instanceof Error && error.name === 'AbortError') throw new AiProviderError('timeout', 'AI provider request timed out');
      throw new AiProviderError('unavailable', 'AI provider is unavailable');
    } finally {
      clearTimeout(timer);
    }
  }
}
