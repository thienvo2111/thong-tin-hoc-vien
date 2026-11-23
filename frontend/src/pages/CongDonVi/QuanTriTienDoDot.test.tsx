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
import { dbTienDoDot, dongTienDoMau, dsTienDoMau } from '@/test/mocks/tienDoDot';
import { taiFileTuBlob } from '@/lib/taiFile';
import { routesCongDonVi } from '@/router';
import CongDonViLayout from './CongDonViLayout';

// Issue #65 / ADR 0015 X7, T5, P2: bảng Tiến độ đợt — số liệu, lọc, tìm, xuất Excel, liên kết, phân quyền.
// Mọi giá trị đều BỊA.
vi.mock('react-router-dom', async (goc) => ({
  ...(await goc<typeof import('react-router-dom')>()),
  createBrowserRouter: vi.fn(),
}));
vi.mock('@/lib/taiFile', () => ({ taiFileTuBlob: vi.fn() }));

beforeEach(() => vi.stubEnv('VITE_CONG_DON_VI_HOSTNAME', window.location.hostname));
afterEach(() => {
  vi.unstubAllEnvs();
  vi.mocked(taiFileTuBlob).mockClear();
});

type User = ReturnType<typeof userEvent.setup>;
const TRANG = '/quan-tri/tien-do-dot';

/** 2 đợt: dtk-1 (hạn 31/12/2026) và dtk-2 (hạn 31/01/2027 — mặc định vì hạn muộn nhất). */
function chuanBi(vaiTro = 'quan_tri') {
  db.nguoiDung.vai_tro = vaiTro;
  datToken('token-gia-lap');
  dbDotTrienKhai.ds = [
    dotMau(),
    dotMau({ id: 'dtk-2', ten: 'HSG Đợt Sau', han_nop: '2027-01-31T16:59:59.000Z', han_nop_ngay: '2027-01-31' }),
  ];
  dbTienDoDot.theoDot = { 'dtk-1': dsTienDoMau(), 'dtk-2': [dongTienDoMau()] };
}

function moTrang(duoi = '?dot=dtk-1', vaiTro = 'quan_tri') {
  chuanBi(vaiTro);
  return renderVoiRouter(routesCongDonVi, { initialEntries: [`${TRANG}${duoi}`] });
}

function batUrl(duoi: 'tien-do' | 'tien-do/xuat-excel') {
  const urls: URL[] = [];
  server.use(
    http.get(`/cong-don-vi/dot-trien-khai/:id/${duoi}`, ({ request }) => {
      urls.push(new URL(request.url));
      return undefined;
    }),
  );
  return urls;
}

const bang = () => screen.findByRole('table', { name: 'Tiến độ theo trường' });
const dongCua = (b: HTMLElement, ten: string) => within(b).getByText(ten).closest('tr') as HTMLElement;
const tenCacTruong = (b: HTMLElement) =>
  within(b)
    .getAllByRole('row')
    .slice(1)
    .map((r) => within(r).getAllByRole('cell')[0].querySelector('p')?.textContent);

async function chonLoc(user: User, nhan: string) {
  await user.click(screen.getByRole('radio', { name: nhan }));
}

