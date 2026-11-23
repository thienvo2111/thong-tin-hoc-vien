/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
  readonly VITE_SITE_URL: string;
  /** Issue #55: hostname của Cổng đơn vị (vd. donvi.hcmue.edu.vn); trống = chỉ có trang NLS như cũ. */
  readonly VITE_CONG_DON_VI_HOSTNAME?: string;
  /** URL gốc Cổng đơn vị, dùng cho link "sang cổng đúng" và og:url của cong-don-vi.html. */
  readonly VITE_CONG_DON_VI_URL?: string;
  /** Tạm khi chưa có tên miền riêng (ADR 0015 T7): tiền tố đường dẫn của Cổng đơn vị trên origin NLS, vd. /cdv;
   * trống = tắt. Hostname khớp VITE_CONG_DON_VI_HOSTNAME được ưu tiên. */
  readonly VITE_CONG_DON_VI_DUONG_DAN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
