import { useEffect } from 'react';
import {
  Anchor,
  Box,
  Button,
  Container,
  Group,
  Image,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { Link } from 'react-router-dom';
import { useToi } from '@/auth/AuthContext';
import { gioiThieu } from '@/content/gioiThieu';
import logoHcmue from '@/assets/logo-hcmue.png';

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

  const { thongBaoNoiBat, moDau, conSo, viSao, loTrinh, noiDung, huongDan, hoiDap, lienHe, donVi } = gioiThieu;

  const dangDaXacThuc = !dangTai && daXacThuc;
  const dichCta = dangDaXacThuc ? '/toi' : '/dang-nhap';

  const mucLuc = [
    noiDung.hien && { href: '#chuong-trinh', label: noiDung.tieuDe },
    loTrinh.hien && { href: '#lo-trinh', label: loTrinh.tieuDe },
    viSao.hien && { href: '#vi-sao', label: viSao.tieuDe },
    huongDan.hien && { href: '#huong-dan', label: huongDan.tieuDe },
    hoiDap.hien && { href: '#faq', label: hoiDap.tieuDe },
    lienHe.hien && { href: '#lien-he', label: lienHe.tieuDe },
  ].filter((m): m is { href: string; label: string } => Boolean(m));

  const hasHeroPanel = noiDung.hien && noiDung.moDun.length > 0;

  return (
    <Box>
      {thongBaoNoiBat && (
        <Box bg="blue.7" c="white" py="xs" ta="center">
          <Text size="sm" fw={500}>
            {thongBaoNoiBat}
          </Text>
        </Box>
      )}

      <HeaderCongKhai mucLuc={mucLuc} dichCta={dichCta} dangDaXacThuc={dangDaXacThuc} />

      {moDau.hien && (
        <Hero moDau={moDau} noiDung={noiDung} hasHeroPanel={hasHeroPanel} dichCta={dichCta} dangDaXacThuc={dangDaXacThuc} ctaPhuHref={mucLuc[0]?.href} />
      )}

      {conSo.hien && <DaiThongKe conSo={conSo} />}

      {noiDung.hien && <ChuongTrinh noiDung={noiDung} />}

      {loTrinh.hien && (
        <Box id="lo-trinh" bg="gray.0" py={{ base: 48, sm: 72 }}>
          <Container size="lg" px={{ base: 'md', sm: 'xl' }}>
            <Stack gap={32}>
              <Title order={2} ta="center" fz={{ base: 22, sm: 28 }}>
                {loTrinh.tieuDe}
              </Title>
              <DanhSachBuocSo buoc={loTrinh.buoc} mau="primary" />
            </Stack>
          </Container>
        </Box>
      )}

      {viSao.hien && <ViSao viSao={viSao} />}

      {huongDan.hien && (
        <Container id="huong-dan" size="lg" py={{ base: 48, sm: 72 }} px={{ base: 'md', sm: 'xl' }}>
          <Stack gap={32}>
            <Title order={2} ta="center" fz={{ base: 22, sm: 28 }}>
              {huongDan.tieuDe}
            </Title>
            <Box maw={640} mx="auto" w="100%">
              <DanhSachBuocSo buoc={huongDan.buoc} mau="accent" />
            </Box>
          </Stack>
        </Container>
      )}

      {hoiDap.hien && (
        <Container id="faq" size="sm" py={{ base: 48, sm: 72 }} px={{ base: 'md', sm: 'xl' }}>
          <Stack gap={24}>
            <Title order={2} ta="center" fz={{ base: 20, sm: 26 }}>
              {hoiDap.tieuDe}
            </Title>
            <Stack gap={12}>
              {hoiDap.cau.map((c) => (
                <Paper key={c.hoi} withBorder radius={12} p="md">
                  <Text fw={700} fz={14} mb={4}>
                    {c.hoi}
                  </Text>
                  <Text fz={13} c="dimmed" lh={1.6}>
                    {c.dap}
                  </Text>
                </Paper>
              ))}
            </Stack>
          </Stack>
        </Container>
      )}

      {lienHe.hien && <KhoiLienHe lienHe={lienHe} />}

      <FooterCongKhai donVi={donVi} />
    </Box>
  );
}

function laNoiDungCho(s: string): boolean {
  return s.startsWith('[CHỜ');
}

function HeaderCongKhai({
  mucLuc,
  dichCta,
  dangDaXacThuc,
}: {
  mucLuc: { href: string; label: string }[];
  dichCta: string;
  dangDaXacThuc: boolean;
}) {
  return (
    <Box component="header" style={{ borderBottom: '1px solid var(--mantine-color-gray-2)' }} py={12} px={{ base: 'md', sm: 'xl' }}>
      <Container size="lg" p={0} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
        <Image src={logoHcmue} alt="Trường Đại học Sư phạm Thành phố Hồ Chí Minh" h={36} w="auto" fit="contain" />
        <Group gap={26} visibleFrom="sm" style={{ flex: 1 }} justify="center">
          {mucLuc.map((m) => (
            <Anchor key={m.href} href={m.href} fz={13.5} fw={600} c="gray.7" underline="never">
              {m.label}
            </Anchor>
          ))}
        </Group>
        <Button component={Link} to={dichCta} size="sm">
          {dangDaXacThuc ? 'Vào trang của tôi' : 'Đăng nhập'}
        </Button>
      </Container>
    </Box>
  );
}

