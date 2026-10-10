import {
  HAN_SUA_HO_TRO_GV_MS,
  quyenSuaDiemDanh,
} from './quyen-sua-diem-danh.util';

describe('quyenSuaDiemDanh (ADR 0005 Z7)', () => {
  const now = new Date('2026-10-10T03:00:00.000Z');
  const truoc = (ms: number) => new Date(now.getTime() - ms);
  const NGAY = 24 * 60 * 60 * 1000;

  it('quan_tri: mọi lúc — buổi tương lai, rất cũ', () => {
    for (const bd of [truoc(-NGAY), truoc(365 * NGAY), now]) {
      expect(quyenSuaDiemDanh('quan_tri', bd, now)).toEqual({
        sua_duoc: true,
        ly_do: null,
      });
    }
  });

  it('ho_tro_giang_vien: buổi đã bắt đầu trong 3 ngày -> sửa được (biên đúng 3 ngày)', () => {
    for (const bd of [
      now,
      truoc(1000),
      truoc(2 * NGAY),
      truoc(HAN_SUA_HO_TRO_GV_MS),
    ]) {
      expect(quyenSuaDiemDanh('ho_tro_giang_vien', bd, now).sua_duoc).toBe(
        true,
      );
    }
  });

  it('ho_tro_giang_vien: quá 3 ngày 1ms -> qua_han', () => {
    expect(
      quyenSuaDiemDanh(
        'ho_tro_giang_vien',
        truoc(HAN_SUA_HO_TRO_GV_MS + 1),
        now,
      ),
    ).toEqual({ sua_duoc: false, ly_do: 'qua_han' });
  });

  it('ho_tro_giang_vien: buổi chưa bắt đầu -> chua_dien_ra', () => {
    expect(quyenSuaDiemDanh('ho_tro_giang_vien', truoc(-1), now)).toEqual({
      sua_duoc: false,
      ly_do: 'chua_dien_ra',
    });
  });

  it('giảng viên, hỗ trợ HV, vai trò khác -> khong_co_quyen', () => {
    for (const vt of [
      'giang_vien',
      'ho_tro_hoc_vien',
      'hoc_vien',
      'truong',
    ] as const) {
      expect(quyenSuaDiemDanh(vt, truoc(1000), now)).toEqual({
        sua_duoc: false,
        ly_do: 'khong_co_quyen',
      });
    }
  });
});
