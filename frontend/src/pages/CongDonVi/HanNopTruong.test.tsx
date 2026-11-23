import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { renderVoiRouter } from '@/test/testUtils';
import { datToken } from '@/auth/tokenStore';
import { db } from '@/test/mocks/db';
import { server } from '@/test/mocks/server';
import { danhSachMau, dbTruongDanhSach, theDotMau, thongDiepHetHanMau } from '@/test/mocks/truongDanhSach';
import { dbHopDong, hopDongMau, lyDo } from '@/test/mocks/hopDong';
import { routesCongDonVi } from '@/router';

// Issue #66 / ADR 0015 T1, T2: hạn nộp phía trường — chip trên thẻ đợt, chỉ xem khi hết hạn (server da_het_han),
// 403 HET_HAN_DOT hiện thông điệp + tải lại. SĐT hỗ trợ trong content còn là chuỗi tạm → hiện "liên hệ HCMUE"
// không số (bản có số: HanNopSdt.test.tsx). Mọi giá trị đều BỊA.
vi.mock('react-router-dom', async (goc) => ({
  ...(await goc<typeof import('react-router-dom')>()),
  createBrowserRouter: vi.fn(),
}));

beforeEach(() => vi.stubEnv('VITE_CONG_DON_VI_HOSTNAME', window.location.hostname));
afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

/** Chỉ giả Date (setTimeout thật) — "hôm nay" cố định 03/12/2026 10:00 giờ VN. */
function coDinhNgay(iso = '2026-12-03T03:00:00Z') {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(iso));
}

const han = (ngay: string, da_het_han = false) => ({
  han_hieu_luc: `${ngay}T16:59:59.000Z`,
  han_hieu_luc_ngay: ngay,
  da_het_han,
});
const HET_HAN = han('2026-12-02', true);

function dangNhapTruong() {
  db.nguoiDung.vai_tro = 'truong';
  datToken('token-gia-lap');
}

const moTrang = (duongDan: string) => {
  dangNhapTruong();
  renderVoiRouter(routesCongDonVi, { initialEntries: [duongDan] });
};

describe('Trang chủ trường — chip hạn nộp', () => {
  it.each([
    ['còn 28 ngày', han('2026-12-31'), 'Còn 28 ngày'],
    ['còn 3 ngày (gấp)', han('2026-12-06'), 'Còn 3 ngày'],
    ['ngày hạn là hôm nay', han('2026-12-03'), 'Hạn cuối hôm nay'],
  ])('%s → "%s"; việc vẫn bình thường (không "Chỉ xem")', async (_t, h, nhan) => {
    coDinhNgay();
    dbTruongDanhSach.the = [theDotMau(h)];
    moTrang('/trang-chu');
    const the = await screen.findByRole('article', { name: 'HSG Đợt Bịa 2026' });
    expect(within(the).getByText(nhan)).toBeInTheDocument();
    expect(within(the).queryByText('Chỉ xem')).not.toBeInTheDocument();
    expect(within(the).getByRole('link', { name: /Nộp hợp đồng/ })).toHaveTextContent('Chưa nộp');
  });

  it('hết hạn → đỏ "Đã hết hạn ngày dd/mm – liên hệ HCMUE" (không SĐT khi chưa cấu hình); việc vẫn mở được, "Chỉ xem"', async () => {
    coDinhNgay();
    dbTruongDanhSach.the = [theDotMau(HET_HAN)];
    moTrang('/trang-chu');
    const the = await screen.findByRole('article', { name: 'HSG Đợt Bịa 2026' });
    expect(within(the).getByText('Đã hết hạn ngày 02/12 – liên hệ HCMUE')).toBeInTheDocument();
    const viec = within(the).getByRole('list', { name: 'Việc cần làm' });
    expect(within(viec).getByRole('link', { name: 'Xem danh sách tham gia' })).toHaveAttribute(
      'href',
      '/dot/dot-hsg-1/danh-sach',
    );
    for (const ten of [/Xác nhận danh sách/, /Thông tin hợp đồng/, /Nộp hợp đồng/]) {
      expect(within(viec).getByRole('link', { name: ten })).toHaveTextContent('Chỉ xem');
    }
  });

  it('server là nguồn quyết định: máy còn trước hạn nhưng da_het_han=true → vẫn hiện hết hạn', async () => {
    coDinhNgay('2026-11-25T03:00:00Z');
    dbTruongDanhSach.the = [theDotMau(han('2026-12-02', true))];
    moTrang('/trang-chu');
    expect(await screen.findByText('Đã hết hạn ngày 02/12 – liên hệ HCMUE')).toBeInTheDocument();
  });

  it('có hạn riêng → dòng "Hạn riêng của trường", chip theo hạn riêng', async () => {
    coDinhNgay();
    dbTruongDanhSach.the = [theDotMau({ han_rieng: '2026-12-10T16:59:59.000Z', ...han('2026-12-10') })];
    moTrang('/trang-chu');
    const the = await screen.findByRole('article', { name: 'HSG Đợt Bịa 2026' });
    expect(within(the).getByText('Hạn nộp: 31/12/2026')).toBeInTheDocument();
    expect(within(the).getByText('Hạn riêng của trường: 10/12/2026')).toBeInTheDocument();
    expect(within(the).getByText('Còn 7 ngày')).toBeInTheDocument();
  });

  it('đã nộp → không hiện chip hạn', async () => {
    coDinhNgay();
    dbTruongDanhSach.the = [theDotMau({ trang_thai_hop_dong: 'da_nop', ...HET_HAN })];
    moTrang('/trang-chu');
    const the = await screen.findByRole('article', { name: 'HSG Đợt Bịa 2026' });
    expect(within(the).queryByText(/hết hạn|Còn \d+ ngày/)).not.toBeInTheDocument();
    expect(within(the).queryByText('Chỉ xem')).not.toBeInTheDocument();
  });
});

