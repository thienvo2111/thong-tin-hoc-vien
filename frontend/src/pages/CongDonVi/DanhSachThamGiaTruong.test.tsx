import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { renderVoiRouter } from '@/test/testUtils';
import { datToken } from '@/auth/tokenStore';
import { db } from '@/test/mocks/db';
import { server } from '@/test/mocks/server';
import { danhSachMau, dbTruongDanhSach } from '@/test/mocks/truongDanhSach';
import type { DanhSachCuaTruong } from '@/api/truongDanhSach';
import { routesCongDonVi } from '@/router';

// Issue #61 / ADR 0015 X1, X2: trường Đồng ý / Không đồng ý từng người, Đồng ý tất cả, Xác nhận danh sách.
// Tên người/đợt đều bịa. router.tsx tạo createBrowserRouter ngay khi import — thay bằng hàm rỗng.
vi.mock('react-router-dom', async (goc) => ({
  ...(await goc<typeof import('react-router-dom')>()),
  createBrowserRouter: vi.fn(),
}));

beforeEach(() => vi.stubEnv('VITE_CONG_DON_VI_HOSTNAME', window.location.hostname));
afterEach(() => vi.unstubAllEnvs());

const URL_DS = '/cong-don-vi/truong/dot/:dotId/danh-sach';

interface YeuCau {
  method: string;
  path: string;
  body: unknown;
}

/** Ghi mọi request ghi (PUT/POST) tới API danh sách của trường, rồi nhường cho handler mặc định. */
function ghiYeuCau() {
  const ds: YeuCau[] = [];
  const ghi = async ({ request }: { request: Request }) => {
    const text = await request.clone().text();
    ds.push({ method: request.method, path: new URL(request.url).pathname, body: text ? JSON.parse(text) : null });
    return undefined;
  };
  server.use(
    http.put(`${URL_DS}/:dongId/y-kien`, ghi),
    http.post(`${URL_DS}/dong-y-tat-ca`, ghi),
    http.post(`${URL_DS}/xac-nhan`, ghi),
  );
  return ds;
}

function moDanhSach(ds: DanhSachCuaTruong = danhSachMau()) {
  dbTruongDanhSach.danhSach['dot-hsg-1'] = ds;
  db.nguoiDung.vai_tro = 'truong';
  datToken('token-gia-lap');
  renderVoiRouter(routesCongDonVi, { initialEntries: ['/dot/dot-hsg-1/danh-sach'] });
}

/** Danh sách mẫu với ý kiến cho sẵn theo thứ tự An, Bình, Chi. */
function voiYKien(yKien: DanhSachCuaTruong['dong'][number]['y_kien_truong'][], p: Partial<DanhSachCuaTruong> = {}) {
  const goc = danhSachMau();
  return danhSachMau({ dong: goc.dong.map((d, i) => ({ ...d, y_kien_truong: yKien[i] })), ...p });
}

const nhomYKien = (ten: string) => screen.getByRole('group', { name: `Ý kiến về ${ten}` });
const nut = (ten: string, y: 'Đồng ý' | 'Không đồng ý') => within(nhomYKien(ten)).getByRole('button', { name: y });
const nutXacNhan = () => screen.getByRole('button', { name: 'Xác nhận danh sách' });
const chip = () => screen.getByLabelText(/^Trạng thái danh sách:/);

