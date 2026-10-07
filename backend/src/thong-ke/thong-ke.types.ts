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

export interface PheuCounts {
  tham_gia: number;
  da_truy_cap: number;
  khao_sat_ky_nang_so: number;
  danh_gia_dau_vao: number;
  danh_gia_dau_ra: number;
}

export interface PheuResult extends PheuCounts {
  /** null nếu vai trò không duyệt hồ sơ (ho_tro_hoc_vien). */
  ho_so_cho_duyet: number | null;
}
