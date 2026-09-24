import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';

export interface ValidationFieldError {
  field: string;
  message: string;
}

// Thân lỗi thống nhất theo docs/api-contract.md mục "Quy ước chung > Lỗi":
// { "error": { "code", "message", "fields"? } }.

export class ValidationException extends BadRequestException {
  constructor(message: string, fields?: ValidationFieldError[]) {
    super({ error: { code: 'VALIDATION_ERROR', message, fields } });
  }
}

export class UnauthorizedAppException extends UnauthorizedException {
  constructor(message = 'Sai tên đăng nhập hoặc mật khẩu') {
    super({ error: { code: 'UNAUTHORIZED', message } });
  }
}

export class ForbiddenAppException extends ForbiddenException {
  constructor(message = 'Không có quyền truy cập tài nguyên này') {
    super({ error: { code: 'FORBIDDEN', message } });
  }
}

export class NotFoundAppException extends NotFoundException {
  constructor(message = 'Không tìm thấy tài nguyên') {
    super({ error: { code: 'NOT_FOUND', message } });
  }
}

export class ConflictAppException extends ConflictException {
  constructor(message: string, fields?: ValidationFieldError[]) {
    super({ error: { code: 'CONFLICT', message, fields } });
  }
}

// Dùng bởi Dịch vụ Import (mỗi dòng file) để biến lỗi ném ra từ đúng 1 bộ
// quy tắc validate dùng chung (ValidationException/ConflictAppException của
// các *_hoc.service.ts) thành 1 chuỗi lý do ngắn gọn cho cột "Lý do".
export function toRowErrorMessage(exception: unknown): string {
  if (
    exception instanceof ValidationException ||
    exception instanceof ConflictAppException
  ) {
    const body = exception.getResponse() as {
      error: { message: string; fields?: ValidationFieldError[] };
    };
    if (body.error.fields?.length) {
      return body.error.fields
        .map((f) => `${f.field}: ${f.message}`)
        .join('; ');
    }
    return body.error.message;
  }
  if (exception instanceof Error) return exception.message;
  return 'Lỗi không xác định';
}