describe('QuanTriTienDoDot — bảng và số liệu', () => {
  it('mỗi trường 1 dòng: số người, suất 0,5, tiền, trạng thái DS + đề nghị chờ, hồ sơ, HĐ + ngày nộp, thao tác gần nhất', async () => {
    moTrang();
    const b = await bang();
    expect(tenCacTruong(b)).toEqual([
      'Trường THCS Mẫu Một',
      'Trường THCS Mẫu Hai',
      'Trường Tiểu học Mẫu Ba',
      'Trường THPT Mẫu Bốn',
    ]);
    const mot = dongCua(b, 'Trường THCS Mẫu Một');
    expect(within(mot).getByText('TR-MAU-001 · Xã Mẫu')).toBeInTheDocument();
    expect(within(mot).getByText('3')).toBeInTheDocument();
    expect(within(mot).getByText('2,5')).toBeInTheDocument();
    expect(within(mot).getByText('3.750.000 đ')).toBeInTheDocument();
    expect(within(mot).getByText('Chờ xác nhận')).toBeInTheDocument();
    expect(within(mot).getByText('Thiếu')).toBeInTheDocument();
    expect(within(mot).getByText('Chưa nộp')).toBeInTheDocument();
    expect(within(mot).getByText('—')).toBeInTheDocument();

    const hai = dongCua(b, 'Trường THCS Mẫu Hai');
    expect(within(hai).getByText('0,5')).toBeInTheDocument();
    expect(within(hai).getByText('Báo sai lệch')).toBeInTheDocument();
    expect(within(hai).getByText('2 đề nghị chờ')).toBeInTheDocument();
    expect(within(hai).getByText('Chưa khai')).toBeInTheDocument();

    const ba = dongCua(b, 'Trường Tiểu học Mẫu Ba');
    expect(within(ba).getByText('Đủ')).toBeInTheDocument();
    expect(within(ba).getByText('18/11/2026 09:30')).toBeInTheDocument();

    const bon = dongCua(b, 'Trường THPT Mẫu Bốn');
    expect(within(bon).getByText('Đã nộp')).toBeInTheDocument();
    expect(within(bon).getByText('19/11/2026')).toBeInTheDocument();
    expect(within(bon).getByText('19/11/2026 10:04')).toBeInTheDocument();
  });

  it('thẻ tổng hợp: số trường, đã xác nhận DS, đã nộp HĐ, tổng suất 12,5, tổng giá trị', async () => {
    moTrang();
    await bang();
    const tong = screen.getByLabelText('Tổng hợp đợt');
    expect(within(tong).getByText('Số trường').nextSibling).toHaveTextContent('4');
    expect(within(tong).getByText('Đã xác nhận DS').nextSibling).toHaveTextContent('2/4');
    expect(within(tong).getByText('Đã nộp HĐ').nextSibling).toHaveTextContent('1/4');
    expect(within(tong).getByText('Tổng suất').nextSibling).toHaveTextContent('12,5');
    expect(within(tong).getByText('Tổng giá trị').nextSibling).toHaveTextContent('18.750.000 đ');
  });

  it('chưa có đơn giá → "Chưa có đơn giá" ở dòng và thẻ tổng giá trị', async () => {
    chuanBi();
    dbTienDoDot.theoDot['dtk-1'] = [dongTienDoMau({ gia_tri: null })];
    renderVoiRouter(routesCongDonVi, { initialEntries: [`${TRANG}?dot=dtk-1`] });
    const b = await bang();
    expect(within(b).getByText('Chưa có đơn giá')).toBeInTheDocument();
    expect(within(screen.getByLabelText('Tổng hợp đợt')).getByText('Chưa có đơn giá')).toBeInTheDocument();
  });

  it('liên kết mỗi dòng: Danh sách → /quan-tri/danh-sach-tham-gia?dot=…&don_vi_id=…, Hợp đồng → /quan-tri/hop-dong/:dot/:donVi', async () => {
    moTrang();
    await bang();
    expect(screen.getByRole('link', { name: 'Danh sách Trường THCS Mẫu Hai' })).toHaveAttribute(
      'href',
      '/quan-tri/danh-sach-tham-gia?dot=dtk-1&don_vi_id=tr-2',
    );
    expect(screen.getByRole('link', { name: 'Hợp đồng Trường THCS Mẫu Hai' })).toHaveAttribute(
      'href',
      '/quan-tri/hop-dong/dtk-1/tr-2',
    );
  });

  it('bấm "Danh sách" mở trang Danh sách tham gia đã chọn sẵn đợt và trường', async () => {
    const user = userEvent.setup();
    moTrang();
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
    await bang();
    await user.click(screen.getByRole('link', { name: 'Danh sách Trường THCS Mẫu Một' }));
    // Trang đích tải lười (nặng) — chạy cả bộ song song có thể quá mốc chờ mặc định của findBy.
    const choLau = { timeout: 15000 };
    expect(await screen.findByRole('heading', { name: 'Danh sách tham gia' }, choLau)).toBeInTheDocument();
    expect(await screen.findByRole('textbox', { name: 'Đợt triển khai' }, choLau)).toHaveValue(
      'HSG – HSG An Giang 2026',
    );
    expect(await screen.findByRole('table', { name: 'Danh sách Trường THCS Mẫu Một' }, choLau)).toBeInTheDocument();
  }, 20000);
});

