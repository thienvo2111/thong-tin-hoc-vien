import { Prisma } from '@prisma/client';

// 2026-10-10: đối tượng chưa triển khai khảo sát/đánh giá (xem
// hoc-vien.service.ts THONG_BAO_KHAO_SAT_NHAN_VIEN) — đổi danh sách này nếu
// sau này nhân viên phải khảo sát.
export const DOI_TUONG_KHONG_KHAO_SAT = ['nhan_vien'] as const;

/** null/undefined (chưa khai đối tượng) -> true, vẫn tính vào khảo sát. */
export function phaiKhaoSat(doiTuong: string | null | undefined): boolean {
  if (doiTuong == null) return true;
  return !(DOI_TUONG_KHONG_KHAO_SAT as readonly string[]).includes(doiTuong);
}

// Prisma `notIn` tự bỏ dòng NULL -> phải OR null riêng, không gộp vào notIn,
// nếu không học viên chưa khai đối tượng sẽ bị loại khỏi khảo sát nhầm.
export const HOC_VIEN_PHAI_KHAO_SAT: Prisma.hoc_vienWhereInput = {
  OR: [
    { doi_tuong: null },
    { doi_tuong: { notIn: [...DOI_TUONG_KHONG_KHAO_SAT] } },
  ],
};

// 2026-10-10: quyết định của người dùng — đợt này nhân viên cũng KHÔNG tham
// gia tập huấn/xếp lớp, không phải chỉ không khảo sát. Tách riêng khỏi
// DOI_TUONG_KHONG_KHAO_SAT (dù trùng giá trị hiện tại) vì 2 quy tắc có thể
// khác nhau ở các đợt sau — xem khoa-boi-duong.service.ts#resolvePhanLopRow,
// danh-sach-chia-lop-excel.util.ts, nhu-cau-muc-hoc.service.ts.
export const DOI_TUONG_KHONG_XEP_LOP = ['nhan_vien'] as const;

/** null/undefined (chưa khai đối tượng) -> true, vẫn xếp lớp bình thường. */
export function phaiXepLop(doiTuong: string | null | undefined): boolean {
  if (doiTuong == null) return true;
  return !(DOI_TUONG_KHONG_XEP_LOP as readonly string[]).includes(doiTuong);
}

export const HOC_VIEN_PHAI_XEP_LOP: Prisma.hoc_vienWhereInput = {
  OR: [
    { doi_tuong: null },
    { doi_tuong: { notIn: [...DOI_TUONG_KHONG_XEP_LOP] } },
  ],
};
