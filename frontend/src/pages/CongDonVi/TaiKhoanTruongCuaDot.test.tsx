import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { renderTrang, renderVoiRouter } from '@/test/testUtils';
import { datToken } from '@/auth/tokenStore';
import { db } from '@/test/mocks/db';
import { server } from '@/test/mocks/server';
import { dbDotTrienKhai, dotMau } from '@/test/mocks/dotTrienKhai';
import { dbDanhSachThamGia } from '@/test/mocks/danhSachThamGia';
import { taiFileTuBlob } from '@/lib/taiFile';
import { TaiKhoanTruongCuaDot } from './TaiKhoanTruongCuaDot';
import QuanTriDanhSachThamGia from './QuanTriDanhSachThamGia';

// ADR 0015 T4: mục "Tài khoản trường của đợt" (Quản trị). Dữ liệu bịa trong mocks/danhSachThamGia.ts.
vi.mock('@/lib/taiFile', () => ({ taiFileTuBlob: vi.fn() }));

const URL_DS = '/cong-don-vi/dot-trien-khai/:id/tai-khoan-truong';
const URL_CAP = `${URL_DS}/cap`;
const TEN_FILE = 'mat-khau-tam-truong-dtk-1.xlsx';

beforeEach(() => {
  db.nguoiDung.vai_tro = 'quan_tri';
  datToken('token-gia-lap');
  vi.mocked(taiFileTuBlob).mockClear();
});

function moTrang() {
  return renderTrang(<TaiKhoanTruongCuaDot dotId="dtk-1" />);
}

const bang = () => screen.findByRole('table', { name: 'Tài khoản trường của đợt' });

function dongCua(ten: string) {
  return screen.getByRole('row', { name: new RegExp(ten) });
}

function demGoi(urlMau: string, phuongThuc: 'get' | 'post') {
  const dem = { lan: 0 };
  server.use(
    http[phuongThuc](urlMau, () => {
      dem.lan++;
      return undefined;
    }),
  );
  return dem;
}

// Blob của jsdom không có .text() — đọc qua FileReader.
function docBlob(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error);
    r.readAsText(blob);
  });
}

