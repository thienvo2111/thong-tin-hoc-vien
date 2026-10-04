import { useEffect, useRef, useState, type ChangeEvent, type CSSProperties, type ReactNode, type RefObject } from 'react';
import {
  ActionIcon,
  Affix,
  Anchor,
  Box,
  Burger,
  Button,
  type ButtonProps,
  Container,
  Drawer,
  Group,
  Image,
  NativeSelect,
  Paper,
  SimpleGrid,
  Stack,
  Tabs,
  Text,
  Textarea,
  TextInput,
  Title,
  Transition,
} from '@mantine/core';
import { useWindowScroll } from '@mantine/hooks';
import { Link } from 'react-router-dom';
import { useToi } from '@/auth/AuthContext';
import { gioiThieu } from '@/content/gioiThieu';
import { hopCheDo, useCauHinhTrienKhai, type CauHinhTrienKhai } from '@/content/trienKhai';
import { layDanhSachTinhKhaoSat, type TinhCoCauHinh } from '@/api/cauHinhKhaoSat';
import { chuanHoaLienKet } from '@/lib/lienKet';
import logoHcmue from '@/assets/logo-hcmue.png';
import './trangGioiThieu.css';

// Trang giới thiệu công khai (M0) — layout theo design/mockup-source/project/LandingDesktop.dc.html
// và LandingMobile.dc.html (mobile là bản ưu tiên). Mọi nội dung hiển thị đọc từ
// src/content/gioiThieu.ts qua đúng khối `hien`/`tam` đã có — mockup chỉ dùng để tham khảo bố cục/kiểu
// dáng, không có số liệu/tên tỉnh/nội dung khóa nào bị chép cứng vào đây (CLAUDE.md).
export default function TrangGioiThieu() {
  const { dangTai, daXacThuc } = useToi();

  useEffect(() => {
    if (import.meta.env.DEV) {
      import('@/content/kiemTraNoiDungTam').then((m) => m.baoCacKhoiTam());
    }
  }, []);

  // Trang nạp lazy nên trình duyệt không tự cuộn tới neo (vd /#khao-sat từ trang đăng nhập).
  // Đợi trang nạp xong (CSS/ảnh) rồi mới cuộn, tránh lệch vị trí do layout còn thay đổi.
  useEffect(() => {
    const neo = window.location.hash.slice(1);
    if (!neo) return;
    const cuon = () => requestAnimationFrame(() => document.getElementById(neo)?.scrollIntoView?.());
    if (document.readyState === 'complete') {
      cuon();
      return;
    }
    window.addEventListener('load', cuon, { once: true });
    return () => window.removeEventListener('load', cuon);
  }, []);

  const { thongBaoNoiBat, moDau, conSo, viSao, doiTuong, khaoSatDauVao, loTrinh, noiDung, huongDan, hoiDap, lienHe, hopTac, donVi } =
    gioiThieu;

  const dangDaXacThuc = !dangTai && daXacThuc;
  // 2026-10-02: mỗi khóa có thể có cấu hình riêng gắn 1 tỉnh — người xem chọn tỉnh để thấy đúng hướng dẫn.
  const [dsTinh, setDsTinh] = useState<TinhCoCauHinh[]>([]);
  const [tinh, setTinh] = useState<string | null>(docTinhDaChon);
  useEffect(() => {
    let huy = false;
    layDanhSachTinhKhaoSat()
      .then((ds) => !huy && setDsTinh(ds))
      .catch(() => undefined);
    return () => {
      huy = true;
    };
  }, []);
  const { cauHinh } = useCauHinhTrienKhai({ loai: 'cong_khai', tinh });
  const chonTinh = (v: string) => {
    const moi = v || null;
    setTinh(moi);
    ghiTinhDaChon(moi);
  };
  const hop = hopCheDo(cauHinh.cheDoHocVien);
  const hienKhaoSat = cauHinh.hienKhaoSat && cauHinh.phieu.length > 0;
  const hienHuongDan = huongDan.hien && hop(huongDan);
  const buocLoTrinh = loTrinh.buoc.filter(hop);
  const cauHoiDap = hoiDap.cau.filter(hop);

  // Chế độ 'khao_sat': học viên chưa đăng nhập — CTA chính trỏ tới khối khảo sát thay vì trang đăng nhập.
  // Người đã đăng nhập (vd quản trị) vẫn thấy "Vào trang của tôi".
  const cta: Cta = dangDaXacThuc
    ? { href: '/toi', nhan: 'Vào trang của tôi', noiBo: true }
    : cauHinh.cheDoHocVien === 'khao_sat' && hienKhaoSat
      ? { href: '#khao-sat', nhan: moDau.nutKhaoSat, noiBo: false }
      : { href: '/dang-nhap', nhan: moDau.nutChinh, noiBo: true };
  const ctaHeader: Cta = cta.href === '/dang-nhap' ? { ...cta, nhan: 'Đăng nhập' } : cta;

  // Nhãn trên thanh menu rút gọn so với tiêu đề đầy đủ của từng khối (tiêu đề dài, dễ vỡ layout menu 1
  // hàng) — 2 khối viSao + noiDung nằm liền kề nhau nói cùng 1 chủ đề nên gộp còn 1 mục trỏ tới viSao.
  const mucLuc = [
    hienKhaoSat && { href: '#khao-sat', label: 'Khảo sát' },
    (viSao.hien || noiDung.hien) && { href: viSao.hien ? '#vi-sao' : '#chuong-trinh', label: 'Chương trình' },
    loTrinh.hien && { href: '#lo-trinh', label: 'Lộ trình học' },
    doiTuong.hien && { href: '#doi-tuong', label: 'Đối tượng' },
    // "Bắt đầu" (khối 4 bước, #huong-dan) tách khỏi mục "Hướng dẫn sử dụng" (/huong-dan, M9) bên dưới,
    // tránh 2 mục trùng nhãn trên cùng thanh menu.
    hienHuongDan && { href: '#huong-dan', label: 'Bắt đầu' },
    hoiDap.hien && { href: '#faq', label: 'Hỏi đáp' },
    lienHe.hien && { href: '#lien-he', label: 'Liên hệ' },
    hopTac.hien && { href: '#hop-tac', label: 'Hợp tác' },
    { href: '/huong-dan', label: gioiThieu.huongDanSuDung.nhanMenu },
  ].filter((m): m is { href: string; label: string } => Boolean(m));

  const hasHeroPanel = noiDung.hien && noiDung.danhSachMuc.length > 0;

  // Nền xen kẽ trắng/xám theo các khối ĐANG hiển thị — khối ẩn theo chế độ không làm 2 khối cùng nền
  // đứng liền nhau (vd chế độ khảo sát ẩn "Hướng dẫn" khiến "Đối tượng" dính "Hỏi đáp").
  const khoiXenKe = [
    viSao.hien && 'vi-sao',
    noiDung.hien && 'chuong-trinh',
    loTrinh.hien && 'lo-trinh',
    doiTuong.hien && 'doi-tuong',
    hienHuongDan && 'huong-dan',
    hoiDap.hien && 'faq',
  ].filter(Boolean);
  const nen = (id: string) => (khoiXenKe.indexOf(id) % 2 === 0 ? 'white' : 'gray.0');

  return (
    <Box>
      {thongBaoNoiBat && (
        <Box bg="blue.7" c="white" py="xs" ta="center">
          <Text size="sm" fw={500}>
            {thongBaoNoiBat}
          </Text>
        </Box>
      )}

      <HeaderCongKhai mucLuc={mucLuc} cta={ctaHeader} />

      {moDau.hien && (
        <Hero moDau={moDau} noiDung={noiDung} hasHeroPanel={hasHeroPanel} cta={cta} ctaPhuHref={mucLucChuongTrinh(mucLuc)} />
      )}

      {conSo.hien && <DaiThongKe conSo={conSo} />}

      {dsTinh.length > 0 && <KhoiChonTinh dsTinh={dsTinh} tinh={tinh} onChange={chonTinh} />}

      {hienKhaoSat && <KhoiKhaoSat khaoSat={khaoSatDauVao} phieu={cauHinh.phieu} />}

      {viSao.hien && <ViSao viSao={viSao} nen={nen('vi-sao')} />}

      {noiDung.hien && <ChuongTrinh noiDung={noiDung} nen={nen('chuong-trinh')} />}

      {loTrinh.hien && (
        <KhoiTrang id="lo-trinh" nen={nen('lo-trinh')}>
          <Stack gap={32}>
            <TieuDeKhoi>{loTrinh.tieuDe}</TieuDeKhoi>
            <DanhSachBuocSo buoc={buocLoTrinh} mau="primary" />
          </Stack>
        </KhoiTrang>
      )}

      {doiTuong.hien && <DoiTuongSection doiTuong={doiTuong} nen={nen('doi-tuong')} />}

      {hienHuongDan && (
        <KhoiTrang id="huong-dan" nen={nen('huong-dan')}>
          <Stack gap={32}>
            <TieuDeKhoi>{huongDan.tieuDe}</TieuDeKhoi>
            <Box maw={640} mx="auto" w="100%">
              <DanhSachBuocSo buoc={huongDan.buoc} mau="accent" />
            </Box>
            <Group justify="center">
              <Button component={Link} to="/huong-dan" variant="outline" color="accent">
                {gioiThieu.huongDanSuDung.nutChiTiet}
              </Button>
            </Group>
          </Stack>
        </KhoiTrang>
      )}

      {hoiDap.hien && (
        <KhoiTrang id="faq" nen={nen('faq')} size="sm">
          <Stack gap={24}>
            <TieuDeKhoi fz={{ base: 20, sm: 26 }}>{hoiDap.tieuDe}</TieuDeKhoi>
            <Stack gap={12}>
              {cauHoiDap.map((c, i) => (
                <HienDan key={c.hoi} tre={Math.min(i, 5) * 60}>
                  <Paper withBorder radius={12} p="md" className="gt-the">
                    <Text fw={700} fz={14} mb={4}>
                      {c.hoi}
                    </Text>
                    <Text fz={13} c="dimmed" lh={1.6}>
                      {c.dap}
                    </Text>
                  </Paper>
                </HienDan>
              ))}
            </Stack>
          </Stack>
        </KhoiTrang>
      )}

      {lienHe.hien && <KhoiLienHe lienHe={lienHe} />}

      {hopTac.hien && <KhoiHopTac hopTac={hopTac} />}

      <FooterCongKhai donVi={donVi} />

      <NutVeDauTrang />
    </Box>
  );
}

