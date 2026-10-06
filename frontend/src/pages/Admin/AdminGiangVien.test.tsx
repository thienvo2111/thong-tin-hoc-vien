import { describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { db } from '@/test/mocks/db';
import { renderTrang } from '@/test/testUtils';
import { datToken } from '@/auth/tokenStore';
import AdminGiangVien from './AdminGiangVien';

function render() {
  datToken('token-gia-lap');
  return renderTrang(<AdminGiangVien />);
}

// T11 (issue #3): danh mục giảng viên + lịch dạy + xác nhận giờ.
describe('Admin — Giảng viên', () => {
  it('hiện danh sách: họ tên, SĐT, email (hoặc "Chưa có email"), số buổi', async () => {
    render();
    expect(await screen.findByText('Nguyễn Văn Long')).toBeInTheDocument();
    const bang = screen.getByRole('table');
    expect(within(bang).getByText('0909123456')).toBeInTheDocument();
    expect(within(bang).getByText('long@hcmue.edu.vn')).toBeInTheDocument();
    expect(within(bang).getByText('Chưa có email')).toBeInTheDocument();
  });

  it('thêm giảng viên trùng SĐT → lỗi hiện ở ô SĐT; SĐT mới → thêm được', async () => {
    const user = userEvent.setup();
    render();
    await screen.findByText('Nguyễn Văn Long');
    await user.click(screen.getByRole('button', { name: '+ Thêm giảng viên' }));
    await user.type(await screen.findByLabelText(/^Họ tên/), 'Lê Văn Mới');
    await user.type(screen.getByLabelText(/^Số điện thoại/), '0909123456');
    await user.click(screen.getByRole('button', { name: 'Thêm giảng viên' }));
    expect(await screen.findByText('Đã tồn tại')).toBeInTheDocument();

    const oSdt = screen.getByLabelText(/^Số điện thoại/);
    await user.clear(oSdt);
    await user.type(oSdt, '0909777777');
    await user.click(screen.getByRole('button', { name: 'Thêm giảng viên' }));
    await waitFor(() => expect(db.giangVien.some((g) => g.ho_ten === 'Lê Văn Mới')).toBe(true));
  });

  it('lịch dạy: hiện buổi được phân công; bấm Xác nhận → chốt giờ', async () => {
    const user = userEvent.setup();
    render();
    await screen.findByText('Nguyễn Văn Long');
    const dong = screen.getByText('Nguyễn Văn Long').closest('tr') as HTMLElement;
    await user.click(within(dong).getByRole('button', { name: 'Lịch dạy' }));
    const modal = await screen.findByRole('dialog');
    expect(await within(modal).findByText('Lớp 01 – Nhóm cơ bản A')).toBeInTheDocument();
    expect(within(modal).getByLabelText('Số giờ')).toHaveValue('4');
    await user.click(within(modal).getByRole('button', { name: 'Xác nhận' }));
    await waitFor(() => expect(db.lichDay['gv-1'].phan_cong[0].da_xac_nhan_gio).toBe(true));
  });

  it('Ngưng → PATCH trang_thai=ngung', async () => {
    const user = userEvent.setup();
    render();
    await screen.findByText('Nguyễn Văn Long');
    const dong = screen.getByText('Nguyễn Văn Long').closest('tr') as HTMLElement;
    await user.click(within(dong).getByRole('button', { name: 'Ngưng' }));
    await waitFor(() => expect(db.giangVien[0].trang_thai).toBe('ngung'));
  });
});
