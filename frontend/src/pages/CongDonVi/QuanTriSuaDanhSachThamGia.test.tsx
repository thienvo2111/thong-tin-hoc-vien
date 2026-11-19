import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { renderVoiRouter } from '@/test/testUtils';
import { datToken } from '@/auth/tokenStore';
import { db } from '@/test/mocks/db';
import { server } from '@/test/mocks/server';
import { dbDotTrienKhai, dotMau } from '@/test/mocks/dotTrienKhai';
import { dbDanhSachThamGia } from '@/test/mocks/danhSachThamGia';
import type { DongDanhSach } from '@/api/danhSachThamGia';
import { taiFileTuBlob } from '@/lib/taiFile';
import QuanTriDanhSachThamGia from './QuanTriDanhSachThamGia';

// Issue #59 / ADR 0015 S2, S3, X3: Quản trị sửa/thêm/xóa từng dòng (bắt buộc lý do) + xuất Excel.
// Phân quyền (trường không thấy trang) đã có ở QuanTriDanhSachThamGia.test.tsx.
vi.mock('@/lib/taiFile', () => ({ taiFileTuBlob: vi.fn() }));

beforeEach(() => vi.stubEnv('VITE_CONG_DON_VI_HOSTNAME', window.location.hostname));
afterEach(() => {
  vi.unstubAllEnvs();
  vi.mocked(taiFileTuBlob).mockClear();
});

type User = ReturnType<typeof userEvent.setup>;
const TRANG = '/quan-tri/danh-sach-tham-gia';

// Dữ liệu bịa.
function dongMau(p: Partial<DongDanhSach> = {}): DongDanhSach {
  return {
    id: 'd1',
    don_vi_id: 'tr-1',
    ho_ten: 'GV Bịa Một',
    ngay_sinh: '1990-02-01',
    gioi_tinh: 'Nam',
    ma_goc: 'M-1',
    lop: 'Lớp A',
    giai_doan: 'ca_hai',
    ty_le_suat: 1,
    ghi_chu: null,
    y_kien_truong: 'Đúng',
    hoc_vien_id: null,
    ...p,
  };
}

function renderTrang() {
  db.nguoiDung.vai_tro = 'quan_tri';
  datToken('token-gia-lap');
  dbDotTrienKhai.ds = [dotMau(), dotMau({ id: 'dtk-nls', chuong_trinh: 'nls', ten: 'NLS đợt 1' })];
  dbDanhSachThamGia.danhSach = {
    tong_hop: [
      { don_vi_id: 'tr-1', ten_don_vi: 'Trường THCS Mẫu Một', ma_don_vi: 'TR-MAU-001', so_nguoi: 2, tong_suat: 1.5 },
    ],
    dong: [dongMau(), dongMau({ id: 'd2', ho_ten: 'GV Bịa Hai', giai_doan: 'chi_gd1', ty_le_suat: 0.5 })],
  };
  return renderVoiRouter([{ path: TRANG, element: <QuanTriDanhSachThamGia /> }], { initialEntries: [TRANG] });
}

async function chonDot(user: User, ten = 'HSG – HSG An Giang 2026') {
  await user.click(await screen.findByRole('textbox', { name: 'Đợt triển khai' }));
  await user.click(await screen.findByRole('option', { name: ten }));
}

async function moTruong(user: User) {
  await chonDot(user);
  await user.click(await screen.findByRole('button', { name: 'Xem danh sách Trường THCS Mẫu Một' }));
  return screen.findByRole('table', { name: 'Danh sách Trường THCS Mẫu Một' });
}

async function moSua(user: User, hoTen = 'GV Bịa Một') {
  await moTruong(user);
  await user.click(screen.getByRole('button', { name: `Sửa ${hoTen}` }));
  return screen.findByRole('dialog', { name: 'Sửa thông tin' });
}

async function chonTrongHop(user: User, hop: HTMLElement, nhan: RegExp, luaChon: string) {
  await user.click(within(hop).getByRole('textbox', { name: nhan }));
  await user.click(await screen.findByRole('option', { name: luaChon }));
}

function batBody(method: 'patch' | 'post' | 'delete', path: string) {
  const ghi: { body?: unknown; soLan: number } = { soLan: 0 };
  server.use(
    http[method](path, async ({ request }) => {
      ghi.soLan++;
      ghi.body = await request.clone().json();
      return undefined;
    }),
  );
  return ghi;
}

const URL_DONG = '/cong-don-vi/danh-sach-tham-gia/:dongId';

