import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { renderVoiRouter } from '@/test/testUtils';
import { datToken } from '@/auth/tokenStore';
import { db } from '@/test/mocks/db';
import { server } from '@/test/mocks/server';
import { dbDotTrienKhai, dotMau } from '@/test/mocks/dotTrienKhai';
import { dbDanhSachThamGia, dongXemTruocMau } from '@/test/mocks/danhSachThamGia';
import { routesCongDonVi } from '@/router';
import CongDonViLayout from './CongDonViLayout';
import QuanTriDanhSachThamGia from './QuanTriDanhSachThamGia';

// router.tsx tạo createBrowserRouter ngay khi import — thay bằng hàm rỗng để test chỉ dùng mảng route.
vi.mock('react-router-dom', async (goc) => ({
  ...(await goc<typeof import('react-router-dom')>()),
  createBrowserRouter: vi.fn(),
}));

beforeEach(() => vi.stubEnv('VITE_CONG_DON_VI_HOSTNAME', window.location.hostname));
afterEach(() => vi.unstubAllEnvs());

type User = ReturnType<typeof userEvent.setup>;
const TRANG = '/quan-tri/danh-sach-tham-gia';

function renderTrang() {
  db.nguoiDung.vai_tro = 'quan_tri';
  datToken('token-gia-lap');
  dbDotTrienKhai.ds = [dotMau(), dotMau({ id: 'dtk-nls', chuong_trinh: 'nls', ten: 'NLS đợt 1' })];
  return renderVoiRouter([{ path: TRANG, element: <QuanTriDanhSachThamGia /> }], { initialEntries: [TRANG] });
}

async function chonDot(user: User, ten: string) {
  await user.click(await screen.findByRole('textbox', { name: 'Đợt triển khai' }));
  await user.click(await screen.findByRole('option', { name: ten }));
}

async function xemTruoc(user: User, container: HTMLElement) {
  await chonDot(user, 'HSG – HSG An Giang 2026');
  await screen.findByRole('heading', { name: 'Nạp danh sách HSG' });
  const oFile = container.querySelector('input[type="file"]') as HTMLInputElement;
  await user.upload(oFile, new File(['x'], 'ds.xlsx'));
  await user.click(screen.getByRole('button', { name: 'Xem trước' }));
  return screen.findByRole('table', { name: 'Xem trước danh sách' });
}

function dongCua(bang: HTMLElement, soDong: number) {
  return within(bang)
    .getAllByRole('row')
    .find((r) => within(r).queryAllByRole('cell')[0]?.textContent === String(soDong)) as HTMLElement;
}

async function chonTruongTay(user: User, soDong: number, ten: string) {
  await user.click(screen.getByRole('textbox', { name: `Chọn trường cho dòng ${soDong}` }));
  await user.click(await screen.findByRole('option', { name: ten }));
}

function batBodyNap() {
  const ghi: { body?: { dong: unknown[] } } = {};
  server.use(
    http.post('/cong-don-vi/dot-trien-khai/:id/danh-sach/nap', async ({ request }) => {
      ghi.body = (await request.clone().json()) as { dong: unknown[] };
      return undefined;
    }),
  );
  return ghi;
}

