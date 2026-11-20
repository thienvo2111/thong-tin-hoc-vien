import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { renderVoiRouter } from '@/test/testUtils';
import { datToken } from '@/auth/tokenStore';
import { db } from '@/test/mocks/db';
import { server } from '@/test/mocks/server';
import { dbDotTrienKhai, dotMau } from '@/test/mocks/dotTrienKhai';
import { dbDanhSachThamGia } from '@/test/mocks/danhSachThamGia';
import { dbDeNghiSua, mucDeNghiMau } from '@/test/mocks/deNghiSua';
import QuanTriDanhSachThamGia from './QuanTriDanhSachThamGia';

// Issue #62 / ADR 0015 X2: hàng đợi "Đề nghị của trường" — Quản trị Áp dụng / Từ chối. Dữ liệu bịa.
beforeEach(() => vi.stubEnv('VITE_CONG_DON_VI_HOSTNAME', window.location.hostname));
afterEach(() => vi.unstubAllEnvs());

type User = ReturnType<typeof userEvent.setup>;
const TRANG = '/quan-tri/danh-sach-tham-gia';

function hangDoiMau() {
  return [
    mucDeNghiMau(),
    mucDeNghiMau({
      id: 'dn-2',
      loai: 'bot',
      dong_id: 'd2',
      dong_hien_tai: {
        ho_ten: 'GV Bịa Hai',
        ngay_sinh: null,
        gioi_tinh: null,
        lop: 'Lớp B',
        giai_doan: 'chi_gd1',
        ty_le_suat: 0.5,
        y_kien_truong: 'khong_dong_y',
      },
      gia_tri: {},
      ly_do: 'Nghỉ dạy (bịa)',
    }),
    mucDeNghiMau({
      id: 'dn-3',
      don_vi: { id: 'tr-2', ten: 'Trường THCS&THPT Mẫu Hai' },
      loai: 'them',
      dong_id: null,
      dong_hien_tai: null,
      gia_tri: { ho_ten: 'GV Bịa Mới', ngay_sinh: null, gioi_tinh: null, lop: 'Văn 6', giai_doan: 'chi_gd2' },
      ly_do: null,
    }),
    mucDeNghiMau({
      id: 'dn-4',
      trang_thai: 'tu_choi',
      ly_do_tu_choi: 'Đúng theo hồ sơ (bịa)',
      xu_ly_luc: '2026-11-20T03:00:00.000Z',
      xu_ly_boi: { id: 'u-qt', ho_ten: 'Quản trị bịa' },
    }),
  ];
}

/** Ghi URL các request tới hàng đợi / xử lý đề nghị, rồi nhường handler mặc định. */
function ghiYeuCau() {
  const ds: { method: string; url: string; body: unknown }[] = [];
  const ghi = async ({ request }: { request: Request }) => {
    const text = await request.clone().text();
    const u = new URL(request.url);
    ds.push({ method: request.method, url: u.pathname + u.search, body: text ? JSON.parse(text) : null });
    return undefined;
  };
  server.use(
    http.get('/cong-don-vi/dot-trien-khai/:id/de-nghi', ghi),
    http.post('/cong-don-vi/de-nghi-sua/:id/ap-dung', ghi),
    http.post('/cong-don-vi/de-nghi-sua/:id/tu-choi', ghi),
  );
  return ds;
}

async function moTrang(user: User) {
  db.nguoiDung.vai_tro = 'quan_tri';
  datToken('token-gia-lap');
  dbDotTrienKhai.ds = [dotMau()];
  dbDeNghiSua.ds = hangDoiMau();
  dbDanhSachThamGia.danhSach = {
    tong_hop: [
      {
        don_vi_id: 'tr-1',
        ten_don_vi: 'Trường THCS Mẫu Một',
        ma_don_vi: 'TR-MAU-001',
        so_nguoi: 2,
        tong_suat: 1.5,
        trang_thai_danh_sach: 'bao_sai_lech',
        so_de_nghi_cho: 2,
      },
      {
        don_vi_id: 'tr-2',
        ten_don_vi: 'Trường THCS&THPT Mẫu Hai',
        ma_don_vi: null,
        so_nguoi: 1,
        tong_suat: 1,
        trang_thai_danh_sach: 'bao_sai_lech',
        so_de_nghi_cho: 1,
      },
    ],
    dong: [
      {
        id: 'd1',
        don_vi_id: 'tr-1',
        ho_ten: 'GV Bịa Một',
        ngay_sinh: '1990-02-01',
        gioi_tinh: 'Nam',
        ma_goc: null,
        lop: 'Lớp A',
        giai_doan: 'ca_hai',
        ty_le_suat: 1,
        ghi_chu: null,
        y_kien_truong: 'khong_dong_y',
        hoc_vien_id: null,
        co_de_nghi_cho: true,
      },
      {
        id: 'd9',
        don_vi_id: 'tr-1',
        ho_ten: 'GV Bịa Chín',
        ngay_sinh: null,
        gioi_tinh: null,
        ma_goc: null,
        lop: null,
        giai_doan: 'ca_hai',
        ty_le_suat: 1,
        ghi_chu: null,
        y_kien_truong: 'dong_y',
        hoc_vien_id: null,
        co_de_nghi_cho: false,
      },
    ],
  };
  renderVoiRouter([{ path: TRANG, element: <QuanTriDanhSachThamGia /> }], { initialEntries: [TRANG] });
  await user.click(await screen.findByRole('textbox', { name: 'Đợt triển khai' }));
  await user.click(await screen.findByRole('option', { name: 'HSG – HSG An Giang 2026' }));
  return screen.findByRole('region', { name: 'Đề nghị của trường' });
}

