import { describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/mocks/server';
import { db } from '@/test/mocks/db';
import { renderVoiRouter } from '@/test/testUtils';
import { datToken } from '@/auth/tokenStore';
import HoTroLop from './HoTroLop';
import HoTroLopChiTiet from './HoTroLopChiTiet';

// ADR 0008 — người hỗ trợ học viên theo lớp: danh sách lớp được gắn, danh sách học viên lớp, xuất Excel.
function render(initialEntries: string[]) {
  datToken('token-gia-lap');
  db.nguoiDung.vai_tro = 'ho_tro_hoc_vien';
  return renderVoiRouter(
    [
      { path: '/ho-tro/lop', element: <HoTroLop /> },
      { path: '/ho-tro/lop/:lopId', element: <HoTroLopChiTiet /> },
      {
        path: '/ho-tro/hoc-vien/:id',
        element: <div>Màn hình chi tiết học viên</div>,
      },
    ],
    { initialEntries },
  );
}

function ghiQueryXuat() {
  const queries: string[] = [];
  server.use(
    http.get('/ho-tro-hoc-vien/lop/xuat', ({ request }) => {
      queries.push(new URL(request.url).search);
      return new HttpResponse(new Blob(['xlsx']));
    }),
  );
  return queries;
}

function dongChua(el: HTMLElement): HTMLElement {
  const tr = el.closest('tr');
  if (!tr) throw new Error('Không thấy dòng bảng');
  return tr;
}

describe('Người hỗ trợ — Lớp hỗ trợ', () => {
  it('bảng lớp: khóa, loại, tên, mức, sĩ số; nút Xem danh sách dẫn tới lớp', async () => {
    render(['/ho-tro/lop']);
    const bang = await screen.findByRole('table');
    for (const cot of ['Khóa', 'Loại lớp', 'Tên lớp', 'Mức', 'Sĩ số']) {
      expect(within(bang).getByRole('columnheader', { name: cot })).toBeInTheDocument();
    }
    const dong = dongChua(within(bang).getByText('Zoom 01'));
    expect(within(dong).getByText('KBD-AG-01')).toBeInTheDocument();
    expect(within(dong).getByText('Zoom')).toBeInTheDocument();
    expect(within(dong).getByText('Cơ bản')).toBeInTheDocument();
    expect(within(dong).getByText('1')).toBeInTheDocument();
    expect(within(dong).getByRole('link', { name: 'Xem danh sách' })).toHaveAttribute('href', '/ho-tro/lop/lop-zoom-1');
  });

  it('chưa được gắn lớp nào -> hướng dẫn liên hệ Quản trị, không có nút xuất', async () => {
    db.hoTroLop = [];
    render(['/ho-tro/lop']);
    expect(
      await screen.findByText('Thầy/Cô chưa được gắn hỗ trợ lớp nào. Liên hệ Quản trị để được phân công.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Xuất tất cả lớp' })).not.toBeInTheDocument();
  });

  it('Xuất tất cả lớp -> gọi /lop/xuat không lop_id và tải file', async () => {
    const queries = ghiQueryXuat();
    render(['/ho-tro/lop']);
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Xuất tất cả lớp' }));
    await waitFor(() => expect(queries).toEqual(['']));
    await waitFor(() => expect(URL.createObjectURL).toHaveBeenCalled());
  });

  it('Xuất Excel 1 lớp -> gửi lop_id của lớp', async () => {
    const queries = ghiQueryXuat();
    render(['/ho-tro/lop']);
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Xuất Excel lớp Zoom 01' }));
    await waitFor(() => expect(queries).toEqual(['?lop_id=lop-zoom-1']));
  });
});

describe('Người hỗ trợ — Danh sách học viên lớp', () => {
  it('đầu lớp + bảng học viên (ngày sinh, đơn vị, SĐT, email, cụm, giai đoạn); tên dẫn tới chi tiết', async () => {
    render(['/ho-tro/lop/lop-zoom-1']);
    expect(await screen.findByRole('heading', { name: 'Zoom · Zoom 01' })).toBeInTheDocument();
    expect(screen.getByText('KBD-AG-01 · Khóa An Giang')).toBeInTheDocument();
    const bang = screen.getByRole('table');
    const link = within(bang).getByRole('link', { name: 'Lê Thị Zoom' });
    expect(link).toHaveAttribute('href', '/ho-tro/hoc-vien/hv-lop-1');
    const dong = dongChua(link);
    for (const o of [
      '02/03/1988',
      'Trường THCS Mỹ Hòa',
      '0912345678',
      'zoom@gmail.com',
      'Cụm Long Xuyên',
      'Học Zoom',
    ]) {
      expect(within(dong).getByText(o)).toBeInTheDocument();
    }
    const user = userEvent.setup();
    await user.click(link);
    expect(await screen.findByText('Màn hình chi tiết học viên')).toBeInTheDocument();
  });

  it('Xuất Excel lớp này -> gửi lop_id', async () => {
    const queries = ghiQueryXuat();
    render(['/ho-tro/lop/lop-zoom-1']);
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Xuất Excel lớp này' }));
    await waitFor(() => expect(queries).toEqual(['?lop_id=lop-zoom-1']));
  });

  it('lớp không được gắn (404) -> thông báo "Không tìm thấy lớp"', async () => {
    render(['/ho-tro/lop/lop-khac']);
    expect(await screen.findByText('Không tìm thấy lớp')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
});
