import { describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { renderVoiRouter } from '@/test/testUtils';
import { datToken } from '@/auth/tokenStore';
import { db } from '@/test/mocks/db';
import { server } from '@/test/mocks/server';
import { dbDotTrienKhai, dotMau } from '@/test/mocks/dotTrienKhai';
import QuanTriDotTrienKhai from './QuanTriDotTrienKhai';

// Issue #68 / ADR 0015 M1: gắn khóa NLS vào đợt ở màn Chương trình / Đợt. Mã/tên khóa đều bịa.
type User = ReturnType<typeof userEvent.setup>;

const KHOA_1 = {
  id: 'k-1',
  ma_khoa: 'KNLS-01',
  ten_khoa: 'Khóa NLS Bịa Một',
  thoi_gian_bat_dau: '2026-03-01',
  thoi_gian_ket_thuc: '2026-06-30',
};

function renderTrang() {
  db.nguoiDung.vai_tro = 'quan_tri';
  datToken('token-gia-lap');
  dbDotTrienKhai.ds = [
    dotMau(),
    dotMau({ id: 'dtk-nls', chuong_trinh: 'nls', ten: 'NLS đợt 1', khoa: [KHOA_1] }),
    dotMau({ id: 'dtk-nls-2', chuong_trinh: 'nls', ten: 'NLS đợt rỗng' }),
  ];
  return renderVoiRouter([{ path: '/quan-tri/dot-trien-khai', element: <QuanTriDotTrienKhai /> }], {
    initialEntries: ['/quan-tri/dot-trien-khai'],
  });
}

async function moSua(user: User, ten: string) {
  await user.click(await screen.findByRole('button', { name: `Sửa đợt ${ten}` }));
  return screen.findByRole('dialog', { name: 'Sửa đợt triển khai' });
}

function batBodyGanKhoa() {
  const ghi: { body?: unknown } = {};
  server.use(
    http.put('/cong-don-vi/dot-trien-khai/:id/khoa', async ({ request }) => {
      ghi.body = await request.clone().json();
      return undefined;
    }),
  );
  return ghi;
}

describe('Khóa NLS của đợt', () => {
  it('thẻ đợt NLS hiện số + mã khóa đã gắn hoặc "Chưa gắn"; thẻ HSG không có dòng khóa', async () => {
    renderTrang();
    const ds = await screen.findByRole('list', { name: 'Danh sách đợt triển khai' });
    const [theHsg, theNls, theRong] = within(ds).getAllByRole('listitem');
    expect(within(theNls).getByText('1 khóa (KNLS-01)')).toBeInTheDocument();
    expect(within(theRong).getByText('Chưa gắn')).toBeInTheDocument();
    expect(within(theHsg).queryByText(/Khóa NLS/)).not.toBeInTheDocument();
  });

  it('đợt NLS: chọn thêm khóa, khóa đã gắn đợt khác bị khóa, Lưu gửi trọn tập khoa_ids', async () => {
    const ghi = batBodyGanKhoa();
    const user = userEvent.setup();
    renderTrang();
    const hop = await moSua(user, 'NLS đợt 1');
    expect(within(hop).getByRole('heading', { name: 'Khóa NLS của đợt' })).toBeInTheDocument();
    await user.click(within(hop).getByRole('textbox', { name: 'Khóa NLS' }));
    const khoaKhac = await screen.findByRole('option', { name: 'KNLS-03 – Khóa NLS Bịa Ba (đã gắn đợt NLS đợt khác)' });
    expect(khoaKhac).toHaveAttribute('data-combobox-disabled');
    await user.click(screen.getByRole('option', { name: 'KNLS-02 – Khóa NLS Bịa Hai' }));
    await user.click(within(hop).getByRole('button', { name: 'Lưu khóa của đợt' }));
    await waitFor(() => expect(ghi.body).toEqual({ khoa_ids: ['k-1', 'k-2'] }));
    expect(await screen.findByText('Đã lưu 2 khóa NLS của đợt')).toBeInTheDocument();
    expect(dbDotTrienKhai.ds.find((d) => d.id === 'dtk-nls')?.khoa.map((k) => k.ma_khoa)).toEqual([
      'KNLS-01',
      'KNLS-02',
    ]);
  }, 20000);

  it('409 khóa đã gắn đợt khác → hiện thông điệp server', async () => {
    server.use(
      http.put('/cong-don-vi/dot-trien-khai/:id/khoa', () =>
        HttpResponse.json(
          {
            error: {
              code: 'CONFLICT',
              message: 'Khóa đã gắn đợt khác — gỡ ở đợt đó trước: KNLS-01 (đợt NLS đợt khác)',
            },
          },
          { status: 409 },
        ),
      ),
    );
    const user = userEvent.setup();
    renderTrang();
    const hop = await moSua(user, 'NLS đợt 1');
    await user.click(within(hop).getByRole('button', { name: 'Lưu khóa của đợt' }));
    expect(await within(hop).findByRole('alert')).toHaveTextContent(
      'Khóa đã gắn đợt khác — gỡ ở đợt đó trước: KNLS-01 (đợt NLS đợt khác)',
    );
  }, 20000);

  it('400 khóa ngoài phạm vi Sở → hiện lỗi', async () => {
    server.use(
      http.put('/cong-don-vi/dot-trien-khai/:id/khoa', () =>
        HttpResponse.json(
          {
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Khóa không do Sở của đợt hoặc đơn vị trực thuộc đặt hàng: KNLS-09',
              fields: [{ field: 'khoa_ids', message: 'Khóa không do Sở của đợt hoặc đơn vị trực thuộc đặt hàng' }],
            },
          },
          { status: 400 },
        ),
      ),
    );
    const user = userEvent.setup();
    renderTrang();
    const hop = await moSua(user, 'NLS đợt 1');
    await user.click(within(hop).getByRole('button', { name: 'Lưu khóa của đợt' }));
    expect(await within(hop).findByRole('alert')).toHaveTextContent('KNLS-09');
  }, 20000);

  it('đợt HSG: không có phần khóa NLS, không gọi khoa-co-the-gan', async () => {
    let daGoi = false;
    server.use(
      http.get('/cong-don-vi/dot-trien-khai/:id/khoa-co-the-gan', () => {
        daGoi = true;
        return HttpResponse.json([]);
      }),
    );
    const user = userEvent.setup();
    renderTrang();
    const hop = await moSua(user, 'HSG An Giang 2026');
    expect(within(hop).getByRole('textbox', { name: /^Tên đợt/ })).toBeInTheDocument();
    expect(within(hop).queryByRole('heading', { name: 'Khóa NLS của đợt' })).not.toBeInTheDocument();
    expect(daGoi).toBe(false);
  });

  it('tạo đợt NLS mới: nhắc gắn khóa sau khi tạo, chưa có ô chọn khóa', async () => {
    const user = userEvent.setup();
    renderTrang();
    await user.click(await screen.findByRole('button', { name: 'Tạo đợt' }));
    const hop = await screen.findByRole('dialog', { name: 'Tạo đợt triển khai' });
    await user.click(within(hop).getByRole('textbox', { name: /^Chương trình/ }));
    await user.click(await screen.findByRole('option', { name: 'NLS – Năng lực số' }));
    expect(within(hop).getByText('Tạo đợt xong, bấm Sửa để gắn khóa NLS.')).toBeInTheDocument();
    expect(within(hop).queryByRole('textbox', { name: 'Khóa NLS' })).not.toBeInTheDocument();
  });
});
