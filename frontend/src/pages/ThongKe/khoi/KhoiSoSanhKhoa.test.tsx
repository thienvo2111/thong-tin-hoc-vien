import { describe, expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/mocks/server';
import { renderTrang } from '@/test/testUtils';
import { datToken } from '@/auth/tokenStore';
import { KhoiSoSanhKhoa } from './KhoiSoSanhKhoa';

describe('KhoiSoSanhKhoa', () => {
  it('hiện khối khi chưa chọn khóa', async () => {
    datToken('token-gia-lap');
    renderTrang(<KhoiSoSanhKhoa loc={{}} />);
    expect(await screen.findByRole('region', { name: 'So sánh giữa các khóa' })).toBeInTheDocument();
    expect(await screen.findByText('% truy cập')).toBeInTheDocument();
  });

  it('so sánh khóa ẩn khi có khoa_id trên URL (và không gọi API)', async () => {
    datToken('token-gia-lap');
    let daGoi = false;
    server.use(
      http.get('/thong-ke/so-sanh-khoa', () => {
        daGoi = true;
        return HttpResponse.json([]);
      }),
    );
    renderTrang(<KhoiSoSanhKhoa loc={{ khoa_id: 'khoa-1' }} />);
    await waitFor(() => expect(screen.queryByRole('region')).not.toBeInTheDocument());
    expect(daGoi).toBe(false);
  });
});
