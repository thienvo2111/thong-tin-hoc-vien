import { beforeEach, describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/mocks/server';
import { renderVoiRouter } from '@/test/testUtils';
import { datToken } from '@/auth/tokenStore';
import { db } from '@/test/mocks/db';
import { bangDiemDanhMock, datLaiDiemDanhMock } from '@/test/mocks/diemDanh';
import HoTroGvDotLop from './HoTroGvDotLop';

// ADR 0005 Z7 (issue #26): hỗ trợ GV sửa nhanh điểm danh trên trang lớp.
function render() {
  datToken('token-gia-lap');
  db.nguoiDung.vai_tro = 'ho_tro_giang_vien';
  return renderVoiRouter([{ path: '/ho-tro-gv/lop/:lopId', element: <HoTroGvDotLop /> }], {
    initialEntries: ['/ho-tro-gv/lop/lop-1'],
  });
}

describe('Hỗ trợ GV — bảng điểm danh lớp', () => {
  beforeEach(() => datLaiDiemDanhMock());

  it('hiện ô theo học viên × buổi, dấu nguồn Zoom (giờ VN) và báo vắng; ô quá 3 ngày / chưa diễn ra bị khóa', async () => {
    render();
    expect(await screen.findByRole('heading', { name: 'Điểm danh' })).toBeInTheDocument();
    expect(await screen.findByText('Zoom 07:12')).toBeInTheDocument();
    expect(screen.getByText('Báo vắng')).toBeInTheDocument();
    expect(screen.getByLabelText('Trần Thị Học buổi 2: Quá 3 ngày — liên hệ Quản trị')).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByLabelText('Lê Văn Vắng buổi 3: Buổi học chưa diễn ra')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Sửa điểm danh Trần Thị Học buổi 2' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sửa điểm danh Trần Thị Học buổi 1' })).toBeInTheDocument();
  });

  it('sửa ô có báo vắng: mặc định "Vắng có phép", lưu kèm ghi chú → thông báo + ô hiện "sửa tay"', async () => {
    const user = userEvent.setup();
    render();
    await user.click(await screen.findByRole('button', { name: 'Sửa điểm danh Lê Văn Vắng buổi 1' }));
    expect(await screen.findByRole('radio', { name: 'Vắng có phép' })).toBeChecked();
    await user.type(screen.getByLabelText('Ghi chú (tùy chọn)'), 'Có giấy phép');
    await user.click(screen.getByRole('button', { name: 'Lưu' }));
    expect(await screen.findByText('Đã lưu điểm danh: Lê Văn Vắng buổi 1 — Vắng có phép')).toBeInTheDocument();
    expect(bangDiemDanhMock.hoc_vien[1].diem_danh['b-1']).toMatchObject({
      trang_thai: 'vang_co_phep',
      nguon: 'thu_cong',
      ghi_chu: 'Có giấy phép',
    });
    const o = await screen.findByRole('button', { name: 'Sửa điểm danh Lê Văn Vắng buổi 1' });
    expect(await within(o).findByText('sửa tay · Phạm Văn Giảng')).toBeInTheDocument();
  });

  it('đổi ô tự điểm danh Zoom sang "Vắng" → gửi đúng trạng thái', async () => {
    const user = userEvent.setup();
    render();
    await user.click(await screen.findByRole('button', { name: 'Sửa điểm danh Trần Thị Học buổi 1' }));
    expect(await screen.findByRole('radio', { name: 'Có mặt' })).toBeChecked();
    await user.click(screen.getByRole('radio', { name: 'Vắng' }));
    await user.click(screen.getByRole('button', { name: 'Lưu' }));
    expect(await screen.findByText('Đã lưu điểm danh: Trần Thị Học buổi 1 — Vắng')).toBeInTheDocument();
    expect(bangDiemDanhMock.hoc_vien[0].diem_danh['b-1']).toMatchObject({ trang_thai: 'vang', nguon: 'thu_cong' });
  });

  it('API từ chối (403) → hiện thông điệp lỗi, popover vẫn mở', async () => {
    server.use(
      http.put('/lop/:lopId/diem-danh', () =>
        HttpResponse.json({ error: { code: 'FORBIDDEN', message: 'Đã quá 3 ngày sau buổi học — liên hệ Quản trị để sửa điểm danh' } }, { status: 403 }),
      ),
    );
    const user = userEvent.setup();
    render();
    await user.click(await screen.findByRole('button', { name: 'Sửa điểm danh Trần Thị Học buổi 1' }));
    await user.click(await screen.findByRole('button', { name: 'Lưu' }));
    expect(await screen.findByText('Đã quá 3 ngày sau buổi học — liên hệ Quản trị để sửa điểm danh')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Lưu' })).toBeInTheDocument();
  });

  it('chọn giai đoạn khác → tải lại bảng theo giai đoạn đó', async () => {
    const user = userEvent.setup();
    render();
    await screen.findByText('Zoom 07:12');
    await user.click(screen.getByRole('textbox', { name: 'Giai đoạn' }));
    await user.click(await screen.findByRole('option', { name: 'GĐ 2 — Học trực tiếp' }));
    expect(await screen.findByText('Lớp chưa có buổi học.')).toBeInTheDocument();
  });
});
