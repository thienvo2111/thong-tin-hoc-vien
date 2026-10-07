import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/mocks/server';
import { renderTrang } from '@/test/testUtils';
import { datToken } from '@/auth/tokenStore';
import { chuyenCanMau } from '@/test/mocks/thongKe';
import { KhoiChuyenCan } from './KhoiChuyenCan';

function renderKhoi() {
  datToken('token-gia-lap');
  return renderTrang(<KhoiChuyenCan loc={{}} />);
}

describe('KhoiChuyenCan', () => {
  it("chuyên cần không khóa → 'Chọn một khóa để xem'", async () => {
    server.use(http.get('/thong-ke/chuyen-can', () => HttpResponse.json({ ...chuyenCanMau, truc_tiep: null })));
    renderKhoi();
    expect(await screen.findByText('Chọn một khóa để xem')).toBeInTheDocument();
  });

  it("điểm danh rỗng → 'Chưa có dữ liệu điểm danh'", async () => {
    server.use(http.get('/thong-ke/chuyen-can', () => HttpResponse.json({ ...chuyenCanMau, truc_tiep: [] })));
    renderKhoi();
    expect(await screen.findByText('Chưa có dữ liệu điểm danh')).toBeInTheDocument();
  });

  it('có điểm danh → chú thích đủ 4 nhãn', async () => {
    renderKhoi();
    const chuThich = await screen.findByTestId('chu-thich-chuyen-can');
    for (const nhan of ['Có mặt', 'Vắng có phép', 'Vắng', 'Tỷ lệ có mặt']) {
      expect(chuThich).toHaveTextContent(nhan);
    }
  });

  it("VLE rỗng → 'Chưa có dữ liệu tiến trình VLE'", async () => {
    server.use(
      http.get('/thong-ke/chuyen-can', () =>
        HttpResponse.json({
          ...chuyenCanMau,
          vle: { khoang: chuyenCanMau.vle.khoang.map((k) => ({ ...k, so_luong: 0 })), chua_co_du_lieu: 0 },
        }),
      ),
    );
    renderKhoi();
    await userEvent.click(await screen.findByRole('tab', { name: 'VLE' }));
    expect(await screen.findByText('Chưa có dữ liệu tiến trình VLE')).toBeInTheDocument();
  });

  it("VLE có dữ liệu → hiện 'Chưa có dữ liệu: 5'", async () => {
    renderKhoi();
    await userEvent.click(await screen.findByRole('tab', { name: 'VLE' }));
    expect(await screen.findByText('Chưa có dữ liệu: 5')).toBeInTheDocument();
  });
});
