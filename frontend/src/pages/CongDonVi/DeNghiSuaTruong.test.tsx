import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { renderVoiRouter } from '@/test/testUtils';
import { datToken } from '@/auth/tokenStore';
import { db } from '@/test/mocks/db';
import { server } from '@/test/mocks/server';
import { danhSachMau, dbTruongDanhSach, deNghiMau } from '@/test/mocks/truongDanhSach';
import type { DanhSachCuaTruong } from '@/api/truongDanhSach';
import { routesCongDonVi } from '@/router';

// Issue #62 / ADR 0015 X2: trường đề nghị sửa / bớt / thêm người; thấy trạng thái từng đề nghị.
// Tên người/đợt đều bịa. router.tsx tạo createBrowserRouter ngay khi import — thay bằng hàm rỗng.
vi.mock('react-router-dom', async (goc) => ({
  ...(await goc<typeof import('react-router-dom')>()),
  createBrowserRouter: vi.fn(),
}));

beforeEach(() => vi.stubEnv('VITE_CONG_DON_VI_HOSTNAME', window.location.hostname));
afterEach(() => vi.unstubAllEnvs());

type User = ReturnType<typeof userEvent.setup>;
const URL_DOT = '/cong-don-vi/truong/dot/:dotId';

/** Ghi body mọi request ghi tới API của trường, rồi nhường cho handler mặc định. */
function ghiYeuCau() {
  const ds: { method: string; path: string; body: unknown }[] = [];
  const ghi = async ({ request }: { request: Request }) => {
    const text = await request.clone().text();
    ds.push({ method: request.method, path: new URL(request.url).pathname, body: text ? JSON.parse(text) : null });
    return undefined;
  };
  server.use(http.post(`${URL_DOT}/de-nghi`, ghi), http.put(`${URL_DOT}/danh-sach/:dongId/y-kien`, ghi));
  return ds;
}

async function moDanhSach(ds: DanhSachCuaTruong = danhSachMau()) {
  dbTruongDanhSach.danhSach['dot-hsg-1'] = ds;
  db.nguoiDung.vai_tro = 'truong';
  datToken('token-gia-lap');
  renderVoiRouter(routesCongDonVi, { initialEntries: ['/dot/dot-hsg-1/danh-sach'] });
  await screen.findByRole('heading', { name: /Danh sách tham gia/ });
}

const nhomYKien = (ten: string) => screen.getByRole('group', { name: `Ý kiến về ${ten}` });
const nut = (ten: string, y: 'Đồng ý' | 'Không đồng ý') => within(nhomYKien(ten)).getByRole('button', { name: y });
const theNguoi = (ten: string) => nhomYKien(ten).closest('li') as HTMLElement;
const chip = () => screen.getByLabelText(/^Trạng thái danh sách:/);

async function moKhongDongY(user: User, ten = 'GV Bịa An') {
  await user.click(nut(ten, 'Không đồng ý'));
  return screen.findByRole('dialog', { name: `Không đồng ý — ${ten}` });
}

async function chonGiaiDoan(user: User, hop: HTMLElement, nhan: string) {
  await user.click(within(hop).getByRole('textbox', { name: 'Giai đoạn tham gia' }));
  await user.click(await screen.findByRole('option', { name: nhan }));
}

