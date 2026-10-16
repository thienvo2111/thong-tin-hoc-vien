import { describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/mocks/server';
import { db } from '@/test/mocks/db';
import { renderVoiRouter } from '@/test/testUtils';
import { datToken } from '@/auth/tokenStore';
import type { DongThongKeDoiBuoi, HocVienDongThongKe, ThongKeDoiBuoi } from '@/api/doiBuoi';
import ThongKeDoiBuoiTab from './ThongKeDoiBuoi';
import DuyetDoiBuoi from './DuyetDoiBuoi';

function dong(id: string, ten: string, over: Partial<DongThongKeDoiBuoi> = {}): DongThongKeDoiBuoi {
  return {
    lich: {
      id,
      buoi_so: 2,
      thoi_gian_bat_dau: '2026-11-20T01:00:00.000Z',
      thoi_gian_ket_thuc: '2026-11-20T04:00:00.000Z',
      lop: { id: `lop-${id}`, ten_lop: ten, muc_nang_luc: 'co_ban', loai_lop: 'zoom' },
      giai_doan: { id: 'gd1', thu_tu: 1, ten_giai_doan: 'GĐ 1' },
      khoa: { id: 'k1', ma_khoa: 'K1', ten_khoa: 'Khóa 1' },
    },
    si_so_phan_lop: 25,
    si_so: 27,
    si_so_toi_da: 30,
    day: false,
    ra_da_duyet: 1,
    ra_cho: 2,
    ra_qua_han: 0,
    ra_tu_choi: 0,
    ra_huy: 0,
    vao_da_duyet: 3,
    vao_cho: 0,
    vao_qua_han: 1,
    vao_tu_choi: 0,
    vao_huy: 0,
    ...over,
  };
}

const BO_LOC: ThongKeDoiBuoi['bo_loc'] = {
  khoa: [
    { id: 'k1', ma_khoa: 'K1', ten_khoa: 'Khóa 1' },
    { id: 'k2', ma_khoa: 'K2', ten_khoa: 'Khóa 2' },
  ],
  giai_doan: [
    { id: 'gd1', khoa_id: 'k1', thu_tu: 1, ten_giai_doan: 'GĐ 1' },
    { id: 'gd2', khoa_id: 'k2', thu_tu: 1, ten_giai_doan: 'GĐ khóa 2' },
  ],
  lop: [
    { id: 'lop-a', khoa_id: 'k1', ten_lop: 'Lớp 01', muc_nang_luc: 'co_ban', loai_lop: 'zoom' },
    { id: 'lop-b', khoa_id: 'k2', ten_lop: 'Lớp K2', muc_nang_luc: 'co_ban', loai_lop: 'zoom' },
  ],
  cum: [
    { id: 'c1', ten_cum: 'Cụm 1' },
    { id: 'c2', ten_cum: 'Cụm 2' },
  ],
};

function ketQua(over: Partial<ThongKeDoiBuoi> = {}): ThongKeDoiBuoi {
  return {
    tong: { de_nghi: 12, cho_duyet: 4, qua_han: 1, da_duyet: 5, tu_choi: 1, da_huy: 1, so_buoi_day: 1 },
    dong: [dong('A', 'Lớp 01'), dong('B', 'Lớp 02', { day: true, si_so: 30 })],
    bo_loc: BO_LOC,
    gioi_han: false,
    ...over,
  };
}

function hv(id: string, over: Partial<HocVienDongThongKe> = {}): HocVienDongThongKe {
  return {
    de_nghi_id: id,
    ho_ten: `Học viên ${id}`,
    don_vi: 'THPT Long Xuyên',
    cum: 'Cụm 1',
    trang_thai: 'da_duyet',
    ly_do_huy: null,
    qua_han: false,
    buoi_kia: {
      id: 'X',
      buoi_so: 2,
      thoi_gian_bat_dau: '2026-11-21T01:00:00.000Z',
      thoi_gian_ket_thuc: null,
      lop: { ten_lop: 'Lớp 09' },
    },
    tao_luc: '2026-10-10T01:00:00.000Z',
    xu_ly_luc: '2026-10-11T01:00:00.000Z',
    nguoi_xu_ly: 'Cô Hà',
    ...over,
  };
}

function datApi(kq: ThongKeDoiBuoi = ketQua()) {
  const urls: string[] = [];
  server.use(
    http.get('/doi-buoi-hoc/thong-ke', ({ request }) => {
      urls.push(request.url);
      return HttpResponse.json(kq);
    }),
    http.get('/doi-buoi-hoc/thong-ke/buoi/:lichId', () =>
      HttpResponse.json({
        ra: [hv('ra-1')],
        vao: [hv('vao-1', { trang_thai: 'da_huy', ly_do_huy: 'huy_duyet' })],
      }),
    ),
  );
  return urls;
}

function renderTab() {
  datToken('token-gia-lap');
  db.nguoiDung.vai_tro = 'quan_tri';
  return renderVoiRouter([{ path: '/', element: <ThongKeDoiBuoiTab /> }]);
}

const tham = (url: string) => new URL(url).searchParams;
const cuoi = (urls: string[]) => urls[urls.length - 1];
const choBang = () => screen.findByRole('button', { name: /Xem chi tiết Lớp 01/ });

async function chon(user: ReturnType<typeof userEvent.setup>, nhan: string, option: string) {
  await user.click(screen.getByRole('textbox', { name: nhan }));
  await user.click(await screen.findByRole('option', { name: option }));
}

describe('Tab Thống kê đổi buổi', () => {
  it('hiện ô tổng và bảng theo buổi', async () => {
    datApi();
    renderTab();
    expect(await choBang()).toBeInTheDocument();
    expect(screen.getByLabelText('Tổng đề nghị')).toHaveTextContent('12');
    expect(screen.getByLabelText('Chờ duyệt')).toHaveTextContent('4');
    expect(screen.getByLabelText('Quá hạn')).toHaveTextContent('1');
    expect(screen.getByLabelText('Buổi đã đầy')).toHaveTextContent('1');
    const hangA = screen.getByRole('button', { name: /Xem chi tiết Lớp 01/ });
    expect(hangA).toHaveTextContent(/Buổi 2 · Thứ sáu, 20\/11 · 08:00–11:00/i);
    expect(within(hangA).getByLabelText('Sĩ số')).toHaveTextContent('25 → 27 / 30');
    expect(within(hangA).getByLabelText('Đổi ra')).toHaveTextContent('1 · 2 · 0 · 0 · 0');
    expect(within(hangA).getByLabelText('Đổi vào')).toHaveTextContent('3 · 0 · 1 · 0 · 0');
  });

  it('buổi đầy: sĩ số có nhãn đã đầy', async () => {
    datApi();
    renderTab();
    const hangB = await screen.findByRole('button', { name: /Xem chi tiết Lớp 02/ });
    expect(within(hangB).getByLabelText('Sĩ số (đã đầy)')).toHaveTextContent('25 → 30 / 30');
    const hangA = screen.getByRole('button', { name: /Xem chi tiết Lớp 01/ });
    expect(within(hangA).queryByLabelText('Sĩ số (đã đầy)')).toBeNull();
  });

  it('đổi bộ lọc gửi đúng query (CSV cho mảng, chi_co_cho=true)', async () => {
    const urls = datApi();
    const user = userEvent.setup();
    renderTab();
    await choBang();
    await chon(user, 'Trình độ', 'Nâng cao');
    await user.click(await screen.findByRole('option', { name: 'Cơ bản' })); // dropdown MultiSelect vẫn mở
    await waitFor(() => expect(tham(cuoi(urls)).get('muc_nang_luc')).toBe('nang_cao,co_ban'));
    await chon(user, 'Cụm', 'Cụm 2');
    await waitFor(() => expect(tham(cuoi(urls)).get('cum_id')).toBe('c2'));
    await user.click(screen.getByRole('switch', { name: 'Chỉ buổi có đề nghị chờ' }));
    await waitFor(() => expect(tham(cuoi(urls)).get('chi_co_cho')).toBe('true'));
    await user.type(screen.getByLabelText('Từ ngày'), '2026-11-01');
    await waitFor(() => expect(tham(cuoi(urls)).get('tu_ngay')).toBe('2026-11-01'));
  });

  it('đổi khóa thì bỏ chọn giai đoạn và lớp', async () => {
    const urls = datApi();
    const user = userEvent.setup();
    renderTab();
    await choBang();
    await chon(user, 'Khóa', 'Khóa 1');
    await chon(user, 'Giai đoạn', 'GĐ1 – GĐ 1');
    await chon(user, 'Lớp', 'Lớp 01');
    await waitFor(() => {
      const p = tham(cuoi(urls));
      expect([p.get('khoa_id'), p.get('giai_doan_id'), p.get('lop_id')]).toEqual(['k1', 'gd1', 'lop-a']);
    });
    await chon(user, 'Khóa', 'Khóa 2');
    await waitFor(() => {
      const p = tham(cuoi(urls));
      expect([p.get('khoa_id'), p.get('giai_doan_id'), p.get('lop_id')]).toEqual(['k2', null, null]);
    });
    // Giai đoạn chỉ còn của khóa 2
    await user.click(screen.getByRole('textbox', { name: 'Giai đoạn' }));
    expect(await screen.findByRole('option', { name: 'GĐ1 – GĐ khóa 2' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'GĐ1 – GĐ 1' })).toBeNull();
  });

  it('bấm dòng mở chi tiết Đổi ra / Đổi vào với nhãn trạng thái như tab Đã xử lý', async () => {
    datApi();
    const user = userEvent.setup();
    renderTab();
    await user.click(await screen.findByRole('button', { name: /Xem chi tiết Lớp 01/ }));
    const modal = await screen.findByRole('dialog');
    const ra = await within(modal).findByRole('region', { name: /Đổi ra/ });
    expect(within(ra).getByText('Học viên ra-1')).toBeInTheDocument();
    expect(ra).toHaveTextContent(/THPT Long Xuyên · Cụm 1/);
    expect(ra).toHaveTextContent(/Lớp 09 · Buổi 2/);
    expect(ra).toHaveTextContent('Đã duyệt');
    const vao = within(modal).getByRole('region', { name: /Đổi vào/ });
    expect(vao).toHaveTextContent('Hủy duyệt bởi Cô Hà');
  });

  it('nút Xuất Excel gọi đúng URL kèm bộ lọc', async () => {
    datApi();
    let urlXuat = '';
    server.use(
      http.get('/doi-buoi-hoc/thong-ke/xuat-excel', ({ request }) => {
        urlXuat = request.url;
        return new HttpResponse(new Blob(['x']), {
          headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
        });
      }),
    );
    const user = userEvent.setup();
    renderTab();
    await choBang();
    await chon(user, 'Hình thức', 'Zoom');
    await user.click(screen.getByRole('button', { name: 'Xuất Excel' }));
    await waitFor(() => expect(urlXuat).toContain('/doi-buoi-hoc/thong-ke/xuat-excel'));
    expect(tham(urlXuat).get('loai_lop')).toBe('zoom');
  });

  it('không có dòng → thông báo trống; gioi_han → banner', async () => {
    datApi(ketQua({ dong: [], gioi_han: true }));
    renderTab();
    expect(await screen.findByText('Không có buổi nào có đề nghị đổi theo bộ lọc.')).toBeInTheDocument();
    expect(screen.getByText(/vượt giới hạn/)).toBeInTheDocument();
  });

  it('ẩn bộ lọc Cụm khi chỉ có 1 cụm', async () => {
    datApi(ketQua({ bo_loc: { ...BO_LOC, cum: [{ id: 'c1', ten_cum: 'Cụm 1' }] } }));
    renderTab();
    await choBang();
    expect(screen.queryByRole('textbox', { name: 'Cụm' })).toBeNull();
  });

  it('màn Đổi buổi có tab Thống kê', async () => {
    datApi();
    server.use(
      http.get('/doi-buoi-hoc', () => HttpResponse.json([])),
      http.get('/doi-buoi-hoc/dem-cho-duyet', () => HttpResponse.json({ cho_duyet: 0 })),
    );
    datToken('token-gia-lap');
    db.nguoiDung.vai_tro = 'ho_tro_hoc_vien';
    const user = userEvent.setup();
    renderVoiRouter([{ path: '/', element: <DuyetDoiBuoi /> }]);
    await user.click(await screen.findByRole('tab', { name: 'Thống kê' }));
    expect(await choBang()).toBeInTheDocument();
  });
});
