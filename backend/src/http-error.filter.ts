import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';

type ErrorResponse = {
  status(status: number): {
    json(body: unknown): void;
  };
};

@Catch()
export class HttpErrorFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<ErrorResponse>();
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
    const exceptionResponse =
      exception instanceof HttpException ? exception.getResponse() : undefined;

    response.status(status).json({
      error: getError(status, exceptionResponse),
      message: getMessage(exceptionResponse),
      status_code: status,
    });
  }
}

function getError(status: number, exceptionResponse: unknown): string {
  if (
    typeof exceptionResponse === 'object' &&
    exceptionResponse !== null &&
    'error' in exceptionResponse &&
    typeof exceptionResponse.error === 'string'
  ) {
    return exceptionResponse.error;
  }

  return HttpStatus[status] ?? 'Error';
}

function getMessage(exceptionResponse: unknown): string | string[] {
  if (
    typeof exceptionResponse === 'object' &&
    exceptionResponse !== null &&
    'message' in exceptionResponse
  ) {
    const message = exceptionResponse.message;

    if (typeof message === 'string' || Array.isArray(message)) {
      return message;
    }
  }

  if (typeof exceptionResponse === 'string') {
    return exceptionResponse;
  }

  return 'Unexpected error';
}
