import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { Prisma } from '@prisma/client';

// Bọc mọi lỗi (kể cả lỗi Nest mặc định như UnauthorizedException do Guard ném,
// hoặc lỗi chưa lường trước) về đúng thân JSON chuẩn ở
// docs/api-contract.md mục "Quy ước chung > Lỗi". Nếu exception đã tự mang
// body dạng { error: {...} } (xem app.exceptions.ts) thì giữ nguyên.

const STATUS_TO_CODE: Record<number, string> = {
  [HttpStatus.BAD_REQUEST]: 'VALIDATION_ERROR',
  [HttpStatus.UNAUTHORIZED]: 'UNAUTHORIZED',
  [HttpStatus.FORBIDDEN]: 'FORBIDDEN',
  [HttpStatus.NOT_FOUND]: 'NOT_FOUND',
  [HttpStatus.CONFLICT]: 'CONFLICT',
};

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    // Lưới an toàn cho lỗi Postgres/Prisma chưa được service bắt trước
    // (vd race condition giữa lúc kiểm tra tồn tại và lúc insert) — tránh
    // rơi xuống 500 INTERNAL thô cho các vi phạm constraint đã biết rõ nguyên nhân.
    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === 'P2002') {
        const target = (exception.meta?.target as string[] | undefined)?.join(
          ', ',
        );
        response.status(HttpStatus.CONFLICT).json({
          error: {
            code: 'CONFLICT',
            message: `Dữ liệu đã tồn tại${target ? ` (${target})` : ''}`,
          },
        });
        return;
      }
      if (exception.code === 'P2003') {
        response.status(HttpStatus.BAD_REQUEST).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Tham chiếu đến bản ghi không tồn tại',
          },
        });
        return;
      }
      if (exception.code === 'P2025') {
        response.status(HttpStatus.NOT_FOUND).json({
          error: { code: 'NOT_FOUND', message: 'Không tìm thấy bản ghi' },
        });
        return;
      }
    }

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    let body: unknown;
    if (exception instanceof HttpException) {
      const exceptionResponse = exception.getResponse();
      const errorField =
        typeof exceptionResponse === 'object' && exceptionResponse !== null
          ? (exceptionResponse as { error?: unknown }).error
          : undefined;
      const isPreformatted =
        typeof errorField === 'object' &&
        errorField !== null &&
        'code' in errorField;
      if (isPreformatted) {
        body = exceptionResponse;
      } else {
        const message =
          typeof exceptionResponse === 'string'
            ? exceptionResponse
            : ((exceptionResponse as { message?: string | string[] })
                ?.message ?? exception.message);
        body = {
          error: {
            code: STATUS_TO_CODE[status] ?? 'INTERNAL',
            message: Array.isArray(message) ? message.join('; ') : message,
          },
        };
      }
    } else {
      this.logger.error(exception);
      body = {
        error: { code: 'INTERNAL', message: 'Đã xảy ra lỗi hệ thống' },
      };
    }

    response.status(status).json(body);
  }
}
