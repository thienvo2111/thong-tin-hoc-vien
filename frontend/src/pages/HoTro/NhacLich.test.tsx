import { beforeEach, describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { notifications } from '@mantine/notifications';
import { server } from '@/test/mocks/server';
import { db } from '@/test/mocks/db';
import { renderTrang, renderVoiRouter } from '@/test/testUtils';
import { datToken } from '@/auth/tokenStore';
import type { KhoaHocDangKy } from '@/api/types';
import HoTroGvHoSoLop from '@/pages/HoTroGv/HoTroGvHoSoLop';
import HoTroGvViecCanLam from '@/pages/HoTroGv/HoTroGvViecCanLam';
import { TheBuoiSapToi } from '@/pages/M3/TheBuoiSapToi';
import HoTroLayout from './HoTroLayout';
import HoTroLichHoc from './HoTroLichHoc';

// ADR 0004 L8 (issue #21): tin nhắn nhắc lịch (Sao chép + Đã gửi), cờ cần nhắc lại, Buổi học sắp tới.
beforeEach(() => notifications.clean());

describe('Nhắc giảng viên (hỗ trợ GV)', () => {
  it('tab Giảng viên: cờ nhắc + tin nhắn soạn sẵn; "Đã gửi" ghi đúng giảng viên và buổi', async () => {
    datToken('token-gia-lap');
    db.nguoiDung.vai_tro = 'ho_tro_giang_vien';
    db.trangLopGv.buoi[0].giang_vien[0].nhac = 'can_nhac_lai';
    let body: unknown;
    server.use(
      http.get('/ho-tro-giang-vien/lop/:lopId/giai-doan/:gdId/tin-nhan-nhac/:gvId', () =>
        HttpResponse.json({
          giang_vien: { id: 'gv-1', ho_ten: 'Nguyễn Văn Long', so_dien_thoai: '0909123456', email: null },
          lich_hoc_ids: ['lh-1'],
          noi_dung: 'Kính gửi Thầy/Cô Nguyễn Văn Long,\n• Buổi 1',
          trang_thai_nhac: 'can_nhac_lai',
          lan_gui_cuoi: { gui_luc: '2026-10-01T01:00:00.000Z', nguoi_gui: 'Phạm Văn Giảng' },
        }),
      ),
      http.post('/ho-tro-giang-vien/nhac-lich', async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ id: 'nk-1' }, { status: 201 });
      }),
    );
    const user = userEvent.setup();
    renderVoiRouter([{ path: '/ho-tro-gv/lop/:lopId/giai-doan/:gdId', element: <HoTroGvHoSoLop /> }], {
      initialEntries: ['/ho-tro-gv/lop/lop-1/giai-doan/gd-2'],
    });
    await user.click(await screen.findByRole('tab', { name: 'Giảng viên' }));
    const panel = await screen.findByRole('tabpanel', { name: 'Giảng viên' });
    expect(within(panel).getByText('Cần nhắc lại')).toBeInTheDocument();
    await user.click(within(panel).getByRole('button', { name: 'Tin nhắn nhắc' }));
    const modal = await screen.findByRole('dialog');
    expect(await within(modal).findByDisplayValue(/Kính gửi Thầy\/Cô Nguyễn Văn Long/)).toBeInTheDocument();
    expect(within(modal).getByText(/Lần gửi cuối .* Phạm Văn Giảng/)).toBeInTheDocument();
    await user.click(within(modal).getByRole('button', { name: 'Đã gửi' }));
    expect(await screen.findByText('Đã ghi nhận nhắc Nguyễn Văn Long')).toBeInTheDocument();
    expect(body).toEqual({
      giang_vien_id: 'gv-1',
      lich_hoc_ids: ['lh-1'],
      noi_dung: 'Kính gửi Thầy/Cô Nguyễn Văn Long,\n• Buổi 1',
    });
  });

  it('Việc cần làm liệt kê giảng viên chưa nhắc / cần nhắc lại', async () => {
    datToken('token-gia-lap');
    db.nguoiDung.vai_tro = 'ho_tro_giang_vien';
    server.use(
      http.get('/ho-tro-giang-vien/viec-can-lam', () =>
        HttpResponse.json([
          {
            lop: db.danhGiaDot.lop,
            giai_doan: db.danhGiaDot.giai_doan,
            buoi_dau: db.danhGiaDot.buoi_dau,
            mau: 'vang',
            so_qua_han: 0,
            so_chua_dat: 1,
            muc_chua_dat: [],
            nhac_gv: [{ id: 'gv-1', ho_ten: 'Nguyễn Văn Long', trang_thai: 'can_nhac_lai' }],
          },
        ]),
      ),
    );
    renderVoiRouter([{ path: '/ho-tro-gv', element: <HoTroGvViecCanLam /> }], { initialEntries: ['/ho-tro-gv'] });
    expect(await screen.findByText(/Nhắc lịch giảng viên: Nguyễn Văn Long \(cần nhắc lại\)/)).toBeInTheDocument();
  });
});

