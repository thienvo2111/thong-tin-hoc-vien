import { describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderVoiRouter } from '@/test/testUtils';
import { datToken } from '@/auth/tokenStore';
import { db } from '@/test/mocks/db';
import { RequireAdmin } from '@/auth/RequireAdmin';
import { RequireHoTroGv } from '@/auth/RequireHoTroGv';
import { trangChuTheoVaiTro } from '@/lib/trangChuTheoVaiTro';
import AdminNguoiHoTro from '@/pages/Admin/AdminNguoiHoTro';
import HoTroGvLayout from './HoTroGvLayout';
import HoTroGvLop from './HoTroGvLop';

// ADR 0004 L1 (issue #14): khu /ho-tro-gv chỉ cho người hỗ trợ giảng viên.
function render(initialEntries: string[]) {
  datToken('token-gia-lap');
  return renderVoiRouter(
    [
      {
        element: <RequireAdmin />,
        children: [
          { path: '/admin/tong-quan', element: <div>Màn hình tổng quan</div> },
          { path: '/admin/nguoi-ho-tro', element: <AdminNguoiHoTro /> },
        ],
      },
      {
        element: <RequireHoTroGv />,
        children: [{ element: <HoTroGvLayout />, children: [{ path: '/ho-tro-gv', element: <HoTroGvLop /> }] }],
      },
      { path: '/ho-tro', element: <div>Khu hỗ trợ học viên</div> },
    ],
    { initialEntries },
  );
}

describe('Khu người hỗ trợ giảng viên', () => {
  it('trang chủ sau đăng nhập của ho_tro_giang_vien là /ho-tro-gv', () => {
    expect(trangChuTheoVaiTro('ho_tro_giang_vien')).toBe('/ho-tro-gv');
  });

  it('ho_tro_giang_vien vào /ho-tro-gv → thấy lớp được phân công', async () => {
    db.nguoiDung.vai_tro = 'ho_tro_giang_vien';
    render(['/ho-tro-gv']);
    expect(await screen.findByText('Lớp 01 – Nhóm cơ bản A')).toBeInTheDocument();
    expect(screen.getByText('AG-2026-014')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Đăng xuất' })).toBeInTheDocument();
  });

  it('chưa được phân công → nhắc liên hệ Quản trị', async () => {
    db.nguoiDung.vai_tro = 'ho_tro_giang_vien';
    db.lopCuaToiGv = [];
    render(['/ho-tro-gv']);
    expect(await screen.findByText(/chưa được phân công/)).toBeInTheDocument();
  });

  it('ho_tro_giang_vien vào /admin/* → về /ho-tro-gv; ho_tro_hoc_vien vào /ho-tro-gv → về /ho-tro', async () => {
    db.nguoiDung.vai_tro = 'ho_tro_giang_vien';
    const { unmount } = render(['/admin/tong-quan']);
    expect(await screen.findByText('Lớp được phân công')).toBeInTheDocument();
    expect(screen.queryByText('Màn hình tổng quan')).not.toBeInTheDocument();
    unmount();
    db.nguoiDung.vai_tro = 'ho_tro_hoc_vien';
    render(['/ho-tro-gv']);
    expect(await screen.findByText('Khu hỗ trợ học viên')).toBeInTheDocument();
  });
});

describe('Admin — Người hỗ trợ: 2 loại', () => {
  it('mặc định hiện người hỗ trợ học viên; chuyển "Hỗ trợ giảng viên" → hiện đúng loại, cột "Khóa phụ trách"', async () => {
    db.nguoiDung.vai_tro = 'quan_tri';
    const user = userEvent.setup();
    render(['/admin/nguoi-ho-tro']);
    expect(await screen.findByText('Nguyễn Văn A')).toBeInTheDocument();
    expect(screen.queryByText('Phạm Văn Giảng')).not.toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: 'Hỗ trợ giảng viên' }));
    expect(await screen.findByText('Phạm Văn Giảng')).toBeInTheDocument();
    expect(screen.getByText('Khóa phụ trách')).toBeInTheDocument();
    expect(screen.queryByText('Nguyễn Văn A')).not.toBeInTheDocument();
  });

  it('tạo tài khoản khi đang ở loại "Hỗ trợ giảng viên" → gửi vai_tro=ho_tro_giang_vien', async () => {
    db.nguoiDung.vai_tro = 'quan_tri';
    const user = userEvent.setup();
    render(['/admin/nguoi-ho-tro']);
    await screen.findByText('Nguyễn Văn A');
    await user.click(screen.getByRole('radio', { name: 'Hỗ trợ giảng viên' }));
    await screen.findByText('Phạm Văn Giảng');
    await user.click(screen.getByRole('button', { name: /Tạo tài khoản|Thêm/ }));
    const modal = await screen.findByRole('dialog');
    await user.type(within(modal).getByLabelText(/^Họ tên/), 'Phạm D');
    await user.type(within(modal).getByLabelText(/^Email/), 'pham.d@hcmue.edu.vn');
    await user.click(within(modal).getByRole('button', { name: 'Tạo tài khoản' }));
    await waitFor(() =>
      expect(db.taiKhoanHoTro.find((t) => t.email === 'pham.d@hcmue.edu.vn')?.vai_tro).toBe('ho_tro_giang_vien'),
    );
  });
});
