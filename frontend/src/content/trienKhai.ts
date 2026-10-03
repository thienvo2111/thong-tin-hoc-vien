// src/content/trienKhai.ts
// CHẾ ĐỘ triển khai cho học viên + danh sách phiếu khảo sát đầu vào. Quản trị sửa tại
// /admin/cau-hinh-khao-sat (lưu ở backend, GET /cau-hinh-khao-sat công khai). Giá trị dưới đây là
// MẶC ĐỊNH — chỉ dùng khi quản trị chưa lưu lần nào hoặc không gọi được API.
//
// Kịch bản điển hình:
// - Giai đoạn 1 kiểu "khảo sát trước" (vd An Giang): chế độ 'khao_sat' — học viên không đăng nhập, làm
//   tuần tự các phiếu, bổ sung thông tin ngay trong phiếu. Quản trị đổ dữ liệu về qua Nhập dữ liệu.
// - Sau khi đổ dữ liệu: chế độ 'dang_nhap' — học viên đăng nhập để XEM hồ sơ/lớp học. Quyền SỬA hồ sơ
//   vẫn do Đợt xác nhận quyết định (không mở đợt = chỉ xem; mở đợt ở giai đoạn cuối để điều chỉnh).
// - Địa phương bổ sung thông tin trên hệ thống trước khi đánh giá: 'dang_nhap' + danhGiaDauVaoTrongCong.

import { useEffect, useState } from 'react';
import {
  layCauHinhCuaToi,
  layCauHinhKhaoSat,
  type CauHinhKhaoSat,
  type CheDoHocVien,
  type KenhDanhGia,
  type PhamViCauHinh,
} from '@/api/cauHinhKhaoSat';

export type { CheDoHocVien } from '@/api/cauHinhKhaoSat';

export interface CauHinhTrienKhai {
  cheDoHocVien: CheDoHocVien;
  /** false = đánh giá đầu vào làm qua phiếu ngoài — ẩn menu M6 trong cổng học viên. */
  danhGiaDauVaoTrongCong: boolean;
  /** true = trang chủ cổng học viên hiện khối "Khảo sát đầu ra" (SSO target 'dau-ra'). */
  khaoSatDauRaMo: boolean;
  hienKhaoSat: boolean;
  /** Kênh làm bài đánh giá đầu vào; cấu hình cũ không có -> 'vle'. */
  kenhDanhGia: KenhDanhGia;
  /** Thứ tự mảng = thứ tự làm. Mỗi phiếu 1 hoặc nhiều đường dẫn (vd tách theo đối tượng). */
  phieu: { ten: string; moTa: string; lienKet: { nhan: string; url: string }[] }[];
}

export const cauHinhMacDinh: CauHinhTrienKhai = {
  cheDoHocVien: 'khao_sat',
  danhGiaDauVaoTrongCong: false,
  khaoSatDauRaMo: false,
  hienKhaoSat: true,
  kenhDanhGia: 'vle',
  phieu: [
    {
      ten: 'Phiếu khảo sát kĩ năng số',
      moTa: 'Kê khai, bổ sung thông tin cá nhân và đơn vị công tác; trả lời các câu hỏi về kĩ năng số hiện có.',
      lienKet: [{ nhan: 'Mở phiếu khảo sát', url: '' }],
    },
    {
      ten: 'Phiếu đánh giá năng lực số',
      moTa: 'Làm bài đánh giá năng lực số sau khi đã hoàn thành phiếu 1. Kết quả dùng để xếp mức năng lực và chia lớp.',
      lienKet: [{ nhan: 'Mở phiếu đánh giá', url: '' }],
    },
  ],
};

export function tuCauHinhApi(c: CauHinhKhaoSat | null): CauHinhTrienKhai {
  if (!c) return cauHinhMacDinh;
  return {
    cheDoHocVien: c.che_do_hoc_vien,
    danhGiaDauVaoTrongCong: c.danh_gia_dau_vao_trong_cong,
    khaoSatDauRaMo: c.khao_sat_dau_ra_mo ?? false,
    hienKhaoSat: c.hien_khao_sat,
    kenhDanhGia: c.kenh_danh_gia ?? 'vle',
    phieu: c.phieu.map((p) => ({ ten: p.ten, moTa: p.mo_ta, lienKet: p.lien_ket })),
  };
}

/** Nguồn cấu hình: trang công khai (có thể theo tỉnh người xem chọn) hay học viên đã đăng nhập. */
export type NguonCauHinh = { loai: 'cong_khai'; tinh?: string | null } | { loai: 'cua_toi' };

const PHAM_VI_CHUNG: PhamViCauHinh = { loai: 'chung' };

/** Đọc cấu hình từ API. Trả mặc định ngay, thay bằng dữ liệu thật khi tải xong; lỗi thì giữ mặc định.
 * 2026-10-02: mỗi khóa có thể có cấu hình riêng — công khai lấy theo tỉnh, đã đăng nhập lấy theo khóa ghi danh. */
export function useCauHinhTrienKhai(nguon: NguonCauHinh = { loai: 'cong_khai' }): {
  cauHinh: CauHinhTrienKhai;
  phamVi: PhamViCauHinh;
  daTai: boolean;
} {
  const [trangThai, setTrangThai] = useState({ cauHinh: cauHinhMacDinh, phamVi: PHAM_VI_CHUNG, daTai: false });
  const khoa = nguon.loai === 'cua_toi' ? 'cua_toi' : `tinh:${nguon.tinh ?? ''}`;

  useEffect(() => {
    let huy = false;
    const goi = nguon.loai === 'cua_toi' ? layCauHinhCuaToi() : layCauHinhKhaoSat(nguon.tinh);
    goi
      .then(
        (kq) =>
          !huy &&
          setTrangThai({ cauHinh: tuCauHinhApi(kq.cau_hinh), phamVi: kq.pham_vi ?? PHAM_VI_CHUNG, daTai: true }),
      )
      .catch(() => !huy && setTrangThai((s) => ({ ...s, daTai: true })));
    return () => {
      huy = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [khoa]);

  return trangThai;
}

/** Mục nội dung có `cheDo` chỉ hiện khi khớp chế độ hiện tại; không gắn `cheDo` = luôn hiện. */
export function hopCheDo(cheDo: CheDoHocVien) {
  return (muc: { cheDo?: CheDoHocVien }) => !muc.cheDo || muc.cheDo === cheDo;
}
