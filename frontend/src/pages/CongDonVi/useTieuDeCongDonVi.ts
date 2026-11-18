import { useEffect } from 'react';
import { congDonVi } from '@/content/congDonVi';

/** Tiêu đề tab trình duyệt của Cổng đơn vị (khi dev chạy qua index.html, tiêu đề tĩnh vẫn là của trang NLS). */
export function useTieuDeCongDonVi() {
  useEffect(() => {
    document.title = congDonVi.tenCong;
  }, []);
}