describe('Trường — đề nghị sửa / bớt từ nút Không đồng ý (#62)', () => {
  it('Không đồng ý mở form, điền sẵn thông tin hiện tại, mặc định "Sửa thông tin"; Hủy không gửi gì', async () => {
    const yeuCau = ghiYeuCau();
    const user = userEvent.setup();
    await moDanhSach();
    const hop = await moKhongDongY(user);
    expect(within(hop).getByRole('radio', { name: 'Sửa thông tin' })).toBeChecked();
    expect(within(hop).getByRole('radio', { name: 'Bớt người này (không tham gia học)' })).not.toBeChecked();
    expect(within(hop).getByRole('textbox', { name: /^Họ và tên/ })).toHaveValue('GV Bịa An');
    expect(within(hop).getByRole('textbox', { name: 'Giới tính' })).toHaveValue('Nữ');
    expect(within(hop).getByRole('textbox', { name: 'Lớp/môn' })).toHaveValue('Toán 9');
    expect(within(hop).getByRole('textbox', { name: 'Giai đoạn tham gia' })).toHaveValue('Cả 2');
    expect(within(hop).getByDisplayValue('01/02/1990')).toBeInTheDocument();

    await user.click(within(hop).getByRole('button', { name: 'Hủy' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(yeuCau).toEqual([]);
    expect(nut('GV Bịa An', 'Không đồng ý')).toHaveAttribute('aria-pressed', 'false');
    expect(chip()).toHaveTextContent('Chờ xác nhận');
  });

  it('Sửa: chỉ gửi trường đã đổi + loai/dong_id + ghi chú; sau đó dòng "Đang chờ HCMUE xử lý", nút ý kiến bị khóa', async () => {
    const yeuCau = ghiYeuCau();
    const user = userEvent.setup();
    await moDanhSach();
    const hop = await moKhongDongY(user);
    const hoTen = within(hop).getByRole('textbox', { name: /^Họ và tên/ });
    await user.clear(hoTen);
    await user.type(hoTen, '  GV Bịa An Đúng ');
    await chonGiaiDoan(user, hop, 'Chỉ GĐ2');
    await user.type(within(hop).getByRole('textbox', { name: 'Ghi chú cho HCMUE' }), 'Sai chính tả (bịa)');
    await user.click(within(hop).getByRole('button', { name: 'Gửi đề nghị' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(yeuCau).toEqual([
      {
        method: 'POST',
        path: '/cong-don-vi/truong/dot/dot-hsg-1/de-nghi',
        body: {
          loai: 'sua',
          dong_id: 'd-1',
          gia_tri: { ho_ten: 'GV Bịa An Đúng', giai_doan: 'chi_gd2' },
          ly_do: 'Sai chính tả (bịa)',
        },
      },
    ]);
    const the = theNguoi('GV Bịa An');
    expect(within(the).getByText('Đang chờ HCMUE xử lý')).toBeInTheDocument();
    expect(within(the).getByText('Họ tên: GV Bịa An → GV Bịa An Đúng; Giai đoạn: Cả 2 → Chỉ GĐ2')).toBeInTheDocument();
    expect(nut('GV Bịa An', 'Đồng ý')).toBeDisabled();
    expect(nut('GV Bịa An', 'Không đồng ý')).toBeDisabled();
    expect(nut('GV Bịa Bình', 'Đồng ý')).toBeEnabled();
    expect(chip()).toHaveTextContent('Báo sai lệch');
  });

  it('Sửa nhưng không đổi gì → chặn "Chưa thay đổi thông tin nào", không gửi', async () => {
    const yeuCau = ghiYeuCau();
    const user = userEvent.setup();
    await moDanhSach();
    const hop = await moKhongDongY(user);
    await user.type(within(hop).getByRole('textbox', { name: 'Ghi chú cho HCMUE' }), 'chỉ ghi chú');
    await user.click(within(hop).getByRole('button', { name: 'Gửi đề nghị' }));
    expect(await within(hop).findByRole('alert')).toHaveTextContent('Chưa thay đổi thông tin nào');
    expect(yeuCau).toEqual([]);
  });

  it('Sửa xóa trống ô → gửi null cho ô đó', async () => {
    const yeuCau = ghiYeuCau();
    const user = userEvent.setup();
    await moDanhSach();
    const hop = await moKhongDongY(user);
    await user.clear(within(hop).getByRole('textbox', { name: 'Lớp/môn' }));
    await user.click(within(hop).getByRole('button', { name: 'Gửi đề nghị' }));
    await waitFor(() => expect(yeuCau).toHaveLength(1));
    expect(yeuCau[0].body).toEqual({ loai: 'sua', dong_id: 'd-1', gia_tri: { lop: null } });
  });

  it('Bớt: bắt buộc lý do (chặn ngay, không gửi); có lý do → gửi loai bot + dong_id, dòng hiện "Đề nghị bớt người này"', async () => {
    const yeuCau = ghiYeuCau();
    const user = userEvent.setup();
    await moDanhSach();
    const hop = await moKhongDongY(user, 'GV Bịa Chi');
    await user.click(within(hop).getByRole('radio', { name: 'Bớt người này (không tham gia học)' }));
    expect(within(hop).queryByRole('textbox', { name: /^Họ và tên/ })).not.toBeInTheDocument();
    await user.click(within(hop).getByRole('button', { name: 'Gửi đề nghị' }));
    expect(await within(hop).findByText('Nhập lý do')).toBeInTheDocument();
    expect(yeuCau).toEqual([]);

    await user.type(within(hop).getByRole('textbox', { name: /^Lý do/ }), 'Nghỉ dạy (bịa)');
    await user.click(within(hop).getByRole('button', { name: 'Gửi đề nghị' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(yeuCau.map((y) => y.body)).toEqual([{ loai: 'bot', dong_id: 'd-3', ly_do: 'Nghỉ dạy (bịa)' }]);
    expect(within(theNguoi('GV Bịa Chi')).getByText('Đề nghị bớt người này')).toBeInTheDocument();
  });

  it('server trả 409 → hiện thông điệp server trong form (không phải câu CCCD), form vẫn mở', async () => {
    server.use(
      http.post(`${URL_DOT}/de-nghi`, () =>
        HttpResponse.json(
          { error: { code: 'CONFLICT', message: 'Dòng này đã có đề nghị đang chờ HCMUE xử lý' } },
          { status: 409 },
        ),
      ),
    );
    const user = userEvent.setup();
    await moDanhSach();
    const hop = await moKhongDongY(user);
    await user.click(within(hop).getByRole('radio', { name: 'Bớt người này (không tham gia học)' }));
    await user.type(within(hop).getByRole('textbox', { name: /^Lý do/ }), 'x');
    await user.click(within(hop).getByRole('button', { name: 'Gửi đề nghị' }));
    expect(await within(hop).findByRole('alert')).toHaveTextContent('Dòng này đã có đề nghị đang chờ HCMUE xử lý');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('lỗi field ly_do từ server gắn vào ô Lý do', async () => {
    server.use(
      http.post(`${URL_DOT}/de-nghi`, () =>
        HttpResponse.json(
          {
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Dữ liệu không hợp lệ',
              fields: [{ field: 'ly_do', message: 'Lý do tối đa 500 ký tự' }],
            },
          },
          { status: 400 },
        ),
      ),
    );
    const user = userEvent.setup();
    await moDanhSach();
    const hop = await moKhongDongY(user);
    await user.click(within(hop).getByRole('radio', { name: 'Bớt người này (không tham gia học)' }));
    await user.type(within(hop).getByRole('textbox', { name: /^Lý do/ }), 'x');
    await user.click(within(hop).getByRole('button', { name: 'Gửi đề nghị' }));
    expect(await within(hop).findByText('Lý do tối đa 500 ký tự')).toBeInTheDocument();
  });
});

describe('Trường — đề nghị thêm người (#62)', () => {
  it('"Đề nghị thêm người" mở form trống; thiếu họ tên → chặn; đủ → POST loai them, chỉ ô có dữ liệu; hiện ở mục "Đề nghị thêm người"', async () => {
    const yeuCau = ghiYeuCau();
    const user = userEvent.setup();
    await moDanhSach();
    await user.click(screen.getByRole('button', { name: 'Đề nghị thêm người' }));
    const hop = await screen.findByRole('dialog', { name: 'Đề nghị thêm người' });
    expect(within(hop).queryByRole('radio')).not.toBeInTheDocument();
    expect(within(hop).getByRole('textbox', { name: /^Họ và tên/ })).toHaveValue('');
    await user.click(within(hop).getByRole('button', { name: 'Gửi đề nghị' }));
    expect(await within(hop).findByText('Nhập họ tên')).toBeInTheDocument();
    expect(yeuCau).toEqual([]);

    await user.type(within(hop).getByRole('textbox', { name: /^Họ và tên/ }), 'GV Bịa Mới');
    await user.type(within(hop).getByRole('textbox', { name: 'Lớp/môn' }), 'Văn 6');
    await chonGiaiDoan(user, hop, 'Chỉ GĐ1');
    await user.click(within(hop).getByRole('button', { name: 'Gửi đề nghị' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(yeuCau.map((y) => y.body)).toEqual([
      { loai: 'them', gia_tri: { ho_ten: 'GV Bịa Mới', lop: 'Văn 6', giai_doan: 'chi_gd1' } },
    ]);
    const muc = screen.getByRole('region', { name: 'Đề nghị thêm người' });
    expect(within(muc).getByText('GV Bịa Mới')).toBeInTheDocument();
    expect(within(muc).getByText('Chờ xử lý')).toBeInTheDocument();
    expect(chip()).toHaveTextContent('Báo sai lệch');
  });

  it('mục "Đề nghị thêm người" hiện trạng thái Đã áp dụng / Từ chối + lý do', async () => {
    await moDanhSach(
      danhSachMau({
        de_nghi: [
          deNghiMau({
            id: 'dn-a',
            loai: 'them',
            dong_id: null,
            gia_tri_cu: null,
            gia_tri: { ho_ten: 'GV Bịa Được Thêm', giai_doan: 'ca_hai' },
            trang_thai: 'da_ap_dung',
          }),
          deNghiMau({
            id: 'dn-b',
            loai: 'them',
            dong_id: null,
            gia_tri_cu: null,
            gia_tri: { ho_ten: 'GV Bịa Không Thêm', giai_doan: 'ca_hai' },
            trang_thai: 'tu_choi',
            ly_do_tu_choi: 'Không thuộc đối tượng (bịa)',
          }),
        ],
      }),
    );
    const muc = screen.getByRole('region', { name: 'Đề nghị thêm người' });
    const the = (ten: string) => within(muc).getByText(ten).closest('li') as HTMLElement;
    expect(within(the('GV Bịa Được Thêm')).getByText('Đã áp dụng')).toBeInTheDocument();
    expect(within(the('GV Bịa Không Thêm')).getByText('Từ chối')).toBeInTheDocument();
    expect(
      within(the('GV Bịa Không Thêm')).getByText('Lý do từ chối: Không thuộc đối tượng (bịa)'),
    ).toBeInTheDocument();
  });
});

describe('Trường — trạng thái đề nghị trên từng dòng (#62)', () => {
  it('dòng có đề nghị chờ: badge + tóm tắt, 2 nút ý kiến khóa; dòng khác bình thường', async () => {
    const goc = danhSachMau();
    await moDanhSach(
      danhSachMau({
        dong: goc.dong.map((d) => (d.id === 'd-1' ? { ...d, y_kien_truong: 'khong_dong_y' as const } : d)),
        de_nghi: [deNghiMau()],
        trang_thai_danh_sach: 'bao_sai_lech',
      }),
    );
    const the = theNguoi('GV Bịa An');
    expect(within(the).getByText('Đang chờ HCMUE xử lý')).toBeInTheDocument();
    expect(within(the).getByText('Họ tên: GV Bịa An → GV Bịa An Sửa')).toBeInTheDocument();
    expect(nut('GV Bịa An', 'Đồng ý')).toBeDisabled();
    expect(nut('GV Bịa An', 'Không đồng ý')).toBeDisabled();
    expect(within(theNguoi('GV Bịa Bình')).queryByText('Đang chờ HCMUE xử lý')).not.toBeInTheDocument();
    expect(nut('GV Bịa Bình', 'Không đồng ý')).toBeEnabled();
  });

  it('đề nghị bị từ chối + dòng chưa có ý kiến → "HCMUE từ chối đề nghị: <lý do>", nút ý kiến mở lại', async () => {
    await moDanhSach(
      danhSachMau({
        de_nghi: [
          deNghiMau({
            trang_thai: 'tu_choi',
            ly_do_tu_choi: 'Đúng theo hồ sơ (bịa)',
            xu_ly_luc: '2026-11-20T03:00:00Z',
          }),
        ],
      }),
    );
    expect(within(theNguoi('GV Bịa An')).getByText('HCMUE từ chối đề nghị: Đúng theo hồ sơ (bịa)')).toBeInTheDocument();
    expect(nut('GV Bịa An', 'Đồng ý')).toBeEnabled();
  });

  it('đề nghị bị từ chối nhưng trường đã Đồng ý lại → không còn hiện lý do từ chối', async () => {
    const goc = danhSachMau();
    await moDanhSach(
      danhSachMau({
        dong: goc.dong.map((d) => (d.id === 'd-1' ? { ...d, y_kien_truong: 'dong_y' as const } : d)),
        de_nghi: [deNghiMau({ trang_thai: 'tu_choi', ly_do_tu_choi: 'Đúng theo hồ sơ (bịa)' })],
      }),
    );
    expect(screen.queryByText(/HCMUE từ chối đề nghị/)).not.toBeInTheDocument();
  });

  it('còn đề nghị chờ → Xác nhận tắt với lý do server "Còn đề nghị sửa đang chờ"', async () => {
    const goc = danhSachMau();
    await moDanhSach(
      danhSachMau({
        dong: goc.dong.map((d) => ({ ...d, y_kien_truong: 'dong_y' as const })),
        de_nghi: [deNghiMau({ loai: 'them', dong_id: null, gia_tri: { ho_ten: 'GV Bịa Chờ' } })],
        trang_thai_danh_sach: 'bao_sai_lech',
      }),
    );
    expect(screen.getByRole('button', { name: 'Xác nhận danh sách' })).toBeDisabled();
    expect(screen.getByText('Còn đề nghị sửa đang chờ — chưa xác nhận được.')).toBeInTheDocument();
  });

  it('PUT ý kiến bị 409 → thông báo đúng thông điệp server', async () => {
    server.use(
      http.put(`${URL_DOT}/danh-sach/:dongId/y-kien`, () =>
        HttpResponse.json(
          { error: { code: 'CONFLICT', message: 'Dòng đang có đề nghị chờ HCMUE xử lý' } },
          { status: 409 },
        ),
      ),
    );
    const user = userEvent.setup();
    await moDanhSach();
    await user.click(nut('GV Bịa An', 'Đồng ý'));
    expect((await screen.findAllByText('Dòng đang có đề nghị chờ HCMUE xử lý')).length).toBeGreaterThan(0);
  });
});
