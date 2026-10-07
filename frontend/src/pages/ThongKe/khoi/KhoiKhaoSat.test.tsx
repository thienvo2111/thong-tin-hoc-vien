import { describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/mocks/server';
import { renderTrang } from '@/test/testUtils';
import { datToken } from '@/auth/tokenStore';
import { khaoSatMau } from '@/test/mocks/thongKe';
import { KhoiKhaoSat } from './KhoiKhaoSat';

describe('KhoiKhaoSat', () => {
  it("khảo sát hiện 'Chưa xếp mức: 2'", async () => {
    datToken('token-gia-lap');
    server.use(
      http.get('/thong-ke/khao-sat', () =>
        HttpResponse.json({ ...khaoSatMau, dau_vao: { ...khaoSatMau.dau_vao, chua_xep_muc: 2 } }),
      ),
    );
    renderTrang(<KhoiKhaoSat loc={{}} />);
    expect(await screen.findByText('Chưa xếp mức: 2')).toBeInTheDocument();
    expect(screen.getByText('Chưa xếp mức: 1')).toBeInTheDocument(); // đầu ra
  });

  it('khảo sát kĩ năng số: Hoàn thành x / tổng (y%) · Chưa làm z, không có mức', async () => {
    datToken('token-gia-lap');
    renderTrang(<KhoiKhaoSat loc={{}} />);
    const phan = await screen.findByTestId('ky-nang-so');
    expect(within(phan).getByText('Khảo sát kĩ năng số (không phân mức)')).toBeInTheDocument();
    expect(within(phan).getByText('Hoàn thành: 100 / 200 (50,0%) · Chưa làm: 100')).toBeInTheDocument();
    expect(phan.textContent).not.toMatch(/Chưa đạt|Cơ bản|Thành thạo|Nâng cao/);
  });

  it('tiêu đề và dòng "Chưa làm" của 2 donut đánh giá NLS', async () => {
    datToken('token-gia-lap');
    renderTrang(<KhoiKhaoSat loc={{}} />);
    const dauVao = await screen.findByTestId('donut-dau-vao');
    const dauRa = screen.getByTestId('donut-dau-ra');
    expect(screen.getByText('Đánh giá năng lực số')).toBeInTheDocument();
    expect(within(dauVao).getByText('Đánh giá NLS đầu vào')).toBeInTheDocument();
    expect(within(dauRa).getByText('Đánh giá NLS đầu ra')).toBeInTheDocument();
    expect(within(dauVao).getByText('Chưa làm: 110')).toBeInTheDocument();
    expect(within(dauRa).getByText('Chưa làm: 155')).toBeInTheDocument();
  });

  it('chú thích đủ 4 mức kèm số lượng đầu vào', async () => {
    datToken('token-gia-lap');
    renderTrang(<KhoiKhaoSat loc={{}} />);
    const dauVao = await screen.findByTestId('donut-dau-vao');
    expect(within(dauVao).getByText('M2 – Cơ bản: 30')).toBeInTheDocument();
    // Tooltip recharts cũng có tên mức (không kèm số) nên chỉ đếm dòng chú thích dạng 'nhãn: số'.
    expect(within(dauVao).getAllByText(/^M[1-4] – .+: \d+$/)).toHaveLength(4);
  });
});
