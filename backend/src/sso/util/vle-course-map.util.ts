import type { muc_nang_luc } from '@prisma/client';

const MUC_HOP_LE: readonly muc_nang_luc[] = ['co_ban', 'thanh_thao', 'nang_cao'];

export interface VleCourseMapResult {
  map: Partial<Record<muc_nang_luc, number>>;
  canhBao: string[];
}

// VLE_COURSE_MAP="co_ban:12,thanh_thao:13,nang_cao:14" — map mức năng lực
// sang id_course của VLE (docs/api-contract.md mục 10.2). Parse nghiêm
// ngặt: mục không hợp lệ (mức lạ, id không phải số nguyên dương) bị BỎ QUA
// (không throw, không chặn khởi động) — chỉ trả cảnh báo để gọi nơi dùng
// log 1 lần (lúc khởi tạo service, không log lại mỗi request).
export function parseVleCourseMap(raw: string | undefined): VleCourseMapResult {
  const map: Partial<Record<muc_nang_luc, number>> = {};
  const canhBao: string[] = [];
  if (!raw?.trim()) return { map, canhBao };

  for (const token of raw.split(',')) {
    const t = token.trim();
    if (!t) continue;
    const [mucRaw, idRaw] = t.split(':').map((s) => s?.trim());
    const muc = mucRaw as muc_nang_luc;
    const id = Number(idRaw);
    if (
      !mucRaw ||
      !(MUC_HOP_LE as readonly string[]).includes(muc) ||
      !idRaw ||
      !Number.isInteger(id) ||
      id <= 0
    ) {
      canhBao.push(`VLE_COURSE_MAP: mục "${t}" không hợp lệ, bỏ qua`);
      continue;
    }
    map[muc] = id;
  }
  return { map, canhBao };
}
