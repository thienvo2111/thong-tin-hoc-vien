import {
  DOI_TUONG_KHONG_KHAO_SAT,
  DOI_TUONG_KHONG_XEP_LOP,
  HOC_VIEN_PHAI_KHAO_SAT,
  HOC_VIEN_PHAI_XEP_LOP,
  phaiKhaoSat,
  phaiXepLop,
} from './doi-tuong-khao-sat.util';

describe('phaiKhaoSat', () => {
  it('nhan_vien -> false (chưa triển khai khảo sát)', () => {
    expect(phaiKhaoSat('nhan_vien')).toBe(false);
  });

  it('null/undefined (chưa khai đối tượng) -> true, vẫn tính vào khảo sát', () => {
    expect(phaiKhaoSat(null)).toBe(true);
    expect(phaiKhaoSat(undefined)).toBe(true);
  });

  it.each(['giao_vien', 'can_bo_quan_ly'])('%s -> true', (doiTuong) => {
    expect(phaiKhaoSat(doiTuong)).toBe(true);
  });
});

describe('HOC_VIEN_PHAI_KHAO_SAT', () => {
  // SQL NOT IN bỏ dòng NULL -> phải OR null riêng; test này khóa lại hình
  // dạng where để tránh ai đó đổi sang notIn đơn thuần làm rớt học viên
  // chưa khai đối tượng khỏi khảo sát.
  it('có OR null + notIn danh sách DOI_TUONG_KHONG_KHAO_SAT', () => {
    expect(HOC_VIEN_PHAI_KHAO_SAT).toEqual({
      OR: [
        { doi_tuong: null },
        { doi_tuong: { notIn: [...DOI_TUONG_KHONG_KHAO_SAT] } },
      ],
    });
  });

  // Mô phỏng ngữ nghĩa Prisma cho đúng hình dạng where ở trên, độc lập với
  // phaiKhaoSat(), để chứng minh học viên NULL vẫn được giữ lại.
  it('áp vào 1 giáo_viên + 1 nhân_viên + 1 chưa khai -> giữ 2, loại nhân viên', () => {
    const hocVien = [
      { id: 'gv', doi_tuong: 'giao_vien' },
      { id: 'nv', doi_tuong: 'nhan_vien' },
      { id: 'chua-khai', doi_tuong: null },
    ];
    const khop = (doiTuong: string | null) =>
      HOC_VIEN_PHAI_KHAO_SAT.OR!.some((dk) => {
        const dt = (dk as { doi_tuong?: unknown }).doi_tuong;
        if (dt === null) return doiTuong === null;
        if (dt && typeof dt === 'object' && 'notIn' in dt) {
          return !(dt.notIn as string[]).includes(doiTuong as string);
        }
        return false;
      });
    const giu = hocVien.filter((hv) => khop(hv.doi_tuong)).map((hv) => hv.id);
    expect(giu.sort()).toEqual(['chua-khai', 'gv']);
  });
});

describe('phaiXepLop', () => {
  it('nhan_vien -> false (không tham gia tập huấn/xếp lớp đợt này)', () => {
    expect(phaiXepLop('nhan_vien')).toBe(false);
  });

  it('null/undefined (chưa khai đối tượng) -> true, vẫn xếp lớp bình thường', () => {
    expect(phaiXepLop(null)).toBe(true);
    expect(phaiXepLop(undefined)).toBe(true);
  });

  it.each(['giao_vien', 'can_bo_quan_ly'])('%s -> true', (doiTuong) => {
    expect(phaiXepLop(doiTuong)).toBe(true);
  });
});

describe('HOC_VIEN_PHAI_XEP_LOP', () => {
  it('có OR null + notIn danh sách DOI_TUONG_KHONG_XEP_LOP', () => {
    expect(HOC_VIEN_PHAI_XEP_LOP).toEqual({
      OR: [
        { doi_tuong: null },
        { doi_tuong: { notIn: [...DOI_TUONG_KHONG_XEP_LOP] } },
      ],
    });
  });
});
