import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/mocks/server';
import { renderTrang } from '@/test/testUtils';
import { datToken } from '@/auth/tokenStore';
import { chuyenMucMau } from '@/test/mocks/thongKe';
import { KhoiChuyenMuc } from './KhoiChuyenMuc';

describe('KhoiChuyenMuc', () => {
  it('chuyển mức: ô M2→M3 có aria-label đúng số', async () => {
    datToken('token-gia-lap');
    server.use(
      http.get('/thong-ke/chuyen-muc', () =>
        HttpResponse.json({
          ...chuyenMucMau,
          o: chuyenMucMau.o.map((o) => (o.tu === 'M2' && o.den === 'M3' ? { ...o, so_luong: 7 } : o)),
        }),
      ),
    );
    renderTrang(<KhoiChuyenMuc loc={{}} />);
    expect(await screen.findByLabelText('Từ M2 sang M3: 7 học viên')).toBeInTheDocument();
    expect(screen.getAllByLabelText(/^Từ M\d sang M\d: /)).toHaveLength(16);
  });

  it('dòng tóm tắt tăng/giữ/giảm', async () => {
    datToken('token-gia-lap');
    renderTrang(<KhoiChuyenMuc loc={{}} />);
    // 6/32, 20/32, 6/32
    expect(await screen.findByText('18,8% tăng mức · 62,5% giữ nguyên · 18,8% giảm')).toBeInTheDocument();
  });

  it('chuyển mức tong 0 → câu rỗng', async () => {
    datToken('token-gia-lap');
    server.use(
      http.get('/thong-ke/chuyen-muc', () =>
        HttpResponse.json({
          ...chuyenMucMau,
          o: chuyenMucMau.o.map((o) => ({ ...o, so_luong: 0 })),
          tong: 0,
          tang: 0,
          giu: 0,
          giam: 0,
        }),
      ),
    );
    renderTrang(<KhoiChuyenMuc loc={{}} />);
    expect(await screen.findByText('Chưa có học viên đủ kết quả đầu vào và đầu ra')).toBeInTheDocument();
    expect(screen.queryByLabelText(/^Từ M/)).not.toBeInTheDocument();
  });
});
