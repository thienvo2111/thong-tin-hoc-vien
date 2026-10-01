import { canhBaoBuoiHocGiaiDoan } from './canh-bao-buoi-hoc.util';

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
