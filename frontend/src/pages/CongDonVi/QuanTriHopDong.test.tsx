import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { notifications } from '@mantine/notifications';
import { renderVoiRouter } from '@/test/testUtils';
import { datToken } from '@/auth/tokenStore';
import { db } from '@/test/mocks/db';
import { server } from '@/test/mocks/server';
import { dbDotTrienKhai, dotMau } from '@/test/mocks/dotTrienKhai';
import { STK_HT_MAU, STK_KT_MAU, dbHopDong, dongHopDongQuanTriMau, dsHopDongMau } from '@/test/mocks/hopDong';
import { taiFileTuBlob } from '@/lib/taiFile';
import { routesCongDonVi } from '@/router';
import CongDonViLayout from './CongDonViLayout';
import { CHUA_CO_HOP_DONG_NOP, DA_XUAT_KHTC } from './QuanTriHopDong';

// Issue #67 / ADR 0015 O1, O2, O4, P2: danh sách hợp đồng của đợt (STK che) + xuất Excel cho KHTC, phân quyền.
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
  // Kho thông báo của Mantine sống qua các test — dọn để test sau không thấy thông báo cũ.
  act(() => notifications.clean());
});

const TRANG = '/quan-tri/hop-dong';
// Trang tải lười (lazy route) — chờ lâu hơn mặc định khi chạy song song cả bộ.
const choLau = { timeout: 5000 };

/** 2 đợt: dtk-1 (hạn 31/12/2026) và dtk-2 (hạn 31/01/2027 — mặc định vì hạn muộn nhất). */
function chuanBi(vaiTro = 'quan_tri') {
  db.nguoiDung.vai_tro = vaiTro;
  datToken('token-gia-lap');
  dbDotTrienKhai.ds = [
    dotMau(),
    dotMau({ id: 'dtk-2', ten: 'HSG Đợt Sau', han_nop: '2027-01-31T16:59:59.000Z', han_nop_ngay: '2027-01-31' }),
  ];
  dbHopDong.danhSach = {
    'dtk-1': dsHopDongMau(),
    'dtk-2': [dongHopDongQuanTriMau({ trang_thai_hop_dong: 'chua_nop' })],
  };
}

function moTrang(duoi = '?dot=dtk-1', vaiTro = 'quan_tri') {
  chuanBi(vaiTro);
  return renderVoiRouter(routesCongDonVi, { initialEntries: [`${TRANG}${duoi}`] });
}

function batUrl(duoi: '' | '/xuat-khtc') {
  const urls: URL[] = [];
  server.use(
    http.get(`/cong-don-vi/dot-trien-khai/:id/hop-dong${duoi}`, ({ request }) => {
      urls.push(new URL(request.url));
      return undefined;
    }),
  );
  return urls;
}

const bang = () => screen.findByRole('table', { name: 'Hợp đồng theo trường' }, choLau);
const dongCua = (b: HTMLElement, ten: string) => within(b).getByText(ten).closest('tr') as HTMLElement;
const nutXuat = () => screen.getByRole('button', { name: 'Xuất Excel cho KHTC' });

