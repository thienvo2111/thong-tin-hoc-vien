import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { renderVoiRouter } from '@/test/testUtils';
import { datToken } from '@/auth/tokenStore';
import { db } from '@/test/mocks/db';
import { server } from '@/test/mocks/server';
import { danhSachMau, dbTruongDanhSach, theDotMau } from '@/test/mocks/truongDanhSach';
import { routesCongDonVi } from '@/router';

// Issue #60 / ADR 0015 U1, X6, S5: trang chủ trường + màn xem danh sách tham gia của trường.
// router.tsx tạo createBrowserRouter ngay khi import — thay bằng hàm rỗng để test chỉ dùng mảng route.
vi.mock('react-router-dom', async (goc) => ({
  ...(await goc<typeof import('react-router-dom')>()),
  createBrowserRouter: vi.fn(),
}));

beforeEach(() => vi.stubEnv('VITE_CONG_DON_VI_HOSTNAME', window.location.hostname));
afterEach(() => vi.unstubAllEnvs());

const URL_DOT = '/cong-don-vi/truong/dot';
const loi500 = () => HttpResponse.json({ error: { code: 'INTERNAL', message: 'Lỗi máy chủ bịa' } }, { status: 500 });

/** Lỗi 500 tới khi gọi suaXong() — KhungNoiBo có QueryClient riêng (retry: 1) nên lỗi "1 lần" bị lần thử lại nuốt. */
function hongTam(duongDan: string) {
  let hong = true;
  server.use(http.get(duongDan, () => (hong ? loi500() : undefined)));
  return { suaXong: () => (hong = false) };
}

function dangNhap(vaiTro: string) {
  db.nguoiDung.vai_tro = vaiTro;
  datToken('token-gia-lap');
}

/** Ghi lại mọi request tới API của trường (để kiểm "không gọi API"). */
function ngheApiTruong() {
  const daGoi: string[] = [];
  const nghe = ({ request }: { request: Request }) => {
    if (new URL(request.url).pathname.startsWith(URL_DOT)) daGoi.push(request.url);
  };
  server.events.on('request:start', nghe);
  return { daGoi, go: () => server.events.removeListener('request:start', nghe) };
}

const moTrang = (duongDan: string) => renderVoiRouter(routesCongDonVi, { initialEntries: [duongDan] });

