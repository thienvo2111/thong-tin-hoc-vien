import { Prisma } from '@prisma/client';

export interface PhamViThongKe {
  /** Phạm vi ∩ bộ lọc, dùng trực tiếp cho truy vấn dang_ky_hoc. */
  where: Prisma.dang_ky_hocWhereInput;
  /** true → trả kết quả rỗng, không truy vấn. */
  rong: boolean;
  /** Khóa nằm trong where (sau lọc). */
  khoaIds: string[] | 'ALL';
}

export interface BoLocResult {
  khoa: { id: string; ten_khoa: string }[];
  /** null = không hiện ô đơn vị. */
  don_vi: { id: string; ten_don_vi: string; loai_don_vi: string }[] | null;
  /** null = không hiện ô cụm. */
  cum: { id: string; ten_cum: string; khoa_id: string }[] | null;
  /** Đơn vị cố định của vai trò truong. */
  don_vi_co_dinh: { id: string; ten_don_vi: string } | null;
}
