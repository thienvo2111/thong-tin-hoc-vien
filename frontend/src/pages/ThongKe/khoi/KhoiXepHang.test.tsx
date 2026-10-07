import { describe, expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/mocks/server';
import { renderTrang } from '@/test/testUtils';
import { datToken } from '@/auth/tokenStore';
import { KhoiXepHang } from './KhoiXepHang';

function renderKhoi() {
  datToken('token-gia-lap');
  return renderTrang(<KhoiXepHang loc={{}} />);
}

describe('KhoiXepHang', () => {
  it('kieu bang → hiện Top và Bottom', async () => {
    renderKhoi();
    expect(await screen.findByText('Cao nhất')).toBeInTheDocument();
    expect(screen.getByText('Thấp nhất')).toBeInTheDocument();
  });

  it("vi_tri → 'Thứ 3/12' + giá trị trường + trung bình", async () => {
    server.use(
      http.get('/thong-ke/xep-hang', () =>
        HttpResponse.json({ kieu: 'vi_tri', thu_hang: 3, tong_so: 12, gia_tri: 0.8, trung_binh: 0.65 }),
      ),
    );
    renderKhoi();
    expect(await screen.findByText(/Thứ 3\/12/)).toBeInTheDocument();
    expect(screen.getByText(/Trường bạn 80,0%/)).toBeInTheDocument();
    expect(screen.getByText(/Trung bình 65,0%/)).toBeInTheDocument();
  });

  it('thu_hang null → câu chưa đủ 5 học viên', async () => {
    server.use(
      http.get('/thong-ke/xep-hang', () =>
        HttpResponse.json({ kieu: 'vi_tri', thu_hang: null, tong_so: 12, gia_tri: null, trung_binh: 0.65 }),
      ),
    );
    renderKhoi();
    expect(await screen.findByText('Chưa đủ 5 học viên để xếp hạng')).toBeInTheDocument();
  });

  it('đổi chỉ số → gọi API với chi_so mới', async () => {
    const chiSo: (string | null)[] = [];
    server.use(
      http.get('/thong-ke/xep-hang', ({ request }) => {
        chiSo.push(new URL(request.url).searchParams.get('chi_so'));
        return HttpResponse.json({ kieu: 'bang', top: [], bottom: [], tong_so: 0 });
      }),
    );
    renderKhoi();
    await waitFor(() => expect(chiSo).toEqual(['truy_cap']));
    await userEvent.click(await screen.findByText('Khảo sát'));
    await waitFor(() => expect(chiSo).toEqual(['truy_cap', 'khao_sat']));
    await userEvent.click(screen.getByText('Đạt'));
    await waitFor(() => expect(chiSo).toEqual(['truy_cap', 'khao_sat', 'dat']));
  });
});
