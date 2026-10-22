import {
  DiemDanhLopCu,
  DiemDanhLopCuKhoa,
  canhBaoDiemDanhLopCu,
  napDiemDanhLopCu,
  phuLucNhatKyPhanLop,
} from './lop-cu-phan-lop.util';
import { CheDoChuyenCan, MucLop } from '../../common/utils/chuyen-can.util';

// ADR 0014 C5a/C5b (issue #36).
describe('canhBaoDiemDanhLopCu', () => {
  const thuTu = new Map([['gd-2', 2]]);
  const lopA = (
    muc: MucLop,
    loai_lop = 'zoom',
    so_buoi = 3,
  ): DiemDanhLopCu => ({
    lop_id: 'lop-a',
    ten_lop: 'Lớp A',
    loai_lop,
    muc_nang_luc: muc,
    so_buoi,
  });
  const boNho = (
    che_do: CheDoChuyenCan,
    cu: DiemDanhLopCu,
  ): DiemDanhLopCuKhoa => ({
    che_do,
    theo_hoc_vien: new Map([['hv-1', new Map([['gd-2', cu]])]]),
  });
  const sangB = (muc: MucLop) =>
    new Map([['gd-2', { ten_lop: 'Lớp B', muc_nang_luc: muc }]]);
  const chuyen = [{ giai_doan_id: 'gd-2', lop_id: 'lop-b' }];
  const tienTo =
    'Học viên "MA1" chuyển từ lớp "Lớp A" sang lớp "Lớp B" (GĐ2): đã điểm danh 3 buổi ở lớp "Lớp A" — theo chế độ của khóa: ';

  it.each<[CheDoChuyenCan, MucLop, MucLop, string]>([
    ['theo_lop_hien_tai', 'co_ban', 'co_ban', 'không được công nhận'],
    ['theo_lop_hien_tai', null, null, 'không được công nhận'],
    ['cong_nhan_cung_muc', 'co_ban', 'co_ban', 'được công nhận'],
    [
      'cong_nhan_cung_muc',
      'co_ban',
      'nang_cao',
      'không được công nhận (khác mức)',
    ],
    ['cong_nhan_cung_muc', null, null, 'được công nhận'],
    ['cong_nhan_cung_muc', null, 'co_ban', 'không được công nhận (khác mức)'],
    ['cong_nhan_lop_cu', 'co_ban', 'nang_cao', 'được công nhận'],
    ['cong_nhan_lop_cu', null, 'co_ban', 'được công nhận'],
  ])(
    'chuyển lớp Zoom, nấc %s, mức cũ %s -> mới %s: %s',
    (cheDo, mucCu, mucMoi, ketLuan) => {
      expect(
        canhBaoDiemDanhLopCu(
          'MA1',
          chuyen,
          sangB(mucMoi),
          boNho(cheDo, lopA(mucCu)),
          'hv-1',
          thuTu,
        ),
      ).toEqual([tienTo + ketLuan]);
    },
  );

  it.each<CheDoChuyenCan>(['theo_lop_hien_tai', 'cong_nhan_cung_muc'])(
    'lớp cũ trực tiếp luôn được công nhận (nấc %s, khác mức)',
    (cheDo) => {
      expect(
        canhBaoDiemDanhLopCu(
          'MA1',
          chuyen,
          sangB('nang_cao'),
          boNho(cheDo, lopA('co_ban', 'truc_tiep')),
          'hv-1',
          thuTu,
        ),
      ).toEqual([tienTo + 'được công nhận']);
    },
  );

  it('gỡ lớp "-" đã có điểm danh -> điểm danh vẫn được giữ', () => {
    expect(
      canhBaoDiemDanhLopCu(
        'MA1',
        [{ giai_doan_id: 'gd-2', lop_id: null }],
        new Map(),
        boNho('cong_nhan_cung_muc', lopA('co_ban', 'zoom', 1)),
        'hv-1',
        thuTu,
      ),
    ).toEqual([
      'Học viên "MA1" gỡ khỏi lớp "Lớp A" (GĐ2): đã điểm danh 1 buổi ở lớp "Lớp A" — điểm danh vẫn được giữ',
    ]);
  });

  it('giữ nguyên lớp, giai đoạn khác, hoặc chưa điểm danh -> không cảnh báo', () => {
    const bn = boNho('theo_lop_hien_tai', lopA('co_ban'));
    expect(
      canhBaoDiemDanhLopCu(
        'MA1',
        [{ giai_doan_id: 'gd-2', lop_id: 'lop-a' }],
        sangB('co_ban'),
        bn,
        'hv-1',
        thuTu,
      ),
    ).toEqual([]);
    expect(
      canhBaoDiemDanhLopCu(
        'MA1',
        [{ giai_doan_id: 'gd-3', lop_id: null }],
        new Map(),
        bn,
        'hv-1',
        thuTu,
      ),
    ).toEqual([]);
    expect(
      canhBaoDiemDanhLopCu(
        'MA1',
        chuyen,
        sangB('co_ban'),
        bn,
        'hv-khac',
        thuTu,
      ),
    ).toEqual([]);
  });
});

