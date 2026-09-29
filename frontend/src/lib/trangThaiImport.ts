// Trạng thái hiển thị cho 1 lần import — enum trang_thai_import thật chỉ có 3 giá trị (đối chiếu
// docs/database-ddl.sql `CREATE TYPE trang_thai_import AS ENUM ('dang_xu_ly', 'hoan_thanh', 'loi')`):
// 'loi' là lỗi Ở CẤP FILE (không đọc/parse được file, gán ngay lúc tạo bản ghi — xem
// backend/src/import/import.service.ts, luôn kèm so_dong_loi=0/tong_so_dong=0) nên phải ưu tiên đọc
// trực tiếp trang_thai='loi' trước, KHÔNG được suy trạng thái chỉ từ so_dong_loi > 0 (trước đây làm
// vậy khiến 1 file lỗi hoàn toàn — trang_thai='loi', so_dong_loi=0 — hiện nhầm thành "Thành công").
// so_dong_loi chỉ dùng để phân biệt "Thành công"/"Có lỗi" trong phạm vi trang_thai='hoan_thanh'
// (import đã xác nhận, có thể có 1 phần dòng lỗi).
export interface TrangThaiImportNguon {
  trang_thai: string;
  so_dong_loi: number;
}

export function nhanTrangThaiImport({ trang_thai, so_dong_loi }: TrangThaiImportNguon): string {
  if (trang_thai === 'dang_xu_ly') return 'Đang xử lý';
  if (trang_thai === 'loi') return 'Lỗi';
  return so_dong_loi > 0 ? 'Có lỗi' : 'Thành công';
}

export function mauTrangThaiImport({ trang_thai, so_dong_loi }: TrangThaiImportNguon): { bg: string; mau: string } {
  if (trang_thai === 'dang_xu_ly') return { bg: '#FEF3E6', mau: '#B54708' };
  if (trang_thai === 'loi') return { bg: '#FDEEEC', mau: '#CF373D' };
  return so_dong_loi > 0 ? { bg: '#FDEEEC', mau: '#CF373D' } : { bg: '#EAF6F0', mau: '#12805C' };
}