describe('Trang chủ trường (/trang-chu, vai trò truong)', () => {
  it('đang tải → thẻ Hồ sơ đơn vị (badge, issue #63) + thẻ đợt: chương trình, hạn nộp, số người, tổng suất 0,5, tiền, trạng thái', async () => {
    dbTruongDanhSach.the = [
      theDotMau(),
      theDotMau({
        dot: { id: 'dot-nls-1', ten: 'NLS Đợt Bịa', chuong_trinh: 'nls', han_nop: '', han_nop_ngay: '2027-01-15' },
        so_nguoi: 1,
        tong_suat: 0.5,
        don_gia: null,
        gia_tri_tam_tinh: null,
        trang_thai_danh_sach: 'da_xac_nhan',
        trang_thai_hop_dong: 'da_nop',
      }),
    ];
    dangNhap('truong');
    moTrang('/trang-chu');

    expect(await screen.findByLabelText('Đang tải')).toBeInTheDocument();
    const hoSo = screen.getByRole('region', { name: 'Hồ sơ đơn vị' });
    expect(await within(hoSo).findByText('Chưa khai')).toBeInTheDocument();

    const hsg = await screen.findByRole('article', { name: 'HSG Đợt Bịa 2026' });
    expect(within(hsg).getByText('HSG')).toBeInTheDocument();
    expect(within(hsg).getByText('Hạn nộp: 31/12/2026')).toBeInTheDocument();
    expect(within(hsg).getByText('3')).toBeInTheDocument();
    expect(within(hsg).getByText('2,5')).toBeInTheDocument();
    // Issue #64: giá trị hiện ở số liệu và ở việc "Thông tin hợp đồng".
    expect(within(hsg).getAllByText('3.086.418 đ')).toHaveLength(2);
    expect(within(hsg).getByText('Danh sách: Chờ xác nhận')).toBeInTheDocument();
    expect(within(hsg).getByText('Hợp đồng: Chưa nộp')).toBeInTheDocument();

    const nls = screen.getByRole('article', { name: 'NLS Đợt Bịa' });
    expect(within(nls).getByText('NLS')).toBeInTheDocument();
    expect(within(nls).getByText('0,5')).toBeInTheDocument();
    expect(within(nls).getAllByText('Chưa có đơn giá')).toHaveLength(2);
    expect(within(nls).queryByText(/ đ$/)).not.toBeInTheDocument();
    expect(within(nls).getByText('Danh sách: Đã xác nhận')).toBeInTheDocument();
    expect(within(nls).getByText('Hợp đồng: Đã nộp')).toBeInTheDocument();
    expect(screen.queryByLabelText('Đang tải')).not.toBeInTheDocument();
  });

  it('việc cần làm: "Xem danh sách tham gia" + "Xác nhận danh sách" (kèm trạng thái) mở /dot/:id/danh-sach; Thông tin hợp đồng (giá trị) / Nộp hợp đồng (trạng thái) mở /dot/:id/hop-dong (issue #64)', async () => {
    dbTruongDanhSach.the = [theDotMau({ trang_thai_danh_sach: 'bao_sai_lech' })];
    dangNhap('truong');
    moTrang('/trang-chu');
    const the = await screen.findByRole('article', { name: 'HSG Đợt Bịa 2026' });
    const viec = within(the).getByRole('list', { name: 'Việc cần làm' });
    expect(within(viec).getByRole('link', { name: 'Xem danh sách tham gia' })).toHaveAttribute(
      'href',
      '/dot/dot-hsg-1/danh-sach',
    );
    // Issue #61: việc "Xác nhận danh sách" đã mở, hiện trạng thái danh sách.
    const xacNhan = within(viec).getByRole('link', { name: /Xác nhận danh sách/ });
    expect(xacNhan).toHaveAttribute('href', '/dot/dot-hsg-1/danh-sach');
    expect(xacNhan).toHaveTextContent('Báo sai lệch');
    expect(xacNhan).not.toHaveTextContent('Sắp mở');
    expect(within(viec).queryByRole('button', { name: /Xác nhận danh sách/ })).not.toBeInTheDocument();
    const thongTin = within(viec).getByRole('link', { name: /Thông tin hợp đồng/ });
    expect(thongTin).toHaveAttribute('href', '/dot/dot-hsg-1/hop-dong');
    expect(thongTin).toHaveTextContent('3.086.418 đ');
    const nop = within(viec).getByRole('link', { name: /Nộp hợp đồng/ });
    expect(nop).toHaveAttribute('href', '/dot/dot-hsg-1/hop-dong');
    expect(nop).toHaveTextContent('Chưa nộp');
    expect(within(the).queryByText('Sắp mở')).not.toBeInTheDocument();
  });

  it('đã nộp hợp đồng → việc "Nộp hợp đồng" hiện "Đã nộp"', async () => {
    dbTruongDanhSach.the = [theDotMau({ trang_thai_hop_dong: 'da_nop' })];
    dangNhap('truong');
    moTrang('/trang-chu');
    const the = await screen.findByRole('article', { name: 'HSG Đợt Bịa 2026' });
    expect(within(the).getByRole('link', { name: /Nộp hợp đồng/ })).toHaveTextContent('Đã nộp');
  });

  it('bấm "Xem danh sách tham gia" → sang màn danh sách của đợt', async () => {
    dbTruongDanhSach.the = [theDotMau()];
    dbTruongDanhSach.danhSach['dot-hsg-1'] = danhSachMau();
    dangNhap('truong');
    moTrang('/trang-chu');
    await userEvent.click(await screen.findByRole('link', { name: 'Xem danh sách tham gia' }));
    expect(await screen.findByRole('heading', { name: /Danh sách tham gia — HSG Đợt Bịa 2026/ })).toBeInTheDocument();
  });

  it('chưa có đợt → "Chưa có đợt bồi dưỡng nào cho trường"', async () => {
    dangNhap('truong');
    moTrang('/trang-chu');
    expect(await screen.findByText('Chưa có đợt bồi dưỡng nào cho trường')).toBeInTheDocument();
    expect(screen.queryByRole('article')).not.toBeInTheDocument();
  });

  it('lỗi tải → thông báo + "Thử lại" tải lại thành công', async () => {
    const { suaXong } = hongTam(URL_DOT);
    dbTruongDanhSach.the = [theDotMau()];
    dangNhap('truong');
    moTrang('/trang-chu');
    expect(await screen.findByText('Không tải được danh sách đợt')).toBeInTheDocument();
    expect(screen.getByText('Lỗi máy chủ bịa')).toBeInTheDocument();
    suaXong();
    await userEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
    expect(await screen.findByRole('article', { name: 'HSG Đợt Bịa 2026' })).toBeInTheDocument();
    expect(screen.queryByText('Không tải được danh sách đợt')).not.toBeInTheDocument();
  });

  it.each(['so_gddt', 'phong_vhxh', 'quan_tri'])(
    'vai trò %s giữ trang chủ tạm, không gọi API của trường',
    async (vaiTro) => {
      const { daGoi, go } = ngheApiTruong();
      try {
        dangNhap(vaiTro);
        moTrang('/trang-chu');
        expect(await screen.findByText(/Xin chào,/)).toBeInTheDocument();
        expect(screen.getByText(/sắp có/)).toBeInTheDocument();
        expect(screen.queryByText('Việc cần làm')).not.toBeInTheDocument();
        expect(daGoi).toEqual([]);
      } finally {
        go();
      }
    },
  );
});

