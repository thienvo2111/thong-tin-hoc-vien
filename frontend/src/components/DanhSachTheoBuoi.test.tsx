import { describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderTrang } from '@/test/testUtils';
import type { TrangLop } from '@/api/hoTroGv';
import { DanhSachTheoBuoi, buoiMacDinh, dsTheoBuoi } from './DanhSachTheoBuoi';

// Danh sách học viên theo BUỔI ở cổng giảng viên + hồ sơ lớp hỗ trợ GV:
// lớp gốc − người đổi ra + người đổi vào (spec đổi buổi §5, ADR 0008 L7).
type HV = TrangLop['hoc_vien'][number];
const hv = (id: string, ghiDe: Partial<HV> = {}): HV => ({
  dang_ky_hoc_id: id,
  hoc_vien_id: `hv-${id}`,
  ho_ten: `HV ${id}`,
  gioi_tinh: null,
  don_vi: `Trường ${id}`,
  doi_tuong: null,
  chuc_vu: null,
  muc_dau_vao: 'co_ban',
  diem_danh: {},
  ket_qua: null,
  ...ghiDe,
});
const buoi = (id: string, so: number, batDau: string) =>
  ({
    id,
    buoi_so: so,
    thoi_gian_bat_dau: batDau,
    thoi_gian_ket_thuc: new Date(new Date(batDau).getTime() + 3 * 3600_000).toISOString(),
    dia_diem_hoac_link: null,
    phong: null,
    trang_thai: 'chua_dien_ra',
    diem_hoc: null,
    giang_vien: [],
  }) as TrangLop['buoi'][number];

const dot = (): TrangLop =>
  ({
    lop: { id: 'l1', ten_lop: 'TT-03', loai_lop: 'truc_tiep', si_so_toi_da: 40, khoa: { id: 'k1', ma_khoa: 'K1', ten_khoa: 'K' } },
    giai_doan: { id: 'gd', thu_tu: 2, ten_giai_doan: 'GĐ2', hinh_thuc: 'truc_tiep', thoi_gian_bat_dau: '', thoi_gian_ket_thuc: '' },
    buoi: [buoi('b1', 1, '2026-10-01T00:30:00.000Z'), buoi('b2', 2, '2099-10-24T06:30:00.000Z')],
    hoc_vien: [
      hv('A', { diem_danh: { b1: 'co_mat' } }),
      hv('B', { doi_buoi: { b1: { loai: 'ra', lop: 'TT-05' } } }),
      hv('C', { bao_vang: { b2: 'Ốm' } }),
    ],
    hoc_vien_doi_vao: [hv('D', { doi_buoi: { b2: { loai: 'vao', lop: 'TT-01' } } })],
    hau_can: [],
    thuc_dia: [],
    nhom_ho_tro_gv: [],
  }) as unknown as TrangLop;

describe('dsTheoBuoi', () => {
  it('buổi 1: bỏ người đổi ra (liệt kê riêng), không có người đổi vào buổi khác', () => {
    const kq = dsTheoBuoi(dot(), 'b1');
    expect(kq.hocVien.map((h) => h.ho_ten)).toEqual(['HV A', 'HV C']);
    expect(kq.doiRa).toEqual([{ ho_ten: 'HV B', lop: 'TT-05' }]);
  });

  it('buổi 2: người đổi vào có trong danh sách kèm lớp nguồn; người đổi ra buổi khác vẫn học', () => {
    const kq = dsTheoBuoi(dot(), 'b2');
    expect(kq.hocVien.map((h) => h.ho_ten)).toEqual(['HV A', 'HV B', 'HV C', 'HV D']);
    expect(kq.hocVien.find((h) => h.ho_ten === 'HV D')?.tuLop).toBe('TT-01');
    expect(kq.hocVien.find((h) => h.ho_ten === 'HV A')?.tuLop).toBeNull();
    expect(kq.doiRa).toEqual([]);
  });
});

describe('buoiMacDinh', () => {
  it('chọn buổi chưa kết thúc sớm nhất; hết buổi thì buổi cuối; không có buổi → null', () => {
    const now = new Date('2026-10-25T00:00:00Z');
    expect(buoiMacDinh(dot().buoi, now)).toBe('b2');
    expect(buoiMacDinh(dot().buoi, new Date('2026-09-30T00:00:00Z'))).toBe('b1');
    expect(buoiMacDinh(dot().buoi, new Date('2100-01-01T00:00:00Z'))).toBe('b2');
    expect(buoiMacDinh([], now)).toBeNull();
  });
});

describe('<DanhSachTheoBuoi />', () => {
  it('mặc định buổi sắp tới; đổi buổi thì danh sách đổi theo; ghi chú đổi vào/ra; điểm danh của đúng buổi', async () => {
    const user = userEvent.setup();
    renderTrang(<DanhSachTheoBuoi d={dot()} />);
    const chon = screen.getByLabelText('Buổi');
    expect(chon).toHaveValue('b2');
    const bang = screen.getByRole('table');
    expect(within(bang).getByText('HV D')).toBeInTheDocument();
    expect(within(bang).getByText('Đổi buổi – từ lớp TT-01')).toBeInTheDocument();
    expect(within(bang).getByText(/Báo vắng: Ốm/)).toBeInTheDocument();
    expect(screen.getByText('4 học viên')).toBeInTheDocument();

    await user.selectOptions(chon, 'b1');
    const bang1 = screen.getByRole('table');
    expect(within(bang1).queryByText('HV B')).not.toBeInTheDocument();
    expect(within(bang1).queryByText('HV D')).not.toBeInTheDocument();
    expect(within(bang1).getByText('Có mặt')).toBeInTheDocument();
    expect(screen.getByText(/HV B – đã chuyển sang TT-05, không học buổi này/)).toBeInTheDocument();
    expect(screen.getByText('2 học viên')).toBeInTheDocument();
  });

  it('cột SĐT chỉ hiện khi dữ liệu có SĐT (backend đã lọc theo vai trò)', () => {
    const d = dot();
    const { unmount } = renderTrang(<DanhSachTheoBuoi d={d} />);
    expect(screen.queryByRole('columnheader', { name: 'SĐT' })).not.toBeInTheDocument();
    unmount();
    d.hoc_vien[0].so_dien_thoai = '0909123456';
    renderTrang(<DanhSachTheoBuoi d={d} />);
    expect(screen.getByRole('columnheader', { name: 'SĐT' })).toBeInTheDocument();
    expect(screen.getByText('0909123456')).toBeInTheDocument();
  });

  it('lớp chưa có buổi hoặc buổi không có học viên → thông báo trống', async () => {
    const d = dot();
    d.buoi = [];
    const { unmount } = renderTrang(<DanhSachTheoBuoi d={d} />);
    expect(screen.getByText('Lớp chưa có buổi học trong giai đoạn này.')).toBeInTheDocument();
    unmount();
    const d2 = dot();
    d2.hoc_vien = [];
    d2.hoc_vien_doi_vao = [];
    renderTrang(<DanhSachTheoBuoi d={d2} />);
    expect(screen.getByText('Buổi này chưa có học viên.')).toBeInTheDocument();
  });
});
