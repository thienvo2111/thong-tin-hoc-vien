import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { renderVoiRouter } from '@/test/testUtils';
import { datToken } from '@/auth/tokenStore';
import { db } from '@/test/mocks/db';
import { server } from '@/test/mocks/server';
import { dbHopDong, hopDongQuanTriMau, lyDo } from '@/test/mocks/hopDong';
import { hoSoMau } from '@/test/mocks/hoSoDonVi';
import { dbDotTrienKhai, dotMau } from '@/test/mocks/dotTrienKhai';
import { dbDanhSachThamGia, dongXemTruocMau, xemTruocMau } from '@/test/mocks/danhSachThamGia';
import type { DongDanhSach } from '@/api/danhSachThamGia';
import { routesCongDonVi } from '@/router';
import QuanTriDanhSachThamGia from './QuanTriDanhSachThamGia';

// Issue #64 / ADR 0015 O3, O4, X5: Quản trị xem hợp đồng 1 trường + Mở lại; danh sách theo trường khóa sửa
// với trường đã nộp; xem trước nạp cảnh báo trường đã nộp. Mọi giá trị đều BỊA.
vi.mock('react-router-dom', async (goc) => ({
  ...(await goc<typeof import('react-router-dom')>()),
  createBrowserRouter: vi.fn(),
}));

beforeEach(() => vi.stubEnv('VITE_CONG_DON_VI_HOSTNAME', window.location.hostname));
afterEach(() => vi.unstubAllEnvs());

type User = ReturnType<typeof userEvent.setup>;
const URL_MO_LAI = '/cong-don-vi/dot-trien-khai/:dotId/hop-dong/:donViId/mo-lai';

function dangNhap(vaiTro: string) {
  db.nguoiDung.vai_tro = vaiTro;
  datToken('token-gia-lap');
}

function moHopDong(hd = hopDongQuanTriMau()) {
  dbHopDong.quanTri['dtk-1/tr-1'] = hd;
  dangNhap('quan_tri');
  renderVoiRouter(routesCongDonVi, { initialEntries: ['/quan-tri/hop-dong/dtk-1/tr-1'] });
  return screen.findByRole('heading', { name: 'Hợp đồng — Trường THCS Mẫu Một' });
}

