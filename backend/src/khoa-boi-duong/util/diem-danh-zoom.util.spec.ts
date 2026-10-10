import {
  apDungDiemDanhZoom,
  diemDanhZoomCuaBuoi,
  giauLinkZoomCuaKhoa,
} from './diem-danh-zoom.util';

const BAT = new Date('2026-10-01T00:00:00Z');
const KHOA = {
  bat_diem_danh_zoom_luc: BAT,
  diem_danh_mo_truoc_phut: 30,
  diem_danh_dong_sau_phut: 120,
};

describe('apDungDiemDanhZoom', () => {
  it('chỉ lớp zoom của khóa đã bật', () => {
    expect(apDungDiemDanhZoom({ loai_lop: 'zoom' }, KHOA)).toBe(true);
    expect(apDungDiemDanhZoom({ loai_lop: 'truc_tiep' }, KHOA)).toBe(false);
    expect(apDungDiemDanhZoom({ loai_lop: 'vle' }, KHOA)).toBe(false);
    expect(
      apDungDiemDanhZoom(
        { loai_lop: 'zoom' },
        { bat_diem_danh_zoom_luc: null },
      ),
    ).toBe(false);
  });
});

describe('diemDanhZoomCuaBuoi', () => {
  const buoi = {
    thoi_gian_bat_dau: new Date('2026-11-06T01:00:00Z'),
    dia_diem_hoac_link: 'https://zoom.us/j/1',
  };

  it('có link + chưa có dòng -> trang_thai null', () => {
    expect(
      diemDanhZoomCuaBuoi(buoi, KHOA, null, new Date('2026-11-06T01:10:00Z')),
    ).toEqual({
      co_link: true,
      mo: new Date('2026-11-06T00:30:00Z'),
      dong: new Date('2026-11-06T03:00:00Z'),
      pha: 'dang_mo',
      trang_thai: null,
      tu_diem_danh_luc: null,
    });
  });

  it('không link -> co_link false; có dòng -> trả trạng thái + mốc', () => {
    const luc = new Date('2026-11-06T00:40:00Z');
    expect(
      diemDanhZoomCuaBuoi(
        { ...buoi, dia_diem_hoac_link: '  ' },
        KHOA,
        { trang_thai: 'co_mat', tu_diem_danh_luc: luc },
        new Date('2026-11-06T05:00:00Z'),
      ),
    ).toMatchObject({
      co_link: false,
      pha: 'da_dong',
      trang_thai: 'co_mat',
      tu_diem_danh_luc: luc,
    });
  });
});

describe('giauLinkZoomCuaKhoa', () => {
  const khoa = {
    bat_diem_danh_zoom_luc: BAT as Date | null,
    giai_doan: [
      { id: 'gd-zoom', link_hoac_dia_diem: 'https://zoom.us/j/1' },
      { id: 'gd-tt', link_hoac_dia_diem: 'Hội trường A' },
    ],
    lop_hoc: [
      { loai_lop: 'zoom' as const, lich_hoc: [{ giai_doan_id: 'gd-zoom' }] },
      { loai_lop: 'truc_tiep' as const, lich_hoc: [{ giai_doan_id: 'gd-tt' }] },
    ],
  };

  it('giấu link giai đoạn có buổi lớp Zoom, giữ giai đoạn khác', () => {
    expect(giauLinkZoomCuaKhoa(khoa).giai_doan).toEqual([
      { id: 'gd-zoom', link_hoac_dia_diem: null },
      { id: 'gd-tt', link_hoac_dia_diem: 'Hội trường A' },
    ]);
  });

  it('khóa chưa bật -> giữ nguyên', () => {
    expect(
      giauLinkZoomCuaKhoa({ ...khoa, bat_diem_danh_zoom_luc: null }).giai_doan,
    ).toEqual(khoa.giai_doan);
  });
});
