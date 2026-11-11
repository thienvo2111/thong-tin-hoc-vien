import { apiFetch } from './client';
import type { SsoTarget } from './hocVien';

// POST /sso/ma-thu (quan_tri) — mã THỬ để tích hợp với hệ thống khảo sát (api-contract.md mục 10).
export interface MaThuSso {
  url: string;
  code: string;
  het_han: string;
  hoc_vien: { id: string; ho_ten: string; ma_dinh_danh_moet: string | null; doi_tuong: string | null };
}

export function taoMaThuSso(maDinhDanhMoet: string, target?: SsoTarget) {
  return apiFetch<MaThuSso>('/sso/ma-thu', {
    method: 'POST',
    body: JSON.stringify(target ? { ma_dinh_danh_moet: maDinhDanhMoet, target } : { ma_dinh_danh_moet: maDinhDanhMoet }),
  });
}

// Vào học VLE (external-login P.CNTT, 2026-11-10, api-contract.md mục 10.2). Thông báo chính xác khi
// chức năng chưa được cấu hình — dùng để ẨN HẲN nút (khác "chưa có tài khoản" chỉ disable + hiện lý do).
export const VLE_CHUA_CAU_HINH_LY_DO = 'Chức năng vào học VLE chưa được cấu hình.';

export interface TrangThaiVle {
  san_sang: boolean;
  ly_do?: string;
  co_khoa_hoc: boolean;
}

export interface FormVle {
  action: string;
  fields: {
    key: string;
    email: string;
    username: string;
    id_course?: string;
  };
}

export function layTrangThaiVle() {
  return apiFetch<TrangThaiVle>('/sso/vle/trang-thai');
}

// POST ngay khi học viên bấm nút (không gọi sẵn khi tải trang) — field "key" buộc phải tới trình
// duyệt (rủi ro đã được chủ sản phẩm chấp nhận, xem api-contract.md mục 10.2).
export function layFormVle() {
  return apiFetch<FormVle>('/sso/vle/form', { method: 'POST' });
}