describe('Sửa dòng', () => {
  it('mở form điền sẵn thông tin dòng', async () => {
    const user = userEvent.setup();
    renderTrang();
    const hop = await moSua(user);
    expect(within(hop).getByLabelText(/^Họ và tên/)).toHaveValue('GV Bịa Một');
    expect(within(hop).getByLabelText(/^Ngày sinh/)).toHaveValue('01/02/1990');
    expect(within(hop).getByLabelText(/^Giới tính/)).toHaveValue('Nam');
    expect(within(hop).getByLabelText(/^Mã gốc/)).toHaveValue('M-1');
    expect(within(hop).getByLabelText(/^Lớp/)).toHaveValue('Lớp A');
    expect(within(hop).getByRole('textbox', { name: /^Giai đoạn tham gia/ })).toHaveValue('Cả 2');
    expect(within(hop).getByRole('textbox', { name: /^Tỷ lệ suất/ })).toHaveValue('1');
    await waitFor(() =>
      expect(within(hop).getByRole('textbox', { name: /^Trường/ })).toHaveValue('Trường THCS Mẫu Một (TR-MAU-001)'),
    );
    expect(within(hop).getByText('Thay giữa chừng: mỗi người 0,5')).toBeInTheDocument();
    expect(within(hop).getByLabelText(/^Lý do/)).toHaveValue('');
  }, 20000);

  it('chỉ gửi trường đã đổi + lý do; báo thành công, đóng form', async () => {
    const ghi = batBody('patch', URL_DONG);
    const user = userEvent.setup();
    renderTrang();
    const hop = await moSua(user);
    await user.clear(within(hop).getByLabelText(/^Họ và tên/));
    await user.type(within(hop).getByLabelText(/^Họ và tên/), 'GV Bịa Đã Sửa');
    await user.clear(within(hop).getByLabelText(/^Lớp/));
    await user.type(within(hop).getByLabelText(/^Lý do/), '  Trường báo sai tên ');
    await user.click(within(hop).getByRole('button', { name: 'Lưu thay đổi' }));

    await waitFor(() => expect(ghi.body).toBeTruthy());
    expect(ghi.body).toEqual({ ho_ten: 'GV Bịa Đã Sửa', lop: null, ly_do: 'Trường báo sai tên' });
    expect(await screen.findByText('Đã lưu thay đổi')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Sửa thông tin' })).not.toBeInTheDocument());
  }, 20000);

  it('đổi giai đoạn → suất tự đổi theo; gửi cả giai đoạn và suất', async () => {
    const ghi = batBody('patch', URL_DONG);
    const user = userEvent.setup();
    renderTrang();
    const hop = await moSua(user);
    await chonTrongHop(user, hop, /^Giai đoạn tham gia/, 'Chỉ GĐ2');
    expect(within(hop).getByRole('textbox', { name: /^Tỷ lệ suất/ })).toHaveValue('0,5');
    await user.type(within(hop).getByLabelText(/^Lý do/), 'Chỉ học GĐ2');
    await user.click(within(hop).getByRole('button', { name: 'Lưu thay đổi' }));
    await waitFor(() => expect(ghi.body).toBeTruthy());
    expect(ghi.body).toEqual({ giai_doan: 'chi_gd2', ty_le_suat: 0.5, ly_do: 'Chỉ học GĐ2' });
  }, 20000);

  it('sửa tay suất 0,5 giữ nguyên giai đoạn Cả 2 (thay giữa chừng) → giữ suất đã chọn', async () => {
    const ghi = batBody('patch', URL_DONG);
    const user = userEvent.setup();
    renderTrang();
    const hop = await moSua(user);
    await chonTrongHop(user, hop, /^Tỷ lệ suất/, '0,5');
    await user.type(within(hop).getByLabelText(/^Ghi chú/), 'Đã được thay');
    expect(within(hop).getByRole('textbox', { name: /^Giai đoạn tham gia/ })).toHaveValue('Cả 2');
    expect(within(hop).getByRole('textbox', { name: /^Tỷ lệ suất/ })).toHaveValue('0,5');
    await user.type(within(hop).getByLabelText(/^Lý do/), 'Thay giữa chừng');
    await user.click(within(hop).getByRole('button', { name: 'Lưu thay đổi' }));
    await waitFor(() => expect(ghi.body).toBeTruthy());
    expect(ghi.body).toEqual({ ty_le_suat: 0.5, ghi_chu: 'Đã được thay', ly_do: 'Thay giữa chừng' });
  }, 20000);

  it('thiếu lý do → chặn ở client, không gọi API', async () => {
    const ghi = batBody('patch', URL_DONG);
    const user = userEvent.setup();
    renderTrang();
    const hop = await moSua(user);
    await user.type(within(hop).getByLabelText(/^Lớp/), ' B');
    await user.type(within(hop).getByLabelText(/^Lý do/), '   ');
    await user.click(within(hop).getByRole('button', { name: 'Lưu thay đổi' }));
    expect(await within(hop).findByText('Nhập lý do')).toBeInTheDocument();
    expect(ghi.soLan).toBe(0);
  }, 20000);

  it('server trả 400 → hiện thông điệp và lỗi đúng ô', async () => {
    server.use(
      http.patch(URL_DONG, () =>
        HttpResponse.json(
          {
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Đơn vị không phải trường đang hoạt động trong phạm vi Sở của đợt',
              fields: [{ field: 'ly_do', message: 'Nhập lý do (tối đa 500 ký tự)' }],
            },
          },
          { status: 400 },
        ),
      ),
    );
    const user = userEvent.setup();
    renderTrang();
    const hop = await moSua(user);
    await user.type(within(hop).getByLabelText(/^Lớp/), ' B');
    await user.type(within(hop).getByLabelText(/^Lý do/), 'x');
    await user.click(within(hop).getByRole('button', { name: 'Lưu thay đổi' }));
    expect(await within(hop).findByRole('alert')).toHaveTextContent(
      'Đơn vị không phải trường đang hoạt động trong phạm vi Sở của đợt',
    );
    expect(within(hop).getByText('Nhập lý do (tối đa 500 ký tự)')).toBeInTheDocument();
  }, 20000);

  it('không thay đổi gì → báo, không gọi API', async () => {
    const ghi = batBody('patch', URL_DONG);
    const user = userEvent.setup();
    renderTrang();
    const hop = await moSua(user);
    await user.type(within(hop).getByLabelText(/^Lý do/), 'x');
    await user.click(within(hop).getByRole('button', { name: 'Lưu thay đổi' }));
    expect(await within(hop).findByRole('alert')).toHaveTextContent('Chưa có thay đổi nào để lưu');
    expect(ghi.soLan).toBe(0);
  }, 20000);
});