/** Nút nổi "Về đầu trang" — hiện khi cuộn quá 1 màn hình, cuộn mượt về đầu khi bấm. */
function NutVeDauTrang() {
  const [scroll, scrollTo] = useWindowScroll();

  return (
    <Affix position={{ bottom: 20, right: 20 }}>
      <Transition transition="slide-up" mounted={scroll.y > 400}>
        {(style) => (
          <ActionIcon
            style={style}
            onClick={() => scrollTo({ y: 0 })}
            size={44}
            radius="xl"
            color="primary"
            variant="filled"
            aria-label="Về đầu trang"
          >
            <Text fz={18} lh={1}>
              ↑
            </Text>
          </ActionIcon>
        )}
      </Transition>
    </Affix>
  );
}

function laNoiDungCho(s: string): boolean {
  return s.startsWith('[CHỜ');
}

type Cta = { href: string; nhan: string; noiBo: boolean };

/** Nút CTA theo loại đích: route nội bộ dùng Link, neo trong trang (#...) dùng thẻ a. */
function NutCta({ cta, ...props }: { cta: Cta; onClick?: () => void } & Omit<ButtonProps, 'children'>) {
  return cta.noiBo ? (
    <Button component={Link} to={cta.href} {...props}>
      {cta.nhan}
    </Button>
  ) : (
    <Button component="a" href={cta.href} {...props}>
      {cta.nhan}
    </Button>
  );
}

