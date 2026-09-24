import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { RowBuildResult } from '../import.types';

// Áp lại class-validator lên object dựng từ 1 dòng Excel — controller bình
// thường có ValidationPipe làm việc này tự động cho request body, nhưng
// import parse thủ công nên phải gọi lại cùng bộ decorator DTO ở đây để
// không lệch quy tắc giữa 2 luồng nhập tay/import (validation-checklist.md #42).
export async function buildValidatedDto<T extends object>(
  cls: new () => T,
  plain: Record<string, unknown>,
): Promise<RowBuildResult<T>> {
  const instance = plainToInstance(cls, plain);
  const errors = await validate(instance as object, {
    whitelist: true,
    forbidUnknownValues: false,
  });
  if (errors.length > 0) {
    const message = errors
      .flatMap((e) => Object.values(e.constraints ?? {}))
      .join('; ');
    return { error: message };
  }
  return { dto: instance };
}
