import {
  DangKyDemo,
  DauVaoKeHoach,
  kiemTraDbLocal,
  lapKeHoachDemo,
} from '../../scripts/demo-thong-ke.lib';

const THANG = ['M1', 'M2', 'M3', 'M4'];
const NOW = new Date('2026-10-07T03:00:00Z');
const gio = (h: number) => new Date(NOW.getTime() + h * 3600000);

function dangKy(
  soTruong: number,
  moiTruong: number,
  tuy?: (d: DangKyDemo) => Partial<DangKyDemo>,
): DangKyDemo[] {
  const ds: DangKyDemo[] = [];
  for (let t = 0; t < soTruong; t++) {
    for (let i = 0; i < moiTruong; i++) {
      const id = `dk-${t}-${String(i).padStart(4, '0')}`;
      const d: DangKyDemo = {
        id,
        hoc_vien_id: `hv-${t}-${i}`,
        don_vi_id: `dv-${t}`,
        nguoi_dung_id: `nd-${t}-${i}`,
        cum_id: null,
        ket_qua: null,
      };
      ds.push({ ...d, ...(tuy ? tuy(d) : {}) });
    }
  }
  return ds;
}

function dauVao(over: Partial<DauVaoKeHoach> = {}): DauVaoKeHoach {
  return {
    dangKy: dangKy(3, 20),
    lop: [
      { id: 'lop-a', loai_lop: 'truc_tiep' },
      { id: 'lop-b', loai_lop: 'zoom' },
      { id: 'lop-v', loai_lop: 'vle' },
    ],
    buoi: [
      { id: 'b-a1', lop_id: 'lop-a', giai_doan_id: 'gd-1', thoi_gian_bat_dau: gio(-72) },
      { id: 'b-a2', lop_id: 'lop-a', giai_doan_id: 'gd-1', thoi_gian_bat_dau: gio(-48) },
      { id: 'b-a3', lop_id: 'lop-a', giai_doan_id: 'gd-1', thoi_gian_bat_dau: gio(48) },
      { id: 'b-b1', lop_id: 'lop-b', giai_doan_id: 'gd-1', thoi_gian_bat_dau: gio(-24) },
      { id: 'b-b2', lop_id: 'lop-b', giai_doan_id: 'gd-1', thoi_gian_bat_dau: gio(72) },
      { id: 'b-v1', lop_id: 'lop-v', giai_doan_id: 'gd-2', thoi_gian_bat_dau: gio(-100) },
    ],
    giaiDoan: [
      { id: 'gd-1', thu_tu: 1, hinh_thuc: 'truc_tiep' },
      { id: 'gd-2', thu_tu: 2, hinh_thuc: 'truc_tuyen' },
    ],
    cumIds: ['cum-1', 'cum-2'],
    thang: THANG,
    now: NOW,
    ...over,
  };
}

describe('kiemTraDbLocal', () => {
  it.each([
    'postgresql://u:p@localhost:5432/db',
    'postgresql://u:p@127.0.0.1:5432/db',
    'postgresql://u:p@[::1]:5432/db',
    'postgresql://u:p@localhost:5432/db?schema=public',
    'postgresql://localhost/db',
  ])('cho qua %s', (url) => {
    expect(() => kiemTraDbLocal(url)).not.toThrow();
  });

  it.each([
    'postgresql://u:p@10.0.0.5:5432/db',
    'postgresql://u:p@localhost/db?host=10.0.0.5',
    'postgresql://u:p@localhost/db?hostaddr=10.0.0.5',
    'postgresql://u:p@localhost,10.0.0.5:5432/db',
    'postgresql://u:p@boiduongnls.hcmue.edu.vn:5432/db',
  ])('chặn host khác %s', (url) => {
    expect(() => kiemTraDbLocal(url)).toThrow();
  });

  it.each(['', undefined, 'khong-phai-url'])('chặn URL rỗng/sai: %p', (url) => {
    expect(() => kiemTraDbLocal(url as string)).toThrow();
  });
});

