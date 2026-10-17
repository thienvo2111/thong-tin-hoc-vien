import { EmailLichDayService } from './email-lich-day.service';
import { PrismaService } from '../prisma/prisma.service';
import { NhatKyService } from '../nhat-ky/nhat-ky.service';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { NotFoundAppException } from '../common/exceptions/app.exceptions';

// ADR 0009: 1 email / (khóa × giai đoạn × giảng viên), gom buổi qua mọi lớp;
// mỗi email = 1 dòng hàng đợi + 1 dòng nhat_ky_nhac_lich trỏ về nó.

const t = (iso: string) => new Date(iso);
const GUI_TRUOC = t('2026-10-17T02:15:00Z');

type Gv = {
  id: string;
  ho_ten: string;
  email: string | null;
  tai_khoan: { trang_thai: 'active' | 'inactive' } | null;
};
const gv = (id: string, ghiDe: Partial<Gv> = {}): Gv => ({
  id,
  ho_ten: `GV ${id}`,
  email: `${id}@hcmue.edu.vn`,
  tai_khoan: null,
  ...ghiDe,
});

const buoi = (
  id: string,
  lop: { id: string; ten: string; loai?: 'truc_tiep' | 'zoom' },
  batDau: string,
  phanCong: { gv: Gv; vai_tro?: 'giang_vien' | 'ho_tro' }[],
  capNhat = '2026-10-10T00:00:00Z',
) => ({
  id,
  lop_id: lop.id,
  buoi_so: Number(id.replace(/\D/g, '')) || 1,
  thoi_gian_bat_dau: t(batDau),
  thoi_gian_ket_thuc: new Date(t(batDau).getTime() + 2 * 3600 * 1000),
  dia_diem_hoac_link: null,
  phong: null,
  cap_nhat_luc: t(capNhat),
  lop: { ten_lop: lop.ten, loai_lop: lop.loai ?? 'truc_tiep' },
  diem_hoc: { ten: 'THPT Long Xuyên', dia_chi: '12 Trần Hưng Đạo' },
  phan_cong: phanCong.map((p) => ({
    giang_vien_id: p.gv.id,
    vai_tro: p.vai_tro ?? 'giang_vien',
    giang_vien: p.gv,
  })),
});

const LOP_A = { id: 'lA', ten: 'TT-03' };
const LOP_B = { id: 'lB', ten: 'Zoom-07', loai: 'zoom' as const };