describe('Thêm người', () => {
  it('từ danh sách 1 trường: chọn sẵn trường, gửi đủ thông tin + lý do; tải lại danh sách', async () => {
    const ghi = batBody('post', '/cong-don-vi/dot-trien-khai/:id/danh-sach');
    let soLanTaiDs = 0;
    server.use(
      http.get('/cong-don-vi/dot-trien-khai/:id/danh-sach', () => {
        soLanTaiDs++;
        return undefined;
      }),
    );
    const user = userEvent.setup();
    renderTrang();
    await moTruong(user);
    const truocKhiThem = soLanTaiDs;
    await user.click(screen.getByRole('button', { name: 'Thêm người vào Trường THCS Mẫu Một' }));
    const hop = await screen.findByRole('dialog', { name: 'Thêm người' });
    await waitFor(() =>
      expect(within(hop).getByRole('textbox', { name: /^Trường/ })).toHaveValue('Trường THCS Mẫu Một (TR-MAU-001)'),
    );
    await user.type(within(hop).getByLabelText(/^Họ và tên/), 'GV Bịa Mới');
    await user.type(within(hop).getByLabelText(/^Ngày sinh/), '05/03/1991');
    await chonTrongHop(user, hop, /^Giai đoạn tham gia/, 'Chỉ GĐ1');
    await user.type(within(hop).getByLabelText(/^Lý do/), 'Bổ sung người');
    await user.click(within(hop).getByRole('button', { name: 'Thêm người' }));

    await waitFor(() => expect(ghi.body).toBeTruthy());
    expect(ghi.body).toEqual({
      don_vi_id: 'tr-1',
      ho_ten: 'GV Bịa Mới',
      ngay_sinh: '1991-03-05',
      gioi_tinh: null,
      ma_goc: null,
      lop: null,
      giai_doan: 'chi_gd1',
      ty_le_suat: 0.5,
      ghi_chu: null,
      ly_do: 'Bổ sung người',
    });
    expect(await screen.findByText('Đã thêm người vào danh sách')).toBeInTheDocument();
    await waitFor(() => expect(soLanTaiDs).toBeGreaterThan(truocKhiThem));
  }, 30000);

  it('nút Thêm người chung: chưa chọn trường → báo lỗi, không gọi API', async () => {
    const ghi = batBody('post', '/cong-don-vi/dot-trien-khai/:id/danh-sach');
    const user = userEvent.setup();
    renderTrang();
    await chonDot(user);
    await user.click(await screen.findByRole('button', { name: 'Thêm người' }));
    const hop = await screen.findByRole('dialog', { name: 'Thêm người' });
    await user.type(within(hop).getByLabelText(/^Họ và tên/), 'GV Bịa');
    await user.type(within(hop).getByLabelText(/^Lý do/), 'x');
    await user.click(within(hop).getByRole('button', { name: 'Thêm người' }));
    expect(await within(hop).findByText('Chọn trường')).toBeInTheDocument();
    expect(ghi.soLan).toBe(0);
  }, 20000);

  it('đợt NLS: không có nút Thêm người', async () => {
    const user = userEvent.setup();
    renderTrang();
    await chonDot(user, 'NLS – NLS đợt 1');
    await screen.findByRole('table', { name: 'Tổng hợp theo trường' });
    expect(screen.queryByRole('button', { name: 'Thêm người' })).not.toBeInTheDocument();
  }, 20000);
});

