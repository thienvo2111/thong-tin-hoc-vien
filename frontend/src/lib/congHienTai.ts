/** Cùng 1 bản build phục vụ 2 cổng, chọn theo hostname lúc chạy (ADR 0015 P3/T7, issue #55):
 * - 'nls': trang Bồi dưỡng năng lực số (mặc định — hostname lạ/localhost/chưa cấu hình đều vào đây).
 * - 'don_vi': Cổng đơn vị – Bồi dưỡng giáo viên HCMUE (trường, Sở, Phòng, quản trị). */
export type Cong = 'nls' | 'don_vi';

const VAI_TRO_DON_VI = ['truong', 'so_gddt', 'phong_vhxh'];

export function xacDinhCong(hostname: string, hostnameCongDonVi: string | undefined): Cong {
  const cauHinh = hostnameCongDonVi?.trim().toLowerCase();
  if (!cauHinh) return 'nls';
  return hostname.trim().toLowerCase() === cauHinh ? 'don_vi' : 'nls';
}

export function daCauHinhCongDonVi(): boolean {
  return !!import.meta.env.VITE_CONG_DON_VI_HOSTNAME?.trim();
}

export function congHienTai(): Cong {
  return xacDinhCong(window.location.hostname, import.meta.env.VITE_CONG_DON_VI_HOSTNAME);
}

/** Vai trò có được dùng cổng này không. Chưa cấu hình tên miền Cổng đơn vị → không chặn ai (giữ hành vi cũ).
 * Chặn ở frontend chỉ là UX; phân quyền thật vẫn ở backend. */
export function vaiTroDungCong(vaiTro: string, cong: Cong, daCauHinh: boolean): boolean {
  if (!daCauHinh || vaiTro === 'quan_tri') return true;
  const laDonVi = VAI_TRO_DON_VI.includes(vaiTro);
  return cong === 'don_vi' ? laDonVi : !laDonVi;
}

/** URL gốc của cổng; '' khi chưa cấu hình (nơi gọi hiện chữ, không có link). */
export function urlCong(cong: Cong): string {
  const url = cong === 'don_vi' ? import.meta.env.VITE_CONG_DON_VI_URL : import.meta.env.VITE_SITE_URL;
  return url?.trim() ?? '';
}
