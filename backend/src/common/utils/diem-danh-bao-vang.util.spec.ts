import { hopNhatDiemDanh } from './diem-danh-bao-vang.util';

// ADR 0004 G13: quy tắc hợp nhất điểm danh nạp + báo vắng.
describe('hopNhatDiemDanh', () => {
  it('vắng + có báo vắng → vắng có phép', () => {
    expect(hopNhatDiemDanh('vang', true)).toBe('vang_co_phep');
  });

  it('vắng + không báo vắng → giữ vắng', () => {
    expect(hopNhatDiemDanh('vang', false)).toBe('vang');
  });

  it('có mặt luôn thắng, kể cả khi đã báo vắng', () => {
    expect(hopNhatDiemDanh('co_mat', true)).toBe('co_mat');
    expect(hopNhatDiemDanh('co_mat', false)).toBe('co_mat');
  });

  it('vắng có phép giữ nguyên dù có hay không báo vắng', () => {
    expect(hopNhatDiemDanh('vang_co_phep', true)).toBe('vang_co_phep');
    expect(hopNhatDiemDanh('vang_co_phep', false)).toBe('vang_co_phep');
  });
});