describe('Nhắc cụm (hỗ trợ HV)', () => {
  it('Lịch học: cờ nhắc theo cụm + menu đếm buổi cần nhắc; tin nhắn ngày → "Đã gửi" ghi đúng cụm', async () => {
    datToken('token-gia-lap');
    db.nguoiDung.vai_tro = 'ho_tro_hoc_vien';
    db.hoTroLichHoc[0].nhac_cum = [{ cum_id: 'cum-1', trang_thai: 'chua_nhac' }];
    let body: unknown;
    let ngayGoi = '';
    server.use(
      http.get('/ho-tro-hoc-vien/nhac-lich/dem', () => HttpResponse.json({ can_nhac: 2 })),
      http.get('/ho-tro-hoc-vien/cum/:cumId/tin-nhan-nhac', ({ request }) => {
        ngayGoi = new URL(request.url).searchParams.get('ngay') ?? '';
        return HttpResponse.json({
          cum: { id: 'cum-1', ten_cum: 'Cụm Long Xuyên' },
          ngay: ngayGoi,
          buoi: [],
          lich_hoc_ids: ['buoi-1'],
          noi_dung: 'Kính gửi Thầy/Cô trong nhóm Cụm Long Xuyên',
          trang_thai_nhac: 'chua_nhac',
        });
      }),
      http.post('/ho-tro-hoc-vien/nhac-lich', async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ id: 'nk-2' }, { status: 201 });
      }),
    );
    const user = userEvent.setup();
    renderVoiRouter([{ element: <HoTroLayout />, children: [{ path: '/ho-tro/lich-hoc', element: <HoTroLichHoc /> }] }], {
      initialEntries: ['/ho-tro/lich-hoc'],
    });
    expect(await screen.findByText('Cụm Long Xuyên: Chưa nhắc')).toBeInTheDocument();
    expect(await screen.findByLabelText('2 buổi cần nhắc')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Tin nhắn nhắc cụm' }));
    const modal = await screen.findByRole('dialog');
    expect(await within(modal).findByDisplayValue(/nhóm Cụm Long Xuyên/)).toBeInTheDocument();
    expect(ngayGoi).toBe('2026-10-10');
    await user.click(within(modal).getByRole('button', { name: 'Đã gửi' }));
    expect(await screen.findByText('Đã ghi nhận nhắc Cụm Long Xuyên')).toBeInTheDocument();
    expect(body).toEqual({
      cum_id: 'cum-1',
      lich_hoc_ids: ['buoi-1'],
      noi_dung: 'Kính gửi Thầy/Cô trong nhóm Cụm Long Xuyên',
    });
  });
});

describe('Cổng học viên — Buổi học sắp tới', () => {
  const iso = (gio: number) => new Date(Date.now() + gio * 3600 * 1000).toISOString();
  const buoi = (id: string, so: number, gio: number) => ({
    id,
    giai_doan_id: 'gd-2',
    buoi_so: so,
    thoi_gian_bat_dau: iso(gio),
    thoi_gian_ket_thuc: iso(gio + 3),
    dia_diem_hoac_link: null,
    trang_thai: 'chua_dien_ra',
    trang_thai_diem_danh: null,
    phong: 'A1',
    diem_hoc: { id: 'dh', ma_diem_hoc: 'D', ten: 'THPT Long Xuyên', dia_chi: '1 Trần Hưng Đạo', nguoi_lien_he: null, sdt_lien_he: null },
  });
  const khoaHoc = [
    {
      id: 'dk',
      giai_doan: [
        {
          id: 'gd-2',
          thuc_dia: [{ ho_ten: 'Lê Văn Đạt', so_dien_thoai: '0911222333', nhiem_vu: null }],
          lop: { id: 'lop-1', ten_lop: 'Lớp 01', lich_hoc: [buoi('qua', 1, -30), buoi('toi', 2, 48), buoi('xa', 3, 24 * 9)] },
        },
      ],
    },
  ] as unknown as KhoaHocDangKy[];

  it('chỉ buổi chưa kết thúc trong 7 ngày tới: giờ, điểm học, phòng, thực địa', () => {
    renderTrang(<TheBuoiSapToi khoaHoc={khoaHoc} />);
    expect(screen.getByText('Buổi học sắp tới')).toBeInTheDocument();
    expect(screen.getByText('Lớp 01 · Buổi 2')).toBeInTheDocument();
    expect(screen.queryByText('Lớp 01 · Buổi 1')).not.toBeInTheDocument();
    expect(screen.queryByText('Lớp 01 · Buổi 3')).not.toBeInTheDocument();
    expect(screen.getByText(/THPT Long Xuyên · phòng A1/)).toBeInTheDocument();
    expect(screen.getByText(/Lê Văn Đạt — 0911222333/)).toBeInTheDocument();
  });

  it('không có buổi trong 7 ngày → không hiện thẻ', () => {
    renderTrang(<TheBuoiSapToi khoaHoc={[]} />);
    expect(screen.queryByText('Buổi học sắp tới')).not.toBeInTheDocument();
  });
});
