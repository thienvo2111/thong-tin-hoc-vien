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
import { layCauHinhKhaoSat, type CauHinhKhaoSat, type CheDoHocVien } from '@/api/cauHinhKhaoSat';

export type { CheDoHocVien } from '@/api/cauHinhKhaoSat';

export interface CauHinhTrienKhai {
  cheDoHocVien: CheDoHocVien;
  /** false = đánh giá đầu vào làm qua phiếu ngoài — ẩn menu M6 trong cổng học viên. */
  danhGiaDauVaoTrongCong: boolean;
  /** true = trang chủ cổng học viên hiện khối "Khảo sát đầu ra" (SSO target 'dau-ra'). */
  khaoSatDauRaMo: boolean;
  hienKhaoSat: boolean;
  /** Thứ tự mảng = thứ tự làm. Mỗi phiếu 1 hoặc nhiều đường dẫn (vd tách theo đối tượng). */
  phieu: { ten: string; moTa: string; lienKet: { nhan: string; url: string }[] }[];
}

export const cauHinhMacDinh: CauHinhTrienKhai = {
  cheDoHocVien: 'khao_sat',
  danhGiaDauVaoTrongCong: false,
  khaoSatDauRaMo: false,
  hienKhaoSat: true,
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
    phieu: c.phieu.map((p) => ({ ten: p.ten, moTa: p.mo_ta, lienKet: p.lien_ket })),
  };
}

/** Đọc cấu hình từ API (công khai). Trả mặc định ngay, thay bằng dữ liệu thật khi tải xong; lỗi thì giữ mặc định. */
export function useCauHinhTrienKhai(): { cauHinh: CauHinhTrienKhai; daTai: boolean } {
  const [trangThai, setTrangThai] = useState({ cauHinh: cauHinhMacDinh, daTai: false });

  useEffect(() => {
    let huy = false;
    layCauHinhKhaoSat()
      .then((kq) => !huy && setTrangThai({ cauHinh: tuCauHinhApi(kq.cau_hinh), daTai: true }))
      .catch(() => !huy && setTrangThai((s) => ({ ...s, daTai: true })));
    return () => {
      huy = true;
    };
  }, []);

  return trangThai;
}

/** Mục nội dung có `cheDo` chỉ hiện khi khớp chế độ hiện tại; không gắn `cheDo` = luôn hiện. */
export function hopCheDo(cheDo: CheDoHocVien) {
  return (muc: { cheDo?: CheDoHocVien }) => !muc.cheDo || muc.cheDo === cheDo;
}
