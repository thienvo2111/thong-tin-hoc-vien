import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { renderVoiRouter } from '@/test/testUtils';
import { datToken } from '@/auth/tokenStore';
import { db } from '@/test/mocks/db';
import { server } from '@/test/mocks/server';
import { DON_VI_MAU, dbHoSoDonVi, hoSoMau } from '@/test/mocks/hoSoDonVi';
import { routesCongDonVi } from '@/router';

// Issue #63 / ADR 0015 M4, U1, U2, X4, O4: Hồ sơ đơn vị — form của trường, badge trang chủ, màn Quản trị.
// router.tsx tạo createBrowserRouter ngay khi import — thay bằng hàm rỗng để test chỉ dùng mảng route.
vi.mock('react-router-dom', async (goc) => ({
  ...(await goc<typeof import('react-router-dom')>()),
  createBrowserRouter: vi.fn(),
}));

beforeEach(() => vi.stubEnv('VITE_CONG_DON_VI_HOSTNAME', window.location.hostname));
afterEach(() => vi.unstubAllEnvs());

const URL_HS = '/cong-don-vi/ho-so-don-vi';
type User = ReturnType<typeof userEvent.setup>;

function dangNhap(vaiTro: string) {
  db.nguoiDung.vai_tro = vaiTro;
  datToken('token-gia-lap');
}

const moTrang = (duongDan: string) => renderVoiRouter(routesCongDonVi, { initialEntries: [duongDan] });

/** Ghi lại mọi request tới API hồ sơ đơn vị (method + body). */
function ngheApiHoSo() {
  const daGoi: { method: string; url: string; body?: Record<string, unknown> }[] = [];
  const nghe = async ({ request }: { request: Request }) => {
    if (!new URL(request.url).pathname.startsWith(URL_HS)) return;
    const body = request.method === 'PUT' ? await request.clone().json() : undefined;
    daGoi.push({ method: request.method, url: request.url, body });
  };
  server.events.on('request:start', nghe);
  return { daGoi, go: () => server.events.removeListener('request:start', nghe) };
}

const o = (nhan: RegExp) => screen.getByLabelText(nhan) as HTMLInputElement;
const hopChuyenKhoan = () => screen.getByRole('region', { name: 'Thông tin chuyển khoản cho HCMUE' });

async function moForm() {
  dangNhap('truong');
  moTrang('/ho-so-don-vi');
  return screen.findByRole('button', { name: 'Lưu hồ sơ' });
}

async function go(user: User, nhan: RegExp, giaTri: string) {
  await user.clear(o(nhan));
  if (giaTri) await user.type(o(nhan), giaTri);
}

