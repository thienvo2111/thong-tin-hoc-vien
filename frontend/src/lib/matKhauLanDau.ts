/** Mật khẩu lần đầu = ngày sinh viết liền dạng ddmmyyyy (vd 8/12/1983 -> "08121983"). */
export function matKhauLanDau(ngay: number, thang: number, nam: number): string {
  const p2 = (n: number) => String(n).padStart(2, '0');
  return `${p2(ngay)}${p2(thang)}${nam}`;
}