describe('lapKeHoachDemo', () => {
  it('cùng seed → cùng kế hoạch', () => {
    expect(lapKeHoachDemo(dauVao())).toEqual(lapKeHoachDemo(dauVao()));
  });

  it('khác seed → khác kế hoạch', () => {
    expect(lapKeHoachDemo(dauVao(), 1)).not.toEqual(lapKeHoachDemo(dauVao(), 2));
  });

  it('hệ số tích cực mỗi trường nằm trong [0.2, 0.95]', () => {
    const kh = lapKeHoachDemo(dauVao());
    expect(Object.keys(kh.heSo)).toHaveLength(3);
    for (const h of Object.values(kh.heSo)) {
      expect(h).toBeGreaterThanOrEqual(0.2);
      expect(h).toBeLessThanOrEqual(0.95);
    }
  });

  it('chỉ tạo điểm danh cho buổi đã qua', () => {
    const kh = lapKeHoachDemo(dauVao());
    expect(kh.diemDanh.length).toBeGreaterThan(0);
    const tuongLai = new Set(['b-a3', 'b-b2']);
    expect(kh.diemDanh.some((d) => tuongLai.has(d.lich_hoc_id))).toBe(false);
    expect(kh.diemDanh.every((d) => d.lich_hoc_id !== 'b-v1')).toBe(true);
  });

  it('không có buổi nào đã qua → tối đa 3 buổi đầu mỗi lớp và ghi log', () => {
    const buoi = [1, 2, 3, 4].map((i) => ({
      id: `b-a${i}`,
      lop_id: 'lop-a',
      giai_doan_id: 'gd-1',
      thoi_gian_bat_dau: gio(i * 24),
    }));
    const kh = lapKeHoachDemo(dauVao({ buoi, dangKy: dangKy(1, 10) }));
    const ids = new Set(kh.diemDanh.map((d) => d.lich_hoc_id));
    expect([...ids].sort()).toEqual(['b-a1', 'b-a2', 'b-a3']);
    expect(kh.ghiChuLog.length).toBeGreaterThan(0);
  });

  it('mọi điểm danh/khảo sát/VLE đều có nhãn demo', () => {
    const kh = lapKeHoachDemo(dauVao());
    expect(kh.khaoSat.length).toBeGreaterThan(0);
    expect(kh.ketQuaGiaiDoan.length).toBeGreaterThan(0);
    expect(kh.diemDanh.every((d) => d.ghi_chu === '[demo]' && d.nguon === 'thu_cong')).toBe(true);
    expect(kh.khaoSat.every((k) => k.nguon === 'demo' && k.trang_thai === 'hoan_thanh')).toBe(true);
    expect(kh.ketQuaGiaiDoan.every((k) => k.ghi_chu === '[demo]')).toBe(true);
  });

  it('VLE: 1 dòng mỗi đăng ký ở giai đoạn của lớp vle, tỷ lệ trong [0,100]', () => {
    const kh = lapKeHoachDemo(dauVao());
    expect(kh.ketQuaGiaiDoan).toHaveLength(60);
    for (const k of kh.ketQuaGiaiDoan) {
      expect(k.giai_doan_id).toBe('gd-2');
      expect(k.ty_le_hoan_thanh).toBeGreaterThanOrEqual(0);
      expect(k.ty_le_hoan_thanh).toBeLessThanOrEqual(100);
    }
  });

  it('lớp vle không có lịch → dùng giai đoạn truc_tuyen đầu tiên', () => {
    const buoi = dauVao().buoi.filter((b) => b.lop_id !== 'lop-v');
    const kh = lapKeHoachDemo(dauVao({ buoi }));
    expect(new Set(kh.ketQuaGiaiDoan.map((k) => k.giai_doan_id))).toEqual(new Set(['gd-2']));
  });

  it('không tạo khảo sát cho học viên chưa truy cập', () => {
    const kh = lapKeHoachDemo(dauVao());
    const truyCap = new Set(
      kh.nguoiDung.map((n) => n.id.replace('nd-', 'hv-')),
    );
    expect(kh.khaoSat.every((k) => truyCap.has(k.hoc_vien_id))).toBe(true);
  });

  it('học viên không có tài khoản không được truy cập/khảo sát', () => {
    const kh = lapKeHoachDemo(
      dauVao({ dangKy: dangKy(2, 50, () => ({ nguoi_dung_id: null })) }),
    );
    expect(kh.nguoiDung).toHaveLength(0);
    expect(kh.khaoSat).toHaveLength(0);
  });

  it('dau-ra chỉ có khi có danh-gia; muc_goc thuộc M1..M4; dau-ra = vào ±1', () => {
    const kh = lapKeHoachDemo(dauVao({ dangKy: dangKy(2, 300) }));
    const loaiTheoHv = new Map<string, Map<string, string | null>>();
    for (const k of kh.khaoSat) {
      const m = loaiTheoHv.get(k.hoc_vien_id) ?? new Map();
      m.set(k.loai, k.muc_goc);
      loaiTheoHv.set(k.hoc_vien_id, m);
    }
    let soDauRa = 0;
    for (const m of loaiTheoHv.values()) {
      if (m.has('dau-ra')) {
        soDauRa++;
        expect(m.has('danh-gia')).toBe(true);
        expect(m.has('khao-sat')).toBe(true);
        const d = THANG.indexOf(m.get('dau-ra')) - THANG.indexOf(m.get('danh-gia'));
        expect(Math.abs(d)).toBeLessThanOrEqual(1);
      }
      if (m.has('danh-gia')) expect(THANG).toContain(m.get('danh-gia'));
      if (m.has('dau-ra')) expect(THANG).toContain(m.get('dau-ra'));
    }
    expect(soDauRa).toBeGreaterThan(0);
  });

  it('bỏ qua học viên đã có dòng cùng loại', () => {
    const daCo = dangKy(3, 20).flatMap((d) => [
      `${d.hoc_vien_id}|khao-sat`,
      `${d.hoc_vien_id}|danh-gia`,
      `${d.hoc_vien_id}|dau-ra`,
    ]);
    const kh = lapKeHoachDemo(dauVao({ khaoSatDaCo: daCo }));
    expect(kh.khaoSat).toHaveLength(0);
  });

  it('bỏ qua cặp điểm danh/VLE đã tồn tại', () => {
    const base = lapKeHoachDemo(dauVao());
    const kh = lapKeHoachDemo(
      dauVao({
        diemDanhDaCo: base.diemDanh.map((d) => `${d.dang_ky_hoc_id}|${d.lich_hoc_id}`),
        ketQuaGiaiDoanDaCo: base.ketQuaGiaiDoan.map(
          (d) => `${d.dang_ky_hoc_id}|${d.giai_doan_id}`,
        ),
      }),
    );
    expect(kh.diemDanh).toHaveLength(0);
    expect(kh.ketQuaGiaiDoan).toHaveLength(0);
  });

  it('không đụng đăng ký đã có ket_qua dat/khong_dat', () => {
    const dk = dangKy(2, 200, (d) => ({
      ket_qua: Number(d.id.slice(-4)) % 2 ? 'dat' : 'khong_dat',
    }));
    const kh = lapKeHoachDemo(dauVao({ dangKy: dk }));
    expect(kh.dangKy.every((c) => c.ket_qua === undefined)).toBe(true);
  });

  it('chỉ đặt ket_qua dat/khong_dat/vang cho đăng ký null hoặc dang_hoc', () => {
    const kh = lapKeHoachDemo(
      dauVao({ dangKy: dangKy(2, 300, (d) => ({ ket_qua: d.id.endsWith('0') ? 'dang_hoc' : null })) }),
    );
    const doiKq = kh.dangKy.filter((c) => c.ket_qua);
    expect(doiKq.length).toBeGreaterThan(0);
    expect(doiKq.every((c) => ['dat', 'khong_dat', 'vang'].includes(c.ket_qua))).toBe(true);
  });

  it('cụm: chia luân phiên cho đăng ký chưa có cụm, giữ nguyên cụm sẵn có', () => {
    const dk = dangKy(1, 10, (d) => ({ cum_id: d.id.endsWith('0') ? 'cum-1' : null }));
    const kh = lapKeHoachDemo(dauVao({ dangKy: dk }));
    const cum = kh.dangKy.filter((c) => c.cum_id);
    expect(cum).toHaveLength(9);
    expect(cum.some((c) => c.id.endsWith('0'))).toBe(false);
    const dem = { 'cum-1': 0, 'cum-2': 0 };
    cum.forEach((c) => dem[c.cum_id]++);
    expect(Math.abs(dem['cum-1'] - dem['cum-2'])).toBeLessThanOrEqual(1);
  });

  it('trường h cao có tỷ lệ truy cập cao hơn trường h thấp', () => {
    const kh = lapKeHoachDemo(
      dauVao({
        dangKy: dangKy(2, 200),
        heSoEp: { 'dv-0': 0.9, 'dv-1': 0.25 },
      }),
    );
    const dem = (t: string) => kh.nguoiDung.filter((n) => n.id.startsWith(`nd-${t}-`)).length;
    expect(dem('0')).toBeGreaterThan(dem('1') * 2);
    expect(dem('0') / 200).toBeGreaterThan(0.8);
    expect(dem('1') / 200).toBeLessThan(0.4);
  });

  it('dang_nhap_lan_cuoi nằm trong 14 ngày qua', () => {
    const kh = lapKeHoachDemo(dauVao());
    for (const n of kh.nguoiDung) {
      const ms = NOW.getTime() - n.dang_nhap_lan_cuoi.getTime();
      expect(ms).toBeGreaterThanOrEqual(0);
      expect(ms).toBeLessThanOrEqual(14 * 24 * 3600 * 1000);
    }
  });
});
