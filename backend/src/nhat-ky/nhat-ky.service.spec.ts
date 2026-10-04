import { PrismaService } from '../prisma/prisma.service';
import { NotFoundAppException } from '../common/exceptions/app.exceptions';
import { NhatKyService } from './nhat-ky.service';
import { nguCanhNhatKy } from './nhat-ky.context';

describe('NhatKyService', () => {
  let prisma: Record<string, Record<string, jest.Mock>>;
  let service: NhatKyService;

  beforeEach(() => {
    const rong = () => jest.fn().mockResolvedValue([]);
    prisma = {
      nhat_ky_hoat_dong: {
        create: jest.fn().mockResolvedValue({}),
        findMany: rong(),
      },
      hoc_vien: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ id: 'hv-1', ho_ten: 'Nguyễn A' }),
      },
      lich_su_thay_doi_ho_so: { findMany: rong() },
      xac_nhan_ho_so: { findMany: rong() },
      ma_sso_mot_lan: { findMany: rong() },
      tai_khoan_vle: { findUnique: jest.fn().mockResolvedValue(null) },
      nhat_ky_thong_bao: { findMany: rong() },
      nhat_ky_dat_lai_mat_khau: { findMany: rong() },
      yeu_cau_ho_tro: { findMany: rong() },
      nguoi_dung: { findMany: rong() },
    };
    service = new NhatKyService(prisma as unknown as PrismaService);
  });

  describe('ghi', () => {
    it('lấy IP, thiết bị, người thực hiện từ ngữ cảnh request; mo_ta gộp vào chi_tiet', async () => {
      await nguCanhNhatKy.run(
        {
          ip: '1.2.3.4',
          thietBi: 'Zalo',
          nguoiDung: { id: 'nd-qt', vai_tro: 'quan_tri' },
        },
        () =>
          service.ghi({
            hanh_dong: 'phan_lop',
            hoc_vien_id: 'hv-1',
            mo_ta: 'A → B',
            chi_tiet: { nguon: 'thu_cong' },
          }),
      );
      expect(prisma.nhat_ky_hoat_dong.create).toHaveBeenCalledWith({
        data: {
          hanh_dong: 'phan_lop',
          hoc_vien_id: 'hv-1',
          nguoi_dung_id: 'nd-qt',
          vai_tro: 'quan_tri',
          chi_tiet: { mo_ta: 'A → B', nguon: 'thu_cong' },
          ip: '1.2.3.4',
          thiet_bi: 'Zalo',
        },
      });
    });

    it('truyền nguoi_dung tường minh (lúc đăng nhập, chưa xác thực) -> ưu tiên hơn ngữ cảnh', async () => {
      await nguCanhNhatKy.run(
        { ip: '5.6.7.8', thietBi: null, nguoiDung: null },
        () =>
          service.ghi({
            hanh_dong: 'dang_nhap_thanh_cong',
            hoc_vien_id: 'hv-1',
            nguoi_dung: { id: 'nd-hv', vai_tro: 'hoc_vien' },
          }),
      );
      const data = prisma.nhat_ky_hoat_dong.create.mock.calls[0][0].data;
      expect(data).toMatchObject({
        nguoi_dung_id: 'nd-hv',
        vai_tro: 'hoc_vien',
        ip: '5.6.7.8',
      });
    });

    it('ngoài request (không có ngữ cảnh) -> vẫn ghi, IP/người thực hiện để trống', async () => {
      await service.ghi({ hanh_dong: 'doi_cum', hoc_vien_id: 'hv-1' });
      const data = prisma.nhat_ky_hoat_dong.create.mock.calls[0][0].data;
      expect(data).toMatchObject({
        nguoi_dung_id: null,
        ip: null,
        thiet_bi: null,
        chi_tiet: undefined,
      });
    });

    it('DB lỗi khi ghi -> KHÔNG ném lỗi (không làm hỏng thao tác chính)', async () => {
      prisma.nhat_ky_hoat_dong.create.mockRejectedValue(new Error('db down'));
      await expect(
        service.ghi({ hanh_dong: 'doi_mat_khau' }),
      ).resolves.toBeUndefined();
    });
  });

  describe('dongThoiGian', () => {
    it('học viên không tồn tại -> NotFound', async () => {
      prisma.hoc_vien.findUnique.mockResolvedValue(null);
      await expect(service.dongThoiGian('hv-x')).rejects.toBeInstanceOf(
        NotFoundAppException,
      );
    });

    it('không có dữ liệu -> danh sách rỗng', async () => {
      const kq = await service.dongThoiGian('hv-1');
      expect(kq).toEqual({
        hoc_vien: { id: 'hv-1', ho_ten: 'Nguyễn A' },
        muc: [],
      });
    });

    it('gộp mọi nguồn, sắp xếp mới nhất trước, kèm người thực hiện + IP', async () => {
      const t = (h: number) => new Date(Date.UTC(2026, 9, 1, h));
      prisma.nhat_ky_hoat_dong.findMany.mockResolvedValue([
        {
          id: 'nk-1',
          thoi_gian: t(1),
          hanh_dong: 'dang_nhap_thanh_cong',
          nguoi_dung_id: 'nd-hv',
          chi_tiet: null,
          ip: '1.1.1.1',
          thiet_bi: 'Zalo',
        },
        {
          id: 'nk-2',
          thoi_gian: t(6),
          hanh_dong: 'cap_nhat_muc_danh_gia',
          nguoi_dung_id: null,
          chi_tiet: {
            mo_ta: 'Khóa A — Đầu vào: (chưa có) → Cơ bản (nhập file)',
          },
          ip: null,
          thiet_bi: null,
        },
      ]);
      prisma.nguoi_dung.findMany.mockResolvedValue([
        { id: 'nd-hv', ho_ten: 'Nguyễn A', vai_tro: 'hoc_vien' },
      ]);
      prisma.lich_su_thay_doi_ho_so.findMany.mockResolvedValue([
        {
          id: 'ls-1',
          sua_luc: t(2),
          truong: 'so_dien_thoai',
          gia_tri_cu: null,
          gia_tri_moi: '0909',
          nguoi_sua: { ho_ten: 'Nguyễn A', vai_tro: 'hoc_vien' },
        },
      ]);
      prisma.xac_nhan_ho_so.findMany.mockResolvedValue([
        {
          id: 'xn-1',
          xac_nhan_luc: t(3),
          con_hieu_luc: false,
          dot: { ten: 'Đợt 1' },
        },
      ]);
      prisma.ma_sso_mot_lan.findMany.mockResolvedValue([
        { id: 'sso-1', da_dung_luc: t(4), target: 'dau-ra' },
      ]);
      prisma.nhat_ky_thong_bao.findMany.mockResolvedValue([
        {
          id: 'tb-1',
          gui_luc: t(5),
          trang_thai: 'that_bai',
          tieu_de: 'Xác nhận',
          email_nguoi_nhan: 'a@x',
          loi: 'SMTP',
        },
      ]);
      prisma.yeu_cau_ho_tro.findMany.mockResolvedValue([
        {
          id: 'yc-1',
          thoi_gian_tao: t(7),
          thoi_gian_phan_hoi: t(8),
          thoi_gian_dong: null,
          tinh_huong: 'Không đăng nhập được',
          noi_dung_hoi: '...',
        },
      ]);

      const { muc } = await service.dongThoiGian('hv-1');

      expect(muc.map((m) => m.tieu_de)).toEqual([
        'Yêu cầu hỗ trợ được trả lời',
        'Gửi yêu cầu hỗ trợ',
        'Cập nhật kết quả đánh giá năng lực',
        'Gửi email thất bại',
        'Hệ thống khảo sát đã tiếp nhận học viên',
        'Xác nhận hồ sơ',
        'Sửa hồ sơ',
        'Đăng nhập thành công',
      ]);
      const dangNhap = muc.at(-1)!;
      expect(dangNhap).toMatchObject({
        nguoi_thuc_hien: 'Nguyễn A (học viên)',
        ip: '1.1.1.1',
        thiet_bi: 'Zalo',
      });
      const suaHoSo = muc.find((m) => m.id === 'ls-1')!;
      expect(suaHoSo).toMatchObject({
        truong: 'so_dien_thoai',
        noi_dung: '(trống) → 0909',
        nhom: 'ho_so',
      });
      expect(muc.find((m) => m.id === 'xn-1')!.noi_dung).toContain(
        'đã hết hiệu lực',
      );
      expect(muc.find((m) => m.id === 'tb-1')!.noi_dung).toContain('lỗi: SMTP');
      expect(muc.find((m) => m.id === 'nk-2')!.noi_dung).toBe(
        'Khóa A — Đầu vào: (chưa có) → Cơ bản (nhập file)',
      );
    });
  });
});