describe('QuanTriDanhSachThamGia — xem trước', () => {
  it('hiện trạng thái từng dòng; chỉ dòng không khớp / nhiều kết quả có ô chọn trường; dòng chặn báo rõ lý do', async () => {
    const user = userEvent.setup();
    const { container } = renderTrang();
    const bang = await xemTruoc(user, container);

    expect(within(dongCua(bang, 3)).getByText('Khớp mã')).toBeInTheDocument();
    expect(within(dongCua(bang, 3)).getByText('01/02/1990')).toBeInTheDocument();
    expect(within(dongCua(bang, 3)).getByText('Trường THCS Mẫu Một')).toBeInTheDocument();
    expect(within(dongCua(bang, 4)).getByText('Khớp tên')).toBeInTheDocument();
    expect(within(dongCua(bang, 4)).getByText('0,5')).toBeInTheDocument();
    expect(within(dongCua(bang, 5)).getByText('Chọn trường')).toBeInTheDocument();
    expect(within(dongCua(bang, 6)).getByText('Chọn trường')).toBeInTheDocument();
    expect(within(dongCua(bang, 7)).getByText('Thiếu trường')).toBeInTheDocument();
    expect(within(dongCua(bang, 7)).getByText('Không có mã/tên trường — không nạp')).toBeInTheDocument();
    expect(within(dongCua(bang, 8)).getByText('Lỗi')).toBeInTheDocument();
    expect(within(dongCua(bang, 8)).getByText('Giai đoạn tham gia "Chỉ GĐ5" không hợp lệ')).toBeInTheDocument();

    expect(screen.getByRole('textbox', { name: 'Chọn trường cho dòng 5' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Chọn trường cho dòng 6' })).toBeInTheDocument();
    for (const n of [3, 4, 7, 8]) {
      expect(screen.queryByRole('textbox', { name: `Chọn trường cho dòng ${n}` })).not.toBeInTheDocument();
    }
    expect(screen.getByText('Sẽ nạp 2 dòng cho 2 trường, bỏ qua 4 dòng.')).toBeInTheDocument();
  }, 20000);

  it('chọn trường tay cho dòng không khớp → dòng được tính vào số sẽ nạp', async () => {
    const user = userEvent.setup();
    const { container } = renderTrang();
    await xemTruoc(user, container);
    await chonTruongTay(user, 5, 'Trường TH Mẫu Ba (TR-MAU-003)');
    expect(await screen.findByText('Sẽ nạp 3 dòng cho 3 trường, bỏ qua 3 dòng.')).toBeInTheDocument();
  }, 20000);

  it('server báo lỗi file → hiện thông điệp, không có bảng xem trước', async () => {
    server.use(
      http.post('/cong-don-vi/dot-trien-khai/:id/danh-sach/xem-truoc', () =>
        HttpResponse.json(
          {
            error: {
              code: 'VALIDATION_ERROR',
              message: 'File thiếu cột trường: cần cột "Mã trường" hoặc "Tên trường"',
            },
          },
          { status: 400 },
        ),
      ),
    );
    const user = userEvent.setup();
    const { container } = renderTrang();
    await chonDot(user, 'HSG – HSG An Giang 2026');
    await user.upload(container.querySelector('input[type="file"]') as HTMLInputElement, new File(['x'], 'ds.xlsx'));
    await user.click(screen.getByRole('button', { name: 'Xem trước' }));
    expect(await screen.findByText('File thiếu cột trường: cần cột "Mã trường" hoặc "Tên trường"')).toBeInTheDocument();
    expect(screen.queryByRole('table', { name: 'Xem trước danh sách' })).not.toBeInTheDocument();
  }, 20000);

  it('mọi dòng bị chặn hoặc chưa chọn trường → nút Xác nhận nạp bị khóa', async () => {
    dbDanhSachThamGia.xemTruoc = {
      dong: [
        dongXemTruocMau({ so_dong: 3, trang_thai_khop: 'thieu_truong', don_vi_id: null, ten_don_vi_khop: null }),
        dongXemTruocMau({ so_dong: 4, trang_thai_khop: 'khong_khop', don_vi_id: null, ten_don_vi_khop: null }),
      ],
      tong_hop: { tong: 2, khop_ma: 0, khop_ten: 0, khong_khop: 1, thieu_truong: 1, nhieu_ket_qua: 0, loi: 0 },
    };
    const user = userEvent.setup();
    const { container } = renderTrang();
    await xemTruoc(user, container);
    expect(screen.getByText('Sẽ nạp 0 dòng cho 0 trường, bỏ qua 2 dòng.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Xác nhận nạp' })).toBeDisabled();
  }, 20000);
});

describe('QuanTriDanhSachThamGia — xác nhận nạp', () => {
  it('gửi đúng các dòng đã gắn trường (kể cả chọn tay), bỏ dòng chưa chọn và dòng bị chặn; cảnh báo thay thế; báo thành công, tải lại danh sách', async () => {
    // server.use sau chạy trước: batBodyNap (đăng ký sau) ghi body rồi nhường cho handler này.
    server.use(
      http.post('/cong-don-vi/dot-trien-khai/:id/danh-sach/nap', () => {
        dbDanhSachThamGia.danhSach = {
          tong_hop: [
            {
              don_vi_id: 'tr-1',
              ten_don_vi: 'Trường THCS Mẫu Một',
              ma_don_vi: 'TR-MAU-001',
              so_nguoi: 1,
              tong_suat: 1,
              trang_thai_danh_sach: 'cho_xac_nhan',
            },
          ],
          dong: [],
        };
        return HttpResponse.json({ so_truong: 3, so_dong: 3, tong_suat: 2.5 });
      }),
    );
    const ghi = batBodyNap();
    const user = userEvent.setup();
    const { container } = renderTrang();
    await xemTruoc(user, container);
    expect(await screen.findByText('Chưa có danh sách cho đợt này.')).toBeInTheDocument();
    await chonTruongTay(user, 5, 'Trường TH Mẫu Ba (TR-MAU-003)');
    await user.click(screen.getByRole('button', { name: 'Xác nhận nạp' }));

    const hop = await screen.findByRole('dialog', { name: 'Xác nhận nạp danh sách' });
    expect(within(hop).getByText(/Danh sách hiện có của 3 trường này trong đợt sẽ bị thay thế/)).toBeInTheDocument();
    await user.click(within(hop).getByRole('button', { name: 'Nạp' }));

    await waitFor(() => expect(ghi.body).toBeTruthy());
    expect(ghi.body).toEqual({
      dong: [
        {
          so_dong: 3,
          don_vi_id: 'tr-1',
          ho_ten: 'GV Bịa Một',
          ngay_sinh: '1990-02-01',
          gioi_tinh: 'Nam',
          ma_goc: null,
          lop: 'Lớp A',
          giai_doan: 'ca_hai',
          ty_le_suat: 1,
          ghi_chu: 'ghi chú bịa',
        },
        {
          so_dong: 4,
          don_vi_id: 'tr-2',
          ho_ten: 'GV Bịa Hai',
          ngay_sinh: null,
          gioi_tinh: null,
          ma_goc: null,
          lop: null,
          giai_doan: 'chi_gd2',
          ty_le_suat: 0.5,
          ghi_chu: null,
        },
        {
          so_dong: 5,
          don_vi_id: 'tr-3',
          ho_ten: 'GV Bịa Ba',
          ngay_sinh: null,
          gioi_tinh: null,
          ma_goc: null,
          lop: null,
          giai_doan: 'ca_hai',
          ty_le_suat: 1,
          ghi_chu: null,
        },
      ],
    });
    expect(await screen.findByText('Đã nạp 3 dòng cho 3 trường (tổng 2,5 suất)')).toBeInTheDocument();
    expect(await screen.findByRole('table', { name: 'Tổng hợp theo trường' })).toBeInTheDocument();
    expect(screen.queryByRole('table', { name: 'Xem trước danh sách' })).not.toBeInTheDocument();
  }, 30000);

  it('server từ chối khi nạp → hiện lỗi trong hộp xác nhận', async () => {
    server.use(
      http.post('/cong-don-vi/dot-trien-khai/:id/danh-sach/nap', () =>
        HttpResponse.json(
          {
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Dòng gắn đơn vị không phải trường đang hoạt động trong phạm vi Sở của đợt: 3',
            },
          },
          { status: 400 },
        ),
      ),
    );
    const user = userEvent.setup();
    const { container } = renderTrang();
    await xemTruoc(user, container);
    await user.click(screen.getByRole('button', { name: 'Xác nhận nạp' }));
    const hop = await screen.findByRole('dialog', { name: 'Xác nhận nạp danh sách' });
    await user.click(within(hop).getByRole('button', { name: 'Nạp' }));
    expect(await within(hop).findByText(/không phải trường đang hoạt động trong phạm vi Sở/)).toBeInTheDocument();
  }, 20000);
});

describe('QuanTriDanhSachThamGia — danh sách theo trường', () => {
  it('bảng tổng hợp (tên, mã, số người, tổng suất, trạng thái) và xem từng người của 1 trường (kèm ý kiến)', async () => {
    dbDanhSachThamGia.danhSach = {
      tong_hop: [
        {
          don_vi_id: 'tr-1',
          ten_don_vi: 'Trường THCS Mẫu Một',
          ma_don_vi: 'TR-MAU-001',
          so_nguoi: 2,
          tong_suat: 1.5,
          trang_thai_danh_sach: 'bao_sai_lech',
        },
        {
          don_vi_id: 'tr-2',
          ten_don_vi: 'Trường THCS&THPT Mẫu Hai',
          ma_don_vi: null,
          so_nguoi: 1,
          tong_suat: 1,
          trang_thai_danh_sach: 'da_xac_nhan',
        },
      ],
      dong: [
        {
          id: 'd1',
          don_vi_id: 'tr-1',
          ho_ten: 'GV Bịa Một',
          ngay_sinh: '1990-02-01',
          gioi_tinh: 'Nam',
          ma_goc: 'M-1',
          lop: 'Lớp A',
          giai_doan: 'ca_hai',
          ty_le_suat: 1,
          ghi_chu: 'ghi chú bịa',
          y_kien_truong: 'khong_dong_y',
          hoc_vien_id: null,
        },
        {
          id: 'd2',
          don_vi_id: 'tr-1',
          ho_ten: 'GV Bịa Hai',
          ngay_sinh: null,
          gioi_tinh: 'Nữ',
          ma_goc: null,
          lop: null,
          giai_doan: 'chi_gd1',
          ty_le_suat: 0.5,
          ghi_chu: null,
          y_kien_truong: null,
          hoc_vien_id: null,
        },
        {
          id: 'd3',
          don_vi_id: 'tr-2',
          ho_ten: 'GV Bịa Ba',
          ngay_sinh: null,
          gioi_tinh: null,
          ma_goc: null,
          lop: null,
          giai_doan: 'ca_hai',
          ty_le_suat: 1,
          ghi_chu: null,
          y_kien_truong: null,
          hoc_vien_id: null,
        },
      ],
    };
    const user = userEvent.setup();
    renderTrang();
    await chonDot(user, 'HSG – HSG An Giang 2026');
    const tongHop = await screen.findByRole('table', { name: 'Tổng hợp theo trường' });
    expect(screen.getByText('2 trường, 3 người, tổng 2,5 suất.')).toBeInTheDocument();
    const hang1 = within(tongHop).getByText('Trường THCS Mẫu Một').closest('tr') as HTMLElement;
    expect(within(hang1).getByText('TR-MAU-001')).toBeInTheDocument();
    expect(within(hang1).getByText('2')).toBeInTheDocument();
    expect(within(hang1).getByText('1,5')).toBeInTheDocument();
    expect(within(hang1).getByText('Báo sai lệch')).toBeInTheDocument();
    const hang2 = within(tongHop).getByText('Trường THCS&THPT Mẫu Hai').closest('tr') as HTMLElement;
    expect(within(hang2).getByText('Đã xác nhận')).toBeInTheDocument();
    // Issue #63: link xem hồ sơ đơn vị (chỉ đọc) của từng trường.
    expect(within(hang1).getByRole('link', { name: 'Hồ sơ đơn vị Trường THCS Mẫu Một' })).toHaveAttribute(
      'href',
      '/quan-tri/ho-so-don-vi/tr-1',
    );

    await user.click(screen.getByRole('button', { name: 'Xem danh sách Trường THCS Mẫu Một' }));
    const bang = await screen.findByRole('table', { name: 'Danh sách Trường THCS Mẫu Một' });
    expect(within(bang).getAllByRole('row')).toHaveLength(3);
    expect(within(bang).getByText('01/02/1990')).toBeInTheDocument();
    expect(within(bang).getByText('Chỉ GĐ1')).toBeInTheDocument();
    expect(within(bang).getByText('0,5')).toBeInTheDocument();
    expect(within(bang).queryByText('GV Bịa Ba')).not.toBeInTheDocument();
    const dong1 = within(bang).getByText('GV Bịa Một').closest('tr') as HTMLElement;
    expect(within(dong1).getByText('Không đồng ý')).toBeInTheDocument();
    const dong2 = within(bang).getByText('GV Bịa Hai').closest('tr') as HTMLElement;
    expect(within(dong2).getByText('Chưa có ý kiến')).toBeInTheDocument();
  }, 20000);

  it('đợt NLS: không có phần nạp Excel, có "Lấy danh sách từ khóa", vẫn xem được danh sách', async () => {
    const user = userEvent.setup();
    renderTrang();
    await chonDot(user, 'NLS – NLS đợt 1');
    expect(await screen.findByRole('heading', { name: 'Lấy danh sách từ khóa' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Nạp danh sách HSG' })).not.toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Danh sách theo trường' })).toBeInTheDocument();
  }, 20000);
});

describe('Phân quyền — Danh sách tham gia', () => {
  function renderLayout(vaiTro: string) {
    db.nguoiDung.vai_tro = vaiTro;
    datToken('token-gia-lap');
    renderVoiRouter([{ element: <CongDonViLayout />, children: [{ path: '/trang-chu', element: <div /> }] }], {
      initialEntries: ['/trang-chu'],
    });
  }

  it('menu có "Danh sách tham gia" cho quan_tri', async () => {
    renderLayout('quan_tri');
    const menu = await screen.findByRole('navigation', { name: 'Menu Cổng đơn vị' });
    await waitFor(() =>
      expect(within(menu).getByRole('link', { name: 'Danh sách tham gia' })).toHaveAttribute('href', TRANG),
    );
  });

  it('menu không có "Danh sách tham gia" cho trường', async () => {
    renderLayout('truong');
    const menu = await screen.findByRole('navigation', { name: 'Menu Cổng đơn vị' });
    await screen.findByText(String(db.hoSo.ma_dinh_danh_moet));
    expect(within(menu).queryByRole('link', { name: 'Danh sách tham gia' })).not.toBeInTheDocument();
  });

  it('trường mở /quan-tri/danh-sach-tham-gia → 404, không gọi API đợt / danh sách', async () => {
    let daGoi = false;
    const danhDau = () => {
      daGoi = true;
      return HttpResponse.json([]);
    };
    server.use(
      http.get('/cong-don-vi/dot-trien-khai', danhDau),
      http.get('/cong-don-vi/dot-trien-khai/:id/danh-sach', danhDau),
      http.get('/cong-don-vi/dot-trien-khai/:id/truong-trong-pham-vi', danhDau),
    );
    db.nguoiDung.vai_tro = 'truong';
    datToken('token-gia-lap');
    renderVoiRouter(routesCongDonVi, { initialEntries: [TRANG] });
    expect(await screen.findByText('Không tìm thấy trang')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Danh sách tham gia' })).not.toBeInTheDocument();
    expect(daGoi).toBe(false);
  });

  it('quan_tri mở /quan-tri/danh-sach-tham-gia trong khung Cổng đơn vị → thấy trang', async () => {
    db.nguoiDung.vai_tro = 'quan_tri';
    datToken('token-gia-lap');
    renderVoiRouter(routesCongDonVi, { initialEntries: [TRANG] });
    expect(await screen.findByRole('heading', { name: 'Danh sách tham gia' })).toBeInTheDocument();
  });
});