const theDeNghi = (nhan: string) => screen.getByRole('listitem', { name: nhan });

describe('Quản trị — hàng đợi đề nghị của trường (#62)', () => {
  it('mặc định "Chờ xử lý": badge số chờ, mỗi đề nghị có trường, loại, Hiện tại → Đề nghị, ghi chú/lý do của trường', async () => {
    const yeuCau = ghiYeuCau();
    const user = userEvent.setup();
    const muc = await moTrang(user);
    expect(await within(muc).findByLabelText('3 đề nghị chờ xử lý')).toHaveTextContent('3');
    expect(yeuCau[0].url).toBe('/cong-don-vi/dot-trien-khai/dtk-1/de-nghi?trang_thai=cho');

    const sua = theDeNghi('Sửa thông tin: GV Bịa Một');
    expect(within(sua).getByText('Trường THCS Mẫu Một')).toBeInTheDocument();
    const hang = within(sua).getAllByRole('row');
    expect(hang.map((h) => h.textContent)).toEqual([
      'Thông tinHiện tạiĐề nghị',
      'Họ tênGV Bịa MộtGV Bịa Một Sửa',
      'Giai đoạnCả 2Chỉ GĐ2',
    ]);
    expect(within(sua).getByText('Ghi chú của trường: Sai chính tả (bịa)')).toBeInTheDocument();

    const bot = theDeNghi('Bớt người: GV Bịa Hai');
    expect(within(bot).getByText(/Bớt: Họ tên: GV Bịa Hai · Lớp\/môn: Lớp B · Giai đoạn: Chỉ GĐ1/)).toBeInTheDocument();
    expect(within(bot).getByText('Lý do của trường: Nghỉ dạy (bịa)')).toBeInTheDocument();

    const them = theDeNghi('Thêm người: GV Bịa Mới');
    expect(within(them).getByText('Trường THCS&THPT Mẫu Hai')).toBeInTheDocument();
    expect(
      within(them).getByText('Thêm: Họ tên: GV Bịa Mới · Lớp/môn: Văn 6 · Giai đoạn: Chỉ GĐ2'),
    ).toBeInTheDocument();
    // Đề nghị đã từ chối không nằm trong bộ lọc "Chờ xử lý".
    expect(screen.queryByText('Lý do từ chối: Đúng theo hồ sơ (bịa)')).not.toBeInTheDocument();
  });

  it('Áp dụng: hộp xác nhận → POST ap-dung → đề nghị rời hàng đợi, badge giảm, báo thành công; Hủy không gửi', async () => {
    const yeuCau = ghiYeuCau();
    const user = userEvent.setup();
    const muc = await moTrang(user);
    await user.click(within(theDeNghi('Sửa thông tin: GV Bịa Một')).getByRole('button', { name: /^Áp dụng/ }));
    let hop = await screen.findByRole('dialog', { name: 'Áp dụng đề nghị' });
    await user.click(within(hop).getByRole('button', { name: 'Hủy' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(yeuCau.filter((y) => y.method === 'POST')).toEqual([]);

    await user.click(within(theDeNghi('Sửa thông tin: GV Bịa Một')).getByRole('button', { name: /^Áp dụng/ }));
    hop = await screen.findByRole('dialog', { name: 'Áp dụng đề nghị' });
    await user.click(within(hop).getByRole('button', { name: 'Áp dụng' }));
    await waitFor(() =>
      expect(screen.queryByRole('listitem', { name: 'Sửa thông tin: GV Bịa Một' })).not.toBeInTheDocument(),
    );
    expect(yeuCau.filter((y) => y.method === 'POST')).toEqual([
      { method: 'POST', url: '/cong-don-vi/de-nghi-sua/dn-1/ap-dung', body: null },
    ]);
    expect(within(muc).getByLabelText('2 đề nghị chờ xử lý')).toBeInTheDocument();
    expect((await screen.findAllByText('Đã áp dụng đề nghị')).length).toBeGreaterThan(0);
  });

  it('Từ chối: thiếu lý do → chặn, không gửi; có lý do → POST { ly_do } và rời hàng đợi', async () => {
    const yeuCau = ghiYeuCau();
    const user = userEvent.setup();
    await moTrang(user);
    await user.click(within(theDeNghi('Bớt người: GV Bịa Hai')).getByRole('button', { name: /^Từ chối/ }));
    const hop = await screen.findByRole('dialog', { name: 'Từ chối đề nghị' });
    await user.click(within(hop).getByRole('button', { name: 'Từ chối' }));
    expect(await within(hop).findByText('Nhập lý do từ chối')).toBeInTheDocument();
    await user.type(within(hop).getByRole('textbox', { name: /^Lý do từ chối/ }), '   ');
    await user.click(within(hop).getByRole('button', { name: 'Từ chối' }));
    expect(yeuCau.filter((y) => y.method === 'POST')).toEqual([]);

    await user.type(within(hop).getByRole('textbox', { name: /^Lý do từ chối/ }), ' Vẫn dạy (bịa) ');
    await user.click(within(hop).getByRole('button', { name: 'Từ chối' }));
    await waitFor(() =>
      expect(screen.queryByRole('listitem', { name: 'Bớt người: GV Bịa Hai' })).not.toBeInTheDocument(),
    );
    expect(yeuCau.filter((y) => y.method === 'POST')).toEqual([
      { method: 'POST', url: '/cong-don-vi/de-nghi-sua/dn-2/tu-choi', body: { ly_do: 'Vẫn dạy (bịa)' } },
    ]);
  });

  it('server báo 409 khi Áp dụng → hiện thông điệp server trong hộp', async () => {
    const user = userEvent.setup();
    await moTrang(user);
    dbDeNghiSua.ds[0].trang_thai = 'da_ap_dung';
    await user.click(within(theDeNghi('Sửa thông tin: GV Bịa Một')).getByRole('button', { name: /^Áp dụng/ }));
    const hop = await screen.findByRole('dialog', { name: 'Áp dụng đề nghị' });
    await user.click(within(hop).getByRole('button', { name: 'Áp dụng' }));
    expect(await within(hop).findByRole('alert')).toHaveTextContent('Đề nghị đã được xử lý');
  });

  it('lọc "Từ chối" gửi trang_thai=tu_choi, hiện lý do từ chối, không có nút xử lý; lọc trường gửi don_vi_id', async () => {
    const yeuCau = ghiYeuCau();
    const user = userEvent.setup();
    const muc = await moTrang(user);
    await user.click(within(muc).getByRole('radio', { name: 'Từ chối' }));
    expect(await within(muc).findByText('Lý do từ chối: Đúng theo hồ sơ (bịa)')).toBeInTheDocument();
    expect(yeuCau.map((y) => y.url)).toContain('/cong-don-vi/dot-trien-khai/dtk-1/de-nghi?trang_thai=tu_choi');
    expect(within(muc).queryByRole('button', { name: /^Áp dụng/ })).not.toBeInTheDocument();
    expect(within(muc).getByText(/Xử lý lúc 20\/11\/2026 10:00 · Quản trị bịa/)).toBeInTheDocument();

    await user.click(within(muc).getByRole('radio', { name: 'Chờ xử lý' }));
    await user.click(within(muc).getByRole('textbox', { name: 'Trường' }));
    await user.click(await screen.findByRole('option', { name: 'Trường THCS&THPT Mẫu Hai' }));
    await waitFor(() =>
      expect(yeuCau.map((y) => y.url)).toContain(
        '/cong-don-vi/dot-trien-khai/dtk-1/de-nghi?trang_thai=cho&don_vi_id=tr-2',
      ),
    );
    await waitFor(() =>
      expect(within(muc).queryByRole('listitem', { name: 'Sửa thông tin: GV Bịa Một' })).not.toBeInTheDocument(),
    );
    expect(theDeNghi('Thêm người: GV Bịa Mới')).toBeInTheDocument();
  });

  it('không có đề nghị → "Không có đề nghị nào", badge 0', async () => {
    const user = userEvent.setup();
    const muc = await moTrang(user);
    dbDeNghiSua.ds = [];
    await user.click(within(muc).getByRole('radio', { name: 'Đã áp dụng' }));
    expect(await within(muc).findByText('Không có đề nghị nào.')).toBeInTheDocument();
    expect(within(muc).getByLabelText('0 đề nghị chờ xử lý')).toBeInTheDocument();
  });
});

describe('Quản trị — danh sách theo trường hiện đề nghị chờ (#62)', () => {
  it('số đề nghị chờ theo trường + badge "Có đề nghị chờ" trên dòng', async () => {
    const user = userEvent.setup();
    await moTrang(user);
    const tongHop = screen.getByRole('table', { name: 'Tổng hợp theo trường' });
    expect(within(tongHop).getByText('2 đề nghị chờ')).toBeInTheDocument();
    expect(within(tongHop).getByText('1 đề nghị chờ')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Xem danh sách Trường THCS Mẫu Một' }));
    const bang = await screen.findByRole('table', { name: 'Danh sách Trường THCS Mẫu Một' });
    const hang = (ten: string) => within(bang).getByText(ten).closest('tr') as HTMLElement;
    expect(within(hang('GV Bịa Một')).getByText('Có đề nghị chờ')).toBeInTheDocument();
    expect(within(hang('GV Bịa Chín')).queryByText('Có đề nghị chờ')).not.toBeInTheDocument();
  });
});
