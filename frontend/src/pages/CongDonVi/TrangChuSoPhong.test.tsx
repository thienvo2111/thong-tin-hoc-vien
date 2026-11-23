import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { renderVoiRouter } from '@/test/testUtils';
import { datToken } from '@/auth/tokenStore';
import { db } from '@/test/mocks/db';
import { server } from '@/test/mocks/server';
import { danhSachGvMau, dbDonViTienDo, dongSoPhongMau, dotSoPhongMau, dsSoPhongMau } from '@/test/mocks/donViTienDo';
import { routesCongDonVi } from '@/router';

// Issue #71 / ADR 0015 P1, O3: trang chủ Sở/Phòng (thẻ đợt + bảng tiến độ trường trong phạm vi), danh sách GV chỉ
// xem, guard ChiSoPhongCong, menu Danh mục trường. Mọi giá trị đều BỊA.
vi.mock('react-router-dom', async (goc) => ({
  ...(await goc<typeof import('react-router-dom')>()),
  createBrowserRouter: vi.fn(),
}));

beforeEach(() => vi.stubEnv('VITE_CONG_DON_VI_HOSTNAME', window.location.hostname));
afterEach(() => vi.unstubAllEnvs());

// Trang lazy nạp chậm lần đầu / khi cả bộ chạy song song.
const CHO_LAU = { timeout: 20000 };
const TEST_LAU = { timeout: 30000 };

/** Nhãn dữ liệu tài chính / liên hệ không bao giờ được hiện cho Sở/Phòng. */
const NHAN_CAM = [
  /Số tài khoản/i,
  /Người nhận/i,
  /Ngân hàng/i,
  /Kho bạc/i,
  /Người đại diện/i,
  /Hiệu trưởng/i,
  /Kế toán/i,
  /QHNS/i,
  /Số điện thoại|SĐT/i,
  /Email/i,
];
function khongCoNhanCam() {
  for (const nhan of NHAN_CAM) expect(screen.queryByText(nhan)).not.toBeInTheDocument();
}

function dangNhap(vaiTro: string) {
  db.nguoiDung.vai_tro = vaiTro;
  datToken('token-gia-lap');
}

/** 2 đợt: dot-sp-1 (hạn 31/12/2026, 3 trường) và dot-sp-2 (hạn 31/01/2027 — mặc định, 1 trường). */
function chuanBi(vaiTro = 'so_gddt') {
  dangNhap(vaiTro);
  dbDonViTienDo.theoDot = {
    'dot-sp-1': { dot: dotSoPhongMau(), dong: dsSoPhongMau() },
    'dot-sp-2': {
      dot: dotSoPhongMau({
        id: 'dot-sp-2',
        ten: 'HSG Đợt Sau Sở',
        han_nop: '2027-01-31T16:59:59.000Z',
        han_nop_ngay: '2027-01-31',
        don_gia: null,
      }),
      dong: [
        dongSoPhongMau({
          don_vi: { id: 'tr-sp-9', ma: 'TR-SP-009', ten: 'Trường Mầm non Bịa Chín', dia_ban: 'Xã Bịa' },
          gia_tri: null,
        }),
      ],
    },
  };
  dbDonViTienDo.danhSach = { 'dot-sp-1/tr-sp-1': danhSachGvMau() };
}

const moTrang = (duongDan: string) => renderVoiRouter(routesCongDonVi, { initialEntries: [duongDan] });

/** Ghi các URL /cong-don-vi/don-vi/* đã gọi. */
function ngheApiSoPhong() {
  const urls: URL[] = [];
  const nghe = ({ request }: { request: Request }) => {
    const u = new URL(request.url);
    if (u.pathname.startsWith('/cong-don-vi/don-vi/')) urls.push(u);
  };
  server.events.on('request:start', nghe);
  return { urls, go: () => server.events.removeListener('request:start', nghe) };
}

const bang = () => screen.findByRole('table', { name: 'Tiến độ theo trường' }, CHO_LAU);
const dongCua = (b: HTMLElement, ten: string) => within(b).getByText(ten).closest('tr') as HTMLElement;
const tenCacTruong = (b: HTMLElement) =>
  within(b)
    .getAllByRole('row')
    .slice(1)
    .map((r) => within(r).getAllByRole('cell')[0].querySelector('p')?.textContent);

function giaLapMobile() {
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
  return () => {
    window.matchMedia = goc;
  };
}

