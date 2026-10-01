import { Prisma } from '@prisma/client';
import { normalizeNfcName } from './normalize-text.util';

// Escape ký tự đặc biệt của SQL LIKE (%, _, \) trước khi nhét vào mẫu '%...%' ESCAPE '\'.
function escapeLikePattern(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

/**
 * Xây điều kiện SQL khớp `cotSql` với MỌI từ trong `q` (AND giữa các từ), không phân biệt dấu/hoa
 * thường qua `unaccent(lower(...))` (extension bật ở migration *_unaccent_tim_kiem). Trả về null khi
 * q rỗng sau khi chuẩn hóa (gọi nơi dùng không nên lọc gì trong trường hợp này).
 */
export function dieuKienKhongDau(
  cotSql: Prisma.Sql,
  q: string,
): Prisma.Sql | null {
  const tuKhoa = normalizeNfcName(q);
  if (!tuKhoa) return null;

  const dieuKien = tuKhoa
    .split(' ')
    .map(
      (tu) =>
        Prisma.sql`unaccent(lower(${cotSql})) LIKE unaccent(lower(${'%' + escapeLikePattern(tu) + '%'})) ESCAPE '\\'`,
    );
  return Prisma.sql`${Prisma.join(dieuKien, ' AND ')}`;
}