describe('Xóa dòng', () => {
  it('bắt buộc lý do; gửi DELETE kèm { ly_do }', async () => {
    const ghi = batBody('delete', URL_DONG);
    const user = userEvent.setup();
    renderTrang();
    await moTruong(user);
    await user.click(screen.getByRole('button', { name: 'Xóa GV Bịa Hai' }));
    const hop = await screen.findByRole('dialog', { name: 'Xóa khỏi danh sách' });
    expect(within(hop).getByText('GV Bịa Hai')).toBeInTheDocument();
    await user.click(within(hop).getByRole('button', { name: 'Xóa' }));
    expect(await within(hop).findByText('Nhập lý do')).toBeInTheDocument();
    expect(ghi.soLan).toBe(0);

    await user.type(within(hop).getByLabelText(/^Lý do/), 'Trùng người');
    await user.click(within(hop).getByRole('button', { name: 'Xóa' }));
    await waitFor(() => expect(ghi.body).toEqual({ ly_do: 'Trùng người' }));
    expect(await screen.findByText('Đã xóa khỏi danh sách')).toBeInTheDocument();
  }, 20000);

  it('server báo lỗi → hiện trong hộp xác nhận', async () => {
    server.use(
      http.delete(URL_DONG, () =>
        HttpResponse.json({ error: { code: 'NOT_FOUND', message: 'Không tìm thấy dòng danh sách' } }, { status: 404 }),
      ),
    );
    const user = userEvent.setup();
    renderTrang();
    await moTruong(user);
    await user.click(screen.getByRole('button', { name: 'Xóa GV Bịa Một' }));
    const hop = await screen.findByRole('dialog', { name: 'Xóa khỏi danh sách' });
    await user.type(within(hop).getByLabelText(/^Lý do/), 'x');
    await user.click(within(hop).getByRole('button', { name: 'Xóa' }));
    expect(await within(hop).findByRole('alert')).toHaveTextContent('Không tìm thấy dòng danh sách');
  }, 20000);
});

describe('Xuất Excel', () => {
  function batUrlXuat() {
    const urls: string[] = [];
    server.use(
      http.get('/cong-don-vi/dot-trien-khai/:id/danh-sach/xuat-excel', ({ request }) => {
        urls.push(request.url);
        return undefined;
      }),
    );
    return urls;
  }

  it('cả đợt: không có don_vi_id; 1 trường: có don_vi_id; tải file qua taiFileTuBlob', async () => {
    const urls = batUrlXuat();
    const user = userEvent.setup();
    renderTrang();
    await moTruong(user);

    await user.click(screen.getByRole('button', { name: 'Xuất Excel' }));
    await waitFor(() => expect(taiFileTuBlob).toHaveBeenCalledTimes(1));
    const u1 = new URL(urls[0]);
    expect(u1.pathname).toBe('/cong-don-vi/dot-trien-khai/dtk-1/danh-sach/xuat-excel');
    expect(u1.searchParams.has('don_vi_id')).toBe(false);
    expect(vi.mocked(taiFileTuBlob).mock.calls[0][1]).toBe('danh-sach-tham-gia.xlsx');

    await user.click(screen.getByRole('button', { name: 'Xuất Excel Trường THCS Mẫu Một' }));
    await waitFor(() => expect(taiFileTuBlob).toHaveBeenCalledTimes(2));
    expect(new URL(urls[1]).searchParams.get('don_vi_id')).toBe('tr-1');
    expect(vi.mocked(taiFileTuBlob).mock.calls[1][1]).toBe('danh-sach-tham-gia-TR-MAU-001.xlsx');
  }, 20000);
});
