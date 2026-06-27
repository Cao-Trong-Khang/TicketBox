import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class ArtistBioHttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const multerCode = typeof exception === 'object' && exception !== null && 'code' in exception ? String((exception as { code: unknown }).code) : '';
    const status = multerCode === 'LIMIT_FILE_SIZE' ? HttpStatus.BAD_REQUEST : exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const payload = exception instanceof HttpException ? exception.getResponse() : null;
    const message = multerCode === 'LIMIT_FILE_SIZE' ? 'PDF must not exceed 10 MB' : this.message(payload, exception);
    response.status(status).json({ error: HttpStatus[status] ?? 'Error', message, status_code: status });
  }

  private message(payload: string | object | null, exception: unknown): string {
    if (typeof payload === 'string') return payload;
    if (payload && 'message' in payload) {
      const value = (payload as { message: unknown }).message;
      return Array.isArray(value) ? value.join(', ') : String(value);
    }
    return exception instanceof HttpException ? exception.message : 'Artist biography request failed';
  }
}
