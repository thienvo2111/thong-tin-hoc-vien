import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { dangNhap as apiDangNhap, dangXuat as apiDangXuat, layThongTinToi } from '@/api/auth';
import type { NguoiDung } from '@/api/types';
import { datToken, layToken, xoaToken } from './tokenStore';
import { baoPhienHetHan, theoDoiPhienHetHan } from './session';

// Cố ý KHÔNG import @tanstack/react-query ở đây: AuthProvider bọc toàn bộ ứng dụng kể cả M0 (trang công khai),
// còn TanStack Query chỉ được nạp cho các route sau M0 (xem src/app/KhungNoiBo.tsx) để giữ chunk M0 nhẹ
// (dac-ta-cong-hoc-vien.md § M0 "Yêu cầu kỹ thuật": không tải TanStack Query cho M0).

interface AuthContextValue {
  dangTai: boolean;
  daXacThuc: boolean;
  nguoiDung: NguoiDung | null;
  phaiDoiMatKhau: boolean;
  /** Mật khẩu vừa dùng để đăng nhập — chỉ giữ trong bộ nhớ, dùng để tự điền ô "mật khẩu hiện tại" ở M2. */
  matKhauVuaDung: string | null;
  dangNhap: (tenDangNhap: string, matKhau: string) => Promise<{ phaiDoiMatKhau: boolean }>;
  dangXuat: () => Promise<void>;
  xacNhanDaDoiMatKhau: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [dangTai, setDangTai] = useState(true);
  const [nguoiDung, setNguoiDung] = useState<NguoiDung | null>(null);
  const [phaiDoiMatKhau, setPhaiDoiMatKhau] = useState(false);
  const [matKhauVuaDung, setMatKhauVuaDung] = useState<string | null>(null);

  const donDep = useCallback(() => {
    xoaToken();
    setNguoiDung(null);
    setPhaiDoiMatKhau(false);
    setMatKhauVuaDung(null);
  }, []);

  useEffect(() => {
    let daHuy = false;
    async function khoiPhuc() {
      if (!layToken()) {
        setDangTai(false);
        return;
      }
      try {
        const tt = await layThongTinToi();
        if (daHuy) return;
        setNguoiDung(tt.nguoi_dung);
        setPhaiDoiMatKhau(tt.phai_doi_mat_khau);
      } catch {
        donDep();
      } finally {
        if (!daHuy) setDangTai(false);
      }
    }
    khoiPhuc();
    return () => {
      daHuy = true;
    };
  }, [donDep]);

  useEffect(() => theoDoiPhienHetHan(donDep), [donDep]);

  const dangNhap = useCallback(async (tenDangNhap: string, matKhau: string) => {
    const res = await apiDangNhap(tenDangNhap, matKhau);
    datToken(res.token);
    setNguoiDung(res.nguoi_dung);
    setPhaiDoiMatKhau(res.phai_doi_mat_khau);
    setMatKhauVuaDung(matKhau);
    return { phaiDoiMatKhau: res.phai_doi_mat_khau };
  }, []);

  const dangXuat = useCallback(async () => {
    try {
      await apiDangXuat();
    } finally {
      // Phát qua bus chung (không gọi donDep() trực tiếp) để các phần khác của ứng dụng có TanStack Query
      // (vd. bộ nhớ đệm hồ sơ) cũng dọn dẹp — xem src/app/LamMoiCacheKhiHetPhien.tsx.
      baoPhienHetHan();
    }
  }, []);

  const xacNhanDaDoiMatKhau = useCallback(() => {
    setPhaiDoiMatKhau(false);
    setMatKhauVuaDung(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      dangTai,
      daXacThuc: !!nguoiDung,
      nguoiDung,
      phaiDoiMatKhau,
      matKhauVuaDung,
      dangNhap,
      dangXuat,
      xacNhanDaDoiMatKhau,
    }),
    [dangTai, nguoiDung, phaiDoiMatKhau, matKhauVuaDung, dangNhap, dangXuat, xacNhanDaDoiMatKhau],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useToi(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useToi() phải dùng trong AuthProvider');
  return ctx;
}