describe('Màn danh sách của trường — ý kiến từng người (#61)', () => {
  it('mỗi người có 2 nút Đồng ý / Không đồng ý chưa bấm; bấm Đồng ý gửi PUT { y_kien: "dong_y" } và nút chuyển sang đã chọn', async () => {
    const yeuCau = ghiYeuCau();
    const user = userEvent.setup();
    moDanhSach();
    await screen.findByRole('heading', { name: /Danh sách tham gia/ });
    for (const ten of ['GV Bịa An', 'GV Bịa Bình', 'GV Bịa Chi']) {
      expect(nut(ten, 'Đồng ý')).toHaveAttribute('aria-pressed', 'false');
      expect(nut(ten, 'Không đồng ý')).toHaveAttribute('aria-pressed', 'false');
    }

    await user.click(nut('GV Bịa An', 'Đồng ý'));
    await waitFor(() => expect(nut('GV Bịa An', 'Đồng ý')).toHaveAttribute('aria-pressed', 'true'));
    expect(nut('GV Bịa An', 'Không đồng ý')).toHaveAttribute('aria-pressed', 'false');
    expect(yeuCau).toEqual([
      { method: 'PUT', path: '/cong-don-vi/truong/dot/dot-hsg-1/danh-sach/d-1/y-kien', body: { y_kien: 'dong_y' } },
    ]);
    expect(chip()).toHaveTextContent('Chờ xác nhận');
    expect(screen.getByText('Còn 2 dòng chưa Đồng ý — chưa xác nhận được.')).toBeInTheDocument();
  });

  // Issue #62: "Không đồng ý" mở form đề nghị (DeNghiSuaTruong.test.tsx) thay cho PUT khong_dong_y + gợi ý
  // "Đề nghị sửa sẽ mở ở bước sau". Dòng đã Không đồng ý từ trước (không có đề nghị chờ) bấm lại vẫn bỏ chọn.
  it('dòng đã Không đồng ý (không có đề nghị chờ) → bấm lại gửi null và bỏ chọn, chip về "Chờ xác nhận"', async () => {
    const yeuCau = ghiYeuCau();
    const user = userEvent.setup();
    moDanhSach(voiYKien([null, 'khong_dong_y', null], { trang_thai_danh_sach: 'bao_sai_lech' }));
    await screen.findByRole('heading', { name: /Danh sách tham gia/ });
    expect(chip()).toHaveTextContent('Báo sai lệch');
    expect(nut('GV Bịa Bình', 'Không đồng ý')).toHaveAttribute('aria-pressed', 'true');

    await user.click(nut('GV Bịa Bình', 'Không đồng ý'));
    await waitFor(() => expect(nut('GV Bịa Bình', 'Không đồng ý')).toHaveAttribute('aria-pressed', 'false'));
    expect(chip()).toHaveTextContent('Chờ xác nhận');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(yeuCau.map((y) => y.body)).toEqual([{ y_kien: null }]);
  });

  it('đang gửi ý kiến → mọi nút ý kiến + Đồng ý tất cả bị khóa tới khi xong', async () => {
    let xong!: () => void;
    const cho = new Promise<void>((r) => (xong = r));
    server.use(
      http.put(`${URL_DS}/:dongId/y-kien`, async () => {
        await cho;
        return undefined;
      }),
    );
    const user = userEvent.setup();
    moDanhSach();
    await screen.findByRole('heading', { name: /Danh sách tham gia/ });
    await user.click(nut('GV Bịa An', 'Đồng ý'));
    await waitFor(() => expect(nut('GV Bịa Chi', 'Không đồng ý')).toBeDisabled());
    expect(screen.getByRole('button', { name: 'Đồng ý tất cả dòng chưa có ý kiến' })).toBeDisabled();
    xong();
    await waitFor(() => expect(nut('GV Bịa Chi', 'Không đồng ý')).toBeEnabled());
    expect(nut('GV Bịa An', 'Đồng ý')).toHaveAttribute('aria-pressed', 'true');
  });

  it('lỗi khi gửi ý kiến → thông báo lỗi, ý kiến không đổi', async () => {
    server.use(
      http.put(`${URL_DS}/:dongId/y-kien`, () =>
        HttpResponse.json({ error: { code: 'NOT_FOUND', message: 'Không tìm thấy dòng danh sách' } }, { status: 404 }),
      ),
    );
    const user = userEvent.setup();
    moDanhSach();
    await screen.findByRole('heading', { name: /Danh sách tham gia/ });
    await user.click(nut('GV Bịa An', 'Đồng ý'));
    // routesCongDonVi có <Notifications> riêng (KhungNoiBo) ngoài cái của renderVoiRouter → thông báo hiện 2 lần.
    expect((await screen.findAllByText('Không tìm thấy dòng danh sách')).length).toBeGreaterThan(0);
    expect(nut('GV Bịa An', 'Đồng ý')).toHaveAttribute('aria-pressed', 'false');
  });

  it('"Đồng ý tất cả dòng chưa có ý kiến" gửi POST, chỉ đổi dòng chưa có ý kiến (dòng Không đồng ý giữ nguyên), rồi tự khóa', async () => {
    const yeuCau = ghiYeuCau();
    const user = userEvent.setup();
    moDanhSach(voiYKien([null, 'khong_dong_y', null], { trang_thai_danh_sach: 'bao_sai_lech' }));
    const tatCa = await screen.findByRole('button', { name: 'Đồng ý tất cả dòng chưa có ý kiến' });
    await user.click(tatCa);
    await waitFor(() => expect(nut('GV Bịa An', 'Đồng ý')).toHaveAttribute('aria-pressed', 'true'));
    expect(nut('GV Bịa Chi', 'Đồng ý')).toHaveAttribute('aria-pressed', 'true');
    expect(nut('GV Bịa Bình', 'Không đồng ý')).toHaveAttribute('aria-pressed', 'true');
    expect(yeuCau).toEqual([
      { method: 'POST', path: '/cong-don-vi/truong/dot/dot-hsg-1/danh-sach/dong-y-tat-ca', body: null },
    ]);
    expect(chip()).toHaveTextContent('Báo sai lệch');
    expect(screen.getByRole('button', { name: 'Đồng ý tất cả dòng chưa có ý kiến' })).toBeDisabled();
  });
});

