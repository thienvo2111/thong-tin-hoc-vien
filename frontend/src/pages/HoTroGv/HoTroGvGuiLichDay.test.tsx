import { beforeEach, describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay, http, HttpResponse } from 'msw';
import { notifications } from '@mantine/notifications';
import { server } from '@/test/mocks/server';
import { db } from '@/test/mocks/db';
import { renderVoiRouter } from '@/test/testUtils';
import { datToken } from '@/auth/tokenStore';
import type { DongGiangVienEmail } from '@/api/emailLichDay';
import HoTroGvGuiLichDay from './HoTroGvGuiLichDay';

// ADR 0009: trang Gửi lịch dạy — chọn khóa/giai đoạn, tích giảng viên, xem trước, gửi email.
const KHOA = [
  {
    id: 'k1',
    ma_khoa: 'AG-2026-01',
    ten_khoa: 'NLS An Giang',
    giai_doan: [
      { id: 'gd1', thu_tu: 1, ten_giai_doan: 'Giai đoạn 1', hinh_thuc: 'truc_tuyen', thoi_gian_bat_dau: '2026-10-01T00:00:00.000Z', thoi_gian_ket_thuc: '2026-10-10T00:00:00.000Z' },
      { id: 'gd2', thu_tu: 2, ten_giai_doan: 'Giai đoạn 2', hinh_thuc: 'truc_tiep', thoi_gian_bat_dau: '2026-10-24T00:00:00.000Z', thoi_gian_ket_thuc: '2026-10-30T00:00:00.000Z' },
    ],
  },
];

const dong = (id: string, ghiDe: Partial<DongGiangVienEmail> = {}): DongGiangVienEmail => ({
  id,
  ho_ten: `GV ${id}`,
  email: `${id}@hcmue.edu.vn`,
  so_buoi: 3,
  so_lop: 2,
  trang_thai_nhac: 'chua_nhac',
  email_cuoi: null,
  ...ghiDe,
});

const DS = [
  dong('A'),
  dong('B', { trang_thai_nhac: 'can_nhac_lai', email_cuoi: { gui_luc: '2026-10-17T02:15:00.000Z', trang_thai: 'that_bai', loi: 'SMTP 550' } }),
  dong('C', { trang_thai_nhac: 'da_nhac', email_cuoi: { gui_luc: '2026-10-17T02:15:00.000Z', trang_thai: 'cho_gui', loi: null } }),
  dong('D', { email: null }),
];

let soLanTaiDs: Record<string, number>;

function dungServer(ds: DongGiangVienEmail[] = DS) {
  server.use(
    http.get('/ho-tro-giang-vien/khoa', () => HttpResponse.json(KHOA)),
    http.get('/ho-tro-giang-vien/khoa/:khoaId/giai-doan/:gdId/email-lich-day', ({ params }) => {
      const gd = params.gdId as string;
      soLanTaiDs[gd] = (soLanTaiDs[gd] ?? 0) + 1;
      return HttpResponse.json({
        giai_doan: KHOA[0].giai_doan.find((g) => g.id === gd),
        giang_vien: gd === 'gd2' ? ds : [],
      });
    }),
    http.get('/ho-tro-giang-vien/khoa/:khoaId/giai-doan/:gdId/email-lich-day/:gvId/xem-truoc', ({ params }) =>
      HttpResponse.json({
        tieu_de: `[BDNLS] Lịch giảng dạy Giai đoạn 2 – khóa AG-2026-01 (${params.gvId as string})`,
        html: '<!DOCTYPE html><html><body>Kính gửi Thầy/Cô</body></html>',
        la_cap_nhat: false,
        email: 'A@hcmue.edu.vn',
      }),
    ),
  );
}

function moTrang(qs = '?khoa=k1&gd=gd2') {
  return renderVoiRouter([{ path: '/ho-tro-gv/gui-lich-day', element: <HoTroGvGuiLichDay /> }], {
    initialEntries: [`/ho-tro-gv/gui-lich-day${qs}`],
  });
}

const oChon = (ten: string) => screen.getByRole('checkbox', { name: `Chọn ${ten}` });

beforeEach(() => {
  notifications.clean();
  datToken('token-gia-lap');
  db.nguoiDung.vai_tro = 'ho_tro_giang_vien';
  soLanTaiDs = {};
});

