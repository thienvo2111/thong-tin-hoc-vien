import { describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/mocks/server';
import { ketQuaHocTruongMau } from '@/test/mocks/thongKe';
import { renderTrang } from '@/test/testUtils';
import { datToken } from '@/auth/tokenStore';
import { KhoiKetQuaHoc } from './KhoiKetQuaHoc';

const dongTruong = () => screen.findAllByLabelText(/: Đạt \d+, Không đạt \d+, Vắng \d+, Đang học \d+/);

describe('KhoiKetQuaHoc', () => {
  it('kết quả học: chú thích đủ 4 nhãn', async () => {
    datToken('token-gia-lap');
    renderTrang(<KhoiKetQuaHoc loc={{}} />);
    const chuThich = await screen.findByTestId('chu-thich-ket-qua');
    for (const nhan of ['Đạt', 'Không đạt', 'Vắng', 'Đang học']) {
      expect(within(chuThich).getByText(nhan)).toBeInTheDocument();
    }
  });

  it('không chọn khóa: không gọi ket-qua-theo-truong, vẫn hiện biểu đồ cũ', async () => {
    datToken('token-gia-lap');
    let goiTheoTruong = 0;
    server.use(
      http.get('/thong-ke/ket-qua-theo-truong', () => {
        goiTheoTruong += 1;
        return HttpResponse.json([]);
      }),
    );
    renderTrang(<KhoiKetQuaHoc loc={{}} />);
    await screen.findByTestId('chu-thich-ket-qua');
    expect(goiTheoTruong).toBe(0);
    expect(screen.queryByText(/\d+ trường/)).not.toBeInTheDocument();
  });

  describe('đã chọn khóa', () => {
    it('không gọi /thong-ke/ket-qua (chỉ gọi theo trường)', async () => {
      datToken('token-gia-lap');
      let goiKhoa = 0;
      server.use(
        http.get('/thong-ke/ket-qua', () => {
          goiKhoa += 1;
          return HttpResponse.json([]);
        }),
      );
      renderTrang(<KhoiKetQuaHoc loc={{ khoa_id: 'khoa-1' }} />);
      await dongTruong();
      expect(goiKhoa).toBe(0);
    });

    it('render đủ số trường, mặc định % Đạt tăng dần, aria-label đúng số', async () => {
      datToken('token-gia-lap');
      renderTrang(<KhoiKetQuaHoc loc={{ khoa_id: 'khoa-1' }} />);
      const dong = await dongTruong();
      expect(dong).toHaveLength(ketQuaHocTruongMau.length);
      expect(screen.getByText('6 trường')).toBeInTheDocument();
      expect(dong[0]).toHaveAttribute(
        'aria-label',
        'Trường THPT An Phú: Đạt 10, Không đạt 10, Vắng 5, Đang học 25',
      );
      // Tổng 0 xếp cuối.
      expect(dong[dong.length - 1]).toHaveAttribute('aria-label', expect.stringContaining('Trường THCS Trống'));
      expect(dong[1]).toHaveAttribute('aria-label', expect.stringContaining('Trường Tiểu học Cẩm Hà'));
    });

    it('hiện % Đạt từng trường', async () => {
      datToken('token-gia-lap');
      renderTrang(<KhoiKetQuaHoc loc={{ khoa_id: 'khoa-1' }} />);
      await dongTruong();
      expect(screen.getByText('20,0%')).toBeInTheDocument();
      expect(screen.getByText('100,0%')).toBeInTheDocument();
    });

    it('đổi sang "Tên trường" -> sắp theo tên', async () => {
      datToken('token-gia-lap');
      renderTrang(<KhoiKetQuaHoc loc={{ khoa_id: 'khoa-1' }} />);
      await dongTruong();
      await userEvent.click(screen.getByText('Tên trường'));
      await waitFor(async () => {
        const dong = await dongTruong();
        expect(dong[0]).toHaveAttribute('aria-label', expect.stringContaining('Trường Mầm non Hoa Mai'));
      });
      const ten = (await dongTruong()).map((d) => d.getAttribute('aria-label')?.split(':')[0]);
      expect(ten).toEqual([...ten].sort((a, b) => (a ?? '').localeCompare(b ?? '', 'vi')));
    });

    it('chú thích 4 màu vẫn hiện', async () => {
      datToken('token-gia-lap');
      renderTrang(<KhoiKetQuaHoc loc={{ khoa_id: 'khoa-1' }} />);
      const chuThich = await screen.findByTestId('chu-thich-ket-qua');
      expect(within(chuThich).getByText('Đang học')).toBeInTheDocument();
    });

    it('rỗng -> thông báo chưa có học viên trong khóa', async () => {
      datToken('token-gia-lap');
      server.use(http.get('/thong-ke/ket-qua-theo-truong', () => HttpResponse.json([])));
      renderTrang(<KhoiKetQuaHoc loc={{ khoa_id: 'khoa-1' }} />);
      expect(await screen.findByText('Chưa có học viên trong khóa đã chọn')).toBeInTheDocument();
    });
  });
});
