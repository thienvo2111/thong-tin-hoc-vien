// Ảnh minh họa của trang Hướng dẫn sử dụng (M9) — tách khỏi huongDan.ts để file nội dung chữ không kéo
// theo import ảnh nhị phân; chỉ trang M9 import file này nên không ảnh hưởng chunk M0.
import type { HinhKey } from './huongDan';

import dangNhapPc from '@/assets/huong-dan/dang-nhap-pc.webp';
import dangNhapPhone from '@/assets/huong-dan/dang-nhap-phone.webp';
import doiMatKhauPc from '@/assets/huong-dan/doi-mat-khau-pc.webp';
import doiMatKhauPhone from '@/assets/huong-dan/doi-mat-khau-phone.webp';
import trangChuPc from '@/assets/huong-dan/trang-chu-pc.webp';
import trangChuPhone from '@/assets/huong-dan/trang-chu-phone.webp';
import hoSoPc from '@/assets/huong-dan/ho-so-pc.webp';
import hoSoPhone from '@/assets/huong-dan/ho-so-phone.webp';
import khaoSatPc from '@/assets/huong-dan/khao-sat-pc.webp';
import khaoSatPhone from '@/assets/huong-dan/khao-sat-phone.webp';
import lopHocPc from '@/assets/huong-dan/lop-hoc-pc.webp';
import lopHocPhone from '@/assets/huong-dan/lop-hoc-phone.webp';
import xacNhanPc from '@/assets/huong-dan/xac-nhan-pc.webp';
import xacNhanPhone from '@/assets/huong-dan/xac-nhan-phone.webp';
import hoTroPc from '@/assets/huong-dan/ho-tro-pc.webp';
import hoTroPhone from '@/assets/huong-dan/ho-tro-phone.webp';

export const hinhHuongDan: Record<HinhKey, { pc: string; phone: string; alt: string }> = {
  'dang-nhap': { pc: dangNhapPc, phone: dangNhapPhone, alt: 'Minh họa màn hình đăng nhập' },
  'doi-mat-khau': { pc: doiMatKhauPc, phone: doiMatKhauPhone, alt: 'Minh họa màn hình đổi mật khẩu' },
  'trang-chu': { pc: trangChuPc, phone: trangChuPhone, alt: 'Minh họa trang chủ học viên' },
  'ho-so': { pc: hoSoPc, phone: hoSoPhone, alt: 'Minh họa trang hồ sơ' },
  'khao-sat': { pc: khaoSatPc, phone: khaoSatPhone, alt: 'Minh họa khối khảo sát đầu vào trên Trang chủ' },
  'lop-hoc': { pc: lopHocPc, phone: lopHocPhone, alt: 'Minh họa trang lớp học' },
  'xac-nhan': { pc: xacNhanPc, phone: xacNhanPhone, alt: 'Minh họa màn hình xác nhận' },
  'ho-tro': { pc: hoTroPc, phone: hoTroPhone, alt: 'Minh họa trang hỗ trợ' },
};