describe('Form Hồ sơ đơn vị của trường (/ho-so-don-vi)', () => {
  it('đang tải → 4 nhóm theo Google Form, ô bắt buộc có *, tên trường điền sẵn từ danh mục khi chưa khai', async () => {
    dangNhap('truong');
    moTrang('/ho-so-don-vi');
    expect(await screen.findByLabelText('Đang tải')).toBeInTheDocument();
    await screen.findByRole('button', { name: 'Lưu hồ sơ' });
    for (const ten of [
      'Thông tin đơn vị',
      'Thông tin thanh toán',
      'Hiệu trưởng và kế toán (nhận kinh phí hỗ trợ)',
      'Hậu cần cơ sở (dùng khi trường là điểm học trực tiếp)',
    ]) {
      expect(screen.getByRole('heading', { name: ten })).toBeInTheDocument();
    }
    expect(o(/^Tên trường/)).toHaveValue(DON_VI_MAU.ten);
    expect(screen.getByText('Ghi đúng tên để đi kho bạc')).toBeInTheDocument();
    // Dấu * ở ô bắt buộc; ô hậu cần không có.
    expect(o(/^Tên trường \*$/)).toBeInTheDocument();
    expect(o(/^Lưu trú gần trường \(kèm SĐT\)$/)).toBeInTheDocument();
    expect(o(/^Mã QHNS/)).toHaveAttribute('inputmode', 'numeric');
    expect(o(/^SĐT Kế toán/)).toHaveAttribute('inputmode', 'numeric');
    expect(o(/^STK Hiệu trưởng/)).toHaveAttribute('inputmode', 'numeric');
    const tinhTrang = screen.getByRole('status', { name: 'Tình trạng hồ sơ' });
    expect(within(tinhTrang).getByText('Chưa khai')).toBeInTheDocument();
  });

  it('hồ sơ đã khai → điền đúng giá trị, tình trạng "Đủ thông tin", hiện STK chuyển khoản', async () => {
    dbHoSoDonVi.cuaTruong = hoSoMau({ ten_truong: 'Tên Trường Đã Khai' });
    await moForm();
    expect(o(/^Tên trường/)).toHaveValue('Tên Trường Đã Khai');
    expect(o(/^Mã QHNS/)).toHaveValue('1234567');
    expect(
      within(screen.getByRole('status', { name: 'Tình trạng hồ sơ' })).getByText('Đủ thông tin'),
    ).toBeInTheDocument();
    expect(within(hopChuyenKhoan()).getByText('HCMUE1234567')).toBeInTheDocument();
  });

  it('ô QHNS: chưa đủ 7 số → nhắc nhập đủ; đủ 7 số → STK HCMUE+QHNS, PVcomBank, đơn vị tiếp nhận; sửa → đổi/ẩn ngay', async () => {
    const user = userEvent.setup();
    await moForm();
    expect(within(hopChuyenKhoan()).getByText('Nhập đủ 7 số mã QHNS để xem số tài khoản')).toBeInTheDocument();

    await go(user, /^Mã QHNS/, '123456');
    expect(within(hopChuyenKhoan()).getByText('Nhập đủ 7 số mã QHNS để xem số tài khoản')).toBeInTheDocument();
    expect(within(hopChuyenKhoan()).queryByText(/^HCMUE/)).not.toBeInTheDocument();

    await user.type(o(/^Mã QHNS/), '7');
    const hop = hopChuyenKhoan();
    expect(within(hop).getByText('HCMUE1234567')).toBeInTheDocument();
    expect(within(hop).getByText('Ngân hàng: Ngân hàng TMCP Đại Chúng Việt Nam (PVcomBank)')).toBeInTheDocument();
    expect(within(hop).getByText('Đơn vị tiếp nhận: Trường Đại học Sư phạm Thành phố Hồ Chí Minh')).toBeInTheDocument();
    expect(within(hop).getByText('Kiểm tra kỹ: sai mã QHNS là chuyển nhầm tài khoản')).toBeInTheDocument();

    await user.type(o(/^Mã QHNS/), '{Backspace}');
    expect(within(hopChuyenKhoan()).queryByText('HCMUE1234567')).not.toBeInTheDocument();
    expect(within(hopChuyenKhoan()).getByText('Nhập đủ 7 số mã QHNS để xem số tài khoản')).toBeInTheDocument();

    await go(user, /^Mã QHNS/, '7654321');
    expect(within(hopChuyenKhoan()).getByText('HCMUE7654321')).toBeInTheDocument();

    await go(user, /^Mã QHNS/, '76543210');
    expect(within(hopChuyenKhoan()).queryByText(/^HCMUE/)).not.toBeInTheDocument();
  });

  it('sai định dạng MST / QHNS / SĐT / email → báo dưới đúng ô, KHÔNG gửi lên server', async () => {
    const { daGoi, go: thoi } = ngheApiHoSo();
    try {
      const user = userEvent.setup();
      const nut = await moForm();
      await go(user, /^Mã số thuế/, '0123456789-01');
      await go(user, /^Mã QHNS/, '123456');
      await go(user, /^SĐT người đại diện/, '1900000001');
      await go(user, /^SĐT Kế toán/, '090000002');
      await go(user, /^Email nhận hóa đơn/, 'khong-phai-email');
      await user.click(nut);

      expect(await screen.findByText('Mã số thuế gồm 10 số, hoặc dạng 0123456789-001')).toBeInTheDocument();
      expect(screen.getByText('Mã QHNS gồm đúng 7 chữ số')).toBeInTheDocument();
      expect(screen.getAllByText('SĐT gồm 10 số, bắt đầu bằng 0')).toHaveLength(2);
      expect(screen.getByText('Email không hợp lệ')).toBeInTheDocument();
      expect(o(/^Mã QHNS/)).toHaveAttribute('aria-invalid', 'true');
      expect(o(/^Email nhận hóa đơn/)).toHaveAttribute('aria-invalid', 'true');
      expect(o(/^Địa chỉ/)).not.toHaveAttribute('aria-invalid', 'true');
      expect(daGoi.filter((r) => r.method === 'PUT')).toEqual([]);
    } finally {
      thoi();
    }
  });

  it('nháp thiếu ô bắt buộc vẫn lưu: PUT gửi null cho ô trống, SĐT bỏ dấu cách; hiện "Còn thiếu N mục" + tên mục', async () => {
    const { daGoi, go: thoi } = ngheApiHoSo();
    try {
      const user = userEvent.setup();
      const nut = await moForm();
      await go(user, /^Địa chỉ/, '  Ấp Bịa, xã Thử  ');
      await go(user, /^SĐT người đại diện/, '0900 000 001');
      await user.click(nut);

      expect((await screen.findAllByText('Đã lưu hồ sơ đơn vị'))[0]).toBeInTheDocument();
      const put = daGoi.find((r) => r.method === 'PUT');
      expect(put?.body).toMatchObject({
        ten_truong: DON_VI_MAU.ten,
        dia_chi: 'Ấp Bịa, xã Thử',
        sdt_dai_dien: '0900000001',
        ma_so_thue: null,
        ma_qhns: null,
        luu_tru: null,
      });
      expect(Object.keys(put?.body ?? {})).toHaveLength(24);

      const tinhTrang = screen.getByRole('status', { name: 'Tình trạng hồ sơ' });
      expect(within(tinhTrang).getByText('Còn thiếu 17 mục')).toBeInTheDocument();
      expect(
        within(tinhTrang).getByText(/Còn thiếu: Mã số thuế, Người đại diện trên hợp đồng, Email nhận hóa đơn/),
      ).toBeInTheDocument();
      expect(within(tinhTrang).queryByText(/Tên trường,/)).not.toBeInTheDocument();
      // Form giữ giá trị đã chuẩn hóa từ server.
      expect(o(/^SĐT người đại diện/)).toHaveValue('0900000001');
    } finally {
      thoi();
    }
  });

  it('đủ mọi ô → "Đủ thông tin"', async () => {
    dbHoSoDonVi.cuaTruong = hoSoMau({ ma_nguon: null });
    const user = userEvent.setup();
    const nut = await moForm();
    expect(
      within(screen.getByRole('status', { name: 'Tình trạng hồ sơ' })).getByText('Còn thiếu 1 mục'),
    ).toBeInTheDocument();
    await go(user, /^Mã nguồn/, '13');
    await user.click(nut);
    expect(
      await within(screen.getByRole('status', { name: 'Tình trạng hồ sơ' })).findByText('Đủ thông tin'),
    ).toBeInTheDocument();
    expect(dbHoSoDonVi.cuaTruong?.ma_nguon).toBe('13');
  });

  it('server trả 400 VALIDATION_ERROR fields → lỗi hiện dưới đúng ô', async () => {
    server.use(
      http.put(URL_HS, () =>
        HttpResponse.json(
          {
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Hồ sơ đơn vị chưa hợp lệ',
              fields: [
                { field: 'so_tai_khoan', message: 'STK bị từ chối (bịa)' },
                { field: 'kt_ho_ten', message: 'Họ tên kế toán bị từ chối (bịa)' },
              ],
            },
          },
          { status: 400 },
        ),
      ),
    );
    const user = userEvent.setup();
    await user.click(await moForm());
    expect(await screen.findByText('STK bị từ chối (bịa)')).toBeInTheDocument();
    expect(o(/^Số tài khoản/)).toHaveAttribute('aria-invalid', 'true');
    expect(o(/^Họ tên Kế toán/)).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('Họ tên kế toán bị từ chối (bịa)')).toBeInTheDocument();
    expect(o(/^Ngân hàng \*$/)).not.toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('Hồ sơ đơn vị chưa hợp lệ')).toBeInTheDocument();
  });

  it('lỗi tải → thông báo + "Thử lại" tải lại thành công', async () => {
    let hong = true;
    server.use(
      http.get(URL_HS, () =>
        hong
          ? HttpResponse.json({ error: { code: 'INTERNAL', message: 'Lỗi máy chủ bịa' } }, { status: 500 })
          : undefined,
      ),
    );
    dangNhap('truong');
    moTrang('/ho-so-don-vi');
    expect(await screen.findByText('Không tải được hồ sơ đơn vị')).toBeInTheDocument();
    expect(screen.getByText('Lỗi máy chủ bịa')).toBeInTheDocument();
    hong = false;
    await userEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
    expect(await screen.findByRole('button', { name: 'Lưu hồ sơ' })).toBeInTheDocument();
  });

  it.each(['so_gddt', 'phong_vhxh', 'quan_tri'])('vai trò %s → trang 404, không gọi API hồ sơ', async (vaiTro) => {
    const { daGoi, go: thoi } = ngheApiHoSo();
    try {
      dangNhap(vaiTro);
      moTrang('/ho-so-don-vi');
      expect(await screen.findByText('Không tìm thấy trang')).toBeInTheDocument();
      await waitFor(() => expect(daGoi).toEqual([]));
    } finally {
      thoi();
    }
  });

  it('menu của trường có "Hồ sơ đơn vị" sau Trang chủ', async () => {
    await moForm();
    const menu = screen.getByRole('navigation', { name: 'Menu Cổng đơn vị' });
    expect(
      within(menu)
        .getAllByRole('link')
        .map((a) => a.textContent),
    ).toEqual(['Trang chủ', 'Hồ sơ đơn vị', 'Hướng dẫn']);
  });
});