describe('Trang chủ Sở/Phòng — thẻ đợt', TEST_LAU, () => {
  it('mỗi đợt 1 thẻ: chương trình, tên, hạn nộp, số trường/đã xác nhận/đã nộp/quá hạn, tổng suất, giá trị', async () => {
    chuanBi();
    moTrang('/trang-chu');
    expect(await screen.findByRole('heading', { name: 'Tiến độ các trường' }, CHO_LAU)).toBeInTheDocument();
    const the1 = await screen.findByRole('button', { name: /HSG Đợt Bịa Sở/ }, CHO_LAU);
    expect(within(the1).getByText('HSG')).toBeInTheDocument();
    expect(within(the1).getByText('Hạn nộp: 31/12/2026')).toBeInTheDocument();
    expect(within(the1).getByText('3 trường · 1 đã xác nhận DS · 1 đã nộp HĐ · 1 quá hạn')).toBeInTheDocument();
    expect(within(the1).getByText('Tổng suất 9,5 · 9.500.000 đ')).toBeInTheDocument();
    const the2 = screen.getByRole('button', { name: /HSG Đợt Sau Sở/ });
    expect(within(the2).getByText('Tổng suất 2,5 · Chưa có đơn giá')).toBeInTheDocument();
    // Thứ tự: hạn nộp muộn trước.
    const nhom = screen.getByLabelText('Các đợt bồi dưỡng');
    expect(within(nhom).getAllByRole('button')[0]).toBe(the2);
    khongCoNhanCam();
  });

  it('mặc định chọn đợt hạn nộp muộn nhất và tải bảng của đợt đó', async () => {
    chuanBi();
    moTrang('/trang-chu');
    const b = await bang();
    expect(tenCacTruong(b)).toEqual(['Trường Mầm non Bịa Chín']);
    expect(screen.getByRole('button', { name: /HSG Đợt Sau Sở/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('heading', { level: 2, name: 'HSG Đợt Sau Sở' })).toBeInTheDocument();
  });

  it('bấm 1 thẻ → tải bảng tiến độ của đợt đó, thẻ được đánh dấu chọn', async () => {
    const user = userEvent.setup();
    chuanBi();
    const nghe = ngheApiSoPhong();
    try {
      const { router } = moTrang('/trang-chu');
      await bang();
      await user.click(screen.getByRole('button', { name: /HSG Đợt Bịa Sở/ }));
      await waitFor(() =>
        expect(tenCacTruong(screen.getByRole('table', { name: 'Tiến độ theo trường' }))).toEqual([
          'Trường THCS Bịa Một',
          'Trường Tiểu học Bịa Hai',
          'Trường THPT Bịa Ba',
        ]),
      );
      expect(screen.getByRole('button', { name: /HSG Đợt Bịa Sở/ })).toHaveAttribute('aria-pressed', 'true');
      expect(router.state.location.search).toContain('dot=dot-sp-1');
      expect(nghe.urls.some((u) => u.pathname === '/cong-don-vi/don-vi/dot/dot-sp-1/tien-do')).toBe(true);
    } finally {
      nghe.go();
    }
  });

  it('?dot= hợp lệ → chọn đợt đó', async () => {
    chuanBi();
    moTrang('/trang-chu?dot=dot-sp-1');
    const b = await bang();
    expect(tenCacTruong(b)).toHaveLength(3);
    expect(screen.getByRole('button', { name: /HSG Đợt Bịa Sở/ })).toHaveAttribute('aria-pressed', 'true');
  });

  it('chưa có đợt nào → thông báo trống, không gọi bảng tiến độ', async () => {
    dangNhap('phong_vhxh');
    const nghe = ngheApiSoPhong();
    try {
      moTrang('/trang-chu');
      expect(
        await screen.findByText('Chưa có đợt bồi dưỡng nào cho các trường trong phạm vi', undefined, CHO_LAU),
      ).toBeInTheDocument();
      expect(nghe.urls.map((u) => u.pathname)).toEqual(['/cong-don-vi/don-vi/dot']);
    } finally {
      nghe.go();
    }
  });

  it('lỗi tải đợt → thông báo + "Thử lại" tải lại được', async () => {
    const user = userEvent.setup();
    chuanBi();
    let henLoi = true;
    server.use(
      http.get('/cong-don-vi/don-vi/dot', () =>
        henLoi ? HttpResponse.json({ error: { code: 'INTERNAL', message: 'Lỗi bịa' } }, { status: 500 }) : undefined,
      ),
    );
    moTrang('/trang-chu');
    expect(await screen.findByText('Không tải được danh sách đợt', undefined, CHO_LAU)).toBeInTheDocument();
    expect(screen.getByText('Lỗi bịa')).toBeInTheDocument();
    henLoi = false;
    await user.click(screen.getByRole('button', { name: 'Thử lại' }));
    expect(await screen.findByRole('button', { name: /HSG Đợt Bịa Sở/ })).toBeInTheDocument();
    expect(screen.queryByText('Không tải được danh sách đợt')).not.toBeInTheDocument();
  });
});

describe('Trang chủ Sở/Phòng — bảng tiến độ', TEST_LAU, () => {
  it('mỗi trường 1 dòng: mã/tên/địa bàn, số GV, suất, giá trị, DS + đề nghị chờ, HĐ + ngày nộp, hạn + Quá hạn, thao tác', async () => {
    chuanBi();
    moTrang('/trang-chu?dot=dot-sp-1');
    const b = await bang();
    const mot = dongCua(b, 'Trường THCS Bịa Một');
    expect(within(mot).getByText('TR-SP-001 · Xã Bịa')).toBeInTheDocument();
    expect(within(mot).getByText('3')).toBeInTheDocument();
    expect(within(mot).getByText('2,5')).toBeInTheDocument();
    expect(within(mot).getByText('2.500.000 đ')).toBeInTheDocument();
    expect(within(mot).getByText('Chờ xác nhận')).toBeInTheDocument();
    expect(within(mot).getByText('Chưa nộp')).toBeInTheDocument();
    expect(within(mot).getByText('31/12/2026')).toBeInTheDocument();
    expect(within(mot).getByText('—')).toBeInTheDocument();

    const hai = dongCua(b, 'Trường Tiểu học Bịa Hai');
    expect(within(hai).getByText('0,5')).toBeInTheDocument();
    expect(within(hai).getByText('Báo sai lệch')).toBeInTheDocument();
    expect(within(hai).getByText('1 đề nghị chờ')).toBeInTheDocument();
    expect(within(hai).getByText('01/11/2026')).toBeInTheDocument();
    expect(within(hai).getByText('Quá hạn')).toBeInTheDocument();

    const ba = dongCua(b, 'Trường THPT Bịa Ba');
    expect(within(ba).getByText('Đã nộp')).toBeInTheDocument();
    expect(within(ba).getByText('19/11/2026')).toBeInTheDocument();
    expect(within(ba).getByText('19/11/2026 10:04')).toBeInTheDocument();
    expect(within(ba).queryByText('Quá hạn')).not.toBeInTheDocument();
    khongCoNhanCam();
  });

  it('bộ lọc hiện số trường; chọn lọc → gửi loc lên API và chỉ còn trường khớp', async () => {
    const user = userEvent.setup();
    chuanBi();
    const nghe = ngheApiSoPhong();
    try {
      const { router } = moTrang('/trang-chu?dot=dot-sp-1');
      await bang();
      for (const nhan of ['Tất cả (3)', 'Chưa xác nhận DS (2)', 'Báo sai lệch (1)', 'Chưa nộp HĐ (2)', 'Quá hạn (1)']) {
        expect(screen.getByRole('radio', { name: nhan })).toBeInTheDocument();
      }
      await user.click(screen.getByRole('radio', { name: 'Quá hạn (1)' }));
      await waitFor(() =>
        expect(tenCacTruong(screen.getByRole('table', { name: 'Tiến độ theo trường' }))).toEqual([
          'Trường Tiểu học Bịa Hai',
        ]),
      );
      expect(nghe.urls.some((u) => u.searchParams.get('loc') === 'qua_han')).toBe(true);
      expect(router.state.location.search).toContain('loc=qua_han');

      await user.click(screen.getByRole('radio', { name: 'Chưa nộp HĐ (2)' }));
      await waitFor(() =>
        expect(tenCacTruong(screen.getByRole('table', { name: 'Tiến độ theo trường' }))).toEqual([
          'Trường THCS Bịa Một',
          'Trường Tiểu học Bịa Hai',
        ]),
      );
      expect(nghe.urls.some((u) => u.searchParams.get('loc') === 'chua_nop_hd')).toBe(true);
    } finally {
      nghe.go();
    }
  });

  it('tìm theo tên không dấu hoặc mã; không khớp → thông báo', async () => {
    const user = userEvent.setup();
    chuanBi();
    moTrang('/trang-chu?dot=dot-sp-1');
    await bang();
    const o = screen.getByLabelText('Tìm trường');
    await user.type(o, 'bia hai');
    expect(tenCacTruong(screen.getByRole('table', { name: 'Tiến độ theo trường' }))).toEqual([
      'Trường Tiểu học Bịa Hai',
    ]);
    await user.clear(o);
    await user.type(o, 'TR-SP-003');
    expect(tenCacTruong(screen.getByRole('table', { name: 'Tiến độ theo trường' }))).toEqual(['Trường THPT Bịa Ba']);
    await user.clear(o);
    await user.type(o, 'khong co truong nay');
    expect(screen.getByText('Không có trường nào khớp tìm kiếm')).toBeInTheDocument();
  });

  it('"Xem danh sách GV" → /don-vi/dot/:dotId/truong/:donViId và mở màn danh sách', async () => {
    const user = userEvent.setup();
    chuanBi();
    const { router } = moTrang('/trang-chu?dot=dot-sp-1');
    await bang();
    const lk = screen.getByRole('link', { name: 'Xem danh sách GV Trường THCS Bịa Một' });
    expect(lk).toHaveAttribute('href', '/don-vi/dot/dot-sp-1/truong/tr-sp-1');
    await user.click(lk);
    expect(await screen.findByRole('table', { name: 'Danh sách giáo viên' }, CHO_LAU)).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/don-vi/dot/dot-sp-1/truong/tr-sp-1');
  });

  it('lỗi tải tiến độ → thông báo + "Thử lại"', async () => {
    const user = userEvent.setup();
    chuanBi();
    let henLoi = true;
    server.use(
      http.get('/cong-don-vi/don-vi/dot/:dotId/tien-do', () =>
        henLoi
          ? HttpResponse.json({ error: { code: 'INTERNAL', message: 'Lỗi tiến độ bịa' } }, { status: 500 })
          : undefined,
      ),
    );
    moTrang('/trang-chu?dot=dot-sp-1');
    expect(await screen.findByText('Không tải được tiến độ đợt', undefined, CHO_LAU)).toBeInTheDocument();
    expect(screen.getByText('Lỗi tiến độ bịa')).toBeInTheDocument();
    henLoi = false;
    await user.click(screen.getByRole('button', { name: 'Thử lại' }));
    expect(await bang()).toBeInTheDocument();
  });

  it('màn hẹp: thẻ xếp dọc thay bảng, vẫn đủ số liệu và liên kết', async () => {
    const tra = giaLapMobile();
    try {
      chuanBi('phong_vhxh');
      moTrang('/trang-chu?dot=dot-sp-1');
      const the = await screen.findByRole('article', { name: 'Trường Tiểu học Bịa Hai' }, CHO_LAU);
      expect(screen.queryByRole('table', { name: 'Tiến độ theo trường' })).not.toBeInTheDocument();
      expect(screen.getAllByRole('article')).toHaveLength(3);
      expect(within(the).getByText('1 GV · 0,5 suất · 500.000 đ')).toBeInTheDocument();
      expect(within(the).getByText('1 đề nghị chờ')).toBeInTheDocument();
      expect(within(the).getByText('Quá hạn')).toBeInTheDocument();
      expect(within(the).getByRole('link', { name: 'Xem danh sách GV Trường Tiểu học Bịa Hai' })).toHaveAttribute(
        'href',
        '/don-vi/dot/dot-sp-1/truong/tr-sp-2',
      );
      khongCoNhanCam();
    } finally {
      tra();
    }
  });
});

describe('Danh sách GV của 1 trường (Sở/Phòng, chỉ xem)', TEST_LAU, () => {
  const TRANG_DS = '/don-vi/dot/dot-sp-1/truong/tr-sp-1';

  it('bảng GV đủ cột, tổng cuối màn, liên kết về bảng tiến độ; không có nút sửa/ý kiến, không thông tin tài chính', async () => {
    chuanBi();
    moTrang(TRANG_DS);
    const b = await screen.findByRole('table', { name: 'Danh sách giáo viên' }, CHO_LAU);
    expect(screen.getByRole('heading', { level: 1, name: 'Trường THCS Bịa Một' })).toBeInTheDocument();
    expect(screen.getByText('TR-SP-001 · HSG Đợt Bịa Sở')).toBeInTheDocument();
    expect(screen.getByText('Danh sách: Chờ xác nhận')).toBeInTheDocument();
    expect(screen.getByText('Hợp đồng: Chưa nộp')).toBeInTheDocument();
    expect(screen.getByText('Chỉ xem')).toBeInTheDocument();

    const dong1 = within(b).getByText('Nguyễn Thị Bịa').closest('tr') as HTMLElement;
    expect(within(dong1).getByText('01/02/1990')).toBeInTheDocument();
    expect(within(dong1).getByText('Nữ')).toBeInTheDocument();
    expect(within(dong1).getByText('6A')).toBeInTheDocument();
    expect(within(dong1).getByText('Cả 2')).toBeInTheDocument();
    expect(within(dong1).getByText('1')).toBeInTheDocument();
    expect(within(dong1).getByText('Ghi chú bịa')).toBeInTheDocument();
    expect(within(dong1).getByText('Đồng ý')).toBeInTheDocument();
    const dong2 = within(b).getByText('Trần Văn Giả').closest('tr') as HTMLElement;
    expect(within(dong2).getByText('Chỉ GĐ1')).toBeInTheDocument();
    expect(within(dong2).getByText('0,5')).toBeInTheDocument();
    expect(within(dong2).getByText('Chưa có ý kiến')).toBeInTheDocument();

    expect(screen.getByText('Tổng: 2 GV · 1,5 suất · 1.500.000 đ')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '← Về bảng tiến độ' })).toHaveAttribute('href', '/trang-chu?dot=dot-sp-1');
    // Chỉ xem: không ô nhập, không nút thao tác trong vùng nội dung.
    const main = screen.getByRole('main');
    expect(within(main).queryAllByRole('textbox')).toHaveLength(0);
    expect(within(main).queryByRole('button', { name: /Đồng ý|Không đồng ý|Xác nhận|Sửa|Xóa|Đề nghị/ })).toBeNull();
    khongCoNhanCam();
  });

  it('đã nộp → ghi chú "Số liệu lúc trường nộp hợp đồng"', async () => {
    chuanBi();
    dbDonViTienDo.danhSach['dot-sp-1/tr-sp-1'] = danhSachGvMau({
      trang_thai_hop_dong: 'da_nop',
      so_nguoi: 7,
      tong_suat: 6.5,
      gia_tri: 6_500_000,
    });
    moTrang(TRANG_DS);
    expect(await screen.findByText('Tổng: 7 GV · 6,5 suất · 6.500.000 đ', undefined, CHO_LAU)).toBeInTheDocument();
    expect(screen.getByText('Số liệu lúc trường nộp hợp đồng.')).toBeInTheDocument();
  });

  it('màn hẹp: mỗi GV 1 thẻ', async () => {
    const tra = giaLapMobile();
    try {
      chuanBi();
      moTrang(TRANG_DS);
      const the = await screen.findByRole('article', { name: 'Nguyễn Thị Bịa' }, CHO_LAU);
      expect(screen.queryByRole('table', { name: 'Danh sách giáo viên' })).not.toBeInTheDocument();
      expect(within(the).getByText('01/02/1990 · Nữ · 6A')).toBeInTheDocument();
      expect(within(the).getByText('Cả 2 · 1 suất')).toBeInTheDocument();
      expect(screen.getAllByRole('article')).toHaveLength(2);
    } finally {
      tra();
    }
  });

  it('trường ngoài phạm vi (API 404) → thông báo không tìm thấy', async () => {
    chuanBi();
    moTrang('/don-vi/dot/dot-sp-1/truong/tr-ngoai');
    expect(
      await screen.findByText('Không tìm thấy danh sách của trường này trong phạm vi của đơn vị.', undefined, CHO_LAU),
    ).toBeInTheDocument();
  });

  it('lỗi máy chủ → thông báo + "Thử lại"', async () => {
    const user = userEvent.setup();
    chuanBi();
    let henLoi = true;
    server.use(
      http.get('/cong-don-vi/don-vi/dot/:dotId/truong/:donViId/danh-sach', () =>
        henLoi ? HttpResponse.json({ error: { code: 'INTERNAL', message: 'Lỗi DS bịa' } }, { status: 500 }) : undefined,
      ),
    );
    moTrang(TRANG_DS);
    expect(await screen.findByText('Không tải được danh sách', undefined, CHO_LAU)).toBeInTheDocument();
    henLoi = false;
    await user.click(screen.getByRole('button', { name: 'Thử lại' }));
    expect(await screen.findByRole('table', { name: 'Danh sách giáo viên' })).toBeInTheDocument();
  });
});

