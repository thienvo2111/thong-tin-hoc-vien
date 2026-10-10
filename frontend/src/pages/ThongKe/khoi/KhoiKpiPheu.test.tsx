import { describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/mocks/server';
import { renderTrang } from '@/test/testUtils';
import { datToken } from '@/auth/tokenStore';
import { pheuMau } from '@/test/mocks/thongKe';
import { KhoiKpiPheu } from './KhoiKpiPheu';

function renderKhoi() {
  datToken('token-gia-lap');
  return renderTrang(<KhoiKpiPheu loc={{}} />);
}

describe('KhoiKpiPheu', () => {
  it('hiện đủ thẻ KPI đúng số fixture', async () => {
    renderKhoi();
    expect(await within(await screen.findByTestId('kpi-tham-gia')).findByText('200')).toBeInTheDocument();
    expect(within(screen.getByTestId('kpi-da-truy-cap')).getByText('150')).toBeInTheDocument();
    expect(within(screen.getByTestId('kpi-ky-nang-so')).getByText('100')).toBeInTheDocument();
    expect(within(screen.getByTestId('kpi-dau-vao')).getByText('90')).toBeInTheDocument();
    expect(within(screen.getByTestId('kpi-dau-ra')).getByText('45')).toBeInTheDocument();
  });

  it('% mỗi thẻ tính trên số tham gia (3 chỉ số khảo sát trên tham_gia_khao_sat, trừ nhân viên)', async () => {
    renderKhoi();
    await screen.findByTestId('kpi-da-truy-cap');
    expect(within(screen.getByTestId('kpi-da-truy-cap')).getByText('75,0% số tham gia')).toBeInTheDocument(); // 150/200
    expect(within(screen.getByTestId('kpi-ky-nang-so')).getByText('52,6% số tham gia')).toBeInTheDocument(); // 100/190
    expect(within(screen.getByTestId('kpi-dau-vao')).getByText('47,4% số tham gia')).toBeInTheDocument(); // 90/190
    expect(within(screen.getByTestId('kpi-dau-ra')).getByText('23,7% số tham gia')).toBeInTheDocument(); // 45/190
    expect(within(screen.getByTestId('kpi-tham-gia')).queryByText(/số tham gia/)).not.toBeInTheDocument();
    expect(document.body.textContent).not.toContain('so với thẻ trước');
  });
  it("tham_gia 0 → '—' (không NaN)", async () => {
    server.use(
      http.get('/thong-ke/pheu', () =>
        HttpResponse.json({
          ...pheuMau,
          tham_gia: 0,
          da_truy_cap: 0,
          khao_sat_ky_nang_so: 0,
          danh_gia_dau_vao: 0,
          danh_gia_dau_ra: 0,
        }),
      ),
    );
    renderKhoi();
    await screen.findByTestId('kpi-da-truy-cap');
    expect(within(screen.getByTestId('kpi-da-truy-cap')).getByText('— số tham gia')).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('NaN');
  });

  it('nhãn thẻ và bước phễu dùng thuật ngữ KS kĩ năng số / đánh giá NLS', async () => {
    renderKhoi();
    expect(await within(await screen.findByTestId('kpi-ky-nang-so')).findByText('Đã làm KS kĩ năng số')).toBeInTheDocument();
    expect(within(screen.getByTestId('kpi-dau-vao')).getByText('Đã làm đánh giá NLS đầu vào')).toBeInTheDocument();
    expect(within(screen.getByTestId('kpi-dau-ra')).getByText('Đã làm đánh giá NLS đầu ra')).toBeInTheDocument();
    expect(within(screen.getByTestId('pheu-ks-ky-nang-so')).getByText('KS kĩ năng số')).toBeInTheDocument();
    expect(within(screen.getByTestId('pheu-dau-vao')).getByText('Đánh giá NLS đầu vào')).toBeInTheDocument();
    expect(within(screen.getByTestId('pheu-dau-ra')).getByText('Đánh giá NLS đầu ra')).toBeInTheDocument();
  });

  it('hiện thẻ hồ sơ chờ duyệt khi có quyền, ẩn khi null', async () => {
    renderKhoi();
    expect(await screen.findByTestId('kpi-cho-duyet')).toBeInTheDocument();
  });

  it('thẻ chờ duyệt là link tới danh sách hồ sơ chờ duyệt', async () => {
    renderKhoi();
    const the = await screen.findByTestId('kpi-cho-duyet');
    expect(the).toHaveAttribute('href', '/admin/hoc-vien?trang_thai=cho_duyet');
    expect(the).toHaveAccessibleName(/Hồ sơ chờ duyệt.*Xem danh sách/);
  });

  it('ho_so_cho_duyet null → không có thẻ chờ duyệt', async () => {
    server.use(http.get('/thong-ke/pheu', () => HttpResponse.json({ ...pheuMau, ho_so_cho_duyet: null })));
    renderKhoi();
    await screen.findByTestId('kpi-tham-gia');
    expect(screen.queryByTestId('kpi-cho-duyet')).not.toBeInTheDocument();
  });

  it('luôn hiện chú thích "Không tính nhân viên"; chọn doi_tuong=nhan_vien -> thêm ghi chú riêng', async () => {
    datToken('token-gia-lap');
    renderTrang(<KhoiKpiPheu loc={{ doi_tuong: 'nhan_vien' }} />);
    await screen.findByTestId('kpi-tham-gia');
    expect(
      screen.getByText('Không tính nhân viên (không thực hiện khảo sát – đánh giá) ở 3 chỉ số khảo sát/đánh giá.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Nhân viên hiện không thực hiện khảo sát – đánh giá.')).toBeInTheDocument();
  });

  it('phễu liệt kê 5 bước kèm % trên số tham gia, không có chữ rơi', async () => {
    renderKhoi();
    const buoc = await screen.findByTestId('pheu-ks-ky-nang-so');
    expect(within(buoc).getByText('100')).toBeInTheDocument();
    expect(within(buoc).getByText('52,6% số tham gia')).toBeInTheDocument(); // 100/190 (trừ nhân viên)
    expect(within(screen.getByTestId('pheu-tham-gia')).queryByText(/số tham gia/)).not.toBeInTheDocument();
    expect(screen.getAllByTestId(/^pheu-/)).toHaveLength(5);
    expect(document.body.textContent).not.toMatch(/rơi/);
  });
});