function Hero({
  moDau,
  noiDung,
  hasHeroPanel,
  dichCta,
  dangDaXacThuc,
  ctaPhuHref,
}: {
  moDau: typeof gioiThieu.moDau;
  noiDung: typeof gioiThieu.noiDung;
  hasHeroPanel: boolean;
  dichCta: string;
  dangDaXacThuc: boolean;
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
        <Group align="center" gap={48} wrap="wrap-reverse" justify={hasHeroPanel ? 'space-between' : 'center'}>
          <Stack gap="lg" maw={hasHeroPanel ? 620 : 680} style={{ flex: '1 1 380px' }}>
            <Title order={1} c="white" fz={{ base: 26, sm: 34, md: 44 }} lh={1.22}>
              {moDau.tenChuongTrinh}
            </Title>
            <Text c="gray.3" fz={{ base: 14.5, sm: 16.5 }} lh={1.65} maw={540}>
              {moDau.thongDiep}
            </Text>
            <Group gap="sm" wrap="wrap">
              <Button component={Link} to={dichCta} size="lg" color="accent">
                {dangDaXacThuc ? 'Vào trang của tôi' : moDau.nutChinh}
              </Button>
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
                {noiDung.moDun.slice(0, 4).map((m, i) => (
                  <Group
                    key={m.ten}
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
                        {m.ten}
                      </Text>
                      {m.hinhThuc && (
                        <Text fz={11.5} c="gray.4">
                          {m.hinhThuc}
                        </Text>
                      )}
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

function ChuongTrinh({ noiDung }: { noiDung: typeof gioiThieu.noiDung }) {
  const nenSac = ['var(--mantine-color-primary-0)', 'var(--mantine-color-success-0)', 'var(--mantine-color-danger-0)'];
  return (
    <Container id="chuong-trinh" size="lg" py={{ base: 48, sm: 72 }} px={{ base: 'md', sm: 'xl' }}>
      <Stack gap={40}>
        <Title order={2} ta="center" fz={{ base: 22, sm: 28 }}>
          {noiDung.tieuDe}
        </Title>
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="lg">
          {noiDung.moDun.map((m, i) => (
            <Paper key={m.ten} withBorder radius={16} p="lg">
              <Box
                w={44}
                h={44}
                mb="sm"
                style={{
                  borderRadius: 12,
                  background: nenSac[i % nenSac.length],
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
                {m.ten}
              </Text>
              <Text fz={13} c="dimmed" lh={1.55}>
                {m.moTa}
              </Text>
              {m.hinhThuc && (
                <Text fz={12} c="dimmed" fw={600} mt={8}>
                  {m.hinhThuc}
                </Text>
              )}
            </Paper>
          ))}
        </SimpleGrid>
      </Stack>
    </Container>
  );
}

function DanhSachBuocSo({ buoc, mau }: { buoc: { ten: string; moTa: string }[]; mau: 'primary' | 'accent' }) {
  return (
    <Stack gap={0}>
      {buoc.map((b, i) => {
        const cuoi = i === buoc.length - 1;
        return (
          <Box key={b.ten} style={{ display: 'flex', gap: 16 }}>
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
        );
      })}
    </Stack>
  );
}

function ViSao({ viSao }: { viSao: typeof gioiThieu.viSao }) {
  return (
    <Container id="vi-sao" size="lg" py={{ base: 48, sm: 72 }} px={{ base: 'md', sm: 'xl' }}>
      <Stack gap={32}>
        <Stack gap={8} maw={640} mx="auto" ta="center">
          <Title order={2} fz={{ base: 22, sm: 28 }}>
            {viSao.tieuDe}
          </Title>
          <Text fz={14} c="dimmed" lh={1.6}>
            {viSao.doanMo}
          </Text>
        </Stack>
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="lg">
          {viSao.loiIch.map((loi) => (
            <Paper key={loi} withBorder radius={14} p="md">
              <Text fz={13.5} lh={1.6}>
                {loi}
              </Text>
            </Paper>
          ))}
        </SimpleGrid>
        {viSao.cacMuc.length > 0 && (
          <SimpleGrid cols={{ base: 1, sm: viSao.cacMuc.length }} spacing="md">
            {viSao.cacMuc.map((m) => (
              <Paper key={m.ten} withBorder radius={14} p="md" ta="center">
                <Text fw={700} fz={14} mb={4}>
                  {m.ten}
                </Text>
                <Text fz={12.5} c="dimmed">
                  {m.moTa}
                </Text>
              </Paper>
            ))}
          </SimpleGrid>
        )}
      </Stack>
    </Container>
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

function FooterCongKhai({ donVi }: { donVi: typeof gioiThieu.donVi }) {
  const doiTacHien = donVi.hien ? donVi.phoiHop.filter((p) => p.hien) : [];
  return (
    <Box bg="#0F2942" py={{ base: 20, sm: 24 }} px={{ base: 'md', sm: 'xl' }}>
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
              · © {new Date().getFullYear()}
            </Text>
          </Group>
        </Stack>
      </Container>
    </Box>
  );
}
