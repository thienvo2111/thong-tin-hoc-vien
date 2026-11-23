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
import { dbDeNghiSua, mucDeNghiMau } from '@/test/mocks/deNghiSua';
import type { DongDanhSach } from '@/api/danhSachThamGia';
import type { MucDeNghi } from '@/api/deNghiSua';
import QuanTriDanhSachThamGia from './QuanTriDanhSachThamGia';

// Issue #69 / ADR 0015 Y2: hỏi "Cập nhật luôn hồ sơ học viên NLS?" khi Quản trị Áp dụng đề nghị sửa / sửa dòng NLS.
// Dữ liệu bịa.
beforeEach(() => vi.stubEnv('VITE_CONG_DON_VI_HOSTNAME', window.location.hostname));
afterEach(() => vi.unstubAllEnvs());

type User = ReturnType<typeof userEvent.setup>;
const TRANG = '/quan-tri/danh-sach-tham-gia';
const TIEU_DE = 'Cập nhật luôn hồ sơ học viên NLS?';
const TIM = { timeout: 5000 };

function dongMau(p: Partial<DongDanhSach> = {}): DongDanhSach {
  return {
    id: 'd-nls',
    don_vi_id: 'tr-1',
    ho_ten: 'GV Bịa Nls',
    ngay_sinh: '1990-02-01',
    gioi_tinh: 'nu',
    ma_goc: 'MOET-BIA-1',
    lop: 'Lớp A',
    giai_doan: 'ca_hai',
    ty_le_suat: 1,
    ghi_chu: null,
    y_kien_truong: 'khong_dong_y',
    hoc_vien_id: 'hv-1',
    ...p,
  };
}

const HO_SO = {
  hoc_vien_id: 'hv-1',
  ho_ten: 'GV Bịa Nls',
  ngay_sinh: '1991-05-06',
  gioi_tinh: 'nu',
  don_vi: { id: 'tr-1', ten: 'Trường THCS Mẫu Một' },
};

/** Đề nghị sửa trên dòng NLS: đổi họ tên (khác hồ sơ), ngày sinh (= hồ sơ), giới tính "Nữ" (= mã nu), lớp. */
function deNghiNls(p: Partial<MucDeNghi> = {}): MucDeNghi {
  const d = dongMau();
  return mucDeNghiMau({
    id: 'dn-nls',
    dong_id: 'd-nls',
    dong_hien_tai: {
      ho_ten: d.ho_ten,
      ngay_sinh: d.ngay_sinh,
      gioi_tinh: d.gioi_tinh,
      lop: d.lop,
      giai_doan: d.giai_doan,
      ty_le_suat: d.ty_le_suat,
      y_kien_truong: d.y_kien_truong,
      hoc_vien_id: d.hoc_vien_id,
    },
    gia_tri: { ho_ten: 'GV Bịa Nls Sửa', ngay_sinh: '1991-05-06', gioi_tinh: 'Nữ', lop: 'Lớp B' },
    ...p,
  });
}

/** Ghi các request tới đề nghị / dòng / hồ sơ rồi nhường handler mặc định. */
function ghiYeuCau() {
  const ds: { method: string; url: string; body: unknown }[] = [];
  const ghi = async ({ request }: { request: Request }) => {
    const text = await request.clone().text();
    ds.push({ method: request.method, url: new URL(request.url).pathname, body: text ? JSON.parse(text) : null });
    return undefined;
  };
  server.use(
    http.post('/cong-don-vi/de-nghi-sua/:id/ap-dung', ghi),
    http.patch('/cong-don-vi/danh-sach-tham-gia/:dongId', ghi),
    http.get('/cong-don-vi/danh-sach-tham-gia/:dongId/ho-so-hoc-vien', ghi),
  );
  return ds;
}
const ghiTheo = <T extends { method: string }>(ds: T[], method: string) => ds.filter((y) => y.method === method);

