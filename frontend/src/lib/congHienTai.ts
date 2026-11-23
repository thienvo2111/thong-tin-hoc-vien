/** Cùng 1 bản build phục vụ 2 cổng, chọn lúc chạy (ADR 0015 P3/T7, issue #55):
 * - 'nls': trang Bồi dưỡng năng lực số (mặc định — hostname lạ/localhost/chưa cấu hình đều vào đây).
 * - 'don_vi': Cổng đơn vị – Bồi dưỡng giáo viên HCMUE (trường, Sở, Phòng, quản trị).
 * 2 cách nhận diện Cổng đơn vị: theo hostname (VITE_CONG_DON_VI_HOSTNAME — tên miền riêng) hoặc, tạm khi chưa có
 * tên miền, theo tiền tố đường dẫn trên cùng origin NLS (VITE_CONG_DON_VI_DUONG_DAN, vd. /cdv — ADR 0015 T7). */
export type Cong = 'nls' | 'don_vi';

/** cong + basename của router ('' = gốc; '/cdv' khi Cổng đơn vị chạy theo tiền tố đường dẫn). */
export interface ViTriCong {
  cong: Cong;
  basename: string;
}

const VAI_TRO_DON_VI = ['truong', 'so_gddt', 'phong_vhxh'];

/** 'cdv/', '/CDV', ' /cdv ' → '/cdv'; rỗng/undefined/'/' → '' (tắt). */
export function chuanHoaDuongDan(giaTri: string | undefined): string {
  const doan = (giaTri ?? '')
    .trim()
    .toLowerCase()
    .replace(/^\/+|\/+$/g, '');
  return doan ? `/${doan}` : '';
}

/** Hostname khớp cấu hình → cổng ở gốc (ưu tiên); không thì pathname nằm dưới tiền tố đã cấu hình → cổng với
 * basename = tiền tố; còn lại → NLS. Khớp không phân biệt hoa thường (như basename của react-router). */
export function viTriCong(
  hostname: string,
  pathname: string,
  hostnameCongDonVi: string | undefined,
  duongDanCongDonVi: string | undefined,
): ViTriCong {
  const host = hostnameCongDonVi?.trim().toLowerCase();
  if (host && hostname.trim().toLowerCase() === host) return { cong: 'don_vi', basename: '' };
  const goc = chuanHoaDuongDan(duongDanCongDonVi);
  const duong = pathname.toLowerCase();
  if (goc && (duong === goc || duong.startsWith(`${goc}/`))) return { cong: 'don_vi', basename: goc };
  return { cong: 'nls', basename: '' };
}

export function xacDinhCong(
  hostname: string,
  pathname: string,
  hostnameCongDonVi: string | undefined,
  duongDanCongDonVi: string | undefined,
): Cong {
  return viTriCong(hostname, pathname, hostnameCongDonVi, duongDanCongDonVi).cong;
}

export function daCauHinhCongDonVi(): boolean {
  return (
    !!import.meta.env.VITE_CONG_DON_VI_HOSTNAME?.trim() ||
    !!chuanHoaDuongDan(import.meta.env.VITE_CONG_DON_VI_DUONG_DAN)
  );
}

export function viTriCongHienTai(): ViTriCong {
  return viTriCong(
    window.location.hostname,
    window.location.pathname,
    import.meta.env.VITE_CONG_DON_VI_HOSTNAME,
    import.meta.env.VITE_CONG_DON_VI_DUONG_DAN,
  );
}

export function congHienTai(): Cong {
  return viTriCongHienTai().cong;
}

/** Vai trò có được dùng cổng này không. Chưa cấu hình Cổng đơn vị (hostname lẫn đường dẫn) → không chặn ai
 * (giữ hành vi cũ). Chặn ở frontend chỉ là UX; phân quyền thật vẫn ở backend. */
export function vaiTroDungCong(vaiTro: string, cong: Cong, daCauHinh: boolean): boolean {
  if (!daCauHinh || vaiTro === 'quan_tri') return true;
  const laDonVi = VAI_TRO_DON_VI.includes(vaiTro);
  return cong === 'don_vi' ? laDonVi : !laDonVi;
}

/** URL gốc của cổng; '' khi chưa cấu hình (nơi gọi hiện chữ, không có link). Chế độ đường dẫn mà thiếu URL cấu hình
 * → suy từ origin hiện tại (2 cổng cùng origin): Cổng đơn vị = origin + tiền tố; NLS = origin (chỉ khi đang ở
 * trong cổng theo đường dẫn, vì ở chế độ hostname origin hiện tại là tên miền Cổng đơn vị). */
export function urlCong(cong: Cong): string {
  const url = (cong === 'don_vi' ? import.meta.env.VITE_CONG_DON_VI_URL : import.meta.env.VITE_SITE_URL)?.trim();
  if (url) return url;
  const goc = chuanHoaDuongDan(import.meta.env.VITE_CONG_DON_VI_DUONG_DAN);
  if (!goc) return '';
  if (cong === 'don_vi') return `${window.location.origin}${goc}`;
  return viTriCongHienTai().basename ? window.location.origin : '';
}