describe('Quản trị xem hợp đồng (/quan-tri/hop-dong/:dotId/:donViId)', () => {
  it('đã nộp: thời điểm + người nộp, Phần 3, bản chụp hồ sơ chỉ đọc; STK cá nhân che, "Hiện" mới thấy đủ', async () => {
    await moHopDong();
    const tt = screen.getByRole('status', { name: 'Trạng thái hợp đồng' });
    expect(within(tt).getByText('Hợp đồng: Đã nộp')).toBeInTheDocument();
    expect(
      within(tt).getByText(/Nộp lúc 20\/11\/2026 10:04 bởi Tài Khoản Trường Bịa \(truong-bia@mau\.test\)/),
    ).toBeInTheDocument();
    expect(screen.getByText('Người Nhận Bịa')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Hồ sơ đơn vị (bản chụp lúc nộp)' })).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    // STK Phần 2 của trường không che; STK cá nhân (Phần 5) che còn 4 số cuối.
    expect(screen.getByText('0000111122223333')).toBeInTheDocument();
    expect(screen.getByText('••••••••6666')).toBeInTheDocument();
    expect(screen.queryByText('9999888877776666')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Hiện STK Hiệu trưởng' }));
    expect(screen.getByText('9999888877776666')).toBeInTheDocument();
    expect(screen.queryByText('5555444433332222')).not.toBeInTheDocument();
  });

  it('chưa nộp: hồ sơ hiện tại + lý do chặn, không có nút Mở lại', async () => {
    await moHopDong(
      hopDongQuanTriMau({
        trang_thai_hop_dong: 'chua_nop',
        nop_luc: null,
        nop_boi: null,
        ban_chup_ho_so: null,
        ho_so_hien_tai: hoSoMau(),
        ly_do_chan: lyDo('danh_sach_chua_xac_nhan'),
      }),
    );
    expect(screen.getByRole('heading', { name: 'Hồ sơ đơn vị hiện tại' })).toBeInTheDocument();
    expect(screen.getByText('Danh sách chưa được xác nhận')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Mở lại hợp đồng' })).not.toBeInTheDocument();
  });

  it('Mở lại: lý do trống → báo lỗi, KHÔNG gửi; có lý do → POST { ly_do } → Chưa nộp + thông báo', async () => {
    const gui: unknown[] = [];
    server.use(
      http.post(URL_MO_LAI, async ({ request }) => {
        gui.push(await request.clone().json());
        return undefined;
      }),
    );
    const user = userEvent.setup();
    await moHopDong();
    await user.click(screen.getByRole('button', { name: 'Mở lại hợp đồng' }));
    const hop = await screen.findByRole('dialog', { name: 'Mở lại hợp đồng' });
    await user.type(within(hop).getByLabelText(/^Lý do mở lại/), '   ');
    await user.click(within(hop).getByRole('button', { name: 'Mở lại' }));
    expect(await within(hop).findByText('Nhập lý do mở lại')).toBeInTheDocument();
    expect(gui).toEqual([]);

    await user.clear(within(hop).getByLabelText(/^Lý do mở lại/));
    await user.type(within(hop).getByLabelText(/^Lý do mở lại/), ' Trường cần sửa danh sách ');
    await user.click(within(hop).getByRole('button', { name: 'Mở lại' }));
    await waitFor(() => expect(gui).toEqual([{ ly_do: 'Trường cần sửa danh sách' }]));
    expect((await screen.findAllByText('Đã mở lại hợp đồng của Trường THCS Mẫu Một'))[0]).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('Hợp đồng: Chưa nộp')).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: 'Mở lại hợp đồng' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Hồ sơ đơn vị hiện tại' })).toBeInTheDocument();
  });

  it('trường không có hợp đồng trong đợt → báo không có', async () => {
    dangNhap('quan_tri');
    renderVoiRouter(routesCongDonVi, { initialEntries: ['/quan-tri/hop-dong/dtk-1/tr-khac'] });
    expect(await screen.findByText('Trường không có hợp đồng trong đợt này')).toBeInTheDocument();
  });

  it('vai trò trường → không mount trang (404 của cổng), không gọi API hợp đồng Quản trị', async () => {
    const daGoi: string[] = [];
    const nghe = ({ request }: { request: Request }) => {
      if (new URL(request.url).pathname.includes('/hop-dong/')) daGoi.push(request.url);
    };
    server.events.on('request:start', nghe);
    dangNhap('truong');
    renderVoiRouter(routesCongDonVi, { initialEntries: ['/quan-tri/hop-dong/dtk-1/tr-1'] });
    await waitFor(() => expect(screen.queryByRole('heading', { name: /^Hợp đồng/ })).not.toBeInTheDocument());
    expect(daGoi).toEqual([]);
    server.events.removeListener('request:start', nghe);
  });
});

// Dữ liệu bịa.
function dongMau(p: Partial<DongDanhSach> = {}): DongDanhSach {
  return {
    id: 'd1',
    don_vi_id: 'tr-1',
    ho_ten: 'GV Bịa Một',
    ngay_sinh: null,
    gioi_tinh: null,
    ma_goc: null,
    lop: null,
    giai_doan: 'ca_hai',
    ty_le_suat: 1,
    ghi_chu: null,
    y_kien_truong: 'dong_y',
    hoc_vien_id: null,
    ...p,
  };
}

function moDanhSachQuanTri() {
  dangNhap('quan_tri');
  dbDotTrienKhai.ds = [dotMau()];
  dbDanhSachThamGia.danhSach = {
    tong_hop: [
      {
        don_vi_id: 'tr-1',
        ten_don_vi: 'Trường THCS Mẫu Một',
        ma_don_vi: 'TR-MAU-001',
        so_nguoi: 1,
        tong_suat: 1,
        trang_thai_danh_sach: 'da_xac_nhan',
        trang_thai_hop_dong: 'da_nop',
      },
      {
        don_vi_id: 'tr-2',
        ten_don_vi: 'Trường THCS&THPT Mẫu Hai',
        ma_don_vi: null,
        so_nguoi: 1,
        tong_suat: 1,
        trang_thai_danh_sach: 'cho_xac_nhan',
        trang_thai_hop_dong: 'chua_nop',
      },
    ],
    dong: [dongMau(), dongMau({ id: 'd2', don_vi_id: 'tr-2', ho_ten: 'GV Bịa Hai' })],
  };
  const TRANG = '/quan-tri/danh-sach-tham-gia';
  return renderVoiRouter([{ path: TRANG, element: <QuanTriDanhSachThamGia /> }], { initialEntries: [TRANG] });
}

async function chonDot(user: User) {
  await user.click(await screen.findByRole('textbox', { name: 'Đợt triển khai' }));
  await user.click(await screen.findByRole('option', { name: 'HSG – HSG An Giang 2026' }));
}

describe('Danh sách theo trường — trường đã nộp hợp đồng (X5)', () => {
  it('chip hợp đồng + link "Hợp đồng" từng trường', async () => {
    const user = userEvent.setup();
    moDanhSachQuanTri();
    await chonDot(user);
    const bang = await screen.findByRole('table', { name: 'Tổng hợp theo trường' });
    expect(within(bang).getByText('HĐ: Đã nộp')).toBeInTheDocument();
    expect(within(bang).getByText('HĐ: Chưa nộp')).toBeInTheDocument();
    expect(within(bang).getByRole('link', { name: 'Hợp đồng Trường THCS Mẫu Một' })).toHaveAttribute(
      'href',
      '/quan-tri/hop-dong/dtk-1/tr-1',
    );
  });

  it('trường đã nộp → Sửa / Xóa / Thêm người tắt kèm ghi chú; trường chưa nộp vẫn bật', async () => {
    const user = userEvent.setup();
    moDanhSachQuanTri();
    await chonDot(user);
    await user.click(await screen.findByRole('button', { name: 'Xem danh sách Trường THCS Mẫu Một' }));
    await screen.findByRole('table', { name: 'Danh sách Trường THCS Mẫu Một' });
    expect(screen.getByText('Đã nộp hợp đồng — mở lại để sửa')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sửa GV Bịa Một' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Xóa GV Bịa Một' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Thêm người vào Trường THCS Mẫu Một' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Xem danh sách Trường THCS&THPT Mẫu Hai' }));
    await screen.findByRole('table', { name: 'Danh sách Trường THCS&THPT Mẫu Hai' });
    expect(screen.queryByText('Đã nộp hợp đồng — mở lại để sửa')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sửa GV Bịa Hai' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Thêm người vào Trường THCS&THPT Mẫu Hai' })).toBeEnabled();
  });

  it('xem trước nạp có dòng của trường đã nộp → cảnh báo + nhãn "Đã nộp HĐ" ở dòng đó', async () => {
    const goc = xemTruocMau();
    dbDanhSachThamGia.xemTruoc = {
      ...goc,
      dong: goc.dong.map((d) => (d.don_vi_id === 'tr-1' ? dongXemTruocMau({ ...d, da_nop: true }) : d)),
      truong_da_nop: [{ don_vi_id: 'tr-1', ten_don_vi: 'Trường THCS Mẫu Một' }],
    };
    const user = userEvent.setup();
    const { container } = moDanhSachQuanTri();
    await chonDot(user);
    await screen.findByRole('heading', { name: 'Nạp danh sách HSG' });
    await user.upload(container.querySelector('input[type="file"]') as HTMLInputElement, new File(['x'], 'ds.xlsx'));
    await user.click(screen.getByRole('button', { name: 'Xem trước' }));
    const bang = await screen.findByRole('table', { name: 'Xem trước danh sách' });
    expect(within(bang).getAllByText('Đã nộp HĐ').length).toBeGreaterThan(0);
    expect(screen.getByText('Có trường đã nộp hợp đồng')).toBeInTheDocument();
    expect(screen.getByText(/Trường THCS Mẫu Một đã nộp hợp đồng — nạp sẽ bị từ chối/)).toBeInTheDocument();
  });
});