function chuanBi(dong: DongDanhSach[], deNghi: MucDeNghi[] = []) {
  db.nguoiDung.vai_tro = 'quan_tri';
  datToken('token-gia-lap');
  dbDotTrienKhai.ds = [dotMau()];
  dbDeNghiSua.ds = deNghi;
  dbDanhSachThamGia.hoSoHocVien = { 'd-nls': HO_SO };
  dbDanhSachThamGia.danhSach = {
    tong_hop: [
      {
        don_vi_id: 'tr-1',
        ten_don_vi: 'Trường THCS Mẫu Một',
        ma_don_vi: 'TR-MAU-001',
        so_nguoi: dong.length,
        tong_suat: dong.length,
        trang_thai_danh_sach: 'bao_sai_lech',
        so_de_nghi_cho: deNghi.length,
      },
    ],
    dong,
  };
  renderVoiRouter([{ path: TRANG, element: <QuanTriDanhSachThamGia /> }], { initialEntries: [TRANG] });
}

async function chonDot(user: User) {
  await user.click(await screen.findByRole('textbox', { name: 'Đợt triển khai' }, TIM));
  await user.click(await screen.findByRole('option', { name: 'HSG – HSG An Giang 2026' }));
}

describe('Áp dụng đề nghị sửa trên dòng NLS', () => {
  async function moApDung(user: User, nhan = 'Sửa thông tin: GV Bịa Nls') {
    await chonDot(user);
    await screen.findByRole('region', { name: 'Đề nghị của trường' }, TIM);
    const the = await screen.findByRole('listitem', { name: nhan }, TIM);
    await user.click(within(the).getByRole('button', { name: /^Áp dụng/ }));
  }

  it('chỉ liệt kê trường cá nhân khác hồ sơ (cũ → mới), ghi chú không đồng bộ; "Cập nhật cả hồ sơ NLS" gửi true', async () => {
    const yeuCau = ghiYeuCau();
    const user = userEvent.setup();
    chuanBi([dongMau()], [deNghiNls()]);
    await moApDung(user);
    const hop = await screen.findByRole('dialog', { name: TIEU_DE }, TIM);
    const hang = within(hop).getAllByRole('row');
    expect(hang.map((h) => h.textContent)).toEqual([
      'Trường thông tinHồ sơ NLS hiện tạiGiá trị mới',
      'Họ tênGV Bịa NlsGV Bịa Nls Sửa',
    ]);
    expect(within(hop).getByText('Giai đoạn, suất, lớp không đồng bộ.')).toBeInTheDocument();
    expect(ghiTheo(yeuCau, 'GET')).toEqual([
      { method: 'GET', url: '/cong-don-vi/danh-sach-tham-gia/d-nls/ho-so-hoc-vien', body: null },
    ]);

    await user.click(within(hop).getByRole('button', { name: 'Cập nhật cả hồ sơ NLS' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: TIEU_DE })).not.toBeInTheDocument());
    expect(ghiTheo(yeuCau, 'POST')).toEqual([
      { method: 'POST', url: '/cong-don-vi/de-nghi-sua/dn-nls/ap-dung', body: { dong_bo_ho_so_hoc_vien: true } },
    ]);
    expect((await screen.findAllByText('Đã áp dụng đề nghị và cập nhật hồ sơ NLS')).length).toBeGreaterThan(0);
  }, 20000);

  it('"Chỉ sửa danh sách" gửi false', async () => {
    const yeuCau = ghiYeuCau();
    const user = userEvent.setup();
    chuanBi([dongMau()], [deNghiNls()]);
    await moApDung(user);
    const hop = await screen.findByRole('dialog', { name: TIEU_DE }, TIM);
    await user.click(within(hop).getByRole('button', { name: 'Chỉ sửa danh sách' }));
    await waitFor(() => expect(ghiTheo(yeuCau, 'POST')).toHaveLength(1));
    expect(ghiTheo(yeuCau, 'POST')[0].body).toEqual({ dong_bo_ho_so_hoc_vien: false });
  }, 20000);

  it('Hủy → không gửi gì', async () => {
    const yeuCau = ghiYeuCau();
    const user = userEvent.setup();
    chuanBi([dongMau()], [deNghiNls()]);
    await moApDung(user);
    const hop = await screen.findByRole('dialog', { name: TIEU_DE }, TIM);
    await user.click(within(hop).getByRole('button', { name: 'Hủy' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(ghiTheo(yeuCau, 'POST')).toEqual([]);
  }, 20000);

  it('giá trị đề nghị đã khớp hồ sơ → hộp xác nhận thường, POST không có cờ', async () => {
    const yeuCau = ghiYeuCau();
    const user = userEvent.setup();
    chuanBi([dongMau()], [deNghiNls({ gia_tri: { ngay_sinh: '1991-05-06', gioi_tinh: 'Nữ' } })]);
    await moApDung(user);
    const hop = await screen.findByRole('dialog', { name: 'Áp dụng đề nghị' }, TIM);
    await waitFor(() => expect(within(hop).getByRole('button', { name: 'Áp dụng' })).toBeEnabled());
    expect(screen.queryByRole('dialog', { name: TIEU_DE })).not.toBeInTheDocument();
    await user.click(within(hop).getByRole('button', { name: 'Áp dụng' }));
    await waitFor(() => expect(ghiTheo(yeuCau, 'POST')).toHaveLength(1));
    expect(ghiTheo(yeuCau, 'POST')[0].body).toBeNull();
  }, 20000);

  it('dòng HSG (không hoc_vien_id) → hộp thường, không gọi xem hồ sơ', async () => {
    const yeuCau = ghiYeuCau();
    const user = userEvent.setup();
    const dn = deNghiNls();
    chuanBi([dongMau({ hoc_vien_id: null })], [{ ...dn, dong_hien_tai: { ...dn.dong_hien_tai!, hoc_vien_id: null } }]);
    await moApDung(user);
    const hop = await screen.findByRole('dialog', { name: 'Áp dụng đề nghị' }, TIM);
    await user.click(within(hop).getByRole('button', { name: 'Áp dụng' }));
    await waitFor(() => expect(ghiTheo(yeuCau, 'POST')).toHaveLength(1));
    expect(ghiTheo(yeuCau, 'POST')[0].body).toBeNull();
    expect(ghiTheo(yeuCau, 'GET')).toEqual([]);
    expect(screen.queryByRole('dialog', { name: TIEU_DE })).not.toBeInTheDocument();
  }, 20000);

  it.each([
    ['bot', 'Bớt người: GV Bịa Nls'],
    ['them', 'Thêm người: GV Bịa Thêm'],
  ] as const)(
    'đề nghị %s → hộp thường, không gọi xem hồ sơ',
    async (loai, nhan) => {
      const yeuCau = ghiYeuCau();
      const user = userEvent.setup();
      const dn =
        loai === 'bot'
          ? deNghiNls({ loai: 'bot', gia_tri: {} })
          : deNghiNls({
              loai: 'them',
              dong_id: null,
              dong_hien_tai: null,
              gia_tri: { ho_ten: 'GV Bịa Thêm', ngay_sinh: null, gioi_tinh: 'Nam', lop: null, giai_doan: 'ca_hai' },
            });
      chuanBi([dongMau()], [dn]);
      await moApDung(user, nhan);
      const hop = await screen.findByRole('dialog', { name: 'Áp dụng đề nghị' }, TIM);
      await user.click(within(hop).getByRole('button', { name: 'Áp dụng' }));
      await waitFor(() => expect(ghiTheo(yeuCau, 'POST')).toHaveLength(1));
      expect(ghiTheo(yeuCau, 'POST')[0].body).toBeNull();
      expect(ghiTheo(yeuCau, 'GET')).toEqual([]);
    },
    20000,
  );

  it('server từ chối hồ sơ → hiện thông điệp server trong hộp, hộp vẫn mở', async () => {
    server.use(
      http.post('/cong-don-vi/de-nghi-sua/:id/ap-dung', () =>
        HttpResponse.json(
          {
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Không cập nhật được hồ sơ học viên: Dữ liệu cập nhật không hợp lệ',
              fields: [{ field: 'ho_ten', message: 'Chỉ được chứa chữ cái và khoảng trắng' }],
            },
          },
          { status: 400 },
        ),
      ),
    );
    const user = userEvent.setup();
    chuanBi([dongMau()], [deNghiNls()]);
    await moApDung(user);
    const hop = await screen.findByRole('dialog', { name: TIEU_DE }, TIM);
    await user.click(within(hop).getByRole('button', { name: 'Cập nhật cả hồ sơ NLS' }));
    expect(await within(hop).findByRole('alert')).toHaveTextContent(
      'Không cập nhật được hồ sơ học viên: Dữ liệu cập nhật không hợp lệ',
    );
    expect(screen.getByRole('dialog', { name: TIEU_DE })).toBeInTheDocument();
  }, 20000);
});

describe('Quản trị sửa dòng NLS', () => {
  async function moSua(user: User, hoTen = 'GV Bịa Nls') {
    await chonDot(user);
    await user.click(await screen.findByRole('button', { name: 'Xem danh sách Trường THCS Mẫu Một' }, TIM));
    await screen.findByRole('table', { name: 'Danh sách Trường THCS Mẫu Một' }, TIM);
    await user.click(screen.getByRole('button', { name: `Sửa ${hoTen}` }));
    return screen.findByRole('dialog', { name: 'Sửa thông tin' }, TIM);
  }

  async function doiTen(user: User, hop: HTMLElement, ten: string) {
    await user.clear(within(hop).getByLabelText(/^Họ và tên/));
    await user.type(within(hop).getByLabelText(/^Họ và tên/), ten);
    await user.type(within(hop).getByLabelText(/^Lý do/), 'Bịa: sửa tên');
    await user.click(within(hop).getByRole('button', { name: 'Lưu thay đổi' }));
  }

  it('đổi họ tên khác hồ sơ → hộp xem trước; "Cập nhật cả hồ sơ NLS" → PATCH kèm cờ true, đóng form', async () => {
    const yeuCau = ghiYeuCau();
    const user = userEvent.setup();
    chuanBi([dongMau()]);
    const hop = await moSua(user);
    await doiTen(user, hop, 'GV Bịa Nls Mới');
    const hoi = await screen.findByRole('dialog', { name: TIEU_DE }, TIM);
    expect(
      within(hoi)
        .getAllByRole('row')
        .map((h) => h.textContent),
    ).toEqual(['Trường thông tinHồ sơ NLS hiện tạiGiá trị mới', 'Họ tênGV Bịa NlsGV Bịa Nls Mới']);
    expect(ghiTheo(yeuCau, 'PATCH')).toEqual([]);
    await user.click(within(hoi).getByRole('button', { name: 'Cập nhật cả hồ sơ NLS' }));
    await waitFor(() => expect(ghiTheo(yeuCau, 'PATCH')).toHaveLength(1));
    expect(ghiTheo(yeuCau, 'PATCH')[0].body).toEqual({
      ho_ten: 'GV Bịa Nls Mới',
      ly_do: 'Bịa: sửa tên',
      dong_bo_ho_so_hoc_vien: true,
    });
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Sửa thông tin' })).not.toBeInTheDocument());
  }, 30000);

  it('"Chỉ sửa danh sách" → PATCH cờ false', async () => {
    const yeuCau = ghiYeuCau();
    const user = userEvent.setup();
    chuanBi([dongMau()]);
    const hop = await moSua(user);
    await doiTen(user, hop, 'GV Bịa Nls Mới');
    const hoi = await screen.findByRole('dialog', { name: TIEU_DE }, TIM);
    await user.click(within(hoi).getByRole('button', { name: 'Chỉ sửa danh sách' }));
    await waitFor(() => expect(ghiTheo(yeuCau, 'PATCH')).toHaveLength(1));
    expect(ghiTheo(yeuCau, 'PATCH')[0].body).toMatchObject({ dong_bo_ho_so_hoc_vien: false });
  }, 30000);

  it('Hủy → không PATCH, quay lại form sửa', async () => {
    const yeuCau = ghiYeuCau();
    const user = userEvent.setup();
    chuanBi([dongMau()]);
    const hop = await moSua(user);
    await doiTen(user, hop, 'GV Bịa Nls Mới');
    const hoi = await screen.findByRole('dialog', { name: TIEU_DE }, TIM);
    await user.click(within(hoi).getByRole('button', { name: 'Hủy' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: TIEU_DE })).not.toBeInTheDocument());
    expect(screen.getByRole('dialog', { name: 'Sửa thông tin' })).toBeInTheDocument();
    expect(ghiTheo(yeuCau, 'PATCH')).toEqual([]);
  }, 30000);

  it('đổi trường công tác → xem trước theo tên trường', async () => {
    ghiYeuCau();
    const user = userEvent.setup();
    chuanBi([dongMau()]);
    const hop = await moSua(user);
    await waitFor(() =>
      expect(within(hop).getByRole('textbox', { name: /^Trường/ })).toHaveValue('Trường THCS Mẫu Một (TR-MAU-001)'),
    );
    await user.click(within(hop).getByRole('textbox', { name: /^Trường/ }));
    await user.click(await screen.findByRole('option', { name: 'Trường TH Mẫu Ba (TR-MAU-003)' }));
    await user.type(within(hop).getByLabelText(/^Lý do/), 'Bịa: chuyển trường');
    await user.click(within(hop).getByRole('button', { name: 'Lưu thay đổi' }));
    const hoi = await screen.findByRole('dialog', { name: TIEU_DE }, TIM);
    expect(
      within(hoi)
        .getAllByRole('row')
        .map((h) => h.textContent),
    ).toEqual(['Trường thông tinHồ sơ NLS hiện tạiGiá trị mới', 'Trường công tácTrường THCS Mẫu MộtTrường TH Mẫu Ba']);
  }, 30000);

  it('họ tên mới đã khớp hồ sơ → không hỏi, PATCH không có cờ', async () => {
    const yeuCau = ghiYeuCau();
    const user = userEvent.setup();
    chuanBi([dongMau({ ho_ten: 'GV Bịa Nls Lệch' })]);
    const hop = await moSua(user, 'GV Bịa Nls Lệch');
    await doiTen(user, hop, 'GV Bịa Nls');
    await waitFor(() => expect(ghiTheo(yeuCau, 'PATCH')).toHaveLength(1));
    expect(ghiTheo(yeuCau, 'PATCH')[0].body).toEqual({ ho_ten: 'GV Bịa Nls', ly_do: 'Bịa: sửa tên' });
    expect(screen.queryByRole('dialog', { name: TIEU_DE })).not.toBeInTheDocument();
  }, 30000);

  it('chỉ đổi lớp (không phải thông tin cá nhân) → không hỏi, không gọi xem hồ sơ', async () => {
    const yeuCau = ghiYeuCau();
    const user = userEvent.setup();
    chuanBi([dongMau()]);
    const hop = await moSua(user);
    await user.type(within(hop).getByLabelText(/^Lớp/), ' B');
    await user.type(within(hop).getByLabelText(/^Lý do/), 'Bịa');
    await user.click(within(hop).getByRole('button', { name: 'Lưu thay đổi' }));
    await waitFor(() => expect(ghiTheo(yeuCau, 'PATCH')).toHaveLength(1));
    expect(ghiTheo(yeuCau, 'PATCH')[0].body).toEqual({ lop: 'Lớp A B', ly_do: 'Bịa' });
    expect(ghiTheo(yeuCau, 'GET')).toEqual([]);
  }, 30000);

  it('dòng HSG → không hỏi, PATCH không có cờ', async () => {
    const yeuCau = ghiYeuCau();
    const user = userEvent.setup();
    chuanBi([dongMau({ hoc_vien_id: null })]);
    const hop = await moSua(user);
    await doiTen(user, hop, 'GV Bịa Nls Mới');
    await waitFor(() => expect(ghiTheo(yeuCau, 'PATCH')).toHaveLength(1));
    expect(ghiTheo(yeuCau, 'PATCH')[0].body).toEqual({ ho_ten: 'GV Bịa Nls Mới', ly_do: 'Bịa: sửa tên' });
    expect(ghiTheo(yeuCau, 'GET')).toEqual([]);
  }, 30000);

  it('server từ chối hồ sơ → thông điệp hiện trong form sửa', async () => {
    server.use(
      http.patch('/cong-don-vi/danh-sach-tham-gia/:dongId', () =>
        HttpResponse.json(
          {
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Không cập nhật được hồ sơ học viên: Dữ liệu cập nhật không hợp lệ',
            },
          },
          { status: 400 },
        ),
      ),
    );
    const user = userEvent.setup();
    chuanBi([dongMau()]);
    const hop = await moSua(user);
    await doiTen(user, hop, 'GV Bịa Nls Mới');
    const hoi = await screen.findByRole('dialog', { name: TIEU_DE }, TIM);
    await user.click(within(hoi).getByRole('button', { name: 'Cập nhật cả hồ sơ NLS' }));
    expect(await within(hop).findByRole('alert')).toHaveTextContent(
      'Không cập nhật được hồ sơ học viên: Dữ liệu cập nhật không hợp lệ',
    );
  }, 30000);
});