describe('EmailLichDayService', () => {
  let prisma: any;
  let tx: any;
  let nhatKy: { ghi: jest.Mock };
  let service: EmailLichDayService;
  const user = { id: 'u1', vai_tro: 'ho_tro_giang_vien' } as AuthenticatedUser;

  beforeEach(() => {
    let soHangDoi = 0;
    tx = {
      hang_doi_email: {
        create: jest.fn(() => Promise.resolve({ id: `hd${++soHangDoi}` })),
      },
      nhat_ky_nhac_lich: { create: jest.fn().mockResolvedValue({ id: 'nk' }) },
    };
    prisma = {
      giai_doan_khoa: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'gd2',
          khoa_id: 'k1',
          ten_giai_doan: 'Giai đoạn 2',
          hinh_thuc: 'truc_tiep',
          thoi_gian_bat_dau: t('2026-10-24T00:00:00Z'),
          thoi_gian_ket_thuc: t('2026-10-30T00:00:00Z'),
          khoa: { ma_khoa: 'AG-2026-01', ten_khoa: 'NLS An Giang' },
        }),
      },
      lich_hoc_lop: { findMany: jest.fn().mockResolvedValue([]) },
      nhat_ky_nhac_lich: { findMany: jest.fn().mockResolvedValue([]) },
      hau_can_giang_vien: { findMany: jest.fn().mockResolvedValue([]) },
      nhan_su_thuc_dia: { findMany: jest.fn().mockResolvedValue([]) },
      phan_cong_ho_tro_gv: {
        findMany: jest
          .fn()
          .mockResolvedValue([
            { nguoi_dung: { ho_ten: 'Lê Văn C', email: 'c@hcmue.edu.vn' } },
          ]),
      },
      giang_vien: { findMany: jest.fn().mockResolvedValue([]) },
      $transaction: jest.fn((fn: (t: unknown) => unknown) => fn(tx)),
    };
    nhatKy = { ghi: jest.fn().mockResolvedValue(undefined) };
    service = new EmailLichDayService(
      prisma as PrismaService,
      nhatKy as unknown as NhatKyService,
    );
  });

  describe('danhSach', () => {
    it('đếm buổi/lớp theo giảng viên, lọc đúng giai đoạn + khóa + lớp đang hoạt động', async () => {
      const a = gv('a');
      const b = gv('b');
      prisma.lich_hoc_lop.findMany.mockResolvedValue([
        buoi('x1', LOP_A, '2026-10-24T00:30:00Z', [{ gv: a }, { gv: b }]),
        buoi('x2', LOP_A, '2026-10-24T06:30:00Z', [{ gv: a }]),
        buoi('y1', LOP_B, '2026-10-28T12:00:00Z', [{ gv: a }]),
      ]);
      const kq = await service.danhSach('k1', 'gd2');
      expect(prisma.lich_hoc_lop.findMany.mock.calls[0][0].where).toEqual({
        giai_doan_id: 'gd2',
        lop: { khoa_id: 'k1', trang_thai: 'active' },
      });
      expect(kq.giai_doan.ten_giai_doan).toBe('Giai đoạn 2');
      const dongA = kq.giang_vien.find((g) => g.id === 'a')!;
      const dongB = kq.giang_vien.find((g) => g.id === 'b')!;
      expect([dongA.so_buoi, dongA.so_lop]).toEqual([3, 2]);
      expect([dongB.so_buoi, dongB.so_lop]).toEqual([1, 1]);
      expect(dongA.trang_thai_nhac).toBe('chua_nhac');
      expect(dongA.email_cuoi).toBeNull();
    });

    it('trạng thái nhắc gộp mọi kênh; email_cuoi lấy lần gửi email mới nhất', async () => {
      const a = gv('a');
      prisma.lich_hoc_lop.findMany.mockResolvedValue([
        buoi('x1', LOP_A, '2026-10-24T00:30:00Z', [{ gv: a }]),
        // Sửa SAU lần gửi email → cần nhắc lại.
        buoi(
          'x2',
          LOP_A,
          '2026-10-24T06:30:00Z',
          [{ gv: a }],
          '2026-10-18T00:00:00Z',
        ),
      ]);
      prisma.nhat_ky_nhac_lich.findMany.mockResolvedValue([
        {
          giang_vien_id: 'a',
          lich_hoc_ids: ['x1', 'x2'],
          gui_luc: GUI_TRUOC,
          hang_doi_email_id: 'hd9',
          hang_doi_email: { trang_thai: 'that_bai', loi: 'SMTP 550' },
        },
      ]);
      const [dong] = (await service.danhSach('k1', 'gd2')).giang_vien;
      expect(dong.trang_thai_nhac).toBe('can_nhac_lai');
      expect(dong.email_cuoi).toEqual({
        gui_luc: GUI_TRUOC,
        trang_thai: 'that_bai',
        loi: 'SMTP 550',
      });
    });

    it('giai đoạn thuộc khóa khác → 404', async () => {
      prisma.giai_doan_khoa.findUnique.mockResolvedValue({
        id: 'gd2',
        khoa_id: 'k-khac',
      });
      await expect(service.danhSach('k1', 'gd2')).rejects.toBeInstanceOf(
        NotFoundAppException,
      );
    });
  });

  describe('xemTruoc', () => {
    it('vai trò hiển thị theo từng lớp', async () => {
      const a = gv('a');
      prisma.lich_hoc_lop.findMany.mockResolvedValue([
        buoi('x1', LOP_A, '2026-10-24T00:30:00Z', [
          { gv: a, vai_tro: 'giang_vien' },
        ]),
        buoi('y1', LOP_B, '2026-10-28T12:00:00Z', [
          { gv: a, vai_tro: 'ho_tro' },
        ]),
      ]);
      const { html, la_cap_nhat, tieu_de } = await service.xemTruoc(
        'k1',
        'gd2',
        'a',
      );
      expect(la_cap_nhat).toBe(false);
      expect(tieu_de).toBe(
        '[BDNLS] Lịch giảng dạy Giai đoạn 2 – khóa AG-2026-01',
      );
      expect(html).toContain('Vai trò: Giảng viên');
      expect(html).toContain('Vai trò: Hỗ trợ');
      expect(html).toContain('Lê Văn C');
    });

    it('chỉ có nhật ký Zalo → vẫn là bản 5a', async () => {
      const a = gv('a');
      prisma.lich_hoc_lop.findMany.mockResolvedValue([
        buoi('x1', LOP_A, '2026-10-24T00:30:00Z', [{ gv: a }]),
      ]);
      prisma.nhat_ky_nhac_lich.findMany.mockResolvedValue([
        {
          giang_vien_id: 'a',
          lich_hoc_ids: ['x1'],
          gui_luc: GUI_TRUOC,
          hang_doi_email_id: null,
          hang_doi_email: null,
        },
      ]);
      expect((await service.xemTruoc('k1', 'gd2', 'a')).la_cap_nhat).toBe(
        false,
      );
    });

    it('5b: buổi sửa sau lần gửi / buổi mới có huy hiệu, buổi bị gỡ được liệt kê', async () => {
      const a = gv('a');
      const b = gv('b');
      prisma.lich_hoc_lop.findMany.mockResolvedValue([
        buoi('x1', LOP_A, '2026-10-24T00:30:00Z', [{ gv: a }]),
        buoi(
          'x2',
          LOP_A,
          '2026-10-24T06:30:00Z',
          [{ gv: a }],
          '2026-10-18T00:00:00Z',
        ),
        buoi('x3', LOP_A, '2026-10-25T00:30:00Z', [{ gv: a }]), // mới, chưa có trong email cũ
        buoi('x4', LOP_A, '2026-10-25T06:30:00Z', [{ gv: b }]), // đã chuyển cho GV khác
      ]);
      prisma.nhat_ky_nhac_lich.findMany.mockResolvedValue([
        {
          giang_vien_id: 'a',
          lich_hoc_ids: ['x1', 'x2', 'x4'],
          gui_luc: GUI_TRUOC,
          hang_doi_email_id: 'hd9',
          hang_doi_email: { trang_thai: 'thanh_cong', loi: null },
        },
      ]);
      const { html, la_cap_nhat, tieu_de } = await service.xemTruoc(
        'k1',
        'gd2',
        'a',
      );
      expect(la_cap_nhat).toBe(true);
      expect(tieu_de).toContain('Cập nhật lịch giảng dạy');
      expect(html.split('>Có thay đổi</span>').length - 1).toBe(2);
      expect(html).toContain('Không còn trong lịch của Thầy/Cô');
      expect(html).toContain('TT-03 – Buổi 4');
    });

    it('nút Cổng giảng viên chỉ khi tài khoản đang hoạt động', async () => {
      prisma.lich_hoc_lop.findMany.mockResolvedValue([
        buoi('x1', LOP_A, '2026-10-24T00:30:00Z', [
          { gv: gv('a', { tai_khoan: { trang_thai: 'active' } }) },
          { gv: gv('b', { tai_khoan: { trang_thai: 'inactive' } }) },
          { gv: gv('c') },
        ]),
      ]);
      expect((await service.xemTruoc('k1', 'gd2', 'a')).html).toContain(
        '/giang-day"',
      );
      expect((await service.xemTruoc('k1', 'gd2', 'b')).html).not.toContain(
        '/giang-day"',
      );
      expect((await service.xemTruoc('k1', 'gd2', 'c')).html).not.toContain(
        '/giang-day"',
      );
    });

    it('giảng viên không có buổi trong giai đoạn → 404', async () => {
      await expect(service.xemTruoc('k1', 'gd2', 'z')).rejects.toBeInstanceOf(
        NotFoundAppException,
      );
    });
  });

  describe('gui', () => {
    it('mỗi người 1 dòng hàng đợi + 1 nhật ký nhắc trỏ về nó; ghi nhật ký hoạt động 1 lần', async () => {
      const a = gv('a', { email: '  a@hcmue.edu.vn ' });
      const b = gv('b');
      prisma.lich_hoc_lop.findMany.mockResolvedValue([
        buoi('x1', LOP_A, '2026-10-24T00:30:00Z', [{ gv: a }, { gv: b }]),
        buoi('y1', LOP_B, '2026-10-28T12:00:00Z', [{ gv: a }]),
      ]);
      const kq = await service.gui(user, 'k1', 'gd2', ['a', 'b']);
      expect(kq).toEqual({ da_xep_hang: 2, bo_qua: [] });
      expect(tx.hang_doi_email.create).toHaveBeenCalledTimes(2);
      const hd = tx.hang_doi_email.create.mock.calls[0][0].data;
      expect(hd).toMatchObject({
        loai_su_kien: 'nhac_lich_giang_vien',
        hoc_vien_id: null,
        email_nguoi_nhan: 'a@hcmue.edu.vn',
        tieu_de: '[BDNLS] Lịch giảng dạy Giai đoạn 2 – khóa AG-2026-01',
      });
      expect(hd.noi_dung_html).toContain('<!DOCTYPE html>');
      const nk = tx.nhat_ky_nhac_lich.create.mock.calls[0][0].data;
      expect(nk).toMatchObject({
        doi_tuong: 'giang_vien',
        giang_vien_id: 'a',
        hang_doi_email_id: 'hd1',
        nguoi_gui: 'u1',
      });
      expect(nk.lich_hoc_ids).toEqual(['x1', 'y1']);
      expect(nk.noi_dung.startsWith('[BDNLS] Lịch giảng dạy')).toBe(true);
      expect(nk.noi_dung).toContain('Zoom-07 – Buổi 1');
      expect(nhatKy.ghi).toHaveBeenCalledTimes(1);
      expect(nhatKy.ghi).toHaveBeenCalledWith(
        expect.objectContaining({
          hanh_dong: 'ho_tro_gv_gui_email_lich_day',
          chi_tiet: { khoa_id: 'k1', giai_doan_id: 'gd2', so_nguoi: 2 },
        }),
      );
    });

    it('không email / email toàn khoảng trắng / không có buổi → bỏ qua, người khác vẫn gửi', async () => {
      const a = gv('a', { email: null });
      const b = gv('b', { email: '   ' });
      const c = gv('c');
      prisma.lich_hoc_lop.findMany.mockResolvedValue([
        buoi('x1', LOP_A, '2026-10-24T00:30:00Z', [
          { gv: a },
          { gv: b },
          { gv: c },
        ]),
      ]);
      prisma.giang_vien.findMany.mockResolvedValue([
        { id: 'z', ho_ten: 'GV z' },
      ]);
      const kq = await service.gui(user, 'k1', 'gd2', ['a', 'b', 'c', 'z']);
      expect(kq.da_xep_hang).toBe(1);
      expect(kq.bo_qua).toEqual([
        { giang_vien_id: 'a', ho_ten: 'GV a', ly_do: 'khong_co_email' },
        { giang_vien_id: 'b', ho_ten: 'GV b', ly_do: 'khong_co_email' },
        { giang_vien_id: 'z', ho_ten: 'GV z', ly_do: 'khong_co_buoi' },
      ]);
      expect(tx.hang_doi_email.create).toHaveBeenCalledTimes(1);
    });

    it('lỗi transaction của 1 người → người đó vào bo_qua (loi_he_thong), người khác vẫn gửi', async () => {
      const ds = ['a', 'b', 'c'].map((id) => gv(id));
      prisma.lich_hoc_lop.findMany.mockResolvedValue([
        buoi(
          'x1',
          LOP_A,
          '2026-10-24T00:30:00Z',
          ds.map((g) => ({ gv: g })),
        ),
      ]);
      prisma.$transaction
        .mockImplementationOnce((fn: (t: unknown) => unknown) => fn(tx))
        .mockRejectedValueOnce(new Error('deadlock'))
        .mockImplementationOnce((fn: (t: unknown) => unknown) => fn(tx));
      const kq = await service.gui(user, 'k1', 'gd2', ['a', 'b', 'c']);
      expect(kq.da_xep_hang).toBe(2);
      expect(kq.bo_qua).toEqual([
        { giang_vien_id: 'b', ho_ten: 'GV b', ly_do: 'loi_he_thong' },
      ]);
      // Hàng đợi + nhật ký chỉ ghi qua tx (cùng transaction), không qua prisma gốc.
      expect(prisma.hang_doi_email).toBeUndefined();
    });

    it('không ai được xếp hàng → không ghi nhật ký hoạt động', async () => {
      prisma.giang_vien.findMany.mockResolvedValue([
        { id: 'z', ho_ten: 'GV z' },
      ]);
      const kq = await service.gui(user, 'k1', 'gd2', ['z']);
      expect(kq.da_xep_hang).toBe(0);
      expect(nhatKy.ghi).not.toHaveBeenCalled();
    });
  });
});
