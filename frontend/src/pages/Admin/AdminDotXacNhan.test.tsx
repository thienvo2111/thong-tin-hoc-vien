import { describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { server } from '@/test/mocks/server';
import { loi } from '@/test/mocks/handlers';
import { db } from '@/test/mocks/db';
import { renderVoiRouter } from '@/test/testUtils';
import { datToken } from '@/auth/tokenStore';
import AdminDotXacNhan from './AdminDotXacNhan';

function renderTrang() {
  datToken('token-gia-lap');
  return renderVoiRouter([{ path: '/admin/dot-xac-nhan', element: <AdminDotXacNhan /> }], {
    initialEntries: ['/admin/dot-xac-nhan'],
  });
}

const NGAY = 24 * 60 * 60 * 1000;

function isoLech(ngay: number, moc: number = Date.now()): string {
  return new Date(moc + ngay * NGAY).toISOString();
}

describe('Admin — Đợt xác nhận', () => {
  it('hiện danh sách + trạng thái đúng (chưa mở/đang mở/đã đóng) theo mo_luc/dong_luc', async () => {
    // Ghi thẳng vào db mock (không chỉ override response GET) để nếu sau này thao tác PATCH/POST trên
    // cùng bản ghi thì handler vẫn tìm thấy (handlers.ts đọc/ghi trên db.danhSachDotXacNhan thật).
    db.danhSachDotXacNhan = [
      {
        id: 'dot-dang-mo',
        khoa_id: null,
        ten: 'Đợt đang mở',
        loai: 'kiem_tra_bo_sung',
        mo_luc: isoLech(-1),
        dong_luc: isoLech(1),
        created_by: 'nd-1',
        created_at: isoLech(-2),
      },
      {
        id: 'dot-chua-mo',
        khoa_id: 'khoa-1',
        ten: 'Đợt sắp mở',
        loai: 'xac_nhan_truoc_danh_gia',
        mo_luc: isoLech(1),
        dong_luc: isoLech(2),
        created_by: 'nd-1',
        created_at: isoLech(-2),
      },
      {
        id: 'dot-da-dong',
        khoa_id: null,
        ten: 'Đợt đã đóng',
        loai: 'kiem_tra_bo_sung',
        mo_luc: isoLech(-3),
        dong_luc: isoLech(-1),
        created_by: 'nd-1',
        created_at: isoLech(-4),
      },
    ];

    renderTrang();

    const bang = await screen.findByRole('table');
    expect(within(bang).getByText('Đang mở')).toBeInTheDocument();
    expect(within(bang).getByText('Chưa mở')).toBeInTheDocument();
    expect(within(bang).getByText('Đã đóng')).toBeInTheDocument();
    // Phạm vi: khoa_id null → "Tất cả học viên"; khoa_id cụ thể → tên khóa tương ứng (map id -> ten_khoa).
    expect(within(bang).getByText('Bồi dưỡng NLS – Mức cơ bản')).toBeInTheDocument();
    expect(within(bang).getAllByText('Tất cả học viên')).toHaveLength(2);
  });

  it('trống: hiện thông báo "Chưa có đợt xác nhận nào" thay vì bảng rỗng im lặng', async () => {
    db.danhSachDotXacNhan = [];
    renderTrang();
    expect(await screen.findByText('Chưa có đợt xác nhận nào.')).toBeInTheDocument();
  });

  it('tạo đợt mới hợp lệ (không trùng giờ) → gọi API thành công, hiện thông báo, danh sách tự làm mới', async () => {
    // Nhiều bước gõ + 2 lần chọn Select liên tiếp — chậm hơn mức timeout mặc định (5s) khi chạy chung
    // cả suite, nới thời gian để không flaky (không phải lỗi thật, chỉ là thao tác dài).
    const user = userEvent.setup();
    renderTrang();
    await screen.findByText('Kiểm tra hồ sơ đợt 1');

    await user.click(screen.getByRole('button', { name: '+ Tạo đợt mới' }));
    await user.type(await screen.findByLabelText(/^Tên đợt/), 'Đợt kiểm tra bổ sung mới');

    await user.click(screen.getByRole('textbox', { name: /^Loại đợt/ }));
    await user.click(await screen.findByRole('option', { name: 'Kiểm tra/bổ sung hồ sơ' }));

    // Chọn 1 khóa cụ thể (khác phạm vi null của dot-1/dot-2 mẫu) để chắc chắn không trùng thời gian.
    await user.click(screen.getByRole('textbox', { name: /^Khóa bồi dưỡng/ }));
    await user.click(await screen.findByRole('option', { name: 'Bồi dưỡng NLS – Mức cơ bản' }));

    await user.type(screen.getByLabelText(/^Mở lúc/), '2027-01-01T08:00');
    await user.type(screen.getByLabelText(/^Đóng lúc/), '2027-01-02T08:00');

    await user.click(screen.getByRole('button', { name: 'Tạo đợt' }));

    expect(await screen.findByText('Đã tạo đợt xác nhận "Đợt kiểm tra bổ sung mới"')).toBeInTheDocument();
    expect(await screen.findByText('Đợt kiểm tra bổ sung mới')).toBeInTheDocument();
  }, 15000);

  it('tạo đợt trùng thời gian → hiện đúng thông báo lỗi trùng giờ từ API (không phải thông báo trùng CCCD)', async () => {
    server.use(
      http.post('/dot-xac-nhan', () =>
        loi(409, 'CONFLICT', 'Đợt xác nhận chồng thời gian với đợt khác trong cùng phạm vi (khoa_id)'),
      ),
    );
    const user = userEvent.setup();
    renderTrang();
    await screen.findByText('Kiểm tra hồ sơ đợt 1');

    await user.click(screen.getByRole('button', { name: '+ Tạo đợt mới' }));
    await user.type(await screen.findByLabelText(/^Tên đợt/), 'Đợt trùng giờ');
    await user.click(screen.getByRole('textbox', { name: /^Loại đợt/ }));
    await user.click(await screen.findByRole('option', { name: 'Xác nhận trước đánh giá' }));
    await user.type(screen.getByLabelText(/^Mở lúc/), '2027-02-01T08:00');
    await user.type(screen.getByLabelText(/^Đóng lúc/), '2027-02-02T08:00');
    await user.click(screen.getByRole('button', { name: 'Tạo đợt' }));

    expect(
      await screen.findByText('Đợt xác nhận chồng thời gian với đợt khác trong cùng phạm vi (khoa_id)'),
    ).toBeInTheDocument();
    expect(
      screen.queryByText('Số CCCD này đã được dùng cho một hồ sơ khác. Liên hệ hỗ trợ.'),
    ).not.toBeInTheDocument();
  });

  it('gia hạn 1 đợt đang mở thành công', async () => {
    db.danhSachDotXacNhan = [
      {
        id: 'dot-gia-han',
        khoa_id: null,
        ten: 'Đợt cần gia hạn',
        loai: 'kiem_tra_bo_sung',
        mo_luc: isoLech(-1),
        dong_luc: isoLech(1),
        created_by: 'nd-1',
        created_at: isoLech(-2),
      },
    ];

    const user = userEvent.setup();
    renderTrang();
    await screen.findByText('Đợt cần gia hạn');

    await user.click(screen.getByRole('button', { name: 'Gia hạn' }));
    await user.type(await screen.findByLabelText(/^Đóng lúc \(mới\)/), '2027-03-01T08:00');
    await user.click(screen.getByRole('button', { name: 'Xác nhận gia hạn' }));

    expect(await screen.findByText('Đã gia hạn đợt xác nhận "Đợt cần gia hạn"')).toBeInTheDocument();
  });
});