/** Nút phụ ở hero trỏ tới khối giới thiệu chương trình — bỏ qua "Khảo sát" vì nút chính đã trỏ tới đó. */
function mucLucChuongTrinh(mucLuc: { href: string }[]): string | undefined {
  return mucLuc.find((m) => m.href !== '#khao-sat')?.href;
}

function HeaderCongKhai({ mucLuc, cta }: { mucLuc: { href: string; label: string }[]; cta: Cta }) {
  const [menuMoDt, setMenuMoDt] = useState(false);

  return (
    <Box component="header" style={{ borderBottom: '1px solid var(--mantine-color-gray-2)' }} py={12} px={{ base: 'md', sm: 'xl' }}>
      <Container size="lg" p={0} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
        <Image src={logoHcmue} alt="Trường Đại học Sư phạm Thành phố Hồ Chí Minh" h={36} w="auto" fit="contain" />

        <Box
          visibleFrom="sm"
          style={{
            flex: 1,
            minWidth: 0,
            display: 'flex',
            justifyContent: 'center',
            overflowX: 'auto',
            scrollbarWidth: 'none',
          }}
        >
          <Group gap={20} wrap="nowrap" style={{ flexShrink: 0 }}>
            {mucLuc.map((m) => (
              <MucLucLinkDesktop key={m.href} href={m.href} label={m.label} />
            ))}
          </Group>
        </Box>

        <Group gap="sm" wrap="nowrap">
          <NutCta cta={cta} size="sm" visibleFrom="sm" />
          <Burger opened={menuMoDt} onClick={() => setMenuMoDt((v) => !v)} hiddenFrom="sm" />
        </Group>
      </Container>

      <Drawer opened={menuMoDt} onClose={() => setMenuMoDt(false)} position="right" hiddenFrom="sm" title="Menu">
        <Stack gap="xs">
          {mucLuc.map((m) => (
            <MucLucLinkDrawer key={m.href} href={m.href} label={m.label} onClick={() => setMenuMoDt(false)} />
          ))}
          <NutCta cta={cta} onClick={() => setMenuMoDt(false)} mt="sm" />
        </Stack>
      </Drawer>
    </Box>
  );
}

/** Mục menu ngang (desktop) — đổi màu chữ sang primary khi hover, để biết đang trỏ vào mục nào.
 * href bắt đầu bằng "#" là neo trong trang (thẻ a thường); còn lại là route nội bộ (vd /huong-dan, dùng Link). */
function MucLucLinkDesktop({ href, label }: { href: string; label: string }) {
  const [hovered, setHovered] = useState(false);
  const chung = {
    onMouseEnter: () => setHovered(true),
    onMouseLeave: () => setHovered(false),
    fz: 13.5,
    fw: 600,
    c: hovered ? 'primary.6' : 'gray.7',
    underline: 'never' as const,
    style: { whiteSpace: 'nowrap' as const, transition: 'color .15s ease' },
  };
  return href.startsWith('#') ? (
    <Anchor href={href} {...chung}>
      {label}
    </Anchor>
  ) : (
    <Anchor component={Link} to={href} {...chung}>
      {label}
    </Anchor>
  );
}

