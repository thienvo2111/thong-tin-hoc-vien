import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import type { LichTrung } from '@/api/doiBuoi';
import { CanhBaoTrungLich } from './CanhBaoTrungLich';

const ve = (ui: React.ReactElement) => render(<MantineProvider>{ui}</MantineProvider>);

// 2026-11-14 là Thứ Bảy; giờ UTC 01:00 = 08:00 giờ Việt Nam.
function buoi(id: string, so: number, lop: string, ngay = '2026-11-14'): LichTrung {
  return {
    id,
    buoi_so: so,
    thoi_gian_bat_dau: `${ngay}T01:00:00.000Z`,
    thoi_gian_ket_thuc: `${ngay}T05:00:00.000Z`,
    lop: { ten_lop: lop },
  };
}

describe('CanhBaoTrungLich', () => {
  it('không trùng (rỗng hoặc thiếu) → không hiện gì', () => {
    ve(<CanhBaoTrungLich ds={[]} />);
    expect(screen.queryByTestId('canh-bao-trung-lich')).toBeNull();
    ve(<CanhBaoTrungLich />);
    expect(screen.queryByText(/Trùng giờ/)).toBeNull();
  });

  it('1 buổi: Trùng giờ với Buổi n · lớp · Thứ, ngày giờ–giờ', () => {
    ve(<CanhBaoTrungLich ds={[buoi('a', 3, 'Lớp 01')]} />);
    expect(screen.getByTestId('canh-bao-trung-lich')).toHaveTextContent(
      'Trùng giờ với Buổi 3 · Lớp 01 · Thứ bảy, 14/11/2026 08:00–12:00',
    );
  });

  it('nhiều buổi: liệt kê tối đa 2 rồi "+k buổi khác"', () => {
    ve(
      <CanhBaoTrungLich
        ds={[buoi('a', 1, 'Lớp A'), buoi('b', 2, 'Lớp B'), buoi('c', 3, 'Lớp C'), buoi('d', 4, 'Lớp D')]}
      />,
    );
    const el = screen.getByTestId('canh-bao-trung-lich');
    expect(el).toHaveTextContent('Buổi 1 · Lớp A');
    expect(el).toHaveTextContent('Buổi 2 · Lớp B');
    expect(el).not.toHaveTextContent('Lớp C');
    expect(el).toHaveTextContent('+2 buổi khác');
  });
});
