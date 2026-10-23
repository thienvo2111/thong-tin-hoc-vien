import {
  hienThiGiaTriCauHinh,
  soSanhCauHinhKhoa,
} from './lich-su-cau-hinh-khoa.util';

describe('soSanhCauHinhKhoa', () => {
  it('chỉ trả trường thực sự đổi; Date so theo giá trị, lưu ISO', () => {
    const truoc = {
      id: 'k1',
      ten_khoa: 'A',
      thoi_gian_bat_dau: new Date('2026-01-01'),
      bat_diem_danh_zoom_luc: null,
      so_buoi_doi_toi_da: 0,
      che_do_chuyen_can: 'theo_lop_hien_tai',
      cap_nhat_luc: new Date('2026-01-01'),
    };
    const sau = {
      ...truoc,
      thoi_gian_bat_dau: new Date('2026-01-01'),
      bat_diem_danh_zoom_luc: new Date('2026-10-22T02:00:00Z'),
      so_buoi_doi_toi_da: 2,
      cap_nhat_luc: new Date('2026-10-22'),
    };
    expect(soSanhCauHinhKhoa(truoc, sau)).toEqual([
      { truong: 'so_buoi_doi_toi_da', truoc: 0, sau: 2 },
      {
        truong: 'bat_diem_danh_zoom_luc',
        truoc: null,
        sau: '2026-10-22T02:00:00.000Z',
      },
    ]);
  });

  it('không đổi gì -> rỗng', () => {
    const k = { ten_khoa: 'A', mo_dieu_chinh_muc: true };
    expect(soSanhCauHinhKhoa(k, { ...k })).toEqual([]);
  });
});

describe('hienThiGiaTriCauHinh', () => {
  it.each([
    [
      'che_do_chuyen_can',
      'cong_nhan_cung_muc',
      'Công nhận buổi đã có mặt ở lớp cũ cùng mức',
    ],
    ['mo_dieu_chinh_muc', true, 'Bật'],
    ['mo_dieu_chinh_muc', false, 'Tắt'],
    ['bat_diem_danh_zoom_luc', null, 'Tắt'],
    [
      'bat_diem_danh_zoom_luc',
      '2026-10-22T02:00:00.000Z',
      'Bật (từ 22/10/2026 09:00)',
    ],
    ['thoi_gian_bat_dau', '2026-01-05T00:00:00.000Z', '05/01/2026'],
    ['so_buoi_doi_toi_da', 2, '2'],
    ['dia_diem', null, '(trống)'],
  ])('%s = %p -> %s', (truong, v, nhan) => {
    expect(hienThiGiaTriCauHinh(truong, v as never)).toBe(nhan);
  });

  it('đơn vị đặt hàng -> tên đơn vị nếu tra được', () => {
    expect(
      hienThiGiaTriCauHinh(
        'don_vi_dat_hang_id',
        'dv-1',
        new Map([['dv-1', 'Sở GD&ĐT An Giang']]),
      ),
    ).toBe('Sở GD&ĐT An Giang');
  });
});
