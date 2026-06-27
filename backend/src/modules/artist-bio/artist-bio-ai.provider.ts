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

  async generate(cleanedText: string): Promise<string> {
    const input = cleanedText.slice(0, this.config.aiTextMaxChars);
    if (this.config.aiProvider === 'mock') {
      return `Tiểu sử nghệ sĩ: ${input.slice(0, 700)}`;
    }
    if (!this.config.aiApiKey) throw new AiProviderError('unavailable', 'AI provider is not configured');
    return this.config.aiProvider === 'gemini' ? this.generateGemini(input) : this.generateOpenAi(input);
  }

  private prompt(text: string): string {
    return [
      'Hãy viết tiểu sử nghệ sĩ bằng tiếng Việt cho trang concert, dựa hoàn toàn trên nội dung press kit bên dưới.',
      'Yêu cầu:',
      '- Chỉ trả về tiếng Việt.',
      '- Không bịa thêm thông tin ngoài press kit.',
      '- Giọng văn tự nhiên, thu hút, phù hợp để hiển thị công khai trên website bán vé.',
      '- Trả về văn bản thuần, không Markdown, không tiêu đề phụ.',
      '',
      text,
    ].join('\n');
  }

  private async generateOpenAi(text: string): Promise<string> {
    const baseUrl = this.config.aiBaseUrl || 'https://api.openai.com/v1';
    const response = await this.request(`${baseUrl}/chat/completions`, {
      model: this.config.aiModel,
      messages: [{ role: 'user', content: this.prompt(text) }],
    }, { Authorization: `Bearer ${this.config.aiApiKey}` });
    const bio = response?.choices?.[0]?.message?.content;
    if (typeof bio !== 'string' || !bio.trim()) throw new AiProviderError('unavailable', 'AI provider returned an empty biography');
    return bio.trim();
  }

  private async generateGemini(text: string): Promise<string> {
    const baseUrl = this.config.aiBaseUrl || 'https://generativelanguage.googleapis.com/v1beta';
    const response = await this.request(`${baseUrl}/models/${this.config.aiModel}:generateContent?key=${encodeURIComponent(this.config.aiApiKey)}`, {
      contents: [{ parts: [{ text: this.prompt(text) }] }],
    });
    const bio = response?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (typeof bio !== 'string' || !bio.trim()) throw new AiProviderError('unavailable', 'AI provider returned an empty biography');
    return bio.trim();
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