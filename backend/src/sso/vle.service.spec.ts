import { VleService } from './vle.service';
import {
  VleChuaCauHinhException,
  VleChuaCoTaiKhoanException,
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
      dang_ky_hoc: {
        findFirst: jest.fn().mockResolvedValue(opts.dangKy ?? null),
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

  function taoDangKyVle(mucNangLuc: string | null) {
    const homNay = new Date();
    return {
      muc_dau_vao: null,
      khoa: {
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

  it('không có đăng ký/lớp VLE nào -> bỏ qua id_course, co_khoa_hoc=false', async () => {
    process.env.VLE_LOGIN_KEY = 'khoa-bi-mat';
    process.env.VLE_COURSE_MAP = 'co_ban:12,thanh_thao:13,nang_cao:14';
    const service = new VleService(
      taoPrisma({ dangNhap: { username: 'u1', email_chup: null }, dangKy: null }) as never,
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