describe('QuanTriTienDoDot — đợt, lọc, tìm', () => {
  it('không có ?dot → chọn đợt có hạn nộp muộn nhất; đổi đợt ghi ?dot và tải lại', async () => {
    const user = userEvent.setup();
    const urls = batUrl('tien-do');
    const { router } = moTrang('');
    const oDot = await screen.findByRole('textbox', { name: 'Đợt triển khai' });
    await waitFor(() => expect(oDot).toHaveValue('HSG – HSG Đợt Sau'));
    await waitFor(() => expect(urls[0]?.pathname).toBe('/cong-don-vi/dot-trien-khai/dtk-2/tien-do'));
    await user.click(oDot);
    await user.click(await screen.findByRole('option', { name: 'HSG – HSG An Giang 2026' }));
    expect(await screen.findByText('Trường THPT Mẫu Bốn')).toBeInTheDocument();
    expect(router.state.location.search).toBe('?dot=dtk-1');
    expect(urls[urls.length - 1]?.pathname).toBe('/cong-don-vi/dot-trien-khai/dtk-1/tien-do');
  });

  it('nút lọc có số lượng từ tong_hop; đổi lọc gửi loc, cập nhật bảng và ?loc', async () => {
    const user = userEvent.setup();
    const urls = batUrl('tien-do');
    const { router } = moTrang();
    await bang();
    expect(urls[0].searchParams.get('loc')).toBe('tat_ca');
    expect(screen.getByRole('radio', { name: 'Tất cả (4)' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Chưa xác nhận DS (2)' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Báo sai lệch (1)' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Chưa nộp HĐ (3)' })).toBeInTheDocument();

    await chonLoc(user, 'Báo sai lệch (1)');
    await waitFor(async () => expect(tenCacTruong(await bang())).toEqual(['Trường THCS Mẫu Hai']));
    expect(urls[urls.length - 1]?.searchParams.get('loc')).toBe('bao_sai_lech');
    expect(router.state.location.search).toBe('?dot=dtk-1&loc=bao_sai_lech');

    await chonLoc(user, 'Chưa nộp HĐ (3)');
    await waitFor(async () => expect(tenCacTruong(await bang())).toHaveLength(3));
    expect(screen.queryByText('Trường THPT Mẫu Bốn')).not.toBeInTheDocument();
  });

  it('?loc= trên URL được dùng ngay lần tải đầu; loc lạ → tat_ca', async () => {
    const urls = batUrl('tien-do');
    moTrang('?dot=dtk-1&loc=chua_xac_nhan_ds');
    const b = await bang();
    expect(urls[0].searchParams.get('loc')).toBe('chua_xac_nhan_ds');
    expect(tenCacTruong(b)).toEqual(['Trường THCS Mẫu Một', 'Trường THCS Mẫu Hai']);
    expect(screen.getByRole('radio', { name: 'Chưa xác nhận DS (2)' })).toBeChecked();
  });

  it('loc lạ trên URL → gửi tat_ca', async () => {
    const urls = batUrl('tien-do');
    moTrang('?dot=dtk-1&loc=qua-han'); // 'qua_han' hợp lệ từ issue #66
    await bang();
    expect(urls[0].searchParams.get('loc')).toBe('tat_ca');
  });

  it('tìm theo tên (không dấu) hoặc mã trường, lọc ngay trên máy (không gọi lại API)', async () => {
    const user = userEvent.setup();
    const urls = batUrl('tien-do');
    moTrang();
    await bang();
    const soLanGoi = urls.length;
    const o = screen.getByRole('textbox', { name: 'Tìm trường' });
    await user.type(o, 'tieu hoc');
    expect(tenCacTruong(await bang())).toEqual(['Trường Tiểu học Mẫu Ba']);
    await user.clear(o);
    await user.type(o, 'TR-MAU-004');
    expect(tenCacTruong(await bang())).toEqual(['Trường THPT Mẫu Bốn']);
    await user.clear(o);
    await user.type(o, 'khong co truong nay');
    expect(screen.getByText('Không có trường nào khớp tìm kiếm')).toBeInTheDocument();
    expect(urls.length).toBe(soLanGoi);
  });

  it('bộ lọc không có trường nào → "Không có trường nào ở trạng thái này"', async () => {
    const user = userEvent.setup();
    chuanBi();
    dbTienDoDot.theoDot['dtk-1'] = [dongTienDoMau({ trang_thai_danh_sach: 'da_xac_nhan' })];
    renderVoiRouter(routesCongDonVi, { initialEntries: [`${TRANG}?dot=dtk-1`] });
    await bang();
    await chonLoc(user, 'Báo sai lệch (0)');
    expect(await screen.findByText('Không có trường nào ở trạng thái này')).toBeInTheDocument();
    expect(screen.queryByRole('table', { name: 'Tiến độ theo trường' })).not.toBeInTheDocument();
  });
});

describe('QuanTriTienDoDot — xuất Excel, trạng thái tải/lỗi, màn hẹp', () => {
  it('"Xuất Excel trường chưa xong" tải file với loc đang chọn', async () => {
    const user = userEvent.setup();
    const urls = batUrl('tien-do/xuat-excel');
    moTrang('?dot=dtk-1&loc=chua_xac_nhan_ds');
    await bang();
    await user.click(screen.getByRole('button', { name: 'Xuất Excel trường chưa xong' }));
    await waitFor(() => expect(taiFileTuBlob).toHaveBeenCalledTimes(1));
    expect(urls[0].pathname).toBe('/cong-don-vi/dot-trien-khai/dtk-1/tien-do/xuat-excel');
    expect(urls[0].searchParams.get('loc')).toBe('chua_xac_nhan_ds');
    expect(vi.mocked(taiFileTuBlob).mock.calls[0][1]).toBe('tien-do-truong-chua-xong.xlsx');

    await chonLoc(user, 'Tất cả (4)');
    await user.click(screen.getByRole('button', { name: 'Xuất Excel trường chưa xong' }));
    await waitFor(() => expect(taiFileTuBlob).toHaveBeenCalledTimes(2));
    expect(urls[1].searchParams.get('loc')).toBe('tat_ca');
  });

  it('xuất lỗi → thông báo, không tải file', async () => {
    const user = userEvent.setup();
    server.use(
      http.get('/cong-don-vi/dot-trien-khai/:id/tien-do/xuat-excel', () =>
        HttpResponse.json({ error: { code: 'INTERNAL', message: 'Lỗi máy chủ bịa' } }, { status: 500 }),
      ),
    );
    moTrang();
    await bang();
    await user.click(screen.getByRole('button', { name: 'Xuất Excel trường chưa xong' }));
    expect((await screen.findAllByText('Lỗi máy chủ bịa')).length).toBeGreaterThan(0);
    expect(taiFileTuBlob).not.toHaveBeenCalled();
  });

  it('đang tải → khung chờ; lỗi → thông báo + "Thử lại" tải lại được', async () => {
    const user = userEvent.setup();
    let henLoi = true;
    server.use(
      http.get('/cong-don-vi/dot-trien-khai/:id/tien-do', () =>
        henLoi ? HttpResponse.json({ error: { code: 'INTERNAL', message: 'Lỗi bịa' } }, { status: 500 }) : undefined,
      ),
    );
    moTrang();
    expect(await screen.findByLabelText('Đang tải tiến độ')).toBeInTheDocument();
    expect(await screen.findByText('Không tải được tiến độ đợt')).toBeInTheDocument();
    expect(screen.getByText('Lỗi bịa')).toBeInTheDocument();
    henLoi = false;
    await user.click(screen.getByRole('button', { name: 'Thử lại' }));
    expect(await bang()).toBeInTheDocument();
    expect(screen.queryByText('Không tải được tiến độ đợt')).not.toBeInTheDocument();
  });

  it('màn hẹp: thẻ xếp dọc thay cho bảng rộng, vẫn đủ số liệu và liên kết', async () => {
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
      const the = await screen.findByRole('article', { name: 'Trường THCS Mẫu Hai' });
      expect(screen.queryByRole('table', { name: 'Tiến độ theo trường' })).not.toBeInTheDocument();
      expect(screen.getAllByRole('article')).toHaveLength(4);
      expect(within(the).getByText('1 người · 0,5 suất · 750.000 đ')).toBeInTheDocument();
      expect(within(the).getByText('2 đề nghị chờ')).toBeInTheDocument();
      expect(within(the).getByRole('link', { name: 'Hợp đồng Trường THCS Mẫu Hai' })).toHaveAttribute(
        'href',
        '/quan-tri/hop-dong/dtk-1/tr-2',
      );
    } finally {
      window.matchMedia = goc;
    }
  });
});

describe('Phân quyền — Tiến độ đợt', () => {
  function renderLayout(vaiTro: string) {
    db.nguoiDung.vai_tro = vaiTro;
    datToken('token-gia-lap');
    renderVoiRouter([{ element: <CongDonViLayout />, children: [{ path: '/trang-chu', element: <div /> }] }], {
      initialEntries: ['/trang-chu'],
    });
  }

  it('menu quan_tri: "Tiến độ đợt" là mục quản trị đầu tiên', async () => {
    renderLayout('quan_tri');
    const menu = await screen.findByRole('navigation', { name: 'Menu Cổng đơn vị' });
    await waitFor(() => expect(within(menu).getByRole('link', { name: 'Tiến độ đợt' })).toHaveAttribute('href', TRANG));
    expect(
      within(menu)
        .getAllByRole('link')
        .map((a) => a.textContent),
    ).toEqual([
      'Trang chủ',
      'Hướng dẫn',
      'Tiến độ đợt',
      'Chương trình / Đợt',
      'Đơn vị & tài khoản',
      'Danh sách tham gia',
      'Hợp đồng',
    ]);
  });

  it('menu trường không có "Tiến độ đợt"', async () => {
    renderLayout('truong');
    const menu = await screen.findByRole('navigation', { name: 'Menu Cổng đơn vị' });
    await screen.findByText(String(db.hoSo.ma_dinh_danh_moet));
    expect(within(menu).queryByRole('link', { name: 'Tiến độ đợt' })).not.toBeInTheDocument();
  });

  it.each(['truong', 'so_gddt'])('%s mở /quan-tri/tien-do-dot → 404, không gọi API', async (vaiTro) => {
    let daGoi = false;
    const danhDau = () => {
      daGoi = true;
      return HttpResponse.json([]);
    };
    server.use(
      http.get('/cong-don-vi/dot-trien-khai', danhDau),
      http.get('/cong-don-vi/dot-trien-khai/:id/tien-do', danhDau),
    );
    moTrang('?dot=dtk-1', vaiTro);
    expect(await screen.findByText('Không tìm thấy trang')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Tiến độ đợt' })).not.toBeInTheDocument();
    expect(daGoi).toBe(false);
  });

  it('quan_tri mở /quan-tri/tien-do-dot trong khung Cổng đơn vị → thấy trang', async () => {
    moTrang();
    expect(await screen.findByRole('heading', { name: 'Tiến độ đợt' })).toBeInTheDocument();
  });
});

async function goNgay(user: User, nhan: RegExp, giaTri: string) {
  const o = screen.getByLabelText(nhan);
  await user.clear(o);
  await user.type(o, giaTri);
  await user.tab(); // blur đóng lịch; Escape sẽ đóng cả Modal
}

// Issue #66 / ADR 0015 T2, T3: cột Hạn, lọc Quá hạn, Gia hạn riêng 1 trường (lý do bắt buộc). Mọi giá trị đều BỊA.
describe('QuanTriTienDoDot — hạn nộp (issue #66)', () => {
  /** Một: hạn riêng 20/12; Hai: quá hạn (hạn đợt 20/11 đã qua, chưa nộp); Ba, Bốn: theo đợt. */
  function chuanBiHan() {
    const ds = dsTienDoMau();
    Object.assign(ds[0], {
      han_rieng: '2026-12-20T16:59:59.000Z',
      han_hieu_luc: '2026-12-20T16:59:59.000Z',
      han_hieu_luc_ngay: '2026-12-20',
    });
    Object.assign(ds[1], {
      han_hieu_luc: '2026-11-20T16:59:59.000Z',
      han_hieu_luc_ngay: '2026-11-20',
      qua_han: true,
    });
    return ds;
  }

  function moTrangHan() {
    chuanBi();
    dbTienDoDot.theoDot['dtk-1'] = chuanBiHan();
    return renderVoiRouter(routesCongDonVi, { initialEntries: [`${TRANG}?dot=dtk-1`] });
  }

  const giaHanCua = (ten: string) => screen.getByRole('button', { name: `Gia hạn riêng ${ten}` });
  // Hộp thoại tải lười (lần đầu biên dịch @mantine/dates chậm) → chờ lâu hơn mặc định.
  const hop = () => screen.findByRole('dialog', { name: 'Gia hạn riêng' }, { timeout: 10000 });

  it('cột Hạn: dd/mm/yyyy, badge "Hạn riêng" / đỏ "Quá hạn"; chip "Quá hạn (1)" gửi loc=qua_han', async () => {
    const urls = batUrl('tien-do');
    moTrangHan();
    const b = await bang();
    expect(within(b).getByRole('columnheader', { name: 'Hạn' })).toBeInTheDocument();
    const mot = dongCua(b, 'Trường THCS Mẫu Một');
    expect(within(mot).getByText('20/12/2026')).toBeInTheDocument();
    expect(within(mot).getByText('Hạn riêng')).toBeInTheDocument();
    expect(within(mot).queryByText('Quá hạn')).not.toBeInTheDocument();
    const hai = dongCua(b, 'Trường THCS Mẫu Hai');
    expect(within(hai).getByText('20/11/2026')).toBeInTheDocument();
    expect(within(hai).getByText('Quá hạn')).toBeInTheDocument();
    expect(within(dongCua(b, 'Trường THPT Mẫu Bốn')).getByText('31/12/2026')).toBeInTheDocument();

    const user = userEvent.setup();
    await chonLoc(user, 'Quá hạn (1)');
    await waitFor(() => expect(urls[urls.length - 1]?.searchParams.get('loc')).toBe('qua_han'));
    await waitFor(async () => expect(tenCacTruong(await bang())).toEqual(['Trường THCS Mẫu Hai']));
    expect(screen.getByRole('radio', { name: 'Quá hạn (1)' })).toBeChecked();
  });

  it('Gia hạn riêng: thiếu lý do → báo lỗi, KHÔNG gửi; đủ → PUT {han_rieng: YYYY-MM-DD, ly_do}, thông báo, tải lại', async () => {
    const urls = batUrl('tien-do');
    moTrangHan();
    await bang();
    const user = userEvent.setup();
    await user.click(giaHanCua('Trường THCS Mẫu Hai'));
    const h = await hop();
    expect(within(h).getByText('Hạn hiện tại: 20/11/2026 (theo đợt)')).toBeInTheDocument();
    expect(within(h).queryByLabelText(/Bỏ hạn riêng/)).not.toBeInTheDocument();
    await goNgay(user, /Hạn riêng đến hết ngày/, '28/12/2026');
    await user.click(within(h).getByRole('button', { name: 'Lưu' }));
    expect(await within(h).findByText('Nhập lý do gia hạn')).toBeInTheDocument();
    expect(dbTienDoDot.hanRiengDaGui).toEqual([]);

    const soLanTai = urls.length;
    await user.type(within(h).getByLabelText(/Lý do/), '  Trường xin thêm thời gian (bịa) ');
    await user.click(within(h).getByRole('button', { name: 'Lưu' }));
    await waitFor(() =>
      expect(dbTienDoDot.hanRiengDaGui).toEqual([
        {
          dotId: 'dtk-1',
          donViId: 'tr-2',
          body: { han_rieng: '2026-12-28', ly_do: 'Trường xin thêm thời gian (bịa)' },
        },
      ]),
    );
    expect((await screen.findAllByText('Đã gia hạn riêng Trường THCS Mẫu Hai đến 28/12/2026')).length).toBeGreaterThan(
      0,
    );
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Gia hạn riêng' })).not.toBeInTheDocument());
    await waitFor(() => expect(urls.length).toBeGreaterThan(soLanTai));
    await waitFor(async () => {
      const hai = dongCua(await bang(), 'Trường THCS Mẫu Hai');
      expect(within(hai).getByText('28/12/2026')).toBeInTheDocument();
      expect(within(hai).getByText('Hạn riêng')).toBeInTheDocument();
    });
  });

  it('"Bỏ hạn riêng" (khi đang có) → gửi han_rieng null, không cần chọn ngày', async () => {
    moTrangHan();
    await bang();
    const user = userEvent.setup();
    await user.click(giaHanCua('Trường THCS Mẫu Một'));
    const h = await hop();
    expect(within(h).getByText('Hạn hiện tại: 20/12/2026 (hạn riêng)')).toBeInTheDocument();
    await user.click(within(h).getByLabelText(/Bỏ hạn riêng/));
    expect(within(h).queryByLabelText(/Hạn riêng đến hết ngày/)).not.toBeInTheDocument();
    await user.type(within(h).getByLabelText(/Lý do/), 'Trường đã xong việc (bịa)');
    await user.click(within(h).getByRole('button', { name: 'Lưu' }));
    await waitFor(() =>
      expect(dbTienDoDot.hanRiengDaGui.map((g) => g.body)).toEqual([
        { han_rieng: null, ly_do: 'Trường đã xong việc (bịa)' },
      ]),
    );
    expect((await screen.findAllByText('Đã bỏ hạn riêng của Trường THCS Mẫu Một')).length).toBeGreaterThan(0);
  });

  it('server 400 field han_rieng / ly_do → gắn vào đúng ô, hộp thoại vẫn mở', async () => {
    server.use(
      http.put('/cong-don-vi/dot-trien-khai/:dotId/hop-dong/:donViId/han-rieng', () =>
        HttpResponse.json(
          {
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Hạn riêng phải từ hôm nay trở đi',
              fields: [
                { field: 'han_rieng', message: 'Hạn riêng phải từ hôm nay trở đi' },
                { field: 'ly_do', message: 'Nhập lý do (tối đa 500 ký tự)' },
              ],
            },
          },
          { status: 400 },
        ),
      ),
    );
    moTrangHan();
    await bang();
    const user = userEvent.setup();
    await user.click(giaHanCua('Trường THCS Mẫu Hai'));
    const h = await hop();
    await goNgay(user, /Hạn riêng đến hết ngày/, '28/12/2026');
    await user.type(within(h).getByLabelText(/Lý do/), 'Bịa');
    await user.click(within(h).getByRole('button', { name: 'Lưu' }));
    expect(await within(h).findByText('Hạn riêng phải từ hôm nay trở đi')).toBeInTheDocument();
    expect(within(h).getByText('Nhập lý do (tối đa 500 ký tự)')).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Gia hạn riêng' })).toBeInTheDocument();
  });

  it('màn hẹp: thẻ trường có Hạn + "Quá hạn" + nút Gia hạn riêng', async () => {
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
      moTrangHan();
      const the = await screen.findByRole('article', { name: 'Trường THCS Mẫu Hai' });
      expect(within(the).getByText('20/11/2026')).toBeInTheDocument();
      expect(within(the).getByText('Quá hạn')).toBeInTheDocument();
      expect(within(the).getByRole('button', { name: 'Gia hạn riêng Trường THCS Mẫu Hai' })).toBeInTheDocument();
    } finally {
      window.matchMedia = goc;
    }
  });
});
