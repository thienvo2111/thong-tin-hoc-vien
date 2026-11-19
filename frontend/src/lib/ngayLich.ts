// Ngày lịch (không giờ) cho ô chọn ngày: API dùng 'YYYY-MM-DD', ô nhập hiển thị 'dd/mm/yyyy'.
// Date ở đây là nửa đêm GIỜ MÁY của ngày đó (như DateInput trả về) — không đổi qua UTC.

const hai = (n: number) => String(n).padStart(2, '0');

/** Date (giờ máy) → 'YYYY-MM-DD'. */
export function ngaySangChuoi(d: Date): string {
  return `${d.getFullYear()}-${hai(d.getMonth() + 1)}-${hai(d.getDate())}`;
}

function taoNgay(nam: number, thang: number, ngay: number): Date | null {
  const d = new Date(nam, thang - 1, ngay);
  return d.getFullYear() === nam && d.getMonth() === thang - 1 && d.getDate() === ngay ? d : null;
}

/** 'YYYY-MM-DD' → Date (giờ máy); null nếu sai dạng hoặc ngày không có thật. */
export function chuoiSangNgay(s: string | null): Date | null {
  const m = s?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? taoNgay(Number(m[1]), Number(m[2]), Number(m[3])) : null;
}

/** Đọc chữ người dùng gõ 'd/m/yyyy' (cho DateInput.dateParser); null nếu chưa đủ/không hợp lệ. */
export function docNgayGo(s: string): Date | null {
  const m = s.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  return m ? taoNgay(Number(m[3]), Number(m[2]), Number(m[1])) : null;
}

/** 'YYYY-MM-DD' → 'dd/mm/yyyy'. */
export function dinhDangNgayLich(s: string): string {
  const [nam, thang, ngay] = s.split('-');
  return `${ngay}/${thang}/${nam}`;
}

/** 1500000 → '1.500.000 đ'. */
export function dinhDangTien(soTien: number): string {
  return `${new Intl.NumberFormat('vi-VN').format(soTien)} đ`;
}
