import { beforeEach, describe, expect, it } from 'vitest';
import { notifications } from '@mantine/notifications';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/mocks/server';
import { db } from '@/test/mocks/db';
import { renderVoiRouter } from '@/test/testUtils';
import { datToken } from '@/auth/tokenStore';
import type { BaoVangHocVien, DeNghiDoiLopGv, DeNghiDoiLopHocVien } from '@/api/doiLop';
import type { KhoaHocDangKy } from '@/api/types';
import HoTroHocVienChiTiet from '@/pages/HoTro/HoTroHocVienChiTiet';
import HoTroGvDeNghiDoiLop from './HoTroGvDeNghiDoiLop';
import HoTroGvHoSoLop from './HoTroGvHoSoLop';

// ADR 0004 L5 (issue #18): báo vắng + đề nghị đổi lớp.
// Mantine giữ thông báo giữa các test (giới hạn 5, phần dư vào hàng đợi) — dọn trước mỗi test.
beforeEach(() => notifications.clean());
const NGAY = 24 * 3600 * 1000;
const iso = (offset: number) => new Date(Date.now() + offset).toISOString();

function hocTapMau(): KhoaHocDangKy[] {
  const buoi = (id: string, so: number, offset: number) => ({
    id,
    buoi_so: so,
    thoi_gian_bat_dau: iso(offset),
    thoi_gian_ket_thuc: iso(offset + 3 * 3600 * 1000),
    dia_diem_hoac_link: 'Trường A',
  });
  return [
    {
      id: 'dk-1',
      hoc_vien_id: 'hv-ht-1',
      khoa_id: 'khoa-1',
      ngay_dang_ky: '2026-09-01',
      trang_thai: 'da_duyet',
      ket_qua: null,
      ngay_hoan_thanh: null,
      muc_dau_vao: null,
      muc_dau_ra: null,
      cum_id: null,
      khoa: {
        id: 'khoa-1',
        ma_khoa: 'AG-1',
        ten_khoa: 'Khóa An Giang',
        dia_diem: null,
        thoi_gian_bat_dau: '2026-01-01',
        thoi_gian_ket_thuc: '2027-01-01',
        trang_thai: 'da_duyet',
      },
      cum: null,
      giai_doan: [
        {
          id: 'gd-2',
          thu_tu: 2,
          ten_giai_doan: 'Học trực tiếp',
          hinh_thuc: 'truc_tiep',
          thoi_gian_bat_dau: '2026-01-01',
          thoi_gian_ket_thuc: '2027-01-01',
          link_hoac_dia_diem: null,
          huong_dan: null,
          tien_do: null,
          lop: {
            id: 'lop-a',
            ten_lop: 'Lớp A',
            loai_lop: 'truc_tiep',
            si_so_toi_da: null,
            nhom_hoc_vien: null,
            muc_nang_luc: null,
            nhan_su: [],
            lich_hoc: [buoi('b-qua', 1, -2 * NGAY), buoi('b-toi', 2, 5 * NGAY)],
          },
        },
      ],
    },
  ] as unknown as KhoaHocDangKy[];
}

function renderHv() {
  datToken('token-gia-lap');
  db.nguoiDung.vai_tro = 'ho_tro_hoc_vien';
  db.hoTroChiTiet.hoc_tap = hocTapMau();
  const baoVang: BaoVangHocVien[] = [];
  const deNghi: DeNghiDoiLopHocVien[] = [];
  server.use(
    http.get('/ho-tro-hoc-vien/hoc-vien/:id', () =>
      HttpResponse.json({ ...db.hoTroChiTiet, bao_vang: baoVang, de_nghi_doi_lop: deNghi }),
    ),
    http.post('/ho-tro-hoc-vien/hoc-vien/:id/bao-vang', async ({ request }) => {
      const b = (await request.json()) as { lich_hoc_id: string; ly_do: string };
      baoVang.push({ ...b, ghi_luc: iso(0), nguoi_ghi: 'Tôi' });
      return HttpResponse.json({}, { status: 201 });
    }),
    http.get('/ho-tro-hoc-vien/hoc-vien/:id/lop-co-the-doi', () =>
      HttpResponse.json({
        lop_hien_tai_id: 'lop-a',
        lop: [
          { id: 'lop-a', ten_lop: 'Lớp A', loai_lop: 'truc_tiep', si_so_toi_da: null, si_so: 30 },
          { id: 'lop-b', ten_lop: 'Lớp B', loai_lop: 'truc_tiep', si_so_toi_da: 30, si_so: 29 },
        ],
      }),
    ),
    http.post('/ho-tro-hoc-vien/hoc-vien/:id/de-nghi-doi-lop', async ({ request }) => {
      const b = (await request.json()) as { giai_doan_id: string; lop_de_nghi_id: string; ly_do: string };
      deNghi.push({
        id: 'dn-1',
        giai_doan_id: b.giai_doan_id,
        ly_do: b.ly_do,
        trang_thai: 'cho_duyet',
        tao_luc: iso(0),
        xu_ly_luc: null,
        ghi_chu_xu_ly: null,
        nguoi_tao: 'nd-1',
        lop_hien_tai: { id: 'lop-a', ten_lop: 'Lớp A' },
        lop_de_nghi: { id: b.lop_de_nghi_id, ten_lop: 'Lớp B' },
        nguoi_tao_ten: 'Tôi',
        nguoi_xu_ly: null,
      });
      return HttpResponse.json({}, { status: 201 });
    }),
  );
  return renderVoiRouter([{ path: '/ho-tro/hoc-vien/:id', element: <HoTroHocVienChiTiet /> }], {
    initialEntries: ['/ho-tro/hoc-vien/hv-ht-1'],
  });
}

