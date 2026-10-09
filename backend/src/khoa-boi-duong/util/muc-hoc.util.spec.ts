import {
  THU_TU_MUC,
  duocChonMuc,
  mucDanhGiaLamMoc,
  mucHocHieuLuc,
  mucTuKetQuaKhaoSat,
} from './muc-hoc.util';

describe('THU_TU_MUC', () => {
  it('co_ban < thanh_thao < nang_cao', () => {
    expect(THU_TU_MUC.co_ban).toBeLessThan(THU_TU_MUC.thanh_thao);
    expect(THU_TU_MUC.thanh_thao).toBeLessThan(THU_TU_MUC.nang_cao);
  });
});

describe('mucHocHieuLuc', () => {
  it('chưa chọn -> theo mức đánh giá', () => {
    expect(mucHocHieuLuc(null, 'nang_cao')).toBe('nang_cao');
  });

  it('đã chọn -> theo mức đã chọn', () => {
    expect(mucHocHieuLuc('co_ban', 'nang_cao')).toBe('co_ban');
  });

  it('chưa có kết quả đánh giá -> null', () => {
    expect(mucHocHieuLuc(null, null)).toBeNull();
  });
});

describe('duocChonMuc', () => {
  it('thấp hơn mức đánh giá -> được', () => {
    expect(duocChonMuc('nang_cao', 'thanh_thao')).toBe(true);
    expect(duocChonMuc('nang_cao', 'co_ban')).toBe(true);
    expect(duocChonMuc('thanh_thao', 'co_ban')).toBe(true);
  });

  it('bằng mức đánh giá -> được', () => {
    expect(duocChonMuc('co_ban', 'co_ban')).toBe(true);
    expect(duocChonMuc('thanh_thao', 'thanh_thao')).toBe(true);
    expect(duocChonMuc('nang_cao', 'nang_cao')).toBe(true);
  });

  it('cao hơn mức đánh giá -> không được', () => {
    expect(duocChonMuc('co_ban', 'thanh_thao')).toBe(false);
    expect(duocChonMuc('co_ban', 'nang_cao')).toBe(false);
    expect(duocChonMuc('thanh_thao', 'nang_cao')).toBe(false);
  });

  it('chưa có mức đánh giá hoặc mức chọn null -> không được', () => {
    expect(duocChonMuc(null, 'co_ban')).toBe(false);
    expect(duocChonMuc('nang_cao', null)).toBe(false);
    expect(duocChonMuc(null, null)).toBe(false);
  });
});

describe('mucTuKetQuaKhaoSat', () => {
  // Chỉ để xếp lớp: M1 "Chưa đạt" vẫn học lớp Cơ bản; kết quả hiển thị giữ nhãn khảo sát.
  it('quy đổi theo mã gốc M1..M4 (mức xếp lớp)', () => {
    const q = (muc_goc: string) => mucTuKetQuaKhaoSat({ muc: null, muc_goc });
    expect(q('M1')).toBe('co_ban');
    expect(q('M2')).toBe('co_ban');
    expect(q('M3')).toBe('thanh_thao');
    expect(q('M4')).toBe('nang_cao');
  });

  it('mã lạ hoặc rỗng -> null', () => {
    expect(mucTuKetQuaKhaoSat({ muc: null, muc_goc: 'M5' })).toBeNull();
    expect(mucTuKetQuaKhaoSat({ muc: null, muc_goc: 'Nâng cao' })).toBeNull();
    expect(mucTuKetQuaKhaoSat({ muc: null, muc_goc: null })).toBeNull();
  });

  it('có muc -> dùng thẳng, bỏ qua muc_goc', () => {
    expect(mucTuKetQuaKhaoSat({ muc: 'thanh_thao', muc_goc: 'M4' })).toBe(
      'thanh_thao',
    );
  });
});

describe('mucDanhGiaLamMoc', () => {
  const bai = (trang_thai: string, muc_goc: string | null) => ({
    trang_thai,
    muc: null,
    muc_goc,
  });

  it('đã chốt muc_dau_vao -> ưu tiên mức chốt', () => {
    expect(mucDanhGiaLamMoc('thanh_thao', bai('hoan_thanh', 'M4'))).toEqual({
      muc: 'thanh_thao',
      nguon: 'chot',
    });
  });

  it('chưa chốt + bài đầu vào hoàn thành -> mức quy đổi từ khảo sát', () => {
    expect(mucDanhGiaLamMoc(null, bai('hoan_thanh', 'M4'))).toEqual({
      muc: 'nang_cao',
      nguon: 'khao_sat',
    });
  });

  it('bài chưa hoàn thành -> chưa có mốc', () => {
    expect(mucDanhGiaLamMoc(null, bai('dang_lam', 'M4'))).toEqual({
      muc: null,
      nguon: null,
    });
    expect(mucDanhGiaLamMoc(null, bai('da_mo', null))).toEqual({
      muc: null,
      nguon: null,
    });
  });

  it('chưa làm bài hoặc mã lạ -> chưa có mốc', () => {
    expect(mucDanhGiaLamMoc(null, null)).toEqual({ muc: null, nguon: null });
    expect(mucDanhGiaLamMoc(null, bai('hoan_thanh', 'X9'))).toEqual({
      muc: null,
      nguon: null,
    });
  });
});
