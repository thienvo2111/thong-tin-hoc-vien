import { describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderTrang, renderVoiRouter } from '@/test/testUtils';
import { datToken } from '@/auth/tokenStore';
import { db } from '@/test/mocks/db';
import { BangKiemEditor } from '@/pages/Admin/BangKiemEditor';
import HoTroGvViecCanLam from './HoTroGvViecCanLam';
import { KhungBangKiem } from './KhungBangKiem';

// ADR 0004 L4 (issue #17): bảng kiểm động theo khóa.
describe('Bảng kiểm — Quản trị', () => {
  it('khóa dùng bộ mặc định: chỉ xem, có nút "Tùy chỉnh cho khóa"; bấm → thành bảng kiểm riêng, sửa được', async () => {
    datToken('token-gia-lap');
    const user = userEvent.setup();
    renderTrang(<BangKiemEditor khoaId="khoa-1" />);
    expect(await screen.findByText('Đang dùng bộ mặc định')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '+ Thêm mục' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Tùy chỉnh cho khóa' }));
    expect(await screen.findByText('Bảng kiểm riêng của khóa')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '+ Thêm mục' })).toBeInTheDocument();
  });

  it('bộ mặc định: thêm mục tự động phải chọn quy tắc mới bật nút', async () => {
    datToken('token-gia-lap');
    const user = userEvent.setup();
    renderTrang(<BangKiemEditor khoaId={null} />);
    expect(await screen.findByText('Mọi buổi đã có điểm học')).toBeInTheDocument();
    expect(screen.getByText(/Tự động · Mọi buổi có điểm học/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '+ Thêm mục' }));
    const modal = await screen.findByRole('dialog');
    await user.type(within(modal).getByLabelText(/^Tên mục/), 'Đã chuẩn bị máy chiếu');
    await user.click(within(modal).getByText('Tự động'));
    const nut = within(modal).getByRole('button', { name: 'Thêm mục' });
    expect(nut).toBeDisabled();
    await user.click(within(modal).getByRole('textbox', { name: /Quy tắc tự động/ }));
    await user.click(await screen.findByRole('option', { name: 'Mọi buổi có ≥ 1 giảng viên' }));
    expect(nut).toBeEnabled();
    await user.click(nut);
    await waitFor(() => expect(db.bangKiemMacDinh.muc.some((m) => m.ten === 'Đã chuẩn bị máy chiếu' && m.ma_quy_tac === 'co_giang_vien')).toBe(true));
  });
});

describe('Bảng kiểm — người hỗ trợ GV', () => {
  it('màu đợt + mục tự động có lý do; đánh dấu mục thủ công → đạt', async () => {
    datToken('token-gia-lap');
    db.nguoiDung.vai_tro = 'ho_tro_giang_vien';
    const user = userEvent.setup();
    renderTrang(<KhungBangKiem lopId="lop-1" gdId="gd-2" />);
    expect(await screen.findByTestId('mau-dot')).toHaveTextContent('Có mục quá hạn');
    expect(screen.getByText('Buổi 1 chưa có giảng viên')).toBeInTheDocument();
    expect(screen.getByText('Quá hạn')).toBeInTheDocument();
    await user.click(screen.getByLabelText('Đã gửi danh sách điểm danh'));
    await waitFor(() => expect(db.danhGiaDot.muc[1].trang_thai).toBe('dat'));
  });

  it('Việc cần làm: đợt có link Hồ sơ chuẩn bị, màu đỏ, liệt kê mục chưa đạt', async () => {
    datToken('token-gia-lap');
    db.nguoiDung.vai_tro = 'ho_tro_giang_vien';
    renderVoiRouter([{ path: '/ho-tro-gv', element: <HoTroGvViecCanLam /> }], { initialEntries: ['/ho-tro-gv'] });
    const link = await screen.findByRole('link', { name: /Lớp 01 – Nhóm cơ bản A · GĐ 2/ });
    expect(link).toHaveAttribute('href', '/ho-tro-gv/lop/lop-1/giai-doan/gd-2');
    expect(screen.getByText('Có mục quá hạn')).toBeInTheDocument();
    expect(screen.getByText(/Mọi buổi đã phân công giảng viên/)).toBeInTheDocument();
  });
});