/** Mục menu trong Drawer (mobile) — nền primary nhạt + chữ primary khi hover/chạm. */
function MucLucLinkDrawer({ href, label, onClick }: { href: string; label: string; onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  const chung = {
    onClick,
    onMouseEnter: () => setHovered(true),
    onMouseLeave: () => setHovered(false),
    px: 'md' as const,
    py: 10,
    fw: 600,
    c: hovered ? 'primary.7' : 'dark',
    style: {
      borderRadius: 8,
      textDecoration: 'none',
      background: hovered ? 'var(--mantine-color-primary-0)' : 'transparent',
      transition: 'background .15s ease, color .15s ease',
    },
  };
  return href.startsWith('#') ? (
    <Anchor href={href} {...chung}>
      {label}
    </Anchor>
  ) : (
    <Anchor component={Link} to={href} {...chung}>
      {label}
    </Anchor>
  );
}

function Hero({
  moDau,
  noiDung,
  hasHeroPanel,
  cta,
  ctaPhuHref,
}: {
  moDau: typeof gioiThieu.moDau;
  noiDung: typeof gioiThieu.noiDung;
  hasHeroPanel: boolean;
  cta: Cta;
  ctaPhuHref?: string;
}) {
  return (
    <Box
      style={{
        position: 'relative',
        background: 'linear-gradient(160deg, var(--mantine-color-primary-8) 0%, #0F2942 100%)',
        overflow: 'hidden',
      }}
      py={{ base: 40, sm: 64, md: 88 }}
      px={{ base: 'md', sm: 'xl' }}
    >
      <svg
        aria-hidden="true"
        style={{ position: 'absolute', right: -140, top: -160, pointerEvents: 'none' }}
        width="420"
        height="420"
        viewBox="0 0 420 420"
        fill="none"
      >
        <circle cx="210" cy="210" r="209" stroke="var(--mantine-color-primary-4)" strokeWidth="1.5" opacity=".55" />
        <circle cx="210" cy="210" r="150" stroke="var(--mantine-color-accent-4)" strokeWidth="1.5" opacity=".3" />
      </svg>

      <Container size="lg" style={{ position: 'relative' }} p={0}>
        <Group align="center" gap={48} wrap="wrap" justify={hasHeroPanel ? 'space-between' : 'center'}>
          <Stack gap="lg" maw={hasHeroPanel ? 620 : 680} style={{ flex: '1 1 380px' }}>
            <Title order={1} c="white" fz={{ base: 26, sm: 34, md: 44 }} lh={1.22}>
              {moDau.tenChuongTrinh}
            </Title>
            <Text c="gray.3" fz={{ base: 14.5, sm: 16.5 }} lh={1.65} maw={540}>
              {moDau.thongDiep}
            </Text>
            {moDau.chiTietNhanh.length > 0 && (
              <Group gap={8} wrap="wrap">
                {moDau.chiTietNhanh.map((ct) => (
                  <Box
                    key={ct}
                    px={12}
                    py={6}
                    style={{
                      borderRadius: 999,
                      background: 'rgba(255,255,255,.1)',
                      border: '1px solid rgba(255,255,255,.22)',
                    }}
                  >
                    <Text fz={12.5} fw={600} c="white">
                      {ct}
                    </Text>
                  </Box>
                ))}
              </Group>
            )}
            <Group gap="sm" wrap="wrap">
              <NutCta cta={cta} size="lg" color="accent" />
              {ctaPhuHref && (
                <Button
                  component="a"
                  href={ctaPhuHref}
                  size="lg"
                  variant="outline"
                  styles={{ root: { borderColor: 'rgba(255,255,255,.35)', color: '#fff' } }}
                >
                  {moDau.nutPhu}
                </Button>
              )}
            </Group>
          </Stack>

          {hasHeroPanel && (
            <Paper
              radius={20}
              p="lg"
              style={{
                flex: '1 1 320px',
                maxWidth: 420,
                background: 'rgba(255,255,255,.06)',
                border: '1px solid rgba(255,255,255,.14)',
                backdropFilter: 'blur(6px)',
              }}
            >
              <Text fz={13} fw={700} c="white" mb="sm">
                {noiDung.tieuDe}
              </Text>
              <Stack gap="sm">
                {noiDung.danhSachMuc.map((m, i) => (
                  <Group
                    key={m.ma}
                    gap={12}
                    wrap="nowrap"
                    style={{ background: 'rgba(255,255,255,.05)', borderRadius: 12, padding: '10px 12px' }}
                  >
                    <Box
                      w={32}
                      h={32}
                      style={{
                        borderRadius: 9,
                        background: 'rgba(255,255,255,.1)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#fff',
                        fontWeight: 700,
                        fontSize: 13,
                        flexShrink: 0,
                      }}
                    >
                      {i + 1}
                    </Box>
                    <Box>
                      <Text fz={13} fw={600} c="white">
                        Mức {m.ten}
                      </Text>
                      <Text fz={11.5} c="gray.4">
                        {noiDung.tongTietMoiMuc} tiết · {noiDung.tyLeHinhThucMoiMuc}
                      </Text>
                    </Box>
                  </Group>
                ))}
              </Stack>
            </Paper>
          )}
        </Group>
      </Container>
    </Box>
  );
}

function DaiThongKe({ conSo }: { conSo: typeof gioiThieu.conSo }) {
  const mauSac = ['primary.6', 'success.6', 'accent.6'];
  return (
    <Container size="lg" px={{ base: 'md', sm: 'xl' }} style={{ marginTop: -32, position: 'relative', zIndex: 2 }}>
      <Paper radius={18} p={{ base: 'md', sm: 'xl' }} shadow="md" withBorder>
        <SimpleGrid cols={{ base: 2, sm: Math.min(conSo.muc.length, 4) }} spacing="md">
          {conSo.muc.map((s, i) => (
            <Stack key={s.nhan} gap={4} align="center" ta="center">
              <Text fz={{ base: 22, sm: 30 }} fw={800} c={mauSac[i % mauSac.length]}>
                {s.so}
              </Text>
              <Text fz={12.5} fw={600} c="dimmed">
                {s.nhan}
              </Text>
            </Stack>
          ))}
        </SimpleGrid>
      </Paper>
    </Container>
  );
}

/** Hiện dần (mờ -> rõ, trượt lên) khi cuộn tới. Không có IntersectionObserver thì hiện ngay, không ẩn
 * nội dung. `tre` (ms) để các thẻ trong cùng lưới hiện so le. Xem trangGioiThieu.css. */
function HienDan({ children, tre = 0, component = 'div' }: { children: ReactNode; tre?: number; component?: 'div' | 'li' }) {
  const ref = useRef<HTMLElement>(null);
  const [coHieuUng] = useState(() => typeof window !== 'undefined' && 'IntersectionObserver' in window);
  const [daHien, setDaHien] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || !coHieuUng) return;
    const quanSat = new IntersectionObserver(
      ([muc]) => {
        if (muc.isIntersecting) {
          setDaHien(true);
          quanSat.disconnect();
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' },
    );
    quanSat.observe(el);
    return () => quanSat.disconnect();
  }, [coHieuUng]);

  const props = {
    className: coHieuUng ? `gt-cho-hien${daHien ? ' gt-da-hien' : ''}` : undefined,
    style: { '--tre': `${tre}ms` } as CSSProperties,
  };
  return component === 'li' ? (
    <li ref={ref as RefObject<HTMLLIElement>} {...props}>
      {children}
    </li>
  ) : (
    <div ref={ref as RefObject<HTMLDivElement>} {...props}>
      {children}
    </div>
  );
}

