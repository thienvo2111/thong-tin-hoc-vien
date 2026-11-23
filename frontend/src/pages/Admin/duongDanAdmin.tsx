import { createContext, useContext, type ReactNode } from 'react';

/** Đường dẫn giữa 4 màn NLS dùng chung (Tổng quan, Học viên, Khóa, Báo cáo). boiduongnls: /admin/*;
 * Cổng đơn vị: /nls/* (issue #70 / ADR 0015 P1). Mặc định /admin — màn NLS không đổi hành vi. */
export interface DuongDanAdmin {
  tongQuan: () => string;
  hocVien: (id?: string) => string;
  khoa: (id?: string) => string;
  baoCao: () => string;
}

function taoDuongDan(goc: string, doanKhoa: string): DuongDanAdmin {
  const theoDoan = (doan: string) => (id?: string) => (id ? `${goc}/${doan}/${id}` : `${goc}/${doan}`);
  return {
    tongQuan: () => `${goc}/tong-quan`,
    hocVien: theoDoan('hoc-vien'),
    khoa: theoDoan(doanKhoa),
    baoCao: () => `${goc}/bao-cao`,
  };
}

export const DUONG_DAN_ADMIN = taoDuongDan('/admin', 'khoa-boi-duong');
export const DUONG_DAN_NLS = taoDuongDan('/nls', 'khoa');

const DuongDanAdminContext = createContext<DuongDanAdmin>(DUONG_DAN_ADMIN);

export function DuongDanAdminProvider({ value, children }: { value: DuongDanAdmin; children: ReactNode }) {
  return <DuongDanAdminContext.Provider value={value}>{children}</DuongDanAdminContext.Provider>;
}

export function useDuongDanAdmin(): DuongDanAdmin {
  return useContext(DuongDanAdminContext);
}
