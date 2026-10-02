// src/content/trienKhai.ts
// Cấu hình CHẾ ĐỘ triển khai cho học viên theo từng địa phương/giai đoạn. Tách riêng khỏi gioiThieu.ts
// để trang đăng nhập và cổng học viên đọc được mà không kéo theo toàn bộ nội dung trang giới thiệu.
//
// Kịch bản điển hình:
// - Giai đoạn 1 kiểu "khảo sát trước" (vd An Giang): cheDoHocVien = 'khao_sat', danhGiaDauVaoTrongCong = false.
//   Học viên không đăng nhập, làm tuần tự các phiếu ở khối `khaoSatDauVao` (gioiThieu.ts), bổ sung thông tin
//   ngay trong phiếu. Quản trị đổ dữ liệu về qua Nhập dữ liệu (hồ sơ MOET, kết quả đánh giá, phân lớp).
// - Giai đoạn sau khi đã đổ dữ liệu: cheDoHocVien = 'dang_nhap' — học viên đăng nhập để XEM hồ sơ/lớp học.
//   Quyền SỬA hồ sơ vẫn do Đợt xác nhận quyết định (không mở đợt = chỉ xem; mở đợt ở giai đoạn cuối để điều chỉnh).
// - Địa phương bổ sung thông tin trên hệ thống trước khi đánh giá: cheDoHocVien = 'dang_nhap',
//   danhGiaDauVaoTrongCong = true (luồng M5 xác nhận -> M6 đánh giá đầu vào như cũ).

export type CheDoHocVien = 'khao_sat' | 'dang_nhap';

export const trienKhai: { cheDoHocVien: CheDoHocVien; danhGiaDauVaoTrongCong: boolean } = {
  cheDoHocVien: 'khao_sat',
  danhGiaDauVaoTrongCong: false,
};

/** Mục nội dung có `cheDo` chỉ hiện khi khớp chế độ hiện tại; không gắn `cheDo` = luôn hiện. */
export function hopCheDo(muc: { cheDo?: CheDoHocVien }): boolean {
  return !muc.cheDo || muc.cheDo === trienKhai.cheDoHocVien;
}