describe('QuanTriHopDong — danh sách', () => {
  it('mỗi trường 1 dòng: trạng thái DS, HĐ + ngày nộp, số người, suất, giá trị, HT/KT với STK đã che', async () => {
    moTrang();
    const b = await bang();
    expect(within(b).getAllByRole('row')).toHaveLength(4);

    const mot = dongCua(b, 'Trường THCS Mẫu Một');
    expect(within(mot).getByText('TR-MAU-001')).toBeInTheDocument();
    expect(within(mot).getByText('Đã xác nhận')).toBeInTheDocument();
    expect(within(mot).getByText('Đã nộp')).toBeInTheDocument();
    expect(within(mot).getByText('20/11/2026')).toBeInTheDocument();
    expect(within(mot).getByText('3')).toBeInTheDocument();
    expect(within(mot).getByText('2,5')).toBeInTheDocument();
    expect(within(mot).getByText('3.750.000 đ')).toBeInTheDocument();
    expect(within(mot).getByText('Hiệu Trưởng Bịa Một')).toBeInTheDocument();
    expect(within(mot).getByText('STK ••••••••6666')).toBeInTheDocument();
    expect(within(mot).getByText('Kế Toán Bịa Một')).toBeInTheDocument();
    expect(within(mot).getByText('STK ••••••••2222')).toBeInTheDocument();

    const hai = dongCua(b, 'Trường THCS Mẫu Hai');
    expect(within(hai).getByText('Báo sai lệch')).toBeInTheDocument();
    expect(within(hai).getByText('Chưa nộp')).toBeInTheDocument();
    expect(within(hai).getByText('Quá hạn')).toBeInTheDocument();
    expect(within(hai).getByText('0,5')).toBeInTheDocument();

    const ba = dongCua(b, 'Trường Tiểu học Mẫu Ba');
    expect(within(ba).getByText('Chờ xác nhận')).toBeInTheDocument();
    expect(within(ba).getByText('Chưa có đơn giá')).toBeInTheDocument();
    expect(within(ba).getAllByText('—')).toHaveLength(2);
  });

  it('STK đầy đủ (bịa) KHÔNG bao giờ xuất hiện trong DOM — chỉ 4 số cuối', async () => {
    moTrang();
    await bang();
    const html = document.body.innerHTML;
    for (const stk of [STK_HT_MAU, STK_KT_MAU, '1111222233334444', '6666777788889999']) {
      expect(html).not.toContain(stk);
      expect(html).toContain(stk.slice(-4));
    }
  });

  it('đếm "1/3 hợp đồng đã nộp"; "Chi tiết" → /quan-tri/hop-dong/:dot/:donVi', async () => {
    moTrang();
    await bang();
    expect(screen.getByText('1/3 hợp đồng đã nộp')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Chi tiết hợp đồng Trường THCS Mẫu Hai' })).toHaveAttribute(
      'href',
      '/quan-tri/hop-dong/dtk-1/tr-2',
    );
  });

  it('không có ?dot → chọn đợt hạn nộp muộn nhất; đổi đợt ghi ?dot và tải lại', async () => {
    const user = userEvent.setup();
    const urls = batUrl('');
    const { router } = moTrang('');
    await bang();
    expect(urls[0].pathname).toBe('/cong-don-vi/dot-trien-khai/dtk-2/hop-dong');
    expect(screen.getByText('0/1 hợp đồng đã nộp')).toBeInTheDocument();
    await user.click(screen.getByRole('textbox', { name: 'Đợt triển khai' }));
    await user.click(await screen.findByRole('option', { name: 'HSG – HSG An Giang 2026' }));
    expect(await screen.findByText('1/3 hợp đồng đã nộp')).toBeInTheDocument();
    expect(router.state.location.search).toBe('?dot=dtk-1');
    expect(urls[urls.length - 1]?.pathname).toBe('/cong-don-vi/dot-trien-khai/dtk-1/hop-dong');
  });

  it('đợt chưa có trường nào → thông báo trống; chưa có đợt nào → "Chưa có đợt triển khai nào."', async () => {
    chuanBi();
    dbHopDong.danhSach['dtk-1'] = [];
    renderVoiRouter(routesCongDonVi, { initialEntries: [`${TRANG}?dot=dtk-1`] });
    expect(await screen.findByText('Đợt này chưa có trường nào.', undefined, choLau)).toBeInTheDocument();
  });

  it('chưa có đợt nào → "Chưa có đợt triển khai nào.", không gọi API danh sách hợp đồng', async () => {
    const urls = batUrl('');
    chuanBi();
    dbDotTrienKhai.ds = [];
    renderVoiRouter(routesCongDonVi, { initialEntries: [TRANG] });
    expect(await screen.findByText('Chưa có đợt triển khai nào.', undefined, choLau)).toBeInTheDocument();
    expect(urls).toHaveLength(0);
  });

  it('đang tải → khung chờ; lỗi → thông báo + "Thử lại" tải lại được', async () => {
    const user = userEvent.setup();
    let henLoi = true;
    server.use(
      http.get('/cong-don-vi/dot-trien-khai/:id/hop-dong', () =>
        henLoi ? HttpResponse.json({ error: { code: 'INTERNAL', message: 'Lỗi bịa' } }, { status: 500 }) : undefined,
      ),
    );
    moTrang();
    expect(await screen.findByLabelText('Đang tải hợp đồng', undefined, choLau)).toBeInTheDocument();
    expect(await screen.findByText('Không tải được danh sách hợp đồng')).toBeInTheDocument();
    expect(screen.getByText('Lỗi bịa')).toBeInTheDocument();
    henLoi = false;
    await user.click(screen.getByRole('button', { name: 'Thử lại' }));
    expect(await bang()).toBeInTheDocument();
    expect(screen.queryByText('Không tải được danh sách hợp đồng')).not.toBeInTheDocument();
  });

  it('màn hẹp: thẻ xếp dọc thay cho bảng, vẫn có STK đã che và liên kết Chi tiết', async () => {
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
      const the = await screen.findByRole('article', { name: 'Trường THCS Mẫu Một' }, choLau);
      expect(screen.queryByRole('table', { name: 'Hợp đồng theo trường' })).not.toBeInTheDocument();
      expect(screen.getAllByRole('article')).toHaveLength(3);
      expect(within(the).getByText('3 người · 2,5 suất · 3.750.000 đ')).toBeInTheDocument();
      expect(within(the).getByText('STK ••••••••6666')).toBeInTheDocument();
      expect(within(the).getByRole('link', { name: 'Chi tiết hợp đồng Trường THCS Mẫu Một' })).toHaveAttribute(
        'href',
        '/quan-tri/hop-dong/dtk-1/tr-1',
      );
      expect(document.body.innerHTML).not.toContain(STK_HT_MAU);
    } finally {
      window.matchMedia = goc;
    }
  });
});