describe('Thẻ Hồ sơ đơn vị trên trang chủ trường', () => {
  it.each([
    ['chưa khai', null, 'Chưa khai'],
    ['khai thiếu', hoSoMau({ ma_qhns: null, kt_sdt: null }), 'Còn thiếu 2 mục'],
    ['đủ', hoSoMau(), 'Đủ thông tin'],
  ])('%s → badge "%s"… và link sang /ho-so-don-vi', async (_ten, hoSo, badge) => {
    dbHoSoDonVi.cuaTruong = hoSo;
    dangNhap('truong');
    moTrang('/trang-chu');
    const the = await screen.findByRole('region', { name: 'Hồ sơ đơn vị' });
    expect(await within(the).findByText(badge)).toBeInTheDocument();
    expect(within(the).queryByText('Sắp mở')).not.toBeInTheDocument();
    expect(within(the).getByRole('link', { name: 'Xem / sửa hồ sơ đơn vị' })).toHaveAttribute('href', '/ho-so-don-vi');
  });

  it('bấm link → mở form hồ sơ', async () => {
    dangNhap('truong');
    moTrang('/trang-chu');
    await userEvent.click(await screen.findByRole('link', { name: 'Xem / sửa hồ sơ đơn vị' }));
    expect(await screen.findByRole('button', { name: 'Lưu hồ sơ' })).toBeInTheDocument();
  });
});