describe('TaiKhoanTruongCuaDot — danh sách', () => {
  it('dòng tóm tắt + bảng: trường, mã, tên đăng nhập, trạng thái theo từng loại', async () => {
    moTrang();
    await bang();
    expect(screen.getByText('5 trường · 3 đã có tài khoản · 2 chưa có · 1 chưa đăng nhập')).toBeInTheDocument();

    const mot = dongCua('Trường THCS Mẫu Một');
    expect(within(mot).getByText('TR-MAU-001')).toBeInTheDocument();
    expect(within(mot).getByText('tr-mau-001')).toBeInTheDocument();
    // 2026-11-20T18:30Z = 21/11/2026 giờ Việt Nam.
    expect(within(mot).getByText('Đã đăng nhập 21/11/2026')).toBeInTheDocument();

    const hai = dongCua('Trường THCS&THPT Mẫu Hai');
    expect(within(hai).getByText('Chưa có tài khoản')).toBeInTheDocument();
    expect(within(hai).getAllByText('—')).toHaveLength(2);
    expect(within(dongCua('Trường TH Mẫu Bốn')).getByText('Chưa đăng nhập')).toBeInTheDocument();
    expect(within(dongCua('Trường TH Mẫu Năm')).getByText('Đã khóa')).toBeInTheDocument();

    expect(screen.getByRole('link', { name: 'Quản lý tài khoản (cấp lại mật khẩu, khóa…)' })).toHaveAttribute(
      'href',
      '/quan-tri/don-vi-tai-khoan',
    );
  });

  it('nút cấp ghi số trường chưa có; 0 trường chưa có → nút bị khóa', async () => {
    moTrang();
    expect(await screen.findByRole('button', { name: 'Cấp tài khoản cho 2 trường chưa có' })).toBeEnabled();
  });

  it('mọi trường đã có tài khoản → nút "Cấp tài khoản cho 0 trường chưa có" bị khóa', async () => {
    dbDanhSachThamGia.taiKhoanTruong = {
      tong: { so_truong: 1, so_co_tai_khoan: 1, so_chua_co: 0, so_chua_dang_nhap: 0 },
      truong: [dbDanhSachThamGia.taiKhoanTruong.truong[0]],
    };
    moTrang();
    expect(await screen.findByRole('button', { name: 'Cấp tài khoản cho 0 trường chưa có' })).toBeDisabled();
  });

  it('đợt chưa có trường → báo trống', async () => {
    dbDanhSachThamGia.taiKhoanTruong = {
      tong: { so_truong: 0, so_co_tai_khoan: 0, so_chua_co: 0, so_chua_dang_nhap: 0 },
      truong: [],
    };
    moTrang();
    expect(await screen.findByText('Đợt chưa có trường nào trong danh sách.')).toBeInTheDocument();
  });

  it('lỗi tải danh sách → hiện thông báo lỗi', async () => {
    server.use(
      http.get(URL_DS, () =>
        HttpResponse.json({ error: { code: 'NOT_FOUND', message: 'Không tìm thấy đợt triển khai' } }, { status: 404 }),
      ),
    );
    moTrang();
    expect(await screen.findByText('Không tìm thấy đợt triển khai')).toBeInTheDocument();
  });

  it('màn hẹp: thẻ xếp dọc thay cho bảng', async () => {
    const goc = window.matchMedia;
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query.includes('max-width'),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
    try {
      moTrang();
      const the = await screen.findByRole('article', { name: 'Trường THCS Mẫu Một' });
      expect(screen.queryByRole('table', { name: 'Tài khoản trường của đợt' })).not.toBeInTheDocument();
      expect(screen.getAllByRole('article')).toHaveLength(5);
      expect(within(the).getByText('Mã: TR-MAU-001 · Tên đăng nhập: tr-mau-001')).toBeInTheDocument();
      expect(within(the).getByText('Đã đăng nhập 21/11/2026')).toBeInTheDocument();
      expect(
        within(screen.getByRole('article', { name: 'Trường THCS&THPT Mẫu Hai' })).getByText('Chưa có tài khoản'),
      ).toBeInTheDocument();
    } finally {
      window.matchMedia = goc;
    }
  });
});

