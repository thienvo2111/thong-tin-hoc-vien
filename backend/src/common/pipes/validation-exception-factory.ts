import { ValidationError } from '@nestjs/common';
import { ValidationException } from '../exceptions/app.exceptions';

// Gom lỗi class-validator (có thể lồng nhau) thành fields[] phẳng cho đúng
// thân lỗi VALIDATION_ERROR ở docs/api-contract.md.
function flattenErrors(
  errors: ValidationError[],
  parentPath = '',
): { field: string; message: string }[] {
  return errors.flatMap((error) => {
    const path = parentPath
      ? `${parentPath}.${error.property}`
      : error.property;
    const ownMessages = error.constraints
      ? Object.values(error.constraints).map((message) => ({
          field: path,
          message,
        }))
      : [];
    const childMessages = error.children?.length
      ? flattenErrors(error.children, path)
      : [];
    return [...ownMessages, ...childMessages];
  });
}

export function validationExceptionFactory(errors: ValidationError[]) {
  return new ValidationException(
    'Dữ liệu gửi lên không hợp lệ',
    flattenErrors(errors),
  );
}
