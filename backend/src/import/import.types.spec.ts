import { isSupportedImportType } from './import.types';

describe('isSupportedImportType', () => {
  it.each([
    'dia_danh',
    'don_vi_cong_tac',
    'mon_hoc',
    'ho_so_nhan_su_moet',
    'phan_lop_hoc_vien',
  ])('%s được hỗ trợ', (loai) => {
    expect(isSupportedImportType(loai)).toBe(true);
  });

  it.each(['khong_ton_tai'])('%s chưa được hỗ trợ', (loai) => {
    expect(isSupportedImportType(loai)).toBe(false);
  });
});