describe('Guard ChiSoPhongCong + Danh mục trường', TEST_LAU, () => {
  it.each([
    ['truong', '/don-vi/dot/dot-sp-1/truong/tr-sp-1'],
    ['quan_tri', '/don-vi/dot/dot-sp-1/truong/tr-sp-1'],
    ['truong', '/don-vi/danh-muc-truong'],
    ['quan_tri', '/don-vi/danh-muc-truong'],
  ])('%s mở %s → 404, không gọi API', async (vaiTro, duongDan) => {
    chuanBi(vaiTro);
    const goi: string[] = [];
    const nghe = ({ request }: { request: Request }) => {
      const p = new URL(request.url).pathname;
      if (p.startsWith('/cong-don-vi/don-vi/') || p.startsWith('/danh-muc/don-vi-cong-tac')) goi.push(p);
    };
    server.events.on('request:start', nghe);
    try {
      moTrang(duongDan);
      expect(await screen.findByText('Không tìm thấy trang', undefined, CHO_LAU)).toBeInTheDocument();
      expect(goi).toEqual([]);
    } finally {
      server.events.removeListener('request:start', nghe);
    }
  });

  it('trường vẫn giữ trang chủ của trường (không gọi API Sở/Phòng)', async () => {
    chuanBi('truong');
    const nghe = ngheApiSoPhong();
    try {
      moTrang('/trang-chu');
      expect(await screen.findByRole('heading', { name: 'Việc cần làm' }, CHO_LAU)).toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: 'Tiến độ các trường' })).not.toBeInTheDocument();
      expect(nghe.urls).toEqual([]);
    } finally {
      nghe.go();
    }
  });

  it.each(['so_gddt', 'phong_vhxh'])(
    '%s: menu có "Danh mục trường" → /don-vi/danh-muc-truong hiện màn danh mục, không nút "Thêm trường"',
    async (vaiTro) => {
      const user = userEvent.setup();
      chuanBi(vaiTro);
      const { router } = moTrang('/trang-chu');
      const menu = await screen.findByRole('navigation', { name: 'Menu Cổng đơn vị' }, CHO_LAU);
      const lk = within(menu).getByRole('link', { name: 'Danh mục trường' });
      expect(lk).toHaveAttribute('href', '/don-vi/danh-muc-truong');
      await user.click(lk);
      expect(await screen.findByText('THPT Long Xuyên', undefined, CHO_LAU)).toBeInTheDocument();
      expect(router.state.location.pathname).toBe('/don-vi/danh-muc-truong');
      expect(screen.queryByRole('button', { name: /Thêm trường/ })).not.toBeInTheDocument();
    },
  );

  it.each(['truong', 'quan_tri'])('%s: menu không có "Danh mục trường"', async (vaiTro) => {
    chuanBi(vaiTro);
    moTrang('/trang-chu');
    const menu = await screen.findByRole('navigation', { name: 'Menu Cổng đơn vị' }, CHO_LAU);
    expect(within(menu).getByRole('link', { name: 'Trang chủ' })).toBeInTheDocument();
    expect(within(menu).queryByRole('link', { name: 'Danh mục trường' })).not.toBeInTheDocument();
  });

  it('thứ tự menu Sở có NLS: Trang chủ · nhóm NLS · Danh mục trường · Hướng dẫn', async () => {
    server.use(http.get('/cong-don-vi/toi/chuong-trinh', () => HttpResponse.json({ nls: true })));
    chuanBi('so_gddt');
    moTrang('/trang-chu');
    const menu = await screen.findByRole('navigation', { name: 'Menu Cổng đơn vị' }, CHO_LAU);
    await within(menu).findByRole('group', { name: 'NLS' });
    expect(
      within(menu)
        .getAllByRole('link')
        .map((a) => a.textContent),
    ).toEqual(['Trang chủ', 'Tổng quan', 'Học viên', 'Khóa', 'Báo cáo', 'Danh mục trường', 'Hướng dẫn']);
  });

  it('thứ tự menu Phòng không NLS: Trang chủ · Danh mục trường · Hướng dẫn', async () => {
    chuanBi('phong_vhxh');
    moTrang('/trang-chu');
    const menu = await screen.findByRole('navigation', { name: 'Menu Cổng đơn vị' }, CHO_LAU);
    expect(
      within(menu)
        .getAllByRole('link')
        .map((a) => a.textContent),
    ).toEqual(['Trang chủ', 'Danh mục trường', 'Hướng dẫn']);
  });
});
