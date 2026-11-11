import { VleService } from './vle.service';
import {
  VleChuaCauHinhException,
  VleChuaCoTaiKhoanException,
  VleChuaMoException,
} from '../common/exceptions/app.exceptions';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';

const ENV_KEYS = ['VLE_LOGIN_KEY', 'VLE_LOGIN_URL', 'VLE_COURSE_MAP'] as const;

describe('VleService — Vào học VLE (external-login P.CNTT)', () => {
  const envGoc: Record<string, string | undefined> = {};
  const caller = { hoc_vien_id: 'hv-1' } as AuthenticatedUser;
  const nhatKy = { ghi: jest.fn().mockResolvedValue(undefined) };

  beforeEach(() => {
    ENV_KEYS.forEach((k) => (envGoc[k] = process.env[k]));
    jest.clearAllMocks();
  });

  afterEach(() => {
    ENV_KEYS.forEach((k) => {
      if (envGoc[k] === undefined) delete process.env[k];
      else process.env[k] = envGoc[k];
    });
  });

  // Dòng nhat_ky_hoat_dong giả lập — groupBy lọc đúng hanh_dong + hoc_vien_id
  // như truy vấn thật để kiểm tra chỉ đếm 'vao_hoc_vle' của CHÍNH học viên.
  interface DongNhatKy {
    hanh_dong: string;
    hoc_vien_id: string | null;
    thoi_gian: Date;
  }

  function taoPrisma(opts: {
    dangNhap?: { username: string | null; email_chup: string | null } | null;
    dangKy?: unknown;
    nhatKy?: DongNhatKy[];
  }) {
    const dongNhatKy = opts.nhatKy ?? [];
    return {
      dang_nhap_vle: {
        findUnique: jest.fn().mockResolvedValue(opts.dangNhap ?? null),
      },
      // Mặc định: có đăng ký khóa đã duyệt, khóa BẬT mo_vao_hoc_vle, chưa có
      // mức VLE. Truyền dangKy: null = không có đăng ký khóa đã duyệt nào.
      dang_ky_hoc: {
        findFirst: jest
          .fn()
          .mockResolvedValue('dangKy' in opts ? opts.dangKy : taoDangKyVle(null)),
      },
      nhat_ky_hoat_dong: {
        groupBy: jest.fn(
          ({ where }: { where: { hanh_dong: string; hoc_vien_id: { in: string[] } } }) => {
            const khop = dongNhatKy.filter(
              (d) =>
                d.hanh_dong === where.hanh_dong &&
                d.hoc_vien_id !== null &&
                where.hoc_vien_id.in.includes(d.hoc_vien_id),
            );
            const ids = [...new Set(khop.map((d) => d.hoc_vien_id))];
            return Promise.resolve(
              ids.map((id) => {
                const cua = khop.filter((d) => d.hoc_vien_id === id);
                return {
                  hoc_vien_id: id,
                  _count: { _all: cua.length },
                  _max: {
                    thoi_gian: new Date(Math.max(...cua.map((d) => d.thoi_gian.getTime()))),
                  },
                };
              }),
            );
          },
        ),
      },
    };
  }

  function taoDangKyVle(mucNangLuc: string | null, moVaoHocVle = true) {
    const homNay = new Date();
    return {
      muc_dau_vao: null,
      khoa: {
        mo_vao_hoc_vle: moVaoHocVle,
        giai_doan: [
          {
            id: 'gd-1',
            ten_giai_doan: 'GĐ1',
            thu_tu: 1,
            thoi_gian_bat_dau: homNay,
            thoi_gian_ket_thuc: homNay,
          },
        ],
      },
      phan_lop_giai_doan: [
        {
          giai_doan_id: 'gd-1',
          lop: { id: 'lop-1', ten_lop: 'VLE 1', muc_nang_luc: mucNangLuc },
        },
      ],
    };
  }

  it('VLE_LOGIN_KEY chưa cấu hình -> trangThai báo san_sang=false, co_khoa_hoc=false, không lộ key', async () => {
    delete process.env.VLE_LOGIN_KEY;
    const service = new VleService(taoPrisma({}) as never, nhatKy as never);
    const kq = await service.trangThai(caller);
    expect(kq).toEqual({
      mo: false,
      san_sang: false,
      ly_do: 'Chức năng vào học VLE chưa được cấu hình.',
      co_khoa_hoc: false,
      so_lan_vao: 0,
      lan_vao_gan_nhat: null,
    });
    expect('key' in kq).toBe(false);
  });

  it('VLE_LOGIN_KEY chưa cấu hình -> form() ném VleChuaCauHinhException (503)', async () => {
    delete process.env.VLE_LOGIN_KEY;
    const service = new VleService(taoPrisma({}) as never, nhatKy as never);
    await expect(service.form(caller, '1.2.3.4')).rejects.toBeInstanceOf(VleChuaCauHinhException);
    expect(nhatKy.ghi).not.toHaveBeenCalled();
  });

  it('có username -> ưu tiên username, email gửi rỗng', async () => {
    process.env.VLE_LOGIN_KEY = 'khoa-bi-mat';
    const service = new VleService(
      taoPrisma({ dangNhap: { username: 'nguyenvana', email_chup: 'a@x.com' } }) as never,
      nhatKy as never,
    );
    const kq = await service.form(caller, '1.2.3.4');
    expect(kq.fields.username).toBe('nguyenvana');
    expect(kq.fields.email).toBe('');
    expect(kq.fields.key).toBe('khoa-bi-mat');
  });

  it('không có username, có email -> fallback email, username rỗng', async () => {
    process.env.VLE_LOGIN_KEY = 'khoa-bi-mat';
    const service = new VleService(
      taoPrisma({ dangNhap: { username: null, email_chup: 'a@x.com' } }) as never,
      nhatKy as never,
    );
    const kq = await service.form(caller, '1.2.3.4');
    expect(kq.fields.email).toBe('a@x.com');
    expect(kq.fields.username).toBe('');
  });

  it('không có username lẫn email -> trangThai báo chưa sẵn sàng + lý do', async () => {
    process.env.VLE_LOGIN_KEY = 'khoa-bi-mat';
    const service = new VleService(taoPrisma({ dangNhap: null }) as never, nhatKy as never);
    const kq = await service.trangThai(caller);
    expect(kq.mo).toBe(true);
    expect(kq.san_sang).toBe(false);
    expect(kq.ly_do).toContain('Chưa có tài khoản VLE');
  });

  it('không có username lẫn email -> form() ném VleChuaCoTaiKhoanException (409)', async () => {
    process.env.VLE_LOGIN_KEY = 'khoa-bi-mat';
    const service = new VleService(taoPrisma({ dangNhap: null }) as never, nhatKy as never);
    await expect(service.form(caller, null)).rejects.toBeInstanceOf(VleChuaCoTaiKhoanException);
  });

  it('VLE_COURSE_MAP hợp lệ + mức lớp VLE khớp -> id_course được gửi', async () => {
    process.env.VLE_LOGIN_KEY = 'khoa-bi-mat';
    process.env.VLE_COURSE_MAP = 'co_ban:12,thanh_thao:13,nang_cao:14';
    const service = new VleService(
      taoPrisma({ dangNhap: { username: 'u1', email_chup: null }, dangKy: taoDangKyVle('thanh_thao') }) as never,
      nhatKy as never,
    );
    const kq = await service.form(caller, null);
    expect(kq.fields.id_course).toBe('13');
  });

  it('mức không có trong VLE_COURSE_MAP -> bỏ qua id_course (không gửi)', async () => {
    process.env.VLE_LOGIN_KEY = 'khoa-bi-mat';
    process.env.VLE_COURSE_MAP = 'co_ban:12'; // thiếu thanh_thao
    const service = new VleService(
      taoPrisma({ dangNhap: { username: 'u1', email_chup: null }, dangKy: taoDangKyVle('thanh_thao') }) as never,
      nhatKy as never,
    );
    const kq = await service.form(caller, null);
    expect(kq.fields.id_course).toBeUndefined();
  });

  it('khóa mở nhưng chưa có lớp VLE nào -> bỏ qua id_course, co_khoa_hoc=false', async () => {
    process.env.VLE_LOGIN_KEY = 'khoa-bi-mat';
    process.env.VLE_COURSE_MAP = 'co_ban:12,thanh_thao:13,nang_cao:14';
    const dangKy = { ...taoDangKyVle(null), phan_lop_giai_doan: [] };
    const service = new VleService(
      taoPrisma({ dangNhap: { username: 'u1', email_chup: null }, dangKy }) as never,
      nhatKy as never,
    );
    const kq = await service.trangThai(caller);
    expect(kq.co_khoa_hoc).toBe(false);
    const form = await service.form(caller, null);
    expect(form.fields.id_course).toBeUndefined();
  });

  it('ghi nhật ký khi thành công — không chứa key, có kiểu khớp + id_course', async () => {
    process.env.VLE_LOGIN_KEY = 'khoa-rat-bi-mat';
    process.env.VLE_COURSE_MAP = 'co_ban:12,thanh_thao:13,nang_cao:14';
    const service = new VleService(
      taoPrisma({ dangNhap: { username: 'u1', email_chup: null }, dangKy: taoDangKyVle('co_ban') }) as never,
      nhatKy as never,
    );
    await service.form(caller, '9.9.9.9');
    expect(nhatKy.ghi).toHaveBeenCalledTimes(1);
    const suKien = nhatKy.ghi.mock.calls[0][0];
    expect(suKien).toMatchObject({ hanh_dong: 'vao_hoc_vle', hoc_vien_id: 'hv-1' });
    expect(suKien.chi_tiet).toMatchObject({ khop_theo: 'username', id_course: 12, ip: '9.9.9.9' });
    expect(JSON.stringify(suKien)).not.toContain('khoa-rat-bi-mat');
  });

  it('trangThai() không bao giờ trả về key', async () => {
    process.env.VLE_LOGIN_KEY = 'khoa-khong-duoc-lo';
    const service = new VleService(
      taoPrisma({ dangNhap: { username: 'u1', email_chup: null } }) as never,
      nhatKy as never,
    );
    const kq = await service.trangThai(caller);
    expect(JSON.stringify(kq)).not.toContain('khoa-khong-duoc-lo');
  });
  // Công tắc theo khóa (2026-11-11): khoa_boi_duong.mo_vao_hoc_vle của khóa
  // ĐÃ DUYỆT gần nhất — cùng đăng ký dùng để tính id_course.
  describe('công tắc theo khóa (mo_vao_hoc_vle)', () => {
    const KHOA_CHUA_MO = 'Khóa học chưa mở vào học VLE.';

    it('khóa tắt -> mo=false, san_sang=false, lý do "chưa mở", KHÔNG tra tài khoản', async () => {
      process.env.VLE_LOGIN_KEY = 'khoa-bi-mat';
      const prisma = taoPrisma({
        dangNhap: { username: 'u1', email_chup: null },
        dangKy: taoDangKyVle('thanh_thao', false),
      });
      const kq = await new VleService(prisma as never, nhatKy as never).trangThai(caller);
      expect(kq).toEqual({
        mo: false,
        san_sang: false,
        ly_do: KHOA_CHUA_MO,
        co_khoa_hoc: false,
        so_lan_vao: 0,
        lan_vao_gan_nhat: null,
      });
      expect(prisma.dang_nhap_vle.findUnique).not.toHaveBeenCalled();
    });

    it('khóa tắt -> trangThai vẫn trả lượt vào, không lộ key', async () => {
      process.env.VLE_LOGIN_KEY = 'khoa-khong-duoc-lo';
      const prisma = taoPrisma({
        dangKy: taoDangKyVle(null, false),
        nhatKy: [
          { hanh_dong: 'vao_hoc_vle', hoc_vien_id: 'hv-1', thoi_gian: new Date('2026-11-02T03:00:00Z') },
        ],
      });
      const kq = await new VleService(prisma as never, nhatKy as never).trangThai(caller);
      expect(kq).toMatchObject({ mo: false, so_lan_vao: 1 });
      expect(JSON.stringify(kq)).not.toContain('khoa-khong-duoc-lo');
    });

    it('khóa mở + có tài khoản -> mo=true, san_sang=true', async () => {
      process.env.VLE_LOGIN_KEY = 'khoa-bi-mat';
      process.env.VLE_COURSE_MAP = 'co_ban:12,thanh_thao:13,nang_cao:14';
      const service = new VleService(
        taoPrisma({
          dangNhap: { username: 'u1', email_chup: null },
          dangKy: taoDangKyVle('thanh_thao', true),
        }) as never,
        nhatKy as never,
      );
      const kq = await service.trangThai(caller);
      expect(kq).toMatchObject({ mo: true, san_sang: true, co_khoa_hoc: true });
      expect(kq.ly_do).toBeUndefined();
    });

    it('không có đăng ký khóa đã duyệt -> coi như tắt (mo=false)', async () => {
      process.env.VLE_LOGIN_KEY = 'khoa-bi-mat';
      const prisma = taoPrisma({ dangNhap: { username: 'u1', email_chup: null }, dangKy: null });
      const kq = await new VleService(prisma as never, nhatKy as never).trangThai(caller);
      expect(kq).toMatchObject({ mo: false, san_sang: false, ly_do: KHOA_CHUA_MO });
      expect(prisma.dang_nhap_vle.findUnique).not.toHaveBeenCalled();
    });

    it('thiếu key -> mo=false, không cần đọc công tắc khóa', async () => {
      delete process.env.VLE_LOGIN_KEY;
      const prisma = taoPrisma({ dangKy: taoDangKyVle(null, true) });
      const kq = await new VleService(prisma as never, nhatKy as never).trangThai(caller);
      expect(kq.mo).toBe(false);
      expect(kq.ly_do).toBe('Chức năng vào học VLE chưa được cấu hình.');
      expect(prisma.dang_ky_hoc.findFirst).not.toHaveBeenCalled();
    });

    it('1 truy vấn đăng ký (khóa đã duyệt gần nhất) lấy cả công tắc lẫn mức VLE', async () => {
      process.env.VLE_LOGIN_KEY = 'khoa-bi-mat';
      process.env.VLE_COURSE_MAP = 'co_ban:12,thanh_thao:13,nang_cao:14';
      const prisma = taoPrisma({
        dangNhap: { username: 'u1', email_chup: null },
        dangKy: taoDangKyVle('nang_cao', true),
      });
      const kq = await new VleService(prisma as never, nhatKy as never).form(caller, null);
      expect(kq.fields.id_course).toBe('14');
      expect(prisma.dang_ky_hoc.findFirst).toHaveBeenCalledTimes(1);
      const args = prisma.dang_ky_hoc.findFirst.mock.calls[0][0];
      expect(args.where).toEqual({ hoc_vien_id: 'hv-1', khoa: { trang_thai: 'da_duyet' } });
      expect(args.orderBy).toEqual({ khoa: { ngay_duyet: 'desc' } });
      expect(args.select.khoa.select.mo_vao_hoc_vle).toBe(true);
    });

    it('form(): khóa tắt -> 409 VLE_CHUA_MO, không ghi nhật ký, không tra tài khoản', async () => {
      process.env.VLE_LOGIN_KEY = 'khoa-bi-mat';
      const prisma = taoPrisma({
        dangNhap: { username: 'u1', email_chup: null },
        dangKy: taoDangKyVle('co_ban', false),
      });
      const service = new VleService(prisma as never, nhatKy as never);
      const loi = await service.form(caller, '1.2.3.4').catch((e: unknown) => e);
      expect(loi).toBeInstanceOf(VleChuaMoException);
      const ex = loi as VleChuaMoException;
      expect(ex.getStatus()).toBe(409);
      expect(ex.getResponse()).toEqual({
        error: { code: 'VLE_CHUA_MO', message: KHOA_CHUA_MO },
      });
      expect(nhatKy.ghi).not.toHaveBeenCalled();
      expect(prisma.dang_nhap_vle.findUnique).not.toHaveBeenCalled();
    });

    it('form(): không có đăng ký khóa đã duyệt -> VLE_CHUA_MO', async () => {
      process.env.VLE_LOGIN_KEY = 'khoa-bi-mat';
      const service = new VleService(
        taoPrisma({ dangNhap: { username: 'u1', email_chup: null }, dangKy: null }) as never,
        nhatKy as never,
      );
      await expect(service.form(caller, null)).rejects.toBeInstanceOf(VleChuaMoException);
      expect(nhatKy.ghi).not.toHaveBeenCalled();
    });

    it('form(): thiếu key -> 503 trước cả khi khóa tắt', async () => {
      delete process.env.VLE_LOGIN_KEY;
      const prisma = taoPrisma({ dangKy: taoDangKyVle(null, false) });
      const service = new VleService(prisma as never, nhatKy as never);
      await expect(service.form(caller, null)).rejects.toBeInstanceOf(VleChuaCauHinhException);
      expect(prisma.dang_ky_hoc.findFirst).not.toHaveBeenCalled();
    });

    it('form(): khóa mở + chưa có tài khoản -> VLE_CHUA_CO_TAI_KHOAN (sau công tắc khóa)', async () => {
      process.env.VLE_LOGIN_KEY = 'khoa-bi-mat';
      const service = new VleService(
        taoPrisma({ dangNhap: null, dangKy: taoDangKyVle(null, true) }) as never,
        nhatKy as never,
      );
      await expect(service.form(caller, null)).rejects.toBeInstanceOf(VleChuaCoTaiKhoanException);
      expect(nhatKy.ghi).not.toHaveBeenCalled();
    });
  });

  describe('lượt vào VLE trong trangThai (so_lan_vao, lan_vao_gan_nhat)', () => {
    it('chưa vào lần nào -> 0 / null', async () => {
      process.env.VLE_LOGIN_KEY = 'khoa-bi-mat';
      const service = new VleService(
        taoPrisma({ dangNhap: { username: 'u1', email_chup: null } }) as never,
        nhatKy as never,
      );
      const kq = await service.trangThai(caller);
      expect(kq.so_lan_vao).toBe(0);
      expect(kq.lan_vao_gan_nhat).toBeNull();
    });

    it('có lượt vào -> đếm đúng + lần gần nhất (ISO); chỉ tính vao_hoc_vle của CHÍNH học viên', async () => {
      process.env.VLE_LOGIN_KEY = 'khoa-bi-mat';
      const prisma = taoPrisma({
        dangNhap: { username: 'u1', email_chup: null },
        nhatKy: [
          { hanh_dong: 'vao_hoc_vle', hoc_vien_id: 'hv-1', thoi_gian: new Date('2026-11-01T02:00:00Z') },
          { hanh_dong: 'vao_hoc_vle', hoc_vien_id: 'hv-1', thoi_gian: new Date('2026-11-09T08:30:00Z') },
          { hanh_dong: 'vao_hoc_vle', hoc_vien_id: 'hv-1', thoi_gian: new Date('2026-11-05T01:00:00Z') },
          // Không tính: hành động khác của chính học viên, lượt vào của người khác.
          { hanh_dong: 'dang_nhap', hoc_vien_id: 'hv-1', thoi_gian: new Date('2026-11-10T00:00:00Z') },
          { hanh_dong: 'vao_hoc_vle', hoc_vien_id: 'hv-2', thoi_gian: new Date('2026-11-10T00:00:00Z') },
        ],
      });
      const service = new VleService(prisma as never, nhatKy as never);
      const kq = await service.trangThai(caller);
      expect(kq.so_lan_vao).toBe(3);
      expect(kq.lan_vao_gan_nhat).toBe('2026-11-09T08:30:00.000Z');
      // 1 truy vấn gộp, lọc đúng hành động + học viên.
      expect(prisma.nhat_ky_hoat_dong.groupBy).toHaveBeenCalledTimes(1);
      expect(prisma.nhat_ky_hoat_dong.groupBy.mock.calls[0][0].where).toEqual({
        hanh_dong: 'vao_hoc_vle',
        hoc_vien_id: { in: ['hv-1'] },
      });
    });

    it('chưa cấu hình / chưa có tài khoản -> vẫn trả lượt vào (không lỗi)', async () => {
      const nk = [
        { hanh_dong: 'vao_hoc_vle', hoc_vien_id: 'hv-1', thoi_gian: new Date('2026-11-02T03:00:00Z') },
      ];
      delete process.env.VLE_LOGIN_KEY;
      const chuaCauHinh = await new VleService(
        taoPrisma({ nhatKy: nk }) as never,
        nhatKy as never,
      ).trangThai(caller);
      expect(chuaCauHinh).toMatchObject({ san_sang: false, so_lan_vao: 1 });

      process.env.VLE_LOGIN_KEY = 'khoa-bi-mat';
      const chuaTaiKhoan = await new VleService(
        taoPrisma({ dangNhap: null, nhatKy: nk }) as never,
        nhatKy as never,
      ).trangThai(caller);
      expect(chuaTaiKhoan).toMatchObject({
        san_sang: false,
        so_lan_vao: 1,
        lan_vao_gan_nhat: '2026-11-02T03:00:00.000Z',
      });
    });
  });
});
