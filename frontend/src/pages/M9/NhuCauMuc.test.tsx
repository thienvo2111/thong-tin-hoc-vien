import { describe, expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/mocks/server';
import { db, taoNhuCauMucMau } from '@/test/mocks/db';
import { renderVoiRouter } from '@/test/testUtils';
import { datToken } from '@/auth/tokenStore';
import { dinhDangNgayGio } from '@/lib/ngay';
import type { NhuCauMucCuaToi } from '@/api/types';
import NhuCauMuc from './NhuCauMuc';

const DOT_ID = '11111111-1111-4111-8111-111111111111';

function render(url = `/toi/nhu-cau-muc?dot=${DOT_ID}`) {
  datToken('token-gia-lap');
  return renderVoiRouter(
    [
      { path: '/toi/nhu-cau-muc', element: <NhuCauMuc /> },
      { path: '/toi', element: <div>Trang chính</div> },
    ],
    { initialEntries: [url] },
  );
}

const moDot = (ghiDe: Partial<NhuCauMucCuaToi> = {}) => {
  db.nhuCauMuc = [taoNhuCauMucMau(ghiDe)];
};

const LUA_CHON_CO_BAN = {
  muc_chon: 'co_ban',
  muc_moc: 'thanh_thao',
  nguon_moc: 'lop',
  chon_luc: '2026-10-05T01:00:00.000Z',
  cap_nhat_luc: '2026-10-05T01:00:00.000Z',
} as const;

describe('M9 — chọn nhu cầu mức học (ADR 0013)', () => {
  it('thứ tự heading theo D8: Thông tin → Mức/lớp → Nhu cầu', async () => {
    moDot();
    render();
    await screen.findByRole('heading', { name: 'Nhu cầu bồi dưỡng' });
    const ten = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    expect(ten).toEqual(['Thông tin của Thầy/Cô', 'Mức – lớp đang được phân công', 'Nhu cầu bồi dưỡng']);
  });

  it('hiện lớp và nguồn mốc theo lớp đang học', async () => {
    moDot();
    render();
    expect(await screen.findByText('Lớp: Lớp A1')).toBeInTheDocument();
    expect(screen.getByText(/theo lớp đang học/)).toBeInTheDocument();
  });

  it('mốc chốt: ghi "theo mức chính thức (chốt)"', async () => {
    moDot({ moc: { muc: 'co_ban', nguon: 'muc_chot', lop: null, giai_doan: null }, cac_muc_duoc_chon: ['co_ban'] });
    render();
    expect(await screen.findByText(/theo mức chính thức \(chốt\)/)).toBeInTheDocument();
  });

  it('mốc thanh_thao: chỉ có Cơ bản và Thành thạo, không có Nâng cao', async () => {
    moDot();
    render();
    expect(await screen.findByRole('radio', { name: 'Cơ bản' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Thành thạo' })).toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: 'Nâng cao' })).not.toBeInTheDocument();
    expect(screen.queryByText('Nâng cao')).not.toBeInTheDocument();
    expect(screen.getByText('Thầy/Cô chỉ có thể chọn bằng hoặc thấp hơn mức hiện tại.')).toBeInTheDocument();
  });

  it('Lưu → modal xác nhận → Xác nhận gọi PUT và báo thành công', async () => {
    moDot();
    render();
    await userEvent.click(await screen.findByRole('radio', { name: 'Cơ bản' }));
    await userEvent.click(screen.getByRole('button', { name: 'Lưu' }));
    expect(await screen.findByText(/xác nhận chọn nhu cầu/)).toBeInTheDocument();
    expect(db.nhuCauMuc[0].lua_chon).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Xác nhận' }));
    expect(await screen.findByText('Đã lưu nhu cầu mức học.')).toBeInTheDocument();
    expect(db.nhuCauMuc[0].lua_chon?.muc_chon).toBe('co_ban');
  });

  it('API trả 400 field muc: hiện lỗi trong modal', async () => {
    moDot();
    server.use(
      http.put(`*/hoc-vien/toi/nhu-cau-muc/${DOT_ID}`, () =>
        HttpResponse.json(
          {
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Dữ liệu không hợp lệ',
              fields: [{ field: 'muc', message: 'Mức chọn vượt quá mức hiện tại' }],
            },
          },
          { status: 400 },
        ),
      ),
    );
    render();
    await userEvent.click(await screen.findByRole('radio', { name: 'Thành thạo' }));
    await userEvent.click(screen.getByRole('button', { name: 'Lưu' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Xác nhận' }));
    expect(await screen.findByText('Mức chọn vượt quá mức hiện tại')).toBeInTheDocument();
  });

  it('đợt da_dong: không có nút Lưu, hiện giờ đóng và lựa chọn cuối', async () => {
    const mau = taoNhuCauMucMau();
    moDot({ dot: { ...mau.dot, trang_thai: 'da_dong' }, lua_chon: LUA_CHON_CO_BAN });
    render();
    expect(await screen.findByText(`Đợt đã đóng lúc ${dinhDangNgayGio(mau.dot.dong_luc)}.`)).toBeInTheDocument();
    expect(screen.getByText('Lựa chọn cuối: Cơ bản')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Lưu' })).not.toBeInTheDocument();
    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
  });

  it('PUT trả 403 DOT_NHU_CAU_DONG: chuyển sang chỉ xem', async () => {
    moDot();
    server.use(
      http.put(`*/hoc-vien/toi/nhu-cau-muc/${DOT_ID}`, () =>
        HttpResponse.json(
          { error: { code: 'DOT_NHU_CAU_DONG', message: 'Đợt nhu cầu mức học đã đóng' } },
          { status: 403 },
        ),
      ),
    );
    render();
    await userEvent.click(await screen.findByRole('radio', { name: 'Cơ bản' }));
    await userEvent.click(screen.getByRole('button', { name: 'Lưu' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Xác nhận' }));
    expect(await screen.findByText(/Đợt đã đóng lúc/)).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Lưu' })).not.toBeInTheDocument());
  });

  it('chưa có mốc: "Chưa có mức/lớp, chưa thể đăng ký nhu cầu"', async () => {
    moDot({ du_dieu_kien: false, ly_do_khong_du: 'chua_co_moc', moc: null, cac_muc_duoc_chon: [] });
    render();
    expect(await screen.findByText('Chưa có mức/lớp, chưa thể đăng ký nhu cầu.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Lưu' })).not.toBeInTheDocument();
  });

  it('thiếu ?dot=: "Không tìm thấy đợt"', async () => {
    render('/toi/nhu-cau-muc');
    expect(await screen.findByText('Không tìm thấy đợt.')).toBeInTheDocument();
  });

  it('API 404: "Không tìm thấy đợt"', async () => {
    db.nhuCauMuc = [];
    render();
    expect(await screen.findByText('Không tìm thấy đợt.')).toBeInTheDocument();
  });

  it('API 500: không báo "Không tìm thấy đợt", hiện lỗi + nút Thử lại gọi lại được', async () => {
    let lan = 0;
    server.use(
      http.get(`*/hoc-vien/toi/nhu-cau-muc/${DOT_ID}`, () => {
        lan += 1;
        return HttpResponse.json({ error: { code: 'INTERNAL', message: 'Lỗi máy chủ' } }, { status: 500 });
      }),
    );
    render();
    expect(await screen.findByText('Lỗi máy chủ')).toBeInTheDocument();
    expect(screen.queryByText('Không tìm thấy đợt.')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
    await waitFor(() => expect(lan).toBe(2));
  });
});
