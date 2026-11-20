import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { renderVoiRouter } from '@/test/testUtils';
import { datToken } from '@/auth/tokenStore';
import { db } from '@/test/mocks/db';
import { server } from '@/test/mocks/server';
import { PHAN_3_MAU, dbHopDong, hopDongDaNopMau, hopDongMau, lyDo } from '@/test/mocks/hopDong';
import type { HopDongPhanHoi } from '@/api/hopDong';
import { routesCongDonVi } from '@/router';

// Issue #64 / ADR 0015 X4, M5, S5, S6: màn hợp đồng của trường — nháp Phần 3–4, điều kiện Nộp, Nộp, chỉ xem
// sau khi nộp. Mọi giá trị đều BỊA. router.tsx tạo createBrowserRouter ngay khi import — thay bằng hàm rỗng.
vi.mock('react-router-dom', async (goc) => ({
  ...(await goc<typeof import('react-router-dom')>()),
  createBrowserRouter: vi.fn(),
}));

beforeEach(() => vi.stubEnv('VITE_CONG_DON_VI_HOSTNAME', window.location.hostname));
afterEach(() => vi.unstubAllEnvs());

const URL_HD = '/cong-don-vi/truong/dot/:dotId/hop-dong';
type User = ReturnType<typeof userEvent.setup>;

function moTrang(hd: HopDongPhanHoi = hopDongMau()) {
  dbHopDong.truong['dot-hsg-1'] = hd;
  db.nguoiDung.vai_tro = 'truong';
  datToken('token-gia-lap');
  renderVoiRouter(routesCongDonVi, { initialEntries: ['/dot/dot-hsg-1/hop-dong'] });
  return screen.findByRole('heading', { name: /Thông tin hợp đồng — HSG Đợt Bịa 2026/ });
}

/** Ghi mọi PUT/POST tới API hợp đồng của trường, rồi nhường cho handler mặc định. */
function ghiYeuCau() {
  const ds: { method: string; path: string; body: unknown }[] = [];
  const ghi = async ({ request }: { request: Request }) => {
    const text = await request.clone().text();
    ds.push({ method: request.method, path: new URL(request.url).pathname, body: text ? JSON.parse(text) : null });
    return undefined;
  };
  server.use(http.put(URL_HD, ghi), http.post(`${URL_HD}/nop`, ghi));
  return ds;
}

const o = (nhan: RegExp) => screen.getByLabelText(nhan) as HTMLInputElement;
const nutNop = () => screen.getByRole('button', { name: 'Nộp hợp đồng' });
const lyDoChan = () => screen.queryByRole('list', { name: 'Lý do chưa nộp được' });

async function dien(user: User, nhan: RegExp, giaTri: string) {
  await user.clear(o(nhan));
  if (giaTri) await user.type(o(nhan), giaTri);
}