/** Tiêu đề khối + gạch nhấn màu accent. */
function TieuDeKhoi({ children, fz = { base: 22, sm: 28 } }: { children: ReactNode; fz?: { base: number; sm: number } }) {
  return (
    <Box ta="center">
      <Title order={2} fz={fz}>
        {children}
      </Title>
      <span className="gt-gach" aria-hidden="true" />
    </Box>
  );
}

/** Khung 1 khối nội dung: nền toàn chiều rộng + đường kẻ mảnh mép trên để tách khối liền kề; nội dung hiện dần. */
function KhoiTrang({ id, nen, size = 'lg', children }: { id: string; nen: string; size?: 'sm' | 'lg'; children: ReactNode }) {
  return (
    <Box
      component="section"
      id={id}
      bg={nen}
      py={{ base: 48, sm: 72 }}
      px={{ base: 'md', sm: 'xl' }}
      style={{ borderTop: '1px solid var(--mantine-color-gray-2)' }}
    >
      <Container size={size} p={0}>
        <HienDan>{children}</HienDan>
      </Container>
    </Box>
  );
}

function ChuongTrinh({ noiDung, nen }: { noiDung: typeof gioiThieu.noiDung; nen: string }) {
  const macDinh = noiDung.danhSachMuc.some((m) => m.ma === 'thanh_thao') ? 'thanh_thao' : noiDung.danhSachMuc[0]?.ma;
  const [mucChon, setMucChon] = useState<string | null>(macDinh ?? null);
  const muc = noiDung.danhSachMuc.find((m) => m.ma === mucChon) ?? noiDung.danhSachMuc[0];

  return (
    <KhoiTrang id="chuong-trinh" nen={nen}>
      <Stack gap={32}>
        <Stack gap={8} ta="center">
          <TieuDeKhoi>{noiDung.tieuDe}</TieuDeKhoi>
          <Text fz={13.5} c="dimmed" fw={600}>
            {noiDung.tongTietMoiMuc} tiết mỗi mức ({noiDung.tyLeHinhThucMoiMuc}) · 07 chuyên đề mỗi mức
          </Text>
        </Stack>

        <Tabs value={mucChon} onChange={setMucChon} variant="pills" radius="xl">
          <Tabs.List justify="center">
            {noiDung.danhSachMuc.map((m) => (
              <Tabs.Tab key={m.ma} value={m.ma}>
                {m.ten}
              </Tabs.Tab>
            ))}
          </Tabs.List>
        </Tabs>

        {muc && (
          <Stack gap={24}>
            <Text fz={13.5} c="dimmed" ta="center" maw={720} mx="auto" lh={1.6}>
              {muc.doiTuongPhuHop}
            </Text>
            <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="lg">
              {muc.chuyenDe.map((cd, i) => (
                <HienDan key={cd.ten} tre={(i % 4) * 80}>
                  <Paper withBorder radius={16} p="lg" h="100%" className="gt-the">
                    <Box
                      w={44}
                      h={44}
                      mb="sm"
                      style={{
                        borderRadius: 12,
                        background: 'var(--mantine-color-primary-0)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 800,
                        color: 'var(--mantine-color-primary-7)',
                      }}
                    >
                      {i + 1}
                    </Box>
                    <Text fw={700} fz={15.5} mb={6}>
                      {cd.ten}
                    </Text>
                    <Text fz={12.5} c="dimmed" lh={1.5}>
                      {cd.moTa}
                    </Text>
                  </Paper>
                </HienDan>
              ))}
            </SimpleGrid>
          </Stack>
        )}
      </Stack>
    </KhoiTrang>
  );
}

