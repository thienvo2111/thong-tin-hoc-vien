import { createBrowserRouter, Navigate } from 'react-router-dom';

// Mọi route dùng `lazy` (kể cả các layout thuần túy) — router.tsx được main.tsx import không-lazy,
// nên bất kỳ import tĩnh nào ở đây sẽ vào chunk tải đầu tiên. M0 phải nhẹ (không Mantine form/dates/
// TanStack Query) nên toàn bộ phần còn lại của cây route chỉ được nạp qua `lazy`.
export const router = createBrowserRouter([
  {
    path: '/',
    lazy: () => import('@/pages/M0/TrangGioiThieu').then((m) => ({ Component: m.default })),
  },
  {
    lazy: () => import('@/app/KhungNoiBo').then((m) => ({ Component: m.default })),
    children: [
      {
        path: '/dang-nhap',
        lazy: () => import('@/pages/M1/DangNhap').then((m) => ({ Component: m.default })),
      },
      {
        // 2026-09-30: quên/đặt lại mật khẩu — công khai, cùng nhánh với /dang-nhap (ngoài RequireAuth).
        path: '/quen-mat-khau',
        lazy: () => import('@/pages/M1/QuenMatKhau').then((m) => ({ Component: m.default })),
      },
      {
        path: '/dat-lai-mat-khau',
        lazy: () => import('@/pages/M1/DatLaiMatKhau').then((m) => ({ Component: m.default })),
      },
      {
        path: '/xac-minh-email',
        lazy: () => import('@/pages/M1/XacMinhEmail').then((m) => ({ Component: m.default })),
      },
      {
        lazy: () => import('@/auth/RequireAuth').then((m) => ({ Component: m.RequireAuth })),
        children: [
          {
            path: '/doi-mat-khau',
            lazy: () => import('@/pages/M2/DoiMatKhau').then((m) => ({ Component: m.default })),
          },
          {
            lazy: () => import('@/components/ProtectedLayout').then((m) => ({ Component: m.ProtectedLayout })),
            children: [
              {
                path: '/toi',
                lazy: () => import('@/pages/M3/TrangChinh').then((m) => ({ Component: m.default })),
              },
              {
                path: '/toi/ho-so',
                lazy: () => import('@/pages/M4/HoSo').then((m) => ({ Component: m.default })),
              },
              {
                path: '/toi/lop-hoc',
                lazy: () => import('@/pages/M7/ThongTinLopHoc').then((m) => ({ Component: m.default })),
              },
              {
                path: '/toi/xac-nhan',
                lazy: () => import('@/pages/M5/XacNhan').then((m) => ({ Component: m.default })),
              },
              {
                path: '/toi/danh-gia-dau-vao',
                lazy: () => import('@/pages/M6/DanhGiaDauVao').then((m) => ({ Component: m.default })),
              },
              {
                path: '/toi/yeu-cau-ho-tro',
                lazy: () => import('@/pages/M8/YeuCauHoTro').then((m) => ({ Component: m.default })),
              },
            ],
          },
          {
            // Module admin — mới hoàn toàn (design/redesign-spec.md § 4). Đặt song song với
            // ProtectedLayout (route học viên) trong cùng nhánh RequireAuth, không đụng route cũ.
            lazy: () => import('@/auth/RequireAdmin').then((m) => ({ Component: m.RequireAdmin })),
            children: [
              {
                lazy: () => import('@/pages/Admin/AdminLayout').then((m) => ({ Component: m.default })),
                children: [
                  { path: '/admin', element: <Navigate to="/admin/tong-quan" replace /> },
                  {
                    path: '/admin/tong-quan',
                    lazy: () => import('@/pages/Admin/AdminTongQuan').then((m) => ({ Component: m.default })),
                  },
                  {
                    path: '/admin/hoc-vien',
                    lazy: () => import('@/pages/Admin/AdminDanhSach').then((m) => ({ Component: m.default })),
                  },
                  {
                    path: '/admin/hoc-vien/:id',
                    lazy: () => import('@/pages/Admin/AdminHocVienChiTiet').then((m) => ({ Component: m.default })),
                  },
                  {
                    path: '/admin/khoa-boi-duong',
                    lazy: () => import('@/pages/Admin/AdminKhoaBoiDuong').then((m) => ({ Component: m.default })),
                  },
                  {
                    path: '/admin/khoa-boi-duong/:id',
                    lazy: () => import('@/pages/Admin/AdminKhoaChiTiet').then((m) => ({ Component: m.default })),
                  },
                  {
                    path: '/admin/dot-xac-nhan',
                    lazy: () => import('@/pages/Admin/AdminDotXacNhan').then((m) => ({ Component: m.default })),
                  },
                  {
                    path: '/admin/bao-cao',
                    lazy: () => import('@/pages/Admin/AdminBaoCao').then((m) => ({ Component: m.default })),
                  },
                  {
                    path: '/admin/nhap-du-lieu',
                    lazy: () => import('@/pages/Admin/AdminNhapDuLieu').then((m) => ({ Component: m.default })),
                  },
                  {
                    path: '/admin/cau-hinh-khao-sat',
                    lazy: () => import('@/pages/Admin/AdminCauHinhKhaoSat').then((m) => ({ Component: m.default })),
                  },
                  {
                    path: '/admin/yeu-cau-ho-tro',
                    lazy: () => import('@/pages/Admin/AdminYeuCauHoTro').then((m) => ({ Component: m.default })),
                  },
                  {
                    path: '/admin/danh-muc-truong',
                    lazy: () => import('@/pages/Admin/AdminDanhMucTruong').then((m) => ({ Component: m.default })),
                  },
                  {
                    path: '/admin/nguoi-dung',
                    lazy: () => import('@/pages/Admin/AdminNguoiDung').then((m) => ({ Component: m.default })),
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        path: '*',
        lazy: () => import('@/pages/KhongTimThay').then((m) => ({ Component: m.default })),
      },
    ],
  },
]);