describe('Người hỗ trợ học viên — báo vắng, đề nghị đổi lớp', () => {
  it('chỉ buổi chưa kết thúc có nút Báo vắng; ghi lý do → hiện "Báo vắng: …"', async () => {
    renderHv();
    const user = userEvent.setup();
    const nut = await screen.findAllByRole('button', { name: 'Báo vắng' });
    expect(nut).toHaveLength(1);
    await user.click(nut[0]);
    const modal = await screen.findByRole('dialog');
    const ghi = within(modal).getByRole('button', { name: 'Ghi báo vắng' });
    expect(ghi).toBeDisabled();
    await user.type(within(modal).getByRole('textbox', { name: /Lý do/ }), 'Ốm');
    await user.click(ghi);
    expect(await screen.findByText('Báo vắng: Ốm')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Hủy' })).toBeInTheDocument();
  });

  it('đề nghị đổi lớp: danh sách bỏ lớp hiện tại, hiện sĩ số; gửi → "Chờ duyệt" + nút Hủy đề nghị', async () => {
    renderHv();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Đề nghị đổi lớp' }));
    const modal = await screen.findByRole('dialog');
    await user.click(within(modal).getByRole('textbox', { name: /Lớp đề nghị/ }));
    expect(await within(modal).findByRole('option', { name: 'Lớp B — sĩ số 29/30' })).toBeInTheDocument();
    expect(within(modal).queryByRole('option', { name: /Lớp A/ })).not.toBeInTheDocument();
    await user.click(within(modal).getByRole('option', { name: 'Lớp B — sĩ số 29/30' }));
    const gui = within(modal).getByRole('button', { name: 'Gửi đề nghị' });
    await user.type(within(modal).getByRole('textbox', { name: /Lý do/ }), 'Gần');
    expect(gui).toBeDisabled();
    await user.type(within(modal).getByRole('textbox', { name: /Lý do/ }), ' nhà hơn');
    await user.click(gui);
    expect(await screen.findByText('Đổi lớp: Chờ duyệt')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Hủy đề nghị' })).toBeInTheDocument();
  });
});

function deNghiMau(): DeNghiDoiLopGv {
  return {
    id: 'dn-1',
    giai_doan_id: 'gd-2',
    ly_do: 'Gần nhà hơn',
    trang_thai: 'cho_duyet',
    tao_luc: '2026-10-07T01:00:00.000Z',
    xu_ly_luc: null,
    ghi_chu_xu_ly: null,
    hoc_vien: { id: 'hv-1', ho_ten: 'Nguyễn Thị Lan', don_vi: 'THPT A', cum: 'Cụm 1' },
    giai_doan: { thu_tu: 2, ten_giai_doan: 'Học trực tiếp' },
    lop_hien_tai: { id: 'lop-a', ten_lop: 'Lớp A' },
    lop_de_nghi: { id: 'lop-b', ten_lop: 'Lớp B', si_so_toi_da: 30, khoa: { ma_khoa: 'AG-1' } },
    si_so_lop_de_nghi: 30,
    nguoi_tao: 'Hỗ trợ HV 1',
    nguoi_xu_ly: null,
  };
}

function renderGv(xuLy?: Parameters<typeof http.post>[1]) {
  datToken('token-gia-lap');
  db.nguoiDung.vai_tro = 'ho_tro_giang_vien';
  const ds = [deNghiMau()];
  server.use(
    http.get('/ho-tro-giang-vien/de-nghi-doi-lop', ({ request }) => {
      const tt = new URL(request.url).searchParams.get('trang_thai');
      return HttpResponse.json(tt ? ds.filter((d) => d.trang_thai === tt) : ds);
    }),
    http.post(
      '/ho-tro-giang-vien/de-nghi-doi-lop/:id/duyet',
      xuLy ??
        (() => {
          ds[0].trang_thai = 'da_duyet';
          return HttpResponse.json({ trang_thai: 'da_duyet', canh_bao: ['Lớp B có 31 học viên, vượt sĩ số tối đa 30'] });
        }),
    ),
    http.post('/ho-tro-giang-vien/de-nghi-doi-lop/:id/tu-choi', async ({ request }) => {
      const b = (await request.json()) as { ghi_chu: string };
      ds[0].trang_thai = 'tu_choi';
      ds[0].ghi_chu_xu_ly = b.ghi_chu;
      return HttpResponse.json({ trang_thai: 'tu_choi' });
    }),
  );
  return renderVoiRouter([{ path: '/ho-tro-gv/de-nghi-doi-lop', element: <HoTroGvDeNghiDoiLop /> }], {
    initialEntries: ['/ho-tro-gv/de-nghi-doi-lop'],
  });
}

describe('Nhóm hỗ trợ GV — duyệt đề nghị đổi lớp', () => {
  it('hiện cảnh báo sẽ vượt sĩ số; duyệt → thông báo cảnh báo + đề nghị rời danh sách chờ', async () => {
    renderGv();
    const user = userEvent.setup();
    expect(await screen.findByText('Nguyễn Thị Lan')).toBeInTheDocument();
    expect(screen.getByText(/duyệt sẽ vượt sĩ số tối đa/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Duyệt' }));
    const modal = await screen.findByRole('dialog');
    await user.click(within(modal).getByRole('button', { name: 'Duyệt' }));
    expect(await screen.findByText('Lớp B có 31 học viên, vượt sĩ số tối đa 30')).toBeInTheDocument();
    expect(await screen.findByText('Không có đề nghị nào đang chờ duyệt.')).toBeInTheDocument();
  });

  it('từ chối bắt buộc lý do', async () => {
    renderGv();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Từ chối' }));
    const modal = await screen.findByRole('dialog');
    const nut = within(modal).getByRole('button', { name: 'Từ chối' });
    expect(nut).toBeDisabled();
    await user.type(within(modal).getByRole('textbox', { name: /Lý do từ chối/ }), 'Lớp đã đủ');
    await user.click(nut);
    expect(await screen.findByText('Không có đề nghị nào đang chờ duyệt.')).toBeInTheDocument();
  });

  it('409 (người khác đã xử lý) → hiện đúng thông điệp server', async () => {
    renderGv(() =>
      HttpResponse.json({ error: { code: 'CONFLICT', message: 'Đề nghị đã được xử lý' } }, { status: 409 }),
    );
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Duyệt' }));
    const modal = await screen.findByRole('dialog');
    await user.click(within(modal).getByRole('button', { name: 'Duyệt' }));
    expect(await screen.findByText('Đề nghị đã được xử lý')).toBeInTheDocument();
  });
});

describe('Hồ sơ chuẩn bị lớp — tab Học viên', () => {
  it('hiện báo vắng theo buổi + đề nghị đổi lớp đang chờ của đợt', async () => {
    datToken('token-gia-lap');
    db.nguoiDung.vai_tro = 'ho_tro_giang_vien';
    const buoi = db.trangLopGv.buoi[0];
    db.trangLopGv.hoc_vien[0].bao_vang = { [buoi.id]: 'Ốm' };
    db.trangLopGv.de_nghi_cho = [
      { id: 'dn-9', ho_ten: 'Trần Văn Bình', chieu: 'vao', tu_lop: 'Lớp 02', den_lop: 'Lớp 01', ly_do: 'Gần nhà', tao_luc: '2026-10-07T01:00:00.000Z' },
    ];
    const user = userEvent.setup();
    renderVoiRouter([{ path: '/ho-tro-gv/lop/:lopId/giai-doan/:gdId', element: <HoTroGvHoSoLop /> }], {
      initialEntries: ['/ho-tro-gv/lop/lop-1/giai-doan/gd-2'],
    });
    await user.click(await screen.findByRole('tab', { name: /Học viên/ }));
    const panel = await screen.findByRole('tabpanel', { name: /Học viên/ });
    expect(within(panel).getByText(`Buổi ${buoi.buoi_so}: Ốm`)).toBeInTheDocument();
    expect(within(panel).getByText('Đề nghị đổi lớp đang chờ duyệt')).toBeInTheDocument();
    expect(within(panel).getByText(/Trần Văn Bình: Lớp 02 → Lớp 01/)).toBeInTheDocument();
  });
});
