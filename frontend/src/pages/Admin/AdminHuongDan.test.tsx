import { describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderVoiRouter } from '@/test/testUtils';
import { datToken } from '@/auth/tokenStore';
import { db } from '@/test/mocks/db';
import { huongDanQuanTri } from '@/content/huongDanQuanTri';
import AdminHuongDan from './AdminHuongDan';
import { AdminSidebar } from './AdminSidebar';

function renderTrang(vaiTro: string) {
  datToken('token-gia-lap');
  db.nguoiDung.vai_tro = vaiTro;
  return renderVoiRouter(
    [
      { path: '/admin/huong-dan', element: <AdminHuongDan /> },
      { path: '/admin/nhap-du-lieu', element: <div>Màn hình nhập dữ liệu</div> },
    ],
    { initialEntries: ['/admin/huong-dan'] },
  );
}

const soPhanChung = huongDanQuanTri.parts.filter((p) => p.vaiTro === 'tat_ca').length;

describe('Admin — Hướng dẫn sử dụng', () => {
  it('Quản trị: thấy quy trình vận hành và mọi phần, kể cả phần chỉ Quản trị', async () => {
    renderTrang('quan_tri');
    expect(await screen.findByLabelText('Quy trình vận hành')).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getAllByRole('heading', { level: 2 }).length).toBeGreaterThanOrEqual(huongDanQuanTri.parts.length),
    );
    expect(screen.getByRole('heading', { level: 2, name: 'Nhập dữ liệu từ Excel' })).toBeInTheDocument();
    expect(screen.getAllByText('Chỉ Quản trị').length).toBeGreaterThan(0);
  });

  it('Tài khoản trường: chỉ thấy phần dùng chung, không có quy trình và phần chỉ Quản trị', async () => {
    renderTrang('truong');
    expect(await screen.findByText(/chỉ hiện các phần dùng được với tài khoản này/)).toBeInTheDocument();
    expect(screen.queryByLabelText('Quy trình vận hành')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 2, name: 'Nhập dữ liệu từ Excel' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Báo cáo' })).toBeInTheDocument();
    expect(screen.getAllByText(/^Phần \d+$/)).toHaveLength(soPhanChung);
  });

  it('tìm không dấu lọc các phần; nút "Mở màn hình" dẫn tới đúng trang', async () => {
    const user = userEvent.setup();
    renderTrang('quan_tri');
    await screen.findByLabelText('Quy trình vận hành');
    await user.type(screen.getByLabelText('Tìm trong hướng dẫn'), 'file loi');
    await waitFor(() => expect(screen.queryByRole('heading', { level: 2, name: 'Báo cáo' })).not.toBeInTheDocument());
    const phanNhap = screen.getByRole('heading', { level: 2, name: 'Nhập dữ liệu từ Excel' }).closest('section')!;
    await user.click(within(phanNhap).getByRole('link', { name: 'Mở màn hình Nhập dữ liệu' }));
    expect(await screen.findByText('Màn hình nhập dữ liệu')).toBeInTheDocument();
  });

  it('không có kết quả tìm -> báo không tìm thấy', async () => {
    const user = userEvent.setup();
    renderTrang('quan_tri');
    await screen.findByLabelText('Quy trình vận hành');
    await user.type(screen.getByLabelText('Tìm trong hướng dẫn'), 'xyz khong co dau');
    expect(await screen.findByText('Không tìm thấy nội dung phù hợp.')).toBeInTheDocument();
  });
});

describe('Admin — menu theo vai trò và đăng xuất', () => {
  function renderMenu(vaiTro: string) {
    datToken('token-gia-lap');
    db.nguoiDung.vai_tro = vaiTro;
    return renderVoiRouter(
      [
        { path: '/admin/tong-quan', element: <AdminSidebar /> },
        { path: '/dang-nhap', element: <div>Màn hình đăng nhập</div> },
      ],
      { initialEntries: ['/admin/tong-quan'] },
    );
  }

  it('tài khoản đơn vị không thấy các mục chỉ Quản trị; ai cũng thấy Hướng dẫn', async () => {
    renderMenu('so_gddt');
    expect(await screen.findByRole('link', { name: /Hướng dẫn/ })).toBeInTheDocument();
    for (const nhan of ['Đợt xác nhận', 'Nhập dữ liệu', 'Cấu hình khảo sát', 'Yêu cầu hỗ trợ', 'Người dùng']) {
      expect(screen.queryByRole('link', { name: new RegExp(nhan) })).not.toBeInTheDocument();
    }
    expect(screen.getByRole('link', { name: /Báo cáo/ })).toBeInTheDocument();
  });

  it('Quản trị thấy đủ mục; bấm Đăng xuất -> về trang đăng nhập', async () => {
    const user = userEvent.setup();
    renderMenu('quan_tri');
    expect(await screen.findByRole('link', { name: /Nhập dữ liệu/ })).toBeInTheDocument();
    await user.click(await screen.findByRole('button', { name: 'Đăng xuất' }));
    expect(await screen.findByText('Màn hình đăng nhập')).toBeInTheDocument();
  });
});