describe('Màn danh sách tham gia của trường (/dot/:dotId/danh-sach)', () => {
  it('đang tải → mỗi người 1 thẻ: họ tên, ngày sinh, lớp/môn, giai đoạn, suất, ghi chú; cuối màn tổng suất + giá trị', async () => {
    dbTruongDanhSach.danhSach['dot-hsg-1'] = danhSachMau();
    dangNhap('truong');
    moTrang('/dot/dot-hsg-1/danh-sach');

    expect(await screen.findByLabelText('Đang tải')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Danh sách tham gia — HSG Đợt Bịa 2026' })).toBeInTheDocument();
    expect(screen.getByText('Hạn nộp: 31/12/2026 · 3 người')).toBeInTheDocument();
    expect(screen.getByText('Chờ xác nhận')).toBeInTheDocument();

    const nguoi = within(screen.getByRole('list', { name: 'Người tham gia' })).getAllByRole('listitem');
    expect(nguoi).toHaveLength(3);
    expect(within(nguoi[0]).getByText('GV Bịa An')).toBeInTheDocument();
    expect(within(nguoi[0]).getByText('1 suất')).toBeInTheDocument();
    expect(
      within(nguoi[0]).getByText(/Ngày sinh: 01\/02\/1990 · Lớp\/môn: Toán 9 · Giai đoạn: Cả 2/),
    ).toBeInTheDocument();
    expect(within(nguoi[1]).getByText('0,5 suất')).toBeInTheDocument();
    expect(within(nguoi[1]).getByText(/Ngày sinh: — · Lớp\/môn: — · Giai đoạn: Chỉ GĐ1/)).toBeInTheDocument();
    expect(within(nguoi[1]).getByText('Ghi chú: chỉ học GĐ1 (bịa)')).toBeInTheDocument();

    const tong = screen.getByRole('region', { name: 'Tổng cộng' });
    expect(within(tong).getByText('Tổng suất: 2,5')).toBeInTheDocument();
    expect(within(tong).getByText('Giá trị tạm tính: 3.086.418 đ')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '← Trang chủ' })).toHaveAttribute('href', '/trang-chu');
  });

  it('đợt chưa có đơn giá → "Giá trị tạm tính: chưa có đơn giá", không hiện số tiền', async () => {
    dbTruongDanhSach.danhSach['dot-hsg-1'] = danhSachMau({ don_gia: null, gia_tri_tam_tinh: null });
    dangNhap('truong');
    moTrang('/dot/dot-hsg-1/danh-sach');
    expect(await screen.findByText('Giá trị tạm tính: chưa có đơn giá')).toBeInTheDocument();
    expect(screen.queryByText(/\d đ$/)).not.toBeInTheDocument();
  });

  it('danh sách rỗng → báo chưa có người, tổng suất 0', async () => {
    dbTruongDanhSach.danhSach['dot-hsg-1'] = danhSachMau({ dong: [], tong_suat: 0, gia_tri_tam_tinh: 0 });
    dangNhap('truong');
    moTrang('/dot/dot-hsg-1/danh-sach');
    expect(await screen.findByText('Danh sách của trường cho đợt này chưa có người nào.')).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Người tham gia' })).not.toBeInTheDocument();
    expect(screen.getByText('Tổng suất: 0')).toBeInTheDocument();
  });

  it('404 (đợt không có danh sách của trường) → "Không tìm thấy danh sách của trường cho đợt này", không có nút thử lại', async () => {
    dangNhap('truong');
    moTrang('/dot/dot-cua-truong-khac/danh-sach');
    expect(await screen.findByText('Không tìm thấy danh sách của trường cho đợt này')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Thử lại' })).not.toBeInTheDocument();
  });

  it('lỗi khác → thông báo + "Thử lại" tải lại thành công', async () => {
    const { suaXong } = hongTam(`${URL_DOT}/:dotId/danh-sach`);
    dbTruongDanhSach.danhSach['dot-hsg-1'] = danhSachMau();
    dangNhap('truong');
    moTrang('/dot/dot-hsg-1/danh-sach');
    expect(await screen.findByText('Không tải được danh sách')).toBeInTheDocument();
    suaXong();
    await userEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
    expect(await screen.findByText('Tổng suất: 2,5')).toBeInTheDocument();
  });

  it.each(['so_gddt', 'phong_vhxh', 'quan_tri'])('vai trò %s → trang 404, không gọi API', async (vaiTro) => {
    const { daGoi, go } = ngheApiTruong();
    try {
      dbTruongDanhSach.danhSach['dot-hsg-1'] = danhSachMau();
      dangNhap(vaiTro);
      moTrang('/dot/dot-hsg-1/danh-sach');
      expect(await screen.findByText('Không tìm thấy trang')).toBeInTheDocument();
      await waitFor(() => expect(daGoi).toEqual([]));
    } finally {
      go();
    }
  });
});
