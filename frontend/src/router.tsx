import { createBrowserRouter } from 'react-router-dom';

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
                path: '/toi/xac-nhan',
                lazy: () => import('@/pages/M5/XacNhan').then((m) => ({ Component: m.default })),
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
