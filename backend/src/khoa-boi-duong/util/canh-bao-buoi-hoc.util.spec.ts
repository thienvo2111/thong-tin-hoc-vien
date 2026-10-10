import {
  canhBaoBuoiHocGiaiDoan,
  canhBaoChongCuaSoDiemDanh,
  canhBaoLoaiLopGiaiDoan,
  demBuoiZoomThieuLink,
} from './canh-bao-buoi-hoc.util';

// Giai đoạn @db.Date: Prisma trả 00:00 UTC của ngày.
const ngay = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
// Giờ Việt Nam -> Date (UTC+7).
const gioVn = (iso: string) => new Date(`${iso}:00.000+07:00`);

const giaiDoanZoom = {
  thu_tu: 2,
  ten_giai_doan: 'Học trực tuyến qua zoom',
  hinh_thuc: 'truc_tuyen' as const,
  thoi_gian_bat_dau: ngay('2026-10-17'),
  thoi_gian_ket_thuc: ngay('2026-11-08'),
};

describe('canhBaoBuoiHocGiaiDoan', () => {
  it('buổi zoom trong khoảng giai đoạn trực tuyến -> không cảnh báo', () => {
    expect(
      canhBaoBuoiHocGiaiDoan(
        'zoom',
        {
          bat_dau: gioVn('2026-10-17T13:00'),
          ket_thuc: gioVn('2026-10-17T17:00'),
        },
        giaiDoanZoom,
      ),
    ).toBeUndefined();
  });

  it('biên: 00:00 ngày đầu và 23:59 ngày cuối (giờ VN) vẫn nằm trong giai đoạn', () => {
    expect(
      canhBaoBuoiHocGiaiDoan(
        'vle',
        {
          bat_dau: gioVn('2026-10-17T00:00'),
          ket_thuc: gioVn('2026-11-08T23:59'),
        },
        giaiDoanZoom,
      ),
    ).toBeUndefined();
  });

  it('bắt đầu trước ngày đầu giai đoạn -> cảnh báo ngoài khoảng thời gian, kèm tên giai đoạn', () => {
    const msg = canhBaoBuoiHocGiaiDoan(
      'zoom',
      {
        bat_dau: gioVn('2026-10-16T23:00'),
        ket_thuc: gioVn('2026-10-17T10:00'),
      },
      giaiDoanZoom,
    );
    expect(msg).toContain('ngoài khoảng thời gian');
    expect(msg).toContain('giai đoạn 2 "Học trực tuyến qua zoom"');
  });

  it('kết thúc sau ngày cuối giai đoạn -> cảnh báo', () => {
    expect(
      canhBaoBuoiHocGiaiDoan(
        'zoom',
        {
          bat_dau: gioVn('2026-11-08T20:00'),
          ket_thuc: gioVn('2026-11-09T00:30'),
        },
        giaiDoanZoom,
      ),
    ).toContain('ngoài khoảng thời gian');
  });

  it('lớp trực tiếp gắn vào giai đoạn trực tuyến -> cảnh báo sai hình thức', () => {
    expect(
      canhBaoBuoiHocGiaiDoan(
        'truc_tiep',
        {
          bat_dau: gioVn('2026-10-20T08:00'),
          ket_thuc: gioVn('2026-10-20T17:00'),
        },
        giaiDoanZoom,
      ),
    ).toContain('lớp trực tiếp nhưng giai đoạn là trực tuyến');
  });

  it('lớp zoom/vle gắn vào giai đoạn trực tiếp -> cảnh báo sai hình thức', () => {
    expect(
      canhBaoBuoiHocGiaiDoan(
        'vle',
        {
          bat_dau: gioVn('2026-10-20T08:00'),
          ket_thuc: gioVn('2026-10-20T17:00'),
        },
        { ...giaiDoanZoom, hinh_thuc: 'truc_tiep' },
      ),
    ).toContain('lớp vle nhưng giai đoạn là trực tiếp');
  });

  it('giai đoạn đánh giá + ngoài khoảng (đúng ca lệch số thật: zoom gắn vào GĐ1) -> gộp cả 2 lý do', () => {
    const msg = canhBaoBuoiHocGiaiDoan(
      'zoom',
      {
        bat_dau: gioVn('2026-10-17T13:00'),
        ket_thuc: gioVn('2026-10-17T17:00'),
      },
      {
        thu_tu: 1,
        ten_giai_doan: 'Đánh giá đầu vào',
        hinh_thuc: 'danh_gia',
        thoi_gian_bat_dau: ngay('2026-10-06'),
        thoi_gian_ket_thuc: ngay('2026-10-10'),
      },
    );
    expect(msg).toContain('ngoài khoảng thời gian');
    expect(msg).toContain('giai đoạn là đánh giá');
  });

  it('giai đoạn hình thức "khac" -> không cảnh báo về hình thức', () => {
    expect(
      canhBaoBuoiHocGiaiDoan(
        'truc_tiep',
        {
          bat_dau: gioVn('2026-10-20T08:00'),
          ket_thuc: gioVn('2026-10-20T17:00'),
        },
        { ...giaiDoanZoom, hinh_thuc: 'khac' },
      ),
    ).toBeUndefined();
  });
});

