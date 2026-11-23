import { describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { renderVoiRouter } from '@/test/testUtils';
import { datToken } from '@/auth/tokenStore';
import { db } from '@/test/mocks/db';
import { server } from '@/test/mocks/server';
import { dbDotTrienKhai, dotMau } from '@/test/mocks/dotTrienKhai';
import QuanTriDanhSachThamGia from './QuanTriDanhSachThamGia';

// Issue #68 / ADR 0015 M3, S3, X5: đợt NLS — "Lấy danh sách từ khóa" ở màn Danh sách tham gia. Dữ liệu đều bịa.
type User = ReturnType<typeof userEvent.setup>;
const TRANG = '/quan-tri/danh-sach-tham-gia';
const CHO = { timeout: 10000 };

const KHOA = [
  {
    id: 'k-1',
    ma_khoa: 'KNLS-01',
    ten_khoa: 'Khóa NLS Bịa Một',
    thoi_gian_bat_dau: '2026-03-01',
    thoi_gian_ket_thuc: '2026-06-30',
  },
];

function renderTrang(khoa = KHOA) {
  db.nguoiDung.vai_tro = 'quan_tri';
  datToken('token-gia-lap');
  dbDotTrienKhai.ds = [dotMau(), dotMau({ id: 'dtk-nls', chuong_trinh: 'nls', ten: 'NLS đợt 1', khoa })];
  return renderVoiRouter([{ path: TRANG, element: <QuanTriDanhSachThamGia /> }], { initialEntries: [TRANG] });
}

async function chonDot(user: User, ten: string) {
  await user.click(await screen.findByRole('textbox', { name: 'Đợt triển khai' }));
  await user.click(await screen.findByRole('option', { name: ten }));
}

async function xemTruoc(user: User) {
  await chonDot(user, 'NLS – NLS đợt 1');
  await user.click(await screen.findByRole('button', { name: 'Xem trước' }, CHO));
  return screen.findByRole('table', { name: 'Xem trước lấy danh sách từ khóa' }, CHO);
}

function loi400(message: string) {
  return HttpResponse.json({ error: { code: 'VALIDATION_ERROR', message } }, { status: 400 });
}

describe('Lấy danh sách từ khóa (đợt NLS)', () => {
  it('đợt NLS: có panel lấy từ khóa, liệt kê khóa của đợt, không có nạp Excel', async () => {
    const user = userEvent.setup();
    renderTrang();
    await chonDot(user, 'NLS – NLS đợt 1');
    expect(await screen.findByRole('heading', { name: 'Lấy danh sách từ khóa' }, CHO)).toBeInTheDocument();
    expect(screen.getByText('KNLS-01 – Khóa NLS Bịa Một')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Nạp danh sách HSG' })).not.toBeInTheDocument();
  }, 20000);

  it('đợt HSG: giữ panel nạp Excel, không có lấy từ khóa', async () => {
    const user = userEvent.setup();
    renderTrang();
    await chonDot(user, 'HSG – HSG An Giang 2026');
    expect(await screen.findByRole('heading', { name: 'Nạp danh sách HSG' }, CHO)).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Lấy danh sách từ khóa' })).not.toBeInTheDocument();
  }, 20000);

  it('đợt chưa gắn khóa: nhắc + link Chương trình / Đợt, nút Xem trước bị tắt', async () => {
    const user = userEvent.setup();
    renderTrang([]);
    await chonDot(user, 'NLS – NLS đợt 1');
    expect(await screen.findByText(/Đợt chưa gắn khóa NLS nào/, undefined, CHO)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Chương trình / Đợt' })).toHaveAttribute(
      'href',
      '/quan-tri/dot-trien-khai',
    );
    expect(screen.getByRole('button', { name: 'Xem trước' })).toBeDisabled();
  }, 20000);

  it('xem trước: số dòng mới/cũ, tổng suất, badge đã nộp / đề nghị chờ, bỏ qua + danh sách ngoài phạm vi, cảnh báo trường bị xóa', async () => {
    const user = userEvent.setup();
    renderTrang();
    const bang = await xemTruoc(user);
    expect(screen.getByText('Bản chụp: 5 người, 2 trường, tổng 4 suất từ 2 khóa.')).toBeInTheDocument();

    const hang = (ten: string) => within(bang).getByText(ten).closest('tr') as HTMLElement;
    const hangMot = hang('Trường THCS Mẫu Một (TR-MAU-001)');
    expect(within(hangMot).getByText('2,5')).toBeInTheDocument();
    expect(within(hangMot).getByText('Đã nộp – giữ nguyên')).toBeInTheDocument();
    const hangHai = hang('Trường THCS&THPT Mẫu Hai');
    expect(
      within(hangHai)
        .getAllByRole('cell')
        .map((c) => c.textContent),
    ).toEqual(['Trường THCS&THPT Mẫu Hai', '2', '1', '1,5', 'Có đề nghị chờ']);

    expect(
      screen.getByText(
        'Bỏ qua: 4 người chưa phân lớp, 1 người ngoài phạm vi, 1 người ghi danh nhiều khóa (gộp 1 dòng).',
      ),
    ).toBeInTheDocument();
    const nutNgoai = screen.getByRole('button', { name: 'Xem 1 người ngoài phạm vi' });
    expect(nutNgoai).toHaveAttribute('aria-expanded', 'false');
    await user.click(nutNgoai);
    expect(screen.getByRole('button', { name: 'Ẩn 1 người ngoài phạm vi' })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('GV Bịa Ngoài — Phòng Bịa: Đơn vị công tác không phải trường')).toBeInTheDocument();
    expect(screen.getByText(/Trường TH Mẫu Ba đang có danh sách nhưng bản chụp mới không có ai/)).toBeInTheDocument();
  }, 20000);

  it('Chụp danh sách: hộp xác nhận nêu số trường chưa nộp, gửi POST, báo kết quả, tải lại danh sách', async () => {
    let soLanGoiDanhSach = 0;
    let daChup = false;
    server.use(
      http.get('/cong-don-vi/dot-trien-khai/:id/danh-sach', () => {
        soLanGoiDanhSach++;
        return undefined;
      }),
      http.post('/cong-don-vi/dot-trien-khai/:id/danh-sach/lay-tu-khoa', ({ params }) => {
        daChup = params.id === 'dtk-nls';
        return undefined;
      }),
    );
    const user = userEvent.setup();
    renderTrang();
    await xemTruoc(user);
    await waitFor(() => expect(soLanGoiDanhSach).toBeGreaterThan(0));
    const truoc = soLanGoiDanhSach;
    await user.click(screen.getByRole('button', { name: 'Chụp danh sách' }));
    const hop = await screen.findByRole('dialog', { name: 'Xác nhận chụp danh sách' });
    expect(
      within(hop).getByText('Thay danh sách của 2 trường chưa nộp hợp đồng; trường đã nộp giữ nguyên.'),
    ).toBeInTheDocument();
    await user.click(within(hop).getByRole('button', { name: 'Chụp' }));
    expect(
      await screen.findByText('Đã chụp 2 dòng cho 2 trường; giữ nguyên 1 trường đã nộp hợp đồng', undefined, CHO),
    ).toBeInTheDocument();
    expect(daChup).toBe(true);
    await waitFor(() => expect(soLanGoiDanhSach).toBeGreaterThan(truoc));
    expect(screen.queryByRole('table', { name: 'Xem trước lấy danh sách từ khóa' })).not.toBeInTheDocument();
  }, 20000);

  it('400 đợt chưa gắn khóa (server) → hiện thông điệp', async () => {
    server.use(
      http.post('/cong-don-vi/dot-trien-khai/:id/danh-sach/lay-tu-khoa/xem-truoc', () =>
        loi400('Đợt chưa gắn khóa NLS nào — gắn khóa ở màn Chương trình / Đợt trước'),
      ),
    );
    const user = userEvent.setup();
    renderTrang();
    await chonDot(user, 'NLS – NLS đợt 1');
    await user.click(await screen.findByRole('button', { name: 'Xem trước' }, CHO));
    expect(await screen.findByRole('alert', undefined, CHO)).toHaveTextContent('Đợt chưa gắn khóa NLS nào');
  }, 20000);

  it('400 khóa > 2 giai đoạn học → hiện thông điệp kèm mã khóa', async () => {
    server.use(
      http.post('/cong-don-vi/dot-trien-khai/:id/danh-sach/lay-tu-khoa/xem-truoc', () =>
        loi400('Khóa có hơn 2 giai đoạn học, không chụp được (chưa có cách tính giai đoạn tham gia): KNLS-01'),
      ),
    );
    const user = userEvent.setup();
    renderTrang();
    await chonDot(user, 'NLS – NLS đợt 1');
    await user.click(await screen.findByRole('button', { name: 'Xem trước' }, CHO));
    expect(await screen.findByRole('alert', undefined, CHO)).toHaveTextContent(
      'Khóa có hơn 2 giai đoạn học, không chụp được (chưa có cách tính giai đoạn tham gia): KNLS-01',
    );
    expect(screen.queryByRole('button', { name: 'Chụp danh sách' })).not.toBeInTheDocument();
  }, 20000);

  it('lỗi khi chụp → hiện trong hộp xác nhận', async () => {
    server.use(
      http.post('/cong-don-vi/dot-trien-khai/:id/danh-sach/lay-tu-khoa', () =>
        loi400('Khóa có hơn 2 giai đoạn học, không chụp được (chưa có cách tính giai đoạn tham gia): KNLS-01'),
      ),
    );
    const user = userEvent.setup();
    renderTrang();
    await xemTruoc(user);
    await user.click(screen.getByRole('button', { name: 'Chụp danh sách' }));
    const hop = await screen.findByRole('dialog', { name: 'Xác nhận chụp danh sách' });
    await user.click(within(hop).getByRole('button', { name: 'Chụp' }));
    expect(await within(hop).findByRole('alert')).toHaveTextContent('KNLS-01');
  }, 20000);
});
