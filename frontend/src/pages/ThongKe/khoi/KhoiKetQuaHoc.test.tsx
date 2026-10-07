import { describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
import { renderTrang } from '@/test/testUtils';
import { datToken } from '@/auth/tokenStore';
import { KhoiKetQuaHoc } from './KhoiKetQuaHoc';

describe('KhoiKetQuaHoc', () => {
  it('kết quả học: chú thích đủ 4 nhãn', async () => {
    datToken('token-gia-lap');
    renderTrang(<KhoiKetQuaHoc loc={{}} />);
    const chuThich = await screen.findByTestId('chu-thich-ket-qua');
    for (const nhan of ['Đạt', 'Không đạt', 'Vắng', 'Đang học']) {
      expect(within(chuThich).getByText(nhan)).toBeInTheDocument();
    }
  });
});
