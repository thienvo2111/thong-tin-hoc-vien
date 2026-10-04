import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { MucNhatKy } from '@/api/types';
import { renderVoiRouter } from '@/test/testUtils';
import { DongThoiGianNhatKy } from './DongThoiGianNhatKy';

function muc(id: string, ghiDe: Partial<MucNhatKy> = {}): MucNhatKy {
  return {
    id,
    thoi_gian: '2026-10-02T03:00:00.000Z',
    nhom: 'tai_khoan',
    tieu_de: `Mục ${id}`,
    noi_dung: null,
    truong: null,
    nguoi_thuc_hien: null,
    ip: null,
    thiet_bi: null,
    ...ghiDe,
  };
}

function render(ds: MucNhatKy[]) {
  return renderVoiRouter([{ path: '/', element: <DongThoiGianNhatKy muc={ds} /> }]);
}

describe('DongThoiGianNhatKy', () => {
  it('rỗng -> báo chưa có hoạt động', async () => {
    render([]);
    expect(await screen.findByText('Chưa có hoạt động nào được ghi nhận.')).toBeInTheDocument();
  });

  it('hiện giờ VN, người thực hiện, nhãn trường hồ sơ, IP + thiết bị', async () => {
    render([
      muc('a', {
        nhom: 'ho_so',
        tieu_de: 'Sửa hồ sơ',
        truong: 'so_dien_thoai_lien_he',
        noi_dung: '0911 → 0912',
        nguoi_thuc_hien: 'Nguyễn A (học viên)',
        ip: '113.161.1.1',
        thiet_bi: 'Zalo',
      }),
    ]);
    expect(await screen.findByText('Sửa hồ sơ')).toBeInTheDocument();
    expect(screen.getByText('02/10/2026 10:00 · Nguyễn A (học viên)')).toBeInTheDocument();
    expect(screen.getByText(/0911 → 0912/).textContent).not.toContain('so_dien_thoai_lien_he');
    expect(screen.getByText('IP 113.161.1.1 · Zalo')).toBeInTheDocument();
  });

  it('lọc theo nhóm -> chỉ còn mục của nhóm đó', async () => {
    const user = userEvent.setup();
    render([muc('dn', { tieu_de: 'Đăng nhập thành công' }), muc('pl', { nhom: 'hoc_tap', tieu_de: 'Phân lớp' })]);
    await user.click(await screen.findByRole('textbox', { name: 'Lọc theo nhóm' }));
    await user.click(await screen.findByRole('option', { name: 'Kết quả & phân lớp' }));
    expect(screen.getByText('Phân lớp')).toBeInTheDocument();
    expect(screen.queryByText('Đăng nhập thành công')).not.toBeInTheDocument();
  });

  it('nhiều hơn 50 mục -> hiện 50, bấm "Xem thêm" để hiện tiếp', async () => {
    const user = userEvent.setup();
    render(Array.from({ length: 60 }, (_, i) => muc(String(i))));
    expect(await screen.findByText('Mục 49')).toBeInTheDocument();
    expect(screen.queryByText('Mục 50')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Xem thêm (10 mục)' }));
    expect(screen.getByText('Mục 59')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Xem thêm/ })).not.toBeInTheDocument();
  });
});
