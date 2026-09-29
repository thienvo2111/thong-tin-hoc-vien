// Trạng thái hiển thị cho 1 lần import — suy ra từ 2 field ĐÃ xác nhận trong api-contract.md mục 5
// (trang_thai='dang_xu_ly' khi đang xử lý bất đồng bộ; so_dong_loi đếm dòng lỗi), thay vì đoán thêm
// giá trị enum "thành công"/"có lỗi" không có trong tài liệu.
export interface TrangThaiImportNguon {
  trang_thai: string;
  so_dong_loi: number;
}

export function nhanTrangThaiImport({ trang_thai, so_dong_loi }: TrangThaiImportNguon): string {
  if (trang_thai === 'dang_xu_ly') return 'Đang xử lý';
  return so_dong_loi > 0 ? 'Có lỗi' : 'Thành công';
}

export function mauTrangThaiImport({ trang_thai, so_dong_loi }: TrangThaiImportNguon): { bg: string; mau: string } {
  if (trang_thai === 'dang_xu_ly') return { bg: '#FEF3E6', mau: '#B54708' };
  return so_dong_loi > 0 ? { bg: '#FDEEEC', mau: '#CF373D' } : { bg: '#EAF6F0', mau: '#12805C' };
}
