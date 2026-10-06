import { describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderVoiRouter } from '@/test/testUtils';
import { datToken } from '@/auth/tokenStore';
import { db } from '@/test/mocks/db';
import HoTroGvLop from './HoTroGvLop';
import HoTroGvDotLop from './HoTroGvDotLop';
import HoTroGvHoSoLop from './HoTroGvHoSoLop';
import HoTroGvLichDay from './HoTroGvLichDay';

// ADR 0004 L2 (issue #15): lớp → đợt → Hồ sơ chuẩn bị lớp (bản đọc) + lịch dạy.
function render(initialEntries: string[]) {
  datToken('token-gia-lap');
  db.nguoiDung.vai_tro = 'ho_tro_giang_vien';
  return renderVoiRouter(
    [
      { path: '/ho-tro-gv/lop', element: <HoTroGvLop /> },
      { path: '/ho-tro-gv/lop/:lopId', element: <HoTroGvDotLop /> },
      { path: '/ho-tro-gv/lop/:lopId/giai-doan/:gdId', element: <HoTroGvHoSoLop /> },
      { path: '/ho-tro-gv/lich-day', element: <HoTroGvLichDay /> },
    ],
    { initialEntries },
  );
}

describe('Khu hỗ trợ giảng viên — trang lớp (L2)', () => {
  it('lớp → danh sách đợt trực tiếp → Hồ sơ chuẩn bị lớp', async () => {
    const user = userEvent.setup();
    render(['/ho-tro-gv/lop']);
    await user.click(await screen.findByRole('link', { name: 'Lớp 01 – Nhóm cơ bản A' }));
    await user.click(await screen.findByRole('link', { name: /GĐ 2 — Học trực tiếp/ }));
    expect(await screen.findByText(/Lớp 01 – Nhóm cơ bản A · GĐ 2/)).toBeInTheDocument();
    expect(screen.getByText('Phạm Văn Giảng · pham.g@hcmue.edu.vn')).toBeInTheDocument();
  });

  it('tab Lịch & điểm học: điểm học + liên hệ + phòng', async () => {
    const user = userEvent.setup();
    render(['/ho-tro-gv/lop/lop-1/giai-doan/gd-2']);
    await user.click(await screen.findByRole('tab', { name: 'Lịch & điểm học' }));
    const panel = await screen.findByRole('tabpanel', { name: 'Lịch & điểm học' });
    expect(within(panel).getByText('THPT Long Xuyên')).toBeInTheDocument();
    expect(within(panel).getByText(/Cô Lan \(0901000001\)/)).toBeInTheDocument();
    expect(within(panel).getByText('P.101')).toBeInTheDocument();
  });

  it('tab Giảng viên: tên + SĐT gọi được; tab Học viên: SĐT, cụm + người hỗ trợ học viên', async () => {
    const user = userEvent.setup();
    render(['/ho-tro-gv/lop/lop-1/giai-doan/gd-2']);
    await user.click(await screen.findByRole('tab', { name: 'Giảng viên' }));
    expect(await screen.findByRole('link', { name: '0909123456' })).toHaveAttribute('href', 'tel:0909123456');
    await user.click(screen.getByRole('tab', { name: /Học viên/ }));
    const bang = await screen.findByRole('table');
    expect(within(bang).getByText('Trần Thị Học')).toBeInTheDocument();
    expect(within(bang).getByText('0912000001')).toBeInTheDocument();
    expect(within(bang).getByText('Nguyễn Văn A')).toBeInTheDocument();
  });

  it('lịch dạy: buổi kèm điểm học, nhắc chưa phân công giảng viên, link Hồ sơ chuẩn bị', async () => {
    render(['/ho-tro-gv/lich-day']);
    expect(await screen.findByText(/THPT Long Xuyên — phòng P.101/)).toBeInTheDocument();
    expect(screen.getByText('Chưa phân công giảng viên')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Hồ sơ chuẩn bị' })).toHaveAttribute('href', '/ho-tro-gv/lop/lop-1/giai-doan/gd-2');
  });
});
