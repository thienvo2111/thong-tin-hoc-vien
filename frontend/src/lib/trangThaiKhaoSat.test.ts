import { describe, expect, it } from 'vitest';
import { phaiKhaoSat } from './trangThaiKhaoSat';

describe('phaiKhaoSat', () => {
  it('nhân viên không thực hiện khảo sát – đánh giá', () => {
    expect(phaiKhaoSat('nhan_vien')).toBe(false);
  });

  it('giáo viên, CBQL phải khảo sát', () => {
    expect(phaiKhaoSat('giao_vien')).toBe(true);
    expect(phaiKhaoSat('can_bo_quan_ly')).toBe(true);
  });

  it('chưa khai đối tượng (null/undefined) vẫn phải khảo sát', () => {
    expect(phaiKhaoSat(null)).toBe(true);
    expect(phaiKhaoSat(undefined)).toBe(true);
  });
});
