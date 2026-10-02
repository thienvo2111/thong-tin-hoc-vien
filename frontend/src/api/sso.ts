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