describe('napDiemDanhLopCu', () => {
  it('gom dòng theo học viên -> giai đoạn; khóa không có -> theo_lop_hien_tai', async () => {
    const prisma = {
      khoa_boi_duong: { findUnique: jest.fn().mockResolvedValue(null) },
      $queryRaw: jest.fn().mockResolvedValue([
        {
          hoc_vien_id: 'hv-1',
          giai_doan_id: 'gd-2',
          lop_id: 'lop-a',
          ten_lop: 'Lớp A',
          loai_lop: 'zoom',
          muc_nang_luc: null,
          so_buoi: 2,
        },
      ]),
    };
    const kq = await napDiemDanhLopCu(prisma as never, 'khoa-1');
    expect(kq.che_do).toBe('theo_lop_hien_tai');
    expect(kq.theo_hoc_vien.get('hv-1')?.get('gd-2')).toEqual({
      lop_id: 'lop-a',
      ten_lop: 'Lớp A',
      loai_lop: 'zoom',
      muc_nang_luc: null,
      so_buoi: 2,
    });
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
  });
});

describe('phuLucNhatKyPhanLop', () => {
  const cu: DiemDanhLopCu = {
    lop_id: 'lop-a',
    ten_lop: 'Lớp A',
    loai_lop: 'zoom',
    muc_nang_luc: 'co_ban',
    so_buoi: 2,
  };
  const chuyen = { giai_doan_id: 'gd-2', lop_id: 'lop-b' };
  const deNghi = (id: string, loai: 'doi_buoi' | 'hoc_bu', gd = 'gd-2') => ({
    id,
    loai,
    trang_thai: 'cho_duyet' as const,
    giai_doan_id: gd,
    lop_id: 'lop-a',
    ten_lop: 'Lớp A',
    da_diem_danh_chot: false,
  });

  it('chuyển lớp khác mức ở nấc cùng mức -> không được công nhận (nấc: cùng mức)', () => {
    expect(
      phuLucNhatKyPhanLop(chuyen, cu, 'cong_nhan_cung_muc', 'nang_cao', [])
        .duoi,
    ).toBe(
      ' — đã điểm danh 2 buổi ở lớp Lớp A, không được công nhận (nấc: cùng mức)',
    );
  });

  it('nấc theo lớp hiện tại + chỉ hủy đề nghị của đúng giai đoạn', () => {
    const kq = phuLucNhatKyPhanLop(chuyen, cu, 'theo_lop_hien_tai', 'co_ban', [
      deNghi('d1', 'hoc_bu'),
      deNghi('d2', 'doi_buoi', 'gd-3'),
    ]);
    expect(kq.duoi).toBe(
      ' — đã điểm danh 2 buổi ở lớp Lớp A, không được công nhận (nấc: theo lớp hiện tại); hủy 1 học bù',
    );
    expect(kq.chi_tiet).toMatchObject({
      huy_de_nghi: { doi_buoi: 0, hoc_bu: 1, ids: ['d1'] },
    });
  });

  it('chưa điểm danh, không hủy gì -> rỗng, không chi_tiet', () => {
    expect(
      phuLucNhatKyPhanLop(chuyen, undefined, 'cong_nhan_lop_cu', null, []),
    ).toEqual({ duoi: '' });
  });

  it('chỉ có đề nghị bị hủy (chưa điểm danh) -> chỉ phần hủy', () => {
    expect(
      phuLucNhatKyPhanLop(chuyen, undefined, 'cong_nhan_lop_cu', null, [
        deNghi('d1', 'doi_buoi'),
      ]).duoi,
    ).toBe(' — hủy 1 đổi buổi');
  });
});