describe('QuanTriHopDong — xuất Excel cho KHTC', () => {
  it('gọi đúng URL xuat-khtc của đợt đang chọn, tải file, báo "file chứa STK cá nhân"', async () => {
    const user = userEvent.setup();
    const urls = batUrl('/xuat-khtc');
    moTrang();
    await bang();
    await user.click(nutXuat());
    await waitFor(() => expect(taiFileTuBlob).toHaveBeenCalledTimes(1));
    expect(urls).toHaveLength(1);
    expect(urls[0].pathname).toBe('/cong-don-vi/dot-trien-khai/dtk-1/hop-dong/xuat-khtc');
    expect(vi.mocked(taiFileTuBlob).mock.calls[0][1]).toBe('khtc-hop-dong.xlsx');
    expect((await screen.findAllByText(DA_XUAT_KHTC)).length).toBeGreaterThan(0);
  });

  it('chưa có hợp đồng nào đã nộp → nút bị khóa kèm gợi ý, không gọi API xuất', async () => {
    const urls = batUrl('/xuat-khtc');
    moTrang('?dot=dtk-2');
    await bang();
    expect(nutXuat()).toBeDisabled();
    expect(screen.getByText(CHUA_CO_HOP_DONG_NOP)).toBeInTheDocument();
    expect(urls).toHaveLength(0);
  });

  it('có hợp đồng đã nộp → không hiện gợi ý khóa', async () => {
    moTrang();
    await bang();
    expect(nutXuat()).toBeEnabled();
    expect(screen.queryByText(CHUA_CO_HOP_DONG_NOP)).not.toBeInTheDocument();
  });

  it('xuất lỗi → thông báo lỗi, không tải file, không báo đã xuất', async () => {
    const user = userEvent.setup();
    server.use(
      http.get('/cong-don-vi/dot-trien-khai/:id/hop-dong/xuat-khtc', () =>
        HttpResponse.json({ error: { code: 'INTERNAL', message: 'Lỗi máy chủ bịa' } }, { status: 500 }),
      ),
    );
    moTrang();
    await bang();
    await user.click(nutXuat());
    expect((await screen.findAllByText('Lỗi máy chủ bịa')).length).toBeGreaterThan(0);
    expect(taiFileTuBlob).not.toHaveBeenCalled();
    expect(screen.queryAllByText(DA_XUAT_KHTC)).toHaveLength(0);
  });
});

describe('Phân quyền — Hợp đồng', () => {
  function renderLayout(vaiTro: string) {
    db.nguoiDung.vai_tro = vaiTro;
    datToken('token-gia-lap');
    renderVoiRouter([{ element: <CongDonViLayout />, children: [{ path: '/trang-chu', element: <div /> }] }], {
      initialEntries: ['/trang-chu'],
    });
  }

  it('menu quan_tri: "Hợp đồng" ngay sau "Danh sách tham gia", trỏ /quan-tri/hop-dong', async () => {
    renderLayout('quan_tri');
    const menu = await screen.findByRole('navigation', { name: 'Menu Cổng đơn vị' });
    await waitFor(() => expect(within(menu).getByRole('link', { name: 'Hợp đồng' })).toHaveAttribute('href', TRANG));
    const nhan = within(menu)
      .getAllByRole('link')
      .map((a) => a.textContent);
    expect(nhan.indexOf('Hợp đồng')).toBe(nhan.indexOf('Danh sách tham gia') + 1);
  });

  it('menu trường không có "Hợp đồng" quản trị', async () => {
    renderLayout('truong');
    const menu = await screen.findByRole('navigation', { name: 'Menu Cổng đơn vị' });
    await screen.findByText(String(db.hoSo.ma_dinh_danh_moet));
    expect(within(menu).queryByRole('link', { name: 'Hợp đồng' })).not.toBeInTheDocument();
  });

  it.each(['truong', 'so_gddt'])('%s mở /quan-tri/hop-dong → 404, không gọi API', async (vaiTro) => {
    let daGoi = false;
    const danhDau = () => {
      daGoi = true;
      return HttpResponse.json([]);
    };
    server.use(
      http.get('/cong-don-vi/dot-trien-khai', danhDau),
      http.get('/cong-don-vi/dot-trien-khai/:id/hop-dong', danhDau),
      http.get('/cong-don-vi/dot-trien-khai/:id/hop-dong/xuat-khtc', danhDau),
    );
    moTrang('?dot=dtk-1', vaiTro);
    expect(await screen.findByText('Không tìm thấy trang', undefined, choLau)).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Hợp đồng' })).not.toBeInTheDocument();
    expect(daGoi).toBe(false);
  });

  it('quan_tri mở /quan-tri/hop-dong trong khung Cổng đơn vị → thấy trang', async () => {
    moTrang();
    expect(await screen.findByRole('heading', { name: 'Hợp đồng' }, choLau)).toBeInTheDocument();
  });
});