describe('Gửi lịch dạy (ADR 0009)', () => {
  it('mặc định tích người có email và chưa nhắc / cần nhắc lại; người không email bị khóa', async () => {
    dungServer();
    moTrang();
    expect(await screen.findByText('GV A')).toBeInTheDocument();
    expect(oChon('GV A')).toBeChecked();
    expect(oChon('GV B')).toBeChecked();
    expect(oChon('GV C')).not.toBeChecked();
    expect(oChon('GV D')).toBeDisabled();
    expect(screen.getByText(/Chưa có email/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Gửi email (2)' })).toBeEnabled();
  });

  it('tích thêm / bỏ hết đổi số trên nút; 0 người thì nút tắt', async () => {
    dungServer();
    const user = userEvent.setup();
    moTrang();
    await screen.findByText('GV A');
    await user.click(oChon('GV C'));
    expect(screen.getByRole('button', { name: 'Gửi email (3)' })).toBeEnabled();
    await user.click(oChon('GV A'));
    await user.click(oChon('GV B'));
    await user.click(oChon('GV C'));
    expect(screen.getByRole('button', { name: 'Gửi email (0)' })).toBeDisabled();
  });

  it('cột email gần nhất hiện trạng thái hàng đợi', async () => {
    dungServer();
    moTrang();
    await screen.findByText('GV A');
    expect(screen.getByText('Lỗi')).toBeInTheDocument();
    expect(screen.getByText('Đang chờ gửi')).toBeInTheDocument();
  });

  it('Xem trước mở modal có iframe sandbox chứa nội dung email', async () => {
    dungServer();
    const user = userEvent.setup();
    moTrang();
    await screen.findByText('GV A');
    const hang = screen.getByText('GV A').closest('tr')!;
    await user.click(within(hang).getByRole('button', { name: 'Xem trước' }));
    const modal = await screen.findByRole('dialog');
    expect(await within(modal).findByText(/\(A\)/)).toBeInTheDocument();
    const iframe = modal.querySelector('iframe')!;
    expect(iframe).toHaveAttribute('sandbox');
    expect(iframe.getAttribute('srcdoc')).toContain('Kính gửi Thầy/Cô');
  });

  it('Gửi: xác nhận → POST đúng danh sách → thông báo có số bỏ qua → tải lại bảng', async () => {
    dungServer();
    let body: unknown;
    server.use(
      http.post('/ho-tro-giang-vien/khoa/:khoaId/giai-doan/:gdId/email-lich-day/gui', async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({
          da_xep_hang: 1,
          bo_qua: [{ giang_vien_id: 'B', ho_ten: 'GV B', ly_do: 'khong_co_email' }],
        });
      }),
    );
    const user = userEvent.setup();
    moTrang();
    await screen.findByText('GV A');
    await user.click(screen.getByRole('button', { name: 'Gửi email (2)' }));
    const modal = await screen.findByRole('dialog');
    expect(within(modal).getByText(/cho 2 giảng viên/)).toBeInTheDocument();
    await user.click(within(modal).getByRole('button', { name: 'Gửi' }));
    expect(await screen.findByText(/Đã xếp hàng 1 email/)).toBeInTheDocument();
    expect(screen.getByText(/Bỏ qua 1/)).toBeInTheDocument();
    expect(body).toEqual({ giang_vien_ids: ['A', 'B'] });
    await waitFor(() => expect(soLanTaiDs.gd2).toBe(2));
  });

  it('đang gửi thì nút xác nhận bị khóa, bấm lại không gửi thêm lô', async () => {
    dungServer();
    let soLanPost = 0;
    server.use(
      http.post('/ho-tro-giang-vien/khoa/:khoaId/giai-doan/:gdId/email-lich-day/gui', async () => {
        soLanPost++;
        await delay(200);
        return HttpResponse.json({ da_xep_hang: 2, bo_qua: [] });
      }),
    );
    const user = userEvent.setup();
    moTrang();
    await screen.findByText('GV A');
    await user.click(screen.getByRole('button', { name: 'Gửi email (2)' }));
    const modal = await screen.findByRole('dialog');
    const nut = within(modal).getByRole('button', { name: 'Gửi' });
    await user.click(nut);
    await user.click(nut).catch(() => undefined);
    expect(await screen.findByText(/Đã xếp hàng 2 email/)).toBeInTheDocument();
    expect(soLanPost).toBe(1);
  });

  it('đổi giai đoạn → tải danh sách mới; rỗng → thông báo chưa phân công', async () => {
    dungServer();
    const user = userEvent.setup();
    const { router } = moTrang();
    await screen.findByText('GV A');
    await user.selectOptions(screen.getByLabelText('Giai đoạn'), 'gd1');
    expect(await screen.findByText('Giai đoạn này chưa phân công giảng viên')).toBeInTheDocument();
    expect(soLanTaiDs.gd1).toBe(1);
    expect(router.state.location.search).toContain('gd=gd1');
  });

  it('không có tham số trên URL → tự chọn khóa đầu và giai đoạn chưa kết thúc gần nhất', async () => {
    dungServer();
    moTrang('');
    // Hôm nay (máy test) sau 10/10/2026 → giai đoạn 1 đã kết thúc, chọn giai đoạn 2.
    expect(await screen.findByText('GV A')).toBeInTheDocument();
    expect(screen.getByLabelText('Giai đoạn')).toHaveValue('gd2');
  });
});