describe('Màn hợp đồng của trường (/dot/:dotId/hop-dong)', () => {
  it('đang tải → số liệu (tổng suất "2,5", đơn giá, giá trị), hồ sơ đơn vị + STK chuyển khoản, form Phần 3', async () => {
    dbHopDong.truong['dot-hsg-1'] = hopDongMau();
    db.nguoiDung.vai_tro = 'truong';
    datToken('token-gia-lap');
    renderVoiRouter(routesCongDonVi, { initialEntries: ['/dot/dot-hsg-1/hop-dong'] });
    expect(await screen.findByLabelText('Đang tải')).toBeInTheDocument();
    await screen.findByRole('heading', { name: /Thông tin hợp đồng/ });
    const soLieu = screen.getByRole('region', { name: 'Số liệu hợp đồng' });
    expect(within(soLieu).getByText('2,5')).toBeInTheDocument();
    expect(within(soLieu).getByText('1.234.567 đ')).toBeInTheDocument();
    expect(within(soLieu).getByText('3.086.418 đ')).toBeInTheDocument();
    const hoSo = screen.getByRole('region', { name: 'Hồ sơ đơn vị' });
    expect(within(hoSo).getByText('Đủ thông tin')).toBeInTheDocument();
    expect(within(hoSo).getByRole('link', { name: 'Xem / sửa hồ sơ đơn vị' })).toHaveAttribute('href', '/ho-so-don-vi');
    expect(within(hoSo).getByText('HCMUE1234567')).toBeInTheDocument();
    expect(o(/^Người nhận bản giấy hợp đồng/)).toHaveValue('');
    expect(o(/^SĐT người nhận/)).toHaveAttribute('inputmode', 'numeric');
    expect(screen.getByRole('checkbox', { name: /Trường là điểm học trực tiếp/ })).not.toBeChecked();
  });

  it('chưa có đơn giá → "Chưa có đơn giá" ở đơn giá và giá trị', async () => {
    await moTrang(hopDongMau({ don_gia: null, gia_tri: null, ly_do_chan: lyDo('chua_co_don_gia') }));
    const soLieu = screen.getByRole('region', { name: 'Số liệu hợp đồng' });
    expect(within(soLieu).getAllByText('Chưa có đơn giá')).toHaveLength(2);
  });

  it('còn lý do chặn → Nộp tắt, hiện từng lý do ngay trên nút (aria-describedby)', async () => {
    await moTrang(hopDongMau({ ly_do_chan: lyDo('danh_sach_chua_xac_nhan', 'ho_so_chua_du', 'phan_3_chua_du') }));
    expect(nutNop()).toBeDisabled();
    expect(nutNop()).toHaveAttribute('aria-describedby', 'ly-do-chan');
    const ds = lyDoChan()!;
    expect(
      within(ds)
        .getAllByRole('listitem')
        .map((li) => li.textContent),
    ).toEqual([
      'Danh sách chưa được xác nhận',
      'Hồ sơ đơn vị còn thiếu 3 mục',
      'Phần 3 (người nhận bản giấy hợp đồng) còn thiếu hoặc sai',
    ]);
  });

  it('không còn lý do → Nộp bật, không có danh sách lý do', async () => {
    await moTrang(hopDongMau({ phan_3: PHAN_3_MAU, ly_do_chan: [] }));
    expect(nutNop()).toBeEnabled();
    expect(lyDoChan()).not.toBeInTheDocument();
  });

  it('giá trị dưới 50.000.000 → không có Phần 4', async () => {
    await moTrang(hopDongMau({ gia_tri: 49_999_999, can_phan_4: false }));
    expect(screen.queryByRole('heading', { name: 'Phần 4 — Quyết định chỉ định thầu' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/^Số QĐ chỉ định thầu/)).not.toBeInTheDocument();
  });

  it('giá trị từ 50.000.000 → có Phần 4: số QĐ + ngày QĐ (dd/mm/yyyy) kèm khoảng ngày của đợt', async () => {
    await moTrang(
      hopDongMau({
        gia_tri: 50_000_000,
        can_phan_4: true,
        phan_4: { so_qd: '12/QĐ-BIA', ngay_qd: '2026-11-15' },
      }),
    );
    expect(screen.getByRole('heading', { name: 'Phần 4 — Quyết định chỉ định thầu' })).toBeInTheDocument();
    expect(o(/^Số QĐ chỉ định thầu/)).toHaveValue('12/QĐ-BIA');
    expect(o(/^Ngày QĐ/)).toHaveValue('15/11/2026');
    expect(screen.getByText('Ngày QĐ từ 01/11/2026 đến 30/11/2026')).toBeInTheDocument();
  });

  it('Lưu nháp gửi PUT đủ khóa (ô trống = null) → tính lại lý do chặn từ phản hồi, Nộp bật', async () => {
    const yeuCau = ghiYeuCau();
    const user = userEvent.setup();
    await moTrang(hopDongMau({ trang_thai_danh_sach: 'da_xac_nhan', ly_do_chan: lyDo('phan_3_chua_du') }));
    expect(nutNop()).toBeDisabled();
    await dien(user, /^Người nhận bản giấy hợp đồng/, '  Người Nhận Bịa ');
    await dien(user, /^SĐT người nhận/, '0900 000 009');
    await dien(user, /^Địa chỉ nhận/, 'Số 1, đường Bịa');
    // Có thay đổi chưa lưu → chưa cho nộp.
    expect(nutNop()).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Lưu nháp' }));

    // Khung Cổng đơn vị có Notifications riêng → thông báo có thể hiện 2 lần trong test.
    expect((await screen.findAllByText('Đã lưu nháp thông tin hợp đồng'))[0]).toBeInTheDocument();
    expect(yeuCau).toEqual([
      {
        method: 'PUT',
        path: '/cong-don-vi/truong/dot/dot-hsg-1/hop-dong',
        body: {
          nguoi_nhan: 'Người Nhận Bịa',
          sdt_nguoi_nhan: '0900000009',
          dia_chi_nhan: 'Số 1, đường Bịa',
          ghi_chu: null,
          so_qd: null,
          ngay_qd: null,
          diem_hoc_truc_tiep: false,
        },
      },
    ]);
    await waitFor(() => expect(nutNop()).toBeEnabled());
    expect(lyDoChan()).not.toBeInTheDocument();
  });

  it('SĐT sai → báo lỗi dưới ô, KHÔNG gửi PUT', async () => {
    const yeuCau = ghiYeuCau();
    const user = userEvent.setup();
    await moTrang();
    await dien(user, /^SĐT người nhận/, '12345');
    await user.click(screen.getByRole('button', { name: 'Lưu nháp' }));
    expect(await screen.findByText('SĐT gồm 10 số, bắt đầu bằng 0')).toBeInTheDocument();
    expect(o(/^SĐT người nhận/)).toHaveAttribute('aria-invalid', 'true');
    expect(yeuCau).toEqual([]);
  });

  it('server 400 có fields → lỗi hiện dưới đúng ô', async () => {
    server.use(
      http.put(URL_HD, () =>
        HttpResponse.json(
          {
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Thông tin hợp đồng chưa hợp lệ',
              fields: [{ field: 'nguoi_nhan', message: 'Lỗi người nhận từ máy chủ (bịa)' }],
            },
          },
          { status: 400 },
        ),
      ),
    );
    const user = userEvent.setup();
    await moTrang();
    await dien(user, /^Người nhận bản giấy hợp đồng/, 'Người Bịa');
    await user.click(screen.getByRole('button', { name: 'Lưu nháp' }));
    const loi = await screen.findByText('Lỗi người nhận từ máy chủ (bịa)');
    expect(o(/^Người nhận bản giấy hợp đồng/)).toHaveAttribute('aria-describedby', expect.stringContaining(loi.id));
  });

  it('Nộp → hộp xác nhận nêu hệ quả → POST nop → banner "Đã nộp lúc…", trang chỉ xem', async () => {
    const yeuCau = ghiYeuCau();
    const user = userEvent.setup();
    await moTrang(hopDongMau({ trang_thai_danh_sach: 'da_xac_nhan', phan_3: PHAN_3_MAU, ly_do_chan: [] }));
    await user.click(nutNop());
    const hop = await screen.findByRole('dialog', { name: 'Nộp hợp đồng' });
    expect(
      within(hop).getByText(
        'Sau khi nộp, danh sách và thông tin hợp đồng chỉ xem được. Cần sửa phải liên hệ HCMUE mở lại.',
      ),
    ).toBeInTheDocument();
    await user.click(within(hop).getByRole('button', { name: 'Nộp' }));

    expect(await screen.findByText('Đã nộp lúc 20/11/2026 10:04')).toBeInTheDocument();
    expect(yeuCau).toEqual([{ method: 'POST', path: '/cong-don-vi/truong/dot/dot-hsg-1/hop-dong/nop', body: null }]);
    expect(screen.getByLabelText('Trạng thái hợp đồng: Đã nộp')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Lưu nháp' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Nộp hợp đồng' })).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.getByText('Người Nhận Bịa')).toBeInTheDocument();
  });

  it('server 400 khi Nộp → hiện danh sách lý do server trả trong hộp xác nhận', async () => {
    server.use(
      http.post(`${URL_HD}/nop`, () =>
        HttpResponse.json(
          {
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Chưa nộp được hợp đồng',
              fields: [
                { field: 'ho_so_chua_du', message: 'Hồ sơ đơn vị còn thiếu 1 mục' },
                { field: 'ngay_qd_ngoai_khoang', message: 'Ngày QĐ phải từ 01/11/2026 đến 30/11/2026' },
              ],
            },
          },
          { status: 400 },
        ),
      ),
    );
    const user = userEvent.setup();
    await moTrang(hopDongMau({ phan_3: PHAN_3_MAU, ly_do_chan: [] }));
    await user.click(nutNop());
    const hop = await screen.findByRole('dialog', { name: 'Nộp hợp đồng' });
    await user.click(within(hop).getByRole('button', { name: 'Nộp' }));
    const alert = await within(hop).findByRole('alert');
    expect(alert).toHaveTextContent('Chưa nộp được hợp đồng');
    expect(
      within(alert)
        .getAllByRole('listitem')
        .map((li) => li.textContent),
    ).toEqual(['Hồ sơ đơn vị còn thiếu 1 mục', 'Ngày QĐ phải từ 01/11/2026 đến 30/11/2026']);
  });

  it('server 409 khi Nộp → hiện thông điệp server', async () => {
    server.use(
      http.post(`${URL_HD}/nop`, () =>
        HttpResponse.json(
          { error: { code: 'CONFLICT', message: 'Hợp đồng đã nộp — liên hệ HCMUE nếu cần mở lại' } },
          { status: 409 },
        ),
      ),
    );
    const user = userEvent.setup();
    await moTrang(hopDongMau({ phan_3: PHAN_3_MAU, ly_do_chan: [] }));
    await user.click(nutNop());
    const hop = await screen.findByRole('dialog', { name: 'Nộp hợp đồng' });
    await user.click(within(hop).getByRole('button', { name: 'Nộp' }));
    expect(await within(hop).findByRole('alert')).toHaveTextContent('Hợp đồng đã nộp — liên hệ HCMUE nếu cần mở lại');
  });

  it('đã nộp → chỉ xem: banner thời điểm nộp, số liệu + STK từ bản chụp, không form', async () => {
    await moTrang(
      hopDongDaNopMau({
        so_nguoi: 4,
        gia_tri: 4_000_000,
        chuyen_khoan: { stk: 'HCMUE7654321', don_vi_tiep_nhan: 'x', ngan_hang: 'y' },
      }),
    );
    expect(screen.getByText('Đã nộp lúc 20/11/2026 10:04')).toBeInTheDocument();
    expect(
      within(screen.getByRole('region', { name: 'Số liệu hợp đồng' })).getByText('4.000.000 đ'),
    ).toBeInTheDocument();
    expect(screen.getByText('HCMUE7654321')).toBeInTheDocument();
    expect(screen.getByText(/Bản chụp lúc nộp/)).toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Nộp hợp đồng' })).not.toBeInTheDocument();
  });

  it('không có hợp đồng cho đợt → báo không tìm thấy', async () => {
    db.nguoiDung.vai_tro = 'truong';
    datToken('token-gia-lap');
    renderVoiRouter(routesCongDonVi, { initialEntries: ['/dot/dot-khac/hop-dong'] });
    expect(await screen.findByText('Không tìm thấy hợp đồng của trường cho đợt này')).toBeInTheDocument();
  });
});