function DanhSachBuocSo({ buoc, mau }: { buoc: { ten: string; moTa: string }[]; mau: 'primary' | 'accent' }) {
  return (
    <Stack gap={0}>
      {buoc.map((b, i) => {
        const cuoi = i === buoc.length - 1;
        return (
          <HienDan key={b.ten} tre={Math.min(i, 6) * 70}>
            <Box style={{ display: 'flex', gap: 16 }}>
              <Box style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                <Box
                  w={32}
                  h={32}
                  style={{
                    borderRadius: '50%',
                    background: `var(--mantine-color-${mau}-6)`,
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: 13,
                    flexShrink: 0,
                  }}
                >
                  {i + 1}
                </Box>
                {!cuoi && <Box style={{ flex: 1, width: 2, background: `var(--mantine-color-${mau}-1)`, minHeight: 20 }} />}
              </Box>
              <Box pb={cuoi ? 0 : 24} style={{ flex: 1 }}>
                <Text fw={700} fz={14.5}>
                  {b.ten}
                </Text>
                <Text fz={13} c="dimmed" lh={1.55}>
                  {b.moTa}
                </Text>
              </Box>
    </Box>
          </HienDan>
        );
      })}
    </Stack>
  );
}

/** Tỉnh đã chọn: ưu tiên ?tinh= trên link (gửi qua Zalo cho từng tỉnh), sau đó lựa chọn lần trước trên máy này. */
function docTinhDaChon(): string | null {
  const tuLink = new URLSearchParams(window.location.search).get('tinh');
  if (tuLink) return tuLink;
  try {
    return localStorage.getItem('gt_tinh');
  } catch {
    return null;
  }
}

function ghiTinhDaChon(tinh: string | null) {
  try {
    if (tinh) localStorage.setItem('gt_tinh', tinh);
    else localStorage.removeItem('gt_tinh');
  } catch {
    // Trình duyệt chặn lưu trữ — chỉ mất tiện ích nhớ lựa chọn, không ảnh hưởng hiển thị.
  }
  const url = new URL(window.location.href);
  if (tinh) url.searchParams.set('tinh', tinh);
  else url.searchParams.delete('tinh');
  window.history.replaceState(window.history.state, '', url);
}

/** Ô chọn tỉnh/thành — chỉ hiện khi có ít nhất 1 tỉnh dùng cấu hình khảo sát riêng. */
function KhoiChonTinh({
  dsTinh,
  tinh,
  onChange,
}: {
  dsTinh: TinhCoCauHinh[];
  tinh: string | null;
  onChange: (v: string) => void;
}) {
  return (
    <Box bg="primary.0" pt={{ base: 32, sm: 48 }} px={{ base: 'md', sm: 'xl' }}>
      <Container size="md" p={0}>
        <Paper withBorder radius={14} p="md">
          <NativeSelect
            label="Thầy/Cô công tác tại tỉnh/thành nào?"
            description="Chọn để xem đúng hướng dẫn khảo sát của địa phương."
            value={tinh ?? ''}
            onChange={(e) => onChange(e.currentTarget.value)}
            data={[{ value: '', label: '— Chọn tỉnh/thành —' }, ...dsTinh.map((t) => ({ value: t.tinh_id, label: t.ten_tinh }))]}
            size="md"
          />
        </Paper>
      </Container>
    </Box>
  );
}

/** Khối khảo sát đầu vào — các phiếu làm tuần tự theo thứ tự, mỗi phiếu 1 hoặc nhiều đường dẫn (theo đối tượng). */
function KhoiKhaoSat({ khaoSat, phieu }: { khaoSat: typeof gioiThieu.khaoSatDauVao; phieu: CauHinhTrienKhai['phieu'] }) {
  return (
    <Box id="khao-sat" bg="primary.0" py={{ base: 48, sm: 72 }} px={{ base: 'md', sm: 'xl' }}>
      <Container size="md" p={0}>
        <Stack gap={28}>
          <Stack gap={8} ta="center">
            <TieuDeKhoi>{khaoSat.tieuDe}</TieuDeKhoi>
            <Text fz={14} c="dimmed" lh={1.6} maw={640} mx="auto">
              {khaoSat.moTa}
            </Text>
          </Stack>

          <Stack gap="md" component="ol" m={0} p={0} style={{ listStyle: 'none' }}>
            {phieu.map((p, i) => (
              <HienDan key={p.ten} component="li" tre={i * 120}>
                <Paper withBorder radius={14} p="lg" className="gt-the">
                  <Group gap={16} align="flex-start" wrap="nowrap">
                    <Box
                      w={36}
                      h={36}
                      aria-hidden="true"
                      style={{
                        borderRadius: '50%',
                        background: 'var(--mantine-color-primary-6)',
                        color: '#fff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 700,
                        flexShrink: 0,
                      }}
                    >
                      {i + 1}
                    </Box>
                    <Stack gap={8} style={{ flex: 1, minWidth: 0 }}>
                      <Title order={3} fz={{ base: 16, sm: 18 }}>
                        {`Phiếu ${i + 1}: ${p.ten}`}
                      </Title>
                      <Text fz={13.5} c="dimmed" lh={1.6}>
                        {p.moTa}
                      </Text>
                      <Group gap="sm" wrap="wrap" mt={4}>
                        {p.lienKet.map((lk) => {
                          const href = !lk.url || laNoiDungCho(lk.url) ? null : chuanHoaLienKet(lk.url);
                          return href ? (
                            <Button key={lk.nhan} component="a" href={href} target="_blank" rel="noopener noreferrer">
                              {lk.nhan}
                            </Button>
                          ) : (
                            <Stack key={lk.nhan} gap={4}>
                              <Button disabled variant="default">
                                {lk.nhan}
                              </Button>
                              <Text fz={12} c="dimmed">
                                Đường dẫn đang được cập nhật
                              </Text>
                            </Stack>
                          );
                        })}
                      </Group>
                    </Stack>
                  </Group>
                </Paper>
              </HienDan>
            ))}
          </Stack>

          {khaoSat.sauKhaoSat.length > 0 && (
            <Paper withBorder radius={14} p="md">
              <Text fw={700} fz={13.5} mb={8}>
                Sau khi hoàn thành khảo sát
              </Text>
              <Stack gap={4} component="ul" m={0} pl="md">
                {khaoSat.sauKhaoSat.map((d) => (
                  <Text key={d} component="li" fz={13} lh={1.6} c="dimmed">
                    {d}
                  </Text>
                ))}
              </Stack>
            </Paper>
          )}
        </Stack>
      </Container>
    </Box>
  );
}