describe('Quản trị xem hồ sơ đơn vị (/quan-tri/ho-so-don-vi/:donViId)', () => {
  it('chỉ đọc: các nhóm, tình trạng, STK chuyển khoản; STK cá nhân che còn 4 số cuối, "Hiện" mới thấy đủ', async () => {
    dbHoSoDonVi.theoId['tr-9'] = { ten: 'Trường Bịa Chín', hoSo: hoSoMau({ ma_qhns: '7654321' }) };
    dangNhap('quan_tri');
    moTrang('/quan-tri/ho-so-don-vi/tr-9');
    expect(await screen.findByRole('heading', { name: 'Hồ sơ đơn vị — Trường Bịa Chín' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Thông tin thanh toán' })).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Lưu hồ sơ' })).not.toBeInTheDocument();
    expect(
      within(screen.getByRole('status', { name: 'Tình trạng hồ sơ' })).getByText('Đủ thông tin'),
    ).toBeInTheDocument();
    expect(within(hopChuyenKhoan()).getByText('HCMUE7654321')).toBeInTheDocument();
    // STK của trường (Phần 2) không che.
    expect(screen.getByText('0000111122223333')).toBeInTheDocument();

    expect(screen.getByText('••••••••6666')).toBeInTheDocument();
    expect(screen.getByText('••••••••2222')).toBeInTheDocument();
    expect(screen.queryByText('9999888877776666')).not.toBeInTheDocument();
    expect(screen.queryByText('5555444433332222')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Hiện STK Hiệu trưởng' }));
    expect(screen.getByText('9999888877776666')).toBeInTheDocument();
    expect(screen.queryByText('5555444433332222')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Ẩn STK Hiệu trưởng' }));
    expect(screen.queryByText('9999888877776666')).not.toBeInTheDocument();
  });

  it('trường chưa khai → "Chưa khai"; id không tồn tại → "Không tìm thấy đơn vị"', async () => {
    dbHoSoDonVi.theoId['tr-8'] = { ten: 'Trường Bịa Tám', hoSo: null };
    dangNhap('quan_tri');
    const { router } = moTrang('/quan-tri/ho-so-don-vi/tr-8');
    expect(await screen.findByText('Trường chưa khai hồ sơ đơn vị.')).toBeInTheDocument();
    expect(screen.getByText('Chưa khai')).toBeInTheDocument();
    await router.navigate('/quan-tri/ho-so-don-vi/khong-co');
    expect(await screen.findByText('Không tìm thấy đơn vị')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Thử lại' })).not.toBeInTheDocument();
  });

  it.each(['truong', 'so_gddt'])('vai trò %s → trang 404, không gọi API', async (vaiTro) => {
    const { daGoi, go: thoi } = ngheApiHoSo();
    try {
      dbHoSoDonVi.theoId['tr-9'] = { ten: 'Trường Bịa Chín', hoSo: hoSoMau() };
      dangNhap(vaiTro);
      moTrang('/quan-tri/ho-so-don-vi/tr-9');
      expect(await screen.findByText('Không tìm thấy trang')).toBeInTheDocument();
      await waitFor(() => expect(daGoi.filter((r) => r.url.includes('tr-9'))).toEqual([]));
    } finally {
      thoi();
    }
  });
});