describe('Màn danh sách của trường khi hết hạn', () => {
  it('da_het_han → banner chỉ xem, ẩn ý kiến / đề nghị / Đồng ý tất cả / Xác nhận', async () => {
    dbTruongDanhSach.danhSach['dot-hsg-1'] = danhSachMau(HET_HAN);
    moTrang('/dot/dot-hsg-1/danh-sach');
    expect(
      await screen.findByText('Đã hết hạn ngày 02/12/2026 — chỉ xem. Liên hệ HCMUE để được gia hạn.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Người tham gia' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Đồng ý' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Không đồng ý' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Đề nghị thêm người' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Đồng ý tất cả/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Xác nhận danh sách' })).not.toBeInTheDocument();
    expect(screen.getByText('Đã hết hạn — danh sách chỉ xem.')).toBeInTheDocument();
  });

  it('còn hạn → vẫn sửa được (nút ý kiến, đề nghị, Xác nhận)', async () => {
    dbTruongDanhSach.danhSach['dot-hsg-1'] = danhSachMau();
    moTrang('/dot/dot-hsg-1/danh-sach');
    await screen.findByRole('list', { name: 'Người tham gia' });
    expect(screen.getAllByRole('button', { name: 'Đồng ý' })).toHaveLength(3);
    expect(screen.getByRole('button', { name: 'Đề nghị thêm người' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Xác nhận danh sách' })).toBeInTheDocument();
    expect(screen.queryByText(/chỉ xem/)).not.toBeInTheDocument();
  });

  it('server trả 403 HET_HAN_DOT (hết hạn giữa chừng) → hiện thông điệp server, tải lại → chỉ xem', async () => {
    dbTruongDanhSach.danhSach['dot-hsg-1'] = danhSachMau();
    // Hạn vừa qua: server đã coi là hết hạn, màn hình còn dữ liệu cũ.
    server.use(
      http.post('/cong-don-vi/truong/dot/:dotId/danh-sach/dong-y-tat-ca', () => {
        dbTruongDanhSach.danhSach['dot-hsg-1'] = danhSachMau(HET_HAN);
        return undefined;
      }),
    );
    moTrang('/dot/dot-hsg-1/danh-sach');
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: /Đồng ý tất cả/ }));
    expect((await screen.findAllByText(thongDiepHetHanMau('2026-12-02'))).length).toBeGreaterThan(0);
    expect(
      await screen.findByText('Đã hết hạn ngày 02/12/2026 — chỉ xem. Liên hệ HCMUE để được gia hạn.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Đồng ý' })).not.toBeInTheDocument();
  });
});

describe('Màn hợp đồng của trường khi hết hạn', () => {
  const moHopDong = async (hd = hopDongMau()) => {
    dbHopDong.truong['dot-hsg-1'] = hd;
    moTrang('/dot/dot-hsg-1/hop-dong');
    await screen.findByRole('heading', { name: /Thông tin hợp đồng — HSG Đợt Bịa 2026/ });
  };

  it('da_het_han → banner chỉ xem, Phần 3 chỉ đọc, không Lưu nháp / Nộp', async () => {
    await moHopDong(hopDongMau({ ...HET_HAN, ly_do_chan: lyDo('da_het_han', 'phan_3_chua_du'), co_the_nop: false }));
    expect(
      screen.getByText('Đã hết hạn ngày 02/12/2026 — chỉ xem. Liên hệ HCMUE để được gia hạn.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Thông tin hợp đồng' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Lưu nháp' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Nộp hợp đồng' })).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('còn hạn → form + Lưu nháp + Nộp', async () => {
    await moHopDong();
    expect(screen.getByRole('button', { name: 'Lưu nháp' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Nộp hợp đồng' })).toBeInTheDocument();
  });

  it('Lưu nháp bị 403 HET_HAN_DOT → hiện thông điệp server rồi tải lại sang chỉ xem', async () => {
    await moHopDong();
    dbHopDong.truong['dot-hsg-1'] = hopDongMau(HET_HAN);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/^Người nhận bản giấy/), 'Người Nhận Bịa');
    await user.click(screen.getByRole('button', { name: 'Lưu nháp' }));
    expect((await screen.findAllByText(thongDiepHetHanMau('2026-12-02'))).length).toBeGreaterThan(0);
    await waitFor(() =>
      expect(
        screen.getByText('Đã hết hạn ngày 02/12/2026 — chỉ xem. Liên hệ HCMUE để được gia hạn.'),
      ).toBeInTheDocument(),
    );
    expect(screen.queryByRole('button', { name: 'Lưu nháp' })).not.toBeInTheDocument();
  });
});