function ViSao({ viSao, nen }: { viSao: typeof gioiThieu.viSao; nen: string }) {
  return (
    <KhoiTrang id="vi-sao" nen={nen}>
      <Stack gap={8} maw={720} mx="auto" ta="center">
        <TieuDeKhoi>{viSao.tieuDe}</TieuDeKhoi>
        <Text fz={14} c="dimmed" lh={1.6}>
          {viSao.doanMo}
        </Text>
      </Stack>
    </KhoiTrang>
  );
}

function DoiTuongSection({ doiTuong, nen }: { doiTuong: typeof gioiThieu.doiTuong; nen: string }) {
  return (
    <KhoiTrang id="doi-tuong" nen={nen}>
      <Stack gap={28}>
        <TieuDeKhoi>{doiTuong.tieuDe}</TieuDeKhoi>
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="lg">
          {doiTuong.nhom.map((n, i) => (
            <HienDan key={n} tre={i * 80}>
              <Paper withBorder radius={14} p="md" ta="center" h="100%" className="gt-the">
                <Text fz={13.5} lh={1.6}>
                  {n}
                </Text>
              </Paper>
            </HienDan>
          ))}
        </SimpleGrid>
        <Paper
          radius={14}
          p="md"
          bg="warning.0"
          style={{ border: '1px solid var(--mantine-color-warning-2)' }}
        >
          <Text fw={700} fz={13.5} c="warning.7" mb={8}>
            Điều kiện cấp giấy chứng nhận
          </Text>
          <Stack gap={4}>
            {doiTuong.dieuKienChungNhan.map((d) => (
              <Text key={d} fz={13} lh={1.6} c="warning.9">
                {d}
              </Text>
            ))}
          </Stack>
        </Paper>
      </Stack>
    </KhoiTrang>
  );
}

function KhoiLienHe({ lienHe }: { lienHe: typeof gioiThieu.lienHe }) {
  const coHotline = !laNoiDungCho(lienHe.hotline);
  return (
    <Box id="lien-he" bg="primary.7" py={{ base: 40, sm: 56 }} px={{ base: 'md', sm: 'xl' }}>
      <Container size="lg" p={0}>
        <Stack gap={8} ta="center">
          <Title order={2} c="white" fz={{ base: 18, sm: 20 }}>
            {lienHe.tieuDe}
          </Title>
          <Stack gap={2} align="center">
            {coHotline && (
              <Text c="gray.3" fz={13.5}>
                Hotline:{' '}
                <Anchor href={`tel:${lienHe.hotline.replace(/\s+/g, '')}`} c="white" underline="always">
                  {lienHe.hotline}
                </Anchor>
              </Text>
            )}
            {!laNoiDungCho(lienHe.zalo) && (
              <Text c="gray.3" fz={13.5}>
                Zalo hỗ trợ: {lienHe.zalo}
              </Text>
            )}
            {!laNoiDungCho(lienHe.email) && (
              <Text c="gray.3" fz={13.5}>
                Email: {lienHe.email}
              </Text>
            )}
            {!laNoiDungCho(lienHe.gioHoTro) && (
              <Text c="gray.4" fz={12.5}>
                Giờ hỗ trợ: {lienHe.gioHoTro}
              </Text>
            )}
          </Stack>
        </Stack>
      </Container>
    </Box>
  );
}