describe('Màn danh sách của trường — Xác nhận danh sách (#61)', () => {
  it('chưa đủ Đồng ý → nút Xác nhận tắt, kèm lý do (aria-describedby)', async () => {
    moDanhSach(voiYKien(['dong_y', null, 'khong_dong_y']));
    const btn = await screen.findByRole('button', { name: 'Xác nhận danh sách' });
    expect(btn).toBeDisabled();
    const lyDo = screen.getByText('Còn 2 dòng chưa Đồng ý — chưa xác nhận được.');
    expect(btn).toHaveAttribute('aria-describedby', lyDo.id);
  });

  it('mọi dòng Đồng ý → nút bật, không còn lý do', async () => {
    moDanhSach(voiYKien(['dong_y', 'dong_y', 'dong_y']));
    expect(await screen.findByRole('button', { name: 'Xác nhận danh sách' })).toBeEnabled();
    expect(screen.queryByText(/chưa xác nhận được/)).not.toBeInTheDocument();
  });

  it('bấm Đồng ý dòng cuối → nút Xác nhận chuyển từ tắt sang bật', async () => {
    const user = userEvent.setup();
    moDanhSach(voiYKien(['dong_y', 'dong_y', null]));
    expect(await screen.findByRole('button', { name: 'Xác nhận danh sách' })).toBeDisabled();
    await user.click(nut('GV Bịa Chi', 'Đồng ý'));
    await waitFor(() => expect(nutXacNhan()).toBeEnabled());
  });

  it('Hủy ở hộp xác nhận → không gửi gì', async () => {
    const yeuCau = ghiYeuCau();
    const user = userEvent.setup();
    moDanhSach(voiYKien(['dong_y', 'dong_y', 'dong_y']));
    await user.click(await screen.findByRole('button', { name: 'Xác nhận danh sách' }));
    const hop = await screen.findByRole('dialog', { name: 'Xác nhận danh sách' });
    await user.click(within(hop).getByRole('button', { name: 'Hủy' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(yeuCau).toEqual([]);
    expect(chip()).toHaveTextContent('Chờ xác nhận');
  });

  it('hộp xác nhận nêu HCMUE dùng danh sách làm hợp đồng → Xác nhận gửi POST xac-nhan → chip "Đã xác nhận"', async () => {
    const yeuCau = ghiYeuCau();
    const user = userEvent.setup();
    moDanhSach(voiYKien(['dong_y', 'dong_y', 'dong_y']));
    await user.click(await screen.findByRole('button', { name: 'Xác nhận danh sách' }));
    const hop = await screen.findByRole('dialog', { name: 'Xác nhận danh sách' });
    expect(within(hop).getByText('Sau khi xác nhận, HCMUE dùng danh sách này để làm hợp đồng.')).toBeInTheDocument();
    await user.click(within(hop).getByRole('button', { name: 'Xác nhận' }));

    await waitFor(() => expect(chip()).toHaveTextContent('Đã xác nhận'));
    expect(yeuCau).toEqual([
      { method: 'POST', path: '/cong-don-vi/truong/dot/dot-hsg-1/danh-sach/xac-nhan', body: null },
    ]);
    expect(screen.getByText('Trường đã xác nhận danh sách này.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Xác nhận danh sách' })).not.toBeInTheDocument();
    // routesCongDonVi có <Notifications> riêng (KhungNoiBo) ngoài cái của renderVoiRouter → thông báo hiện 2 lần.
    expect((await screen.findAllByText('Đã xác nhận danh sách')).length).toBeGreaterThan(0);
  });

  it('server từ chối (400) → hiện lý do trong hộp xác nhận, trạng thái không đổi', async () => {
    server.use(
      http.post(`${URL_DS}/xac-nhan`, () =>
        HttpResponse.json({ error: { code: 'VALIDATION_ERROR', message: 'Còn 1 dòng chưa Đồng ý' } }, { status: 400 }),
      ),
    );
    const user = userEvent.setup();
    moDanhSach(voiYKien(['dong_y', 'dong_y', 'dong_y']));
    await user.click(await screen.findByRole('button', { name: 'Xác nhận danh sách' }));
    const hop = await screen.findByRole('dialog', { name: 'Xác nhận danh sách' });
    await user.click(within(hop).getByRole('button', { name: 'Xác nhận' }));
    expect(await within(hop).findByRole('alert')).toHaveTextContent('Còn 1 dòng chưa Đồng ý');
    expect(chip()).toHaveTextContent('Chờ xác nhận');
  });

  it('danh sách trống → không có nút ý kiến / Đồng ý tất cả; Xác nhận tắt với lý do "Danh sách trống"', async () => {
    moDanhSach(danhSachMau({ dong: [], tong_suat: 0, gia_tri_tam_tinh: 0 }));
    expect(await screen.findByRole('button', { name: 'Xác nhận danh sách' })).toBeDisabled();
    expect(screen.getByText('Danh sách trống — chưa xác nhận được.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Đồng ý tất cả dòng chưa có ý kiến' })).not.toBeInTheDocument();
    expect(screen.queryByRole('group')).not.toBeInTheDocument();
  });

  it('đã xác nhận → chip "Đã xác nhận", không còn nút Xác nhận', async () => {
    moDanhSach(voiYKien(['dong_y', 'dong_y', 'dong_y'], { trang_thai_danh_sach: 'da_xac_nhan' }));
    expect(await screen.findByText('Trường đã xác nhận danh sách này.')).toBeInTheDocument();
    expect(chip()).toHaveTextContent('Đã xác nhận');
    expect(screen.queryByRole('button', { name: 'Xác nhận danh sách' })).not.toBeInTheDocument();
  });
});

describe('Màn danh sách của trường — hợp đồng đã nộp (#64, X5)', () => {
  it('đã nộp → chỉ xem: không nút ý kiến, Đồng ý tất cả, đề nghị thêm người, Xác nhận; có ghi chú', async () => {
    moDanhSach(
      voiYKien(['dong_y', 'dong_y', 'dong_y'], { trang_thai_danh_sach: 'da_xac_nhan', trang_thai_hop_dong: 'da_nop' }),
    );
    expect(await screen.findByText('Hợp đồng đã nộp — danh sách chỉ xem')).toBeInTheDocument();
    expect(screen.getByText('GV Bịa An')).toBeInTheDocument();
    expect(screen.queryByRole('group')).not.toBeInTheDocument();
    for (const ten of ['Đồng ý tất cả dòng chưa có ý kiến', 'Đề nghị thêm người', 'Xác nhận danh sách']) {
      expect(screen.queryByRole('button', { name: ten })).not.toBeInTheDocument();
    }
  });
});
