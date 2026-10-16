import { describe, expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/mocks/server';
import { db } from '@/test/mocks/db';
import { renderVoiRouter } from '@/test/testUtils';
import { datToken } from '@/auth/tokenStore';
import type { CumHocVien, LopHoc } from '@/api/types';
import { ChonNguoiHoTroCum, ChonNguoiHoTroLop } from './ChonNguoiHoTroCum';

const CUM: CumHocVien = {
  id: 'cum-1',
  khoa_id: 'khoa-1',
  ten_cum: 'Cụm Long Xuyên',
  link_zalo: null,
  ghi_chu: null,
  trang_thai: 'active',
  created_at: '2026-09-01T00:00:00.000Z',
  nguoi_ho_tro: [],
};

function render(cum: CumHocVien) {
  datToken('token-gia-lap');
  db.nguoiDung.vai_tro = 'quan_tri';
  return renderVoiRouter([{ path: '/', element: <ChonNguoiHoTroCum khoaId="khoa-1" cum={cum} /> }]);
}

describe('Phân công người hỗ trợ cho cụm (ADR 0003 H4)', () => {
  it('cụm chưa có người hỗ trợ -> nhãn cảnh báo', async () => {
    render(CUM);
    expect(await screen.findByText('Chưa có người hỗ trợ')).toBeInTheDocument();
  });

  it('cụm đã có người -> hiện tên, không có cảnh báo', async () => {
    render({ ...CUM, nguoi_ho_tro: [{ id: 'ht-1', ho_ten: 'Nguyễn Văn A' }] });
    expect((await screen.findAllByText('Nguyễn Văn A')).length).toBeGreaterThan(0);
    expect(screen.queryByText('Chưa có người hỗ trợ')).not.toBeInTheDocument();
  });

  it('chọn 1 người -> PUT danh sách id thay toàn bộ', async () => {
    let body: unknown = null;
    server.use(
      http.put('/khoa-boi-duong/:id/cum/:cumId/nguoi-ho-tro', async ({ request, params }) => {
        body = { ...((await request.json()) as object), cumId: params.cumId };
        return HttpResponse.json({ cum_id: 'cum-1', nguoi_ho_tro: [{ id: 'ht-2', ho_ten: 'Trần Thị B' }] });
      }),
    );
    render(CUM);
    const user = userEvent.setup();
    await user.click(await screen.findByRole('textbox', { name: 'Người hỗ trợ Cụm Long Xuyên' }));
    await user.click(await screen.findByRole('option', { name: 'Trần Thị B' }));
    await waitFor(() => expect(body).toEqual({ nguoi_dung_ids: ['ht-2'], cumId: 'cum-1' }));
    expect(await screen.findByText('Đã cập nhật người hỗ trợ "Cụm Long Xuyên"')).toBeInTheDocument();
  });

  it('API lỗi -> báo lỗi', async () => {
    server.use(
      http.put('/khoa-boi-duong/:id/cum/:cumId/nguoi-ho-tro', () =>
        HttpResponse.json(
          { error: { code: 'VALIDATION_ERROR', message: 'Chỉ phân công được tài khoản người hỗ trợ học viên', fields: [] } },
          { status: 400 },
        ),
      ),
    );
    render(CUM);
    const user = userEvent.setup();
    await user.click(await screen.findByRole('textbox', { name: 'Người hỗ trợ Cụm Long Xuyên' }));
    await user.click(await screen.findByRole('option', { name: 'Nguyễn Văn A' }));
    expect(await screen.findByText(/Chỉ phân công được tài khoản người hỗ trợ học viên/)).toBeInTheDocument();
  });
});

const LOP: LopHoc = {
  id: 'lop-2',
  khoa_id: 'khoa-1',
  loai_lop: 'zoom',
  ten_lop: 'Lớp Zoom 01',
  si_so_toi_da: 500,
  trang_thai: 'active',
  nhom_hoc_vien: null,
  muc_nang_luc: null,
  nguoi_ho_tro: [],
};

function renderLop(lop: LopHoc) {
  datToken('token-gia-lap');
  db.nguoiDung.vai_tro = 'quan_tri';
  return renderVoiRouter([{ path: '/', element: <ChonNguoiHoTroLop khoaId="khoa-1" lop={lop} /> }]);
}

describe('Phân công người hỗ trợ cho lớp (ADR 0008)', () => {
  it('lớp chưa có người hỗ trợ -> không cảnh báo (bình thường)', async () => {
    renderLop(LOP);
    expect(await screen.findByRole('textbox', { name: 'Người hỗ trợ lớp Lớp Zoom 01' })).toBeInTheDocument();
    expect(screen.queryByText('Chưa có người hỗ trợ')).not.toBeInTheDocument();
  });

  it('thêm người -> PUT /lop/:lopId/nguoi-ho-tro với toàn bộ danh sách id', async () => {
    const bodies: unknown[] = [];
    server.use(
      http.put('/khoa-boi-duong/:id/lop/:lopId/nguoi-ho-tro', async ({ request, params }) => {
        bodies.push({ ...((await request.json()) as object), khoaId: params.id, lopId: params.lopId });
        return HttpResponse.json({ lop_id: 'lop-2', nguoi_ho_tro: [] });
      }),
    );
    renderLop({ ...LOP, nguoi_ho_tro: [{ id: 'ht-1', ho_ten: 'Nguyễn Văn A' }] });
    const user = userEvent.setup();
    await user.click(await screen.findByRole('textbox', { name: 'Người hỗ trợ lớp Lớp Zoom 01' }));
    await user.click(await screen.findByRole('option', { name: 'Trần Thị B' }));
    await waitFor(() =>
      expect(bodies).toEqual([{ nguoi_dung_ids: ['ht-1', 'ht-2'], khoaId: 'khoa-1', lopId: 'lop-2' }]),
    );
    expect(await screen.findByText('Đã cập nhật người hỗ trợ "Lớp Zoom 01"')).toBeInTheDocument();
  });
});