describe('canhBaoLoaiLopGiaiDoan', () => {
  it.each([
    ['zoom', 'truc_tuyen', undefined],
    ['truc_tiep', 'truc_tiep', undefined],
    ['truc_tiep', 'khac', undefined],
    ['truc_tiep', 'truc_tuyen', 'lớp trực tiếp nhưng giai đoạn là trực tuyến'],
    ['vle', 'truc_tiep', 'lớp vle nhưng giai đoạn là trực tiếp'],
    ['zoom', 'danh_gia', 'giai đoạn là đánh giá, không phải giai đoạn học'],
  ] as const)('%s + %s -> %s', (loai, hinhThuc, mongDoi) => {
    expect(canhBaoLoaiLopGiaiDoan(loai, hinhThuc)).toBe(mongDoi);
  });
});

describe('canhBaoChongCuaSoDiemDanh (ADR 0005 §9)', () => {
  const macDinh = { diem_danh_mo_truoc_phut: 30, diem_danh_dong_sau_phut: 120 };
  const buoi = (buoi_so: number, gio: string) => ({
    buoi_so,
    thoi_gian_bat_dau: gioVn(gio),
  });

  it('không có buổi khác -> không cảnh báo', () => {
    expect(
      canhBaoChongCuaSoDiemDanh(gioVn('2026-10-20T08:00'), [], macDinh),
    ).toEqual([]);
  });

  it('sáng 08:00, chiều 13:30 (mặc định 30/120) -> không chồng', () => {
    expect(
      canhBaoChongCuaSoDiemDanh(
        gioVn('2026-10-20T08:00'),
        [buoi(2, '2026-10-20T13:30')],
        macDinh,
      ),
    ).toEqual([]);
  });

  it('cách nhau 2 giờ (< 150 phút) -> chồng, nêu buổi + giờ VN', () => {
    expect(
      canhBaoChongCuaSoDiemDanh(
        gioVn('2026-10-20T08:00'),
        [buoi(2, '2026-10-20T10:00')],
        macDinh,
      ),
    ).toEqual([
      'Cửa sổ điểm danh Zoom chồng với buổi 2 (20/10/2026 10:00) cùng lớp — học viên dễ bấm nhầm buổi',
    ]);
  });

  it('biên: lệch đúng mở + đóng -> chỉ chạm, không chồng; lệch kém 1 phút -> chồng', () => {
    const batDau = gioVn('2026-10-20T08:00');
    expect(
      canhBaoChongCuaSoDiemDanh(batDau, [buoi(2, '2026-10-20T10:30')], macDinh),
    ).toEqual([]);
    expect(
      canhBaoChongCuaSoDiemDanh(batDau, [buoi(2, '2026-10-20T10:29')], macDinh),
    ).toHaveLength(1);
  });

  it('buổi khác nằm TRƯỚC cũng tính; nhiều buổi chồng -> sắp theo giờ', () => {
    const kq = canhBaoChongCuaSoDiemDanh(
      gioVn('2026-10-20T08:00'),
      [
        buoi(3, '2026-10-20T09:00'),
        buoi(1, '2026-10-20T07:00'),
        buoi(9, '2026-10-21T08:00'),
      ],
      macDinh,
    );
    expect(kq).toHaveLength(2);
    expect(kq[0]).toContain('buổi 1');
    expect(kq[1]).toContain('buổi 3');
  });

  it('dùng cấu hình khóa: cửa sổ hẹp 0/15 -> buổi cách 20 phút không chồng', () => {
    expect(
      canhBaoChongCuaSoDiemDanh(
        gioVn('2026-10-20T08:00'),
        [buoi(2, '2026-10-20T08:20')],
        { diem_danh_mo_truoc_phut: 0, diem_danh_dong_sau_phut: 15 },
      ),
    ).toEqual([]);
  });
});

describe('demBuoiZoomThieuLink (ADR 0005 §9)', () => {
  const now = gioVn('2026-10-20T08:00');
  const b = (gio: string, link: string | null) => ({
    thoi_gian_bat_dau: gioVn(gio),
    dia_diem_hoac_link: link,
  });

  it('chỉ đếm buổi lớp Zoom, sau now, link null/rỗng/khoảng trắng', () => {
    expect(
      demBuoiZoomThieuLink(
        [
          {
            loai_lop: 'zoom',
            lich_hoc: [
              b('2026-10-21T08:00', null),
              b('2026-10-21T13:30', '   '),
              b('2026-10-22T08:00', ''),
              b('2026-10-22T13:30', 'https://zoom.us/j/1'),
              b('2026-10-19T08:00', null), // đã qua
              b('2026-10-20T08:00', null), // đúng now -> không tính
            ],
          },
          { loai_lop: 'truc_tiep', lich_hoc: [b('2026-10-21T08:00', null)] },
          { loai_lop: 'vle', lich_hoc: [b('2026-10-21T08:00', null)] },
        ],
        now,
      ),
    ).toBe(3);
  });

  it('không có lớp -> 0', () => {
    expect(demBuoiZoomThieuLink([], now)).toBe(0);
  });
});