function KhoiHopTac({ hopTac }: { hopTac: typeof gioiThieu.hopTac }) {
  const [form, setForm] = useState({
    tenDonVi: '',
    nguoiLienHe: '',
    chucVu: '',
    soDienThoai: '',
    email: '',
    quyMo: '',
    noiDungTraoDoi: '',
  });
  const coEmailHopTac = !laNoiDungCho(hopTac.email);
  const coHotlineHopTac = !laNoiDungCho(hopTac.hotline);

  const suaTruong =
    (truong: keyof typeof form) => (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((truoc) => ({ ...truoc, [truong]: e.currentTarget.value }));

  const guiYeuCau = () => {
    if (!coEmailHopTac) return;
    const tieuDe = encodeURIComponent(`Hợp tác tổ chức bồi dưỡng — ${form.tenDonVi || 'Đơn vị'}`);
    const noiDungThu = encodeURIComponent(
      [
        `Tên đơn vị/Sở-Phòng GD&ĐT: ${form.tenDonVi}`,
        `Người liên hệ: ${form.nguoiLienHe}`,
        `Chức vụ: ${form.chucVu}`,
        `Số điện thoại: ${form.soDienThoai}`,
        `Email: ${form.email}`,
        `Quy mô dự kiến: ${form.quyMo}`,
        `Nội dung trao đổi: ${form.noiDungTraoDoi}`,
      ].join('\n'),
    );
    window.location.href = `mailto:${hopTac.email}?subject=${tieuDe}&body=${noiDungThu}`;
  };

  return (
    <Box id="hop-tac" bg="gray.0" py={{ base: 48, sm: 72 }} px={{ base: 'md', sm: 'xl' }}>
      <Container size="lg" p={0}>
        <Stack gap={32}>
          <Stack gap={8} ta="center">
            <TieuDeKhoi>{hopTac.tieuDe}</TieuDeKhoi>
            <Text fz={14} c="dimmed" lh={1.6} maw={640} mx="auto">
              {hopTac.moTa}
            </Text>
          </Stack>
          <Stack gap="xl">
            <Paper withBorder radius={14} p="lg">
              <Stack gap="sm">
                <TextInput
                  label="Tên đơn vị/Sở-Phòng GD&ĐT"
                  value={form.tenDonVi}
                  onChange={suaTruong('tenDonVi')}
                />
                <TextInput label="Người liên hệ" value={form.nguoiLienHe} onChange={suaTruong('nguoiLienHe')} />
                <TextInput label="Chức vụ" value={form.chucVu} onChange={suaTruong('chucVu')} />
                <TextInput label="Số điện thoại" value={form.soDienThoai} onChange={suaTruong('soDienThoai')} />
                <TextInput label="Email" type="email" value={form.email} onChange={suaTruong('email')} />
                <TextInput
                  label="Quy mô dự kiến"
                  placeholder="Ví dụ: số lượng giáo viên dự kiến tham gia"
                  value={form.quyMo}
                  onChange={suaTruong('quyMo')}
                />
                <Textarea
                  label="Nội dung trao đổi"
                  minRows={3}
                  value={form.noiDungTraoDoi}
                  onChange={suaTruong('noiDungTraoDoi')}
                />
                <Button onClick={guiYeuCau} disabled={!coEmailHopTac} mt="xs">
                  Gửi yêu cầu hợp tác
                </Button>
              </Stack>
            </Paper>
            <Paper withBorder radius={14} p="lg" bg="primary.0">
              <Stack gap={8}>
                <Text fw={700} fz={13.5} c="primary.7">
                  Thông tin liên hệ
                </Text>
                <Text fz={12.5} c="dimmed" lh={1.6}>
                  Kênh liên hệ dành cho đơn vị, Sở/Phòng GD&ĐT muốn triển khai chương trình.
                </Text>
                {coHotlineHopTac && (
                  <Text fz={13.5}>
                    Hotline:{' '}
                    <Anchor href={`tel:${hopTac.hotline.replace(/\s+/g, '')}`} underline="always">
                      {hopTac.hotline}
                    </Anchor>
                  </Text>
                )}
                {coEmailHopTac && (
                  <Text fz={13.5}>
                    Email: <Anchor href={`mailto:${hopTac.email}`}>{hopTac.email}</Anchor>
                  </Text>
                )}
                {!coHotlineHopTac && !coEmailHopTac && (
                  <Text fz={13} c="dimmed">
                    Thông tin liên hệ hợp tác đang được cập nhật.
                  </Text>
                )}
              </Stack>
            </Paper>
          </Stack>
        </Stack>
      </Container>
    </Box>
  );
}

function FooterCongKhai({ donVi }: { donVi: typeof gioiThieu.donVi }) {
  const doiTacHien = donVi.hien ? donVi.phoiHop.filter((p) => p.hien) : [];
  return (
    <Box component="footer" bg="#0F2942" py={{ base: 20, sm: 24 }} px={{ base: 'md', sm: 'xl' }}>
      <Container size="lg" p={0}>
        <Stack gap={4} ta="center">
          <Text fz={13} c="gray.3">
            {donVi.toChuc.ten}
          </Text>
          {!laNoiDungCho(donVi.toChuc.diaChi) && (
            <Text fz={12} c="gray.5">
              {donVi.toChuc.diaChi}
            </Text>
          )}
          {doiTacHien.length > 0 && (
            <Group justify="center" gap="md" mt={8}>
              {doiTacHien.map((p) => (
                <Image key={p.ten} src={p.logo} alt={p.ten} h={22} w="auto" fit="contain" />
              ))}
            </Group>
          )}
          <Group justify="center" gap="xs" mt={4}>
            <Anchor component={Link} to="/dang-nhap" fz={12.5} c="gray.3">
              Đăng nhập hệ thống
            </Anchor>
            <Text fz={11.5} c="gray.5">
              ·
            </Text>
            <Anchor component={Link} to="/huong-dan" fz={12.5} c="gray.3">
              {gioiThieu.huongDanSuDung.lienKetChanTrang}
            </Anchor>
            <Text fz={11.5} c="gray.5">
              · © {new Date().getFullYear()}
            </Text>
          </Group>
        </Stack>
      </Container>
    </Box>
  );
}
