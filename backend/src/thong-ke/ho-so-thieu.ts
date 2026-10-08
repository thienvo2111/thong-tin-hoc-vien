import { DongHoSoHocVien } from './thong-ke.types';

const trong = (v: string | null): boolean => v === null || v.trim() === '';

/** Các mục hồ sơ còn thiếu, theo thứ tự hiển thị. */
export function mucThieuHoSo(
  r: Pick<
    DongHoSoHocVien,
    'doi_tuong' | 'cap_giang_day' | 'email' | 'so_dien_thoai'
  >,
): string[] {
  const thieu: string[] = [];
  if (r.doi_tuong === null) thieu.push('Đối tượng');
  if (r.cap_giang_day === null) thieu.push('Cấp giảng dạy');
  if (trong(r.email)) thieu.push('Email');
  if (trong(r.so_dien_thoai)) thieu.push('SĐT');
  return thieu;
}