// Issue #66 / ADR 0015 T1, T3: Quản trị thấy hạn hiệu lực (chỉ xem) của trường.
describe('Quản trị xem hợp đồng — hạn hiệu lực (issue #66)', () => {
  it('không hạn riêng → "Hạn hiệu lực: dd/mm/yyyy (theo hạn đợt)"', async () => {
    await moHopDong();
    const tt = screen.getByRole('status', { name: 'Trạng thái hợp đồng' });
    expect(within(tt).getByText('Hạn hiệu lực: 31/12/2026 (theo hạn đợt)')).toBeInTheDocument();
  });

  it('có hạn riêng, chưa nộp, đã hết hạn → kèm hạn đợt và "đã hết hạn"', async () => {
    await moHopDong(
      hopDongQuanTriMau({
        trang_thai_hop_dong: 'chua_nop',
        nop_luc: null,
        nop_boi: null,
        ban_chup_ho_so: null,
        ho_so_hien_tai: hoSoMau(),
        ly_do_chan: lyDo('da_het_han'),
        co_the_nop: false,
        han_rieng: '2026-12-05T16:59:59.000Z',
        han_hieu_luc: '2026-12-05T16:59:59.000Z',
        han_hieu_luc_ngay: '2026-12-05',
        da_het_han: true,
      }),
    );
    const tt = screen.getByRole('status', { name: 'Trạng thái hợp đồng' });
    expect(
      within(tt).getByText('Hạn hiệu lực: 05/12/2026 (hạn riêng; hạn đợt 31/12/2026) — đã hết hạn'),
    ).toBeInTheDocument();
    expect(within(tt).getByText('Đã hết hạn ngày 05/12/2026 — liên hệ HCMUE để được gia hạn')).toBeInTheDocument();
  });
});
