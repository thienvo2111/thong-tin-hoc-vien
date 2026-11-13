import type { PrismaService } from '../../prisma/prisma.service';
import { chiaLo } from '../../common/utils/theo-lo.util';

// "Lượt vào VLE" (CONTEXT.md, docs/api-contract.md mục 10.2) = 1 lần
// POST /sso/vle/form thành công = 1 dòng nhat_ky_hoat_dong hanh_dong
// 'vao_hoc_vle' (VleService.form ghi). Chỉ là cấp form vào VLE — KHÔNG phải
// điểm danh, KHÔNG xác nhận VLE đăng nhập thành công.
export const HANH_DONG_VAO_HOC_VLE = 'vao_hoc_vle';

// Quản trị "Thử vào VLE" (POST /sso/vle/form-thu) — hành động RIÊNG, không có
// hoc_vien_id, KHÔNG tính là lượt vào VLE (demLuotVaoVle chỉ lọc
// HANH_DONG_VAO_HOC_VLE).
export const HANH_DONG_THU_VAO_VLE = 'thu_vao_vle';

export interface LuotVaoVle {
  so_lan_vao: number;
  lan_vao_gan_nhat: Date | null;
}

/**
 * Số lượt vào VLE + lần gần nhất theo học viên: 1 truy vấn gộp (groupBy
 * hoc_vien_id, dùng index (hoc_vien_id, thoi_gian)) cho mỗi lô id — không
 * N+1. Học viên chưa vào lần nào → không có trong Map. Mảng rỗng → không
 * truy vấn.
 */
export async function demLuotVaoVle(
  prisma: Pick<PrismaService, 'nhat_ky_hoat_dong'>,
  hocVienIds: string[],
): Promise<Map<string, LuotVaoVle>> {
  const kq = new Map<string, LuotVaoVle>();
  for (const lo of chiaLo([...new Set(hocVienIds)])) {
    const nhom = await prisma.nhat_ky_hoat_dong.groupBy({
      by: ['hoc_vien_id'],
      where: { hanh_dong: HANH_DONG_VAO_HOC_VLE, hoc_vien_id: { in: lo } },
      _count: { _all: true },
      _max: { thoi_gian: true },
    });
    for (const n of nhom) {
      if (!n.hoc_vien_id) continue;
      kq.set(n.hoc_vien_id, {
        so_lan_vao: n._count._all,
        lan_vao_gan_nhat: n._max.thoi_gian ?? null,
      });
    }
  }
  return kq;
}
