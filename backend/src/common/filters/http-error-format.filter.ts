import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';

@Catch()
export class HttpErrorFormatFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse();
    const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const payload = exception instanceof HttpException ? exception.getResponse() : undefined;

    response.status(status).json({
      error: this.getError(status, payload),
      message: this.getMessage(exception, payload),
      status_code: status,
    });
  }

  private getError(status: number, payload: unknown): string {
    if (isErrorPayload(payload) && typeof payload.error === 'string') {
      return payload.error;
    }

    return HttpStatus[status] ?? 'Error';
  }

  private getMessage(exception: unknown, payload: unknown): string {
    if (isErrorPayload(payload)) {
      if (Array.isArray(payload.message)) {
        return payload.message.join('; ');
      }

      if (typeof payload.message === 'string') {
        return payload.message;
      }
    }

    if (typeof payload === 'string') {
      return payload;
    }

    return exception instanceof Error ? exception.message : 'Internal server error';
  }
}

function isErrorPayload(payload: unknown): payload is { error?: unknown; message?: unknown } {
  return typeof payload === 'object' && payload !== null;
}