describe('TaiKhoanTruongCuaDot — cấp tài khoản', () => {
  async function moXacNhan(user: ReturnType<typeof userEvent.setup>) {
    await user.click(await screen.findByRole('button', { name: 'Cấp tài khoản cho 2 trường chưa có' }));
    return screen.findByRole('dialog', { name: 'Cấp tài khoản cho trường' });
  }

  it('hộp xác nhận nhắc gửi riêng từng trường; Hủy không gọi API', async () => {
    const user = userEvent.setup();
    const cap = demGoi(URL_CAP, 'post');
    moTrang();
    const hop = await moXacNhan(user);
    expect(
      within(hop).getByText(
        'Tạo tài khoản cho 2 trường. Mật khẩu tạm chỉ tải về một lần — gửi riêng từng trường (Zalo đầu mối/công văn), không gửi vào nhóm chung. Trường đổi mật khẩu ở lần đăng nhập đầu tiên.',
      ),
    ).toBeInTheDocument();
    await user.click(within(hop).getByRole('button', { name: 'Hủy' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(cap.lan).toBe(0);
  });

  it('xác nhận → POST → tự tải file + hộp kết quả có trường bỏ qua; Tải lại file; Đã lưu, đóng; làm mới danh sách', async () => {
    const user = userEvent.setup();
    const cap = demGoi(URL_CAP, 'post');
    const ds = demGoi(URL_DS, 'get');
    moTrang();
    const hop = await moXacNhan(user);
    const lanGetTruoc = ds.lan;
    await user.click(within(hop).getByRole('button', { name: 'Cấp tài khoản' }));

    const kq = await screen.findByRole('dialog', { name: 'Kết quả cấp tài khoản' });
    expect(cap.lan).toBe(1);
    expect(within(kq).getByText('Đã tạo 1 tài khoản.')).toBeInTheDocument();
    expect(within(kq).getByText('Bỏ qua 1 trường:')).toBeInTheDocument();
    expect(
      within(kq).getByText(
        'Trường THCS&THPT Mẫu Hai: Trường chưa có mã đơn vị — tạo tài khoản tay ở Đơn vị & tài khoản',
      ),
    ).toBeInTheDocument();
    expect(within(kq).getByText(/File mật khẩu tạm chỉ tải được lúc này/)).toBeInTheDocument();

    expect(taiFileTuBlob).toHaveBeenCalledTimes(1);
    const [blob, ten] = vi.mocked(taiFileTuBlob).mock.calls[0];
    expect(ten).toBe(TEN_FILE);
    expect(await docBlob(blob as Blob)).toBe('xlsx-bia');

    await user.click(within(kq).getByRole('button', { name: 'Tải lại file' }));
    expect(taiFileTuBlob).toHaveBeenCalledTimes(2);
    expect(vi.mocked(taiFileTuBlob).mock.calls[1]).toEqual([blob, TEN_FILE]);

    await waitFor(() => expect(ds.lan).toBeGreaterThan(lanGetTruoc));
    await user.click(within(kq).getByRole('button', { name: 'Đã lưu, đóng' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('không tạo được tài khoản nào → không tải file, không có nút Tải lại file', async () => {
    dbDanhSachThamGia.ketQuaCap = { ...dbDanhSachThamGia.ketQuaCap, so_tao: 0, file_mat_khau: null };
    const user = userEvent.setup();
    moTrang();
    const hop = await moXacNhan(user);
    await user.click(within(hop).getByRole('button', { name: 'Cấp tài khoản' }));
    const kq = await screen.findByRole('dialog', { name: 'Kết quả cấp tài khoản' });
    expect(within(kq).getByText('Đã tạo 0 tài khoản.')).toBeInTheDocument();
    expect(within(kq).queryByRole('button', { name: 'Tải lại file' })).not.toBeInTheDocument();
    expect(within(kq).queryByText(/File mật khẩu tạm chỉ tải được lúc này/)).not.toBeInTheDocument();
    expect(taiFileTuBlob).not.toHaveBeenCalled();
  });

  it('lỗi từ server → báo lỗi trong hộp xác nhận, không tải file', async () => {
    server.use(
      http.post(URL_CAP, () =>
        HttpResponse.json(
          { error: { code: 'FORBIDDEN', message: 'Không có quyền truy cập tài nguyên này' } },
          {
            status: 403,
          },
        ),
      ),
    );
    const user = userEvent.setup();
    moTrang();
    const hop = await moXacNhan(user);
    await user.click(within(hop).getByRole('button', { name: 'Cấp tài khoản' }));
    expect(await within(hop).findByText('Không có quyền truy cập tài nguyên này')).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'Kết quả cấp tài khoản' })).not.toBeInTheDocument();
    expect(taiFileTuBlob).not.toHaveBeenCalled();
  });
});

describe('QuanTriDanhSachThamGia — có mục Tài khoản trường của đợt', () => {
  beforeEach(() => vi.stubEnv('VITE_CONG_DON_VI_HOSTNAME', window.location.hostname));
  afterEach(() => vi.unstubAllEnvs());

  it('chọn đợt → hiện mục tài khoản trường; đợt HSG có gợi ý nạp thẳng file tổng hợp', async () => {
    dbDotTrienKhai.ds = [dotMau()];
    const user = userEvent.setup();
    renderVoiRouter([{ path: '/qt', element: <QuanTriDanhSachThamGia /> }], { initialEntries: ['/qt'] });
    await user.click(await screen.findByRole('textbox', { name: 'Đợt triển khai' }));
    await user.click(await screen.findByRole('option', { name: 'HSG – HSG An Giang 2026' }));
    expect(await screen.findByRole('heading', { name: 'Tài khoản trường của đợt' })).toBeInTheDocument();
    expect(
      screen.getByText(
        'Có thể nạp thẳng file danh sách tổng hợp (cột Họ và / Tên, Ngày/Tháng/Năm sinh, Đơn vị công tác, Mã lớp) — không cần chuyển sang file mẫu.',
      ),
    ).toBeInTheDocument();
  });
});
