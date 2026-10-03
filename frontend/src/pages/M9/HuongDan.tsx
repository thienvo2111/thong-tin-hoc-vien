import { useEffect, useState } from 'react';
import {
  Accordion,
  Anchor,
  Box,
  Button,
  Chip,
  Container,
  CopyButton,
  Flex,
  Group,
  Image,
  NativeSelect,
  Paper,
  SegmentedControl,
  SimpleGrid,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { Link } from 'react-router-dom';
import { useToi } from '@/auth/AuthContext';
import { StatusBanner } from '@/components/StatusBanner';
import { TextMarkup } from '@/components/TextMarkup';
import {
  huongDan,
  NHAN_NHOM_LOI,
  type BangDuLieu,
  type HinhKey,
  type LienHeHoTro,
  type NhomLoi,
  type PhanHuongDan,
  type TinhHuongLoi,
} from '@/content/huongDan';
import { hinhHuongDan } from '@/content/huongDanHinh';
import { khopTimKiem } from '@/lib/timKiemTiengViet';
import { matKhauLanDau } from '@/lib/matKhauLanDau';
import logoHcmue from '@/assets/logo-hcmue.png';

type ThietBi = 'pc' | 'phone';

/** M9 — Hướng dẫn sử dụng (công khai, /huong-dan). Nội dung lấy từ src/content/huongDan.ts,
 * component chỉ hiển thị (dac-ta-cong-hoc-vien.md § M9). */
export default function HuongDan() {
  const [thietBiChon, setThietBiChon] = useState<ThietBi | null>(null);
  const laManHinhRong = useMediaQuery('(min-width: 62em)');
  const thietBi: ThietBi = thietBiChon ?? (laManHinhRong ? 'pc' : 'phone');

  // Trang nạp lazy nên trình duyệt không tự cuộn tới neo (vd /huong-dan#loi từ trang khác) — chờ
  // trang nạp xong rồi mới cuộn, giống M0 (TrangGioiThieu.tsx).
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

  const mucLuc = [
    ...huongDan.parts.map((p) => ({ id: p.id, tieuDe: p.tieuDe })),
    { id: 'loi', tieuDe: 'Lỗi thường gặp và cách khắc phục' },
    { id: 'lien-he', tieuDe: 'Liên hệ hỗ trợ và an toàn tài khoản' },
  ];

  return (
    <Box>
      <HeaderCongKhai />
      <HeroHuongDan />

      <Container size="lg" py={{ base: 32, sm: 48 }} px={{ base: 'md', sm: 'xl' }}>
        <Group justify="flex-end" mb="xl">
          <SegmentedControl
            aria-label="Kiểu hình minh họa"
            value={thietBi}
            onChange={(v) => setThietBiChon(v as ThietBi)}
            data={[
              { label: 'Máy tính', value: 'pc' },
              { label: 'Điện thoại', value: 'phone' },
            ]}
          />
        </Group>

        <Box data-testid="hang-bo-cuc" style={{ display: 'flex', flexWrap: 'wrap', gap: 40, alignItems: 'flex-start' }}>
          <MucLuc danhSach={mucLuc} />

          <Stack gap={56} style={{ flex: '1 1 280px', minWidth: 0 }}>
            {huongDan.parts.map((p, i) => (
              <PhanGenericSection key={p.id} phan={p} soThuTu={i + 1} thietBi={thietBi} />
            ))}
            <LoiThuongGap troubleshooting={huongDan.troubleshooting} email={huongDan.contact.email} />
            <LienHeSection contact={huongDan.contact} />
          </Stack>
        </Box>
      </Container>

      <FooterHuongDan />
    </Box>
  );
}

function HeaderCongKhai() {
  const { dangTai, daXacThuc } = useToi();
  const dangDaXacThuc = !dangTai && daXacThuc;
  const cta = dangDaXacThuc ? { href: '/toi', nhan: 'Vào trang của tôi' } : { href: '/dang-nhap', nhan: 'Đăng nhập' };

  return (
    <Box component="header" style={{ borderBottom: '1px solid var(--mantine-color-gray-2)' }} py={12} px={{ base: 'md', sm: 'xl' }}>
      <Container
        size="lg"
        p={0}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}
      >
        <Anchor component={Link} to="/" underline="never" style={{ display: 'flex', alignItems: 'center' }}>
          <Image src={logoHcmue} alt="Trường Đại học Sư phạm Thành phố Hồ Chí Minh" h={36} w="auto" fit="contain" />
        </Anchor>
        <Group gap="md" wrap="wrap">
          <Anchor component={Link} to="/" fz={13.5} fw={600} c="gray.7" underline="never">
            Trang giới thiệu
          </Anchor>
          <Button component={Link} to={cta.href} size="sm">
            {cta.nhan}
          </Button>
        </Group>
      </Container>
    </Box>
  );
}

function HeroHuongDan() {
  const { hero } = huongDan;
  return (
    <Box bg="primary.7" py={{ base: 32, sm: 48 }} px={{ base: 'md', sm: 'xl' }}>
      <Container size="lg" p={0}>
        <Stack gap={10}>
          <Text c="primary.1" fz={11.5} fw={700} tt="uppercase" style={{ letterSpacing: '.1em' }}>
            Trường Đại học Sư phạm TP. Hồ Chí Minh · Tài liệu dành cho học viên
          </Text>
          <Title order={1} c="white" fz={{ base: 22, sm: 30 }} maw={640}>
            {hero.tieuDe}
          </Title>
          <Text c="gray.3" fz={{ base: 13.5, sm: 15 }} maw={720} lh={1.6}>
            {hero.gioiThieu}
          </Text>
          <Group gap="xl" mt={6}>
            <Box>
              <Text c="gray.4" fz={11}>
                Địa chỉ hệ thống
              </Text>
              <Text c="white" fw={700} fz={14.5}>
                {hero.diaChi}
              </Text>
            </Box>
            <Box>
              <Text c="gray.4" fz={11}>
                Email hỗ trợ
              </Text>
              <Text c="white" fw={700} fz={14.5}>
                {hero.email}
              </Text>
            </Box>
          </Group>
        </Stack>
      </Container>
    </Box>
  );
}

function MucLuc({ danhSach }: { danhSach: { id: string; tieuDe: string }[] }) {
  return (
    <>
      <Box visibleFrom="md" w={240} style={{ flexShrink: 0, position: 'sticky', top: 16, alignSelf: 'flex-start' }}>
        <Text fz={11} fw={700} tt="uppercase" c="dimmed" mb={8} style={{ letterSpacing: '.08em' }}>
          Mục lục
        </Text>
        <Stack gap={2} component="ol" m={0} p={0} style={{ listStyle: 'none' }}>
          {danhSach.map((m, i) => (
            <Box key={m.id} component="li">
              <Anchor
                href={`#${m.id}`}
                fz={13.5}
                fw={500}
                c="gray.7"
                underline="never"
                style={{ display: 'flex', gap: 8, padding: '5px 8px', borderRadius: 6 }}
              >
                <Text component="span" c="dimmed" fz={13} style={{ minWidth: '1.4em' }}>
                  {i + 1}
                </Text>
                {m.tieuDe}
              </Anchor>
            </Box>
          ))}
        </Stack>
      </Box>

      <Box hiddenFrom="md" style={{ width: '100%' }}>
        <NativeSelect
          label="Đi tới phần"
          data={[{ value: '', label: '— Chọn phần —' }, ...danhSach.map((m, i) => ({ value: m.id, label: `${i + 1}. ${m.tieuDe}` }))]}
          onChange={(e) => {
            const id = e.currentTarget.value;
            if (id) window.location.hash = id;
          }}
        />
      </Box>
    </>
  );
}

function HeaderPhan({ soThuTu, tieuDe, moTa }: { soThuTu: number; tieuDe: string; moTa: string }) {
  return (
    <Box style={{ borderBottom: '2px solid var(--mantine-color-gray-2)', paddingBottom: 12 }}>
      <Text fw={700} fz={12} c="accent.6" tt="uppercase" style={{ letterSpacing: '.08em' }}>
        Phần {soThuTu}
      </Text>
      <Title order={2} fz={{ base: 20, sm: 24 }}>
        {tieuDe}
      </Title>
      <Text c="dimmed" fz={14} mt={6} lh={1.6}>
        <TextMarkup text={moTa} />
      </Text>
    </Box>
  );
}

function DanhSachBuoc({ buoc }: { buoc: string[] }) {
  return (
    <Stack gap={12} component="ol" m={0} p={0} style={{ listStyle: 'none' }}>
      {buoc.map((b, i) => (
        <Group key={i} gap={10} align="flex-start" wrap="nowrap" component="li">
          <Box
            w={24}
            h={24}
            style={{
              borderRadius: '50%',
              background: 'var(--mantine-color-accent-6)',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: 12,
              flexShrink: 0,
            }}
          >
            {i + 1}
          </Box>
          <Text fz={14} lh={1.6} style={{ flex: 1, minWidth: 0 }}>
            <TextMarkup text={b} />
          </Text>
        </Group>
      ))}
    </Stack>
  );
}

function KhoiAnhVaBuoc({ hinh, thietBi, buoc }: { hinh: HinhKey; thietBi: ThietBi; buoc?: string[] }) {
  const anh = hinhHuongDan[hinh];
  const src = thietBi === 'pc' ? anh.pc : anh.phone;
  const anhNode = (
    <Image
      src={src}
      alt={anh.alt}
      loading="lazy"
      radius="md"
      style={{ maxWidth: thietBi === 'pc' ? '100%' : 320, width: '100%' }}
    />
  );

  if (!buoc) return anhNode;

  if (thietBi === 'pc') {
    return (
      <Stack gap="md">
        {anhNode}
        <DanhSachBuoc buoc={buoc} />
      </Stack>
    );
  }

  return (
    <Flex gap="lg" wrap="wrap" align="flex-start">
      <Box style={{ flex: '0 1 320px' }}>{anhNode}</Box>
      <Box style={{ flex: '1 1 280px', minWidth: 0 }}>
        <DanhSachBuoc buoc={buoc} />
      </Box>
    </Flex>
  );
}

function BangHuongDan({ bang }: { bang: BangDuLieu }) {
  return (
    <Table.ScrollContainer minWidth={420}>
      <Table striped withTableBorder verticalSpacing="sm" fz={13.5}>
        <Table.Thead>
          <Table.Tr>
            {bang.cot.map((c) => (
              <Table.Th key={c}>{c}</Table.Th>
            ))}
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {bang.hang.map((h, i) => (
            <Table.Tr key={i}>
              {h.map((cell, j) => (
                <Table.Td key={j}>
                  <TextMarkup text={cell} />
                </Table.Td>
              ))}
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  );
}

/** Giai đoạn 1-5 (Phần 1 "Tổng quan"). */
function KhoiGiaiDoan() {
  return (
    <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
      {huongDan.giaiDoan.map((g, i) => (
        <Paper key={g.ten} withBorder radius={12} p="md">
          <Stack gap={4}>
            <Text fz={11} fw={700} tt="uppercase" c="accent.6" style={{ letterSpacing: '.06em' }}>
              Giai đoạn {i + 1}
            </Text>
            <Text fw={700} fz={14}>
              {g.ten}
            </Text>
            <Text fz={13} c="dimmed" lh={1.5}>
              <TextMarkup text={g.moTa} />
            </Text>
            {g.nhan && (
              <Text
                fz={11.5}
                fw={600}
                c="primary.7"
                mt={4}
                style={{ background: 'var(--mantine-color-primary-0)', borderRadius: 999, padding: '2px 10px', justifySelf: 'start' }}
              >
                {g.nhan}
              </Text>
            )}
          </Stack>
        </Paper>
      ))}
    </SimpleGrid>
  );
}

/** Checklist chuẩn bị (Phần 2). */
function KhoiChuanBi() {
  return (
    <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
      {huongDan.chuanBi.map((m) => (
        <Paper key={m.tieuDe} withBorder radius={12} p="md">
          <Stack gap={4}>
            <Text fw={700} fz={14}>
              {m.tieuDe}
            </Text>
            <Text fz={13} c="dimmed" lh={1.5}>
              {m.moTa}
            </Text>
          </Stack>
        </Paper>
      ))}
    </SimpleGrid>
  );
}

/** Công cụ tìm mật khẩu lần đầu từ ngày sinh (Phần 3 "Đăng nhập lần đầu"). */
function CongCuMatKhau() {
  const [ngay, setNgay] = useState('8');
  const [thang, setThang] = useState('12');
  const [nam, setNam] = useState('1983');
  const matKhau = matKhauLanDau(Number(ngay), Number(thang), Number(nam));

  const ngayData = Array.from({ length: 31 }, (_, i) => String(i + 1));
  const thangData = Array.from({ length: 12 }, (_, i) => String(i + 1));
  const namData = Array.from({ length: 2008 - 1950 + 1 }, (_, i) => String(1950 + i));

  return (
    <Paper withBorder radius={12} p="lg" maw={560}>
      <Stack gap={12}>
        <Text fw={700} fz={14}>
          Tìm mật khẩu lần đầu từ ngày sinh
        </Text>
        <Group gap={10} wrap="wrap">
          <NativeSelect label="Ngày" data={ngayData} value={ngay} onChange={(e) => setNgay(e.currentTarget.value)} w={90} />
          <NativeSelect label="Tháng" data={thangData} value={thang} onChange={(e) => setThang(e.currentTarget.value)} w={90} />
          <NativeSelect label="Năm" data={namData} value={nam} onChange={(e) => setNam(e.currentTarget.value)} w={110} />
        </Group>
        <Text fz={14}>
          Mật khẩu lần đầu:{' '}
          <Text component="span" fz={26} fw={700} c="primary.7" style={{ letterSpacing: '.1em', fontVariantNumeric: 'tabular-nums' }}>
            {matKhau}
          </Text>
        </Text>
        <Text fz={11.5} c="dimmed">
          Công cụ chỉ chạy trên máy của Thầy/Cô, không lưu và không gửi đi đâu.
        </Text>
      </Stack>
    </Paper>
  );
}

function PhanGenericSection({ phan, soThuTu, thietBi }: { phan: PhanHuongDan; soThuTu: number; thietBi: ThietBi }) {
  return (
    <Box component="section" id={phan.id} style={{ scrollMarginTop: 16 }}>
      <Stack gap={20}>
        <HeaderPhan soThuTu={soThuTu} tieuDe={phan.tieuDe} moTa={phan.moTa} />

        {phan.id === 'tong-quan' && <KhoiGiaiDoan />}
        {phan.id === 'chuan-bi' && <KhoiChuanBi />}

        {phan.hinh ? (
          <KhoiAnhVaBuoc hinh={phan.hinh} thietBi={thietBi} buoc={phan.buoc} />
        ) : (
          phan.buoc && <DanhSachBuoc buoc={phan.buoc} />
        )}

        {phan.id === 'dang-nhap' && <CongCuMatKhau />}

        {phan.bang?.map((b, i) => (
          <BangHuongDan key={i} bang={b} />
        ))}

        {phan.ghiChu?.map((g, i) => (
          <StatusBanner key={i} loai={g.loai} tieuDe={g.tieuDe}>
            <TextMarkup text={g.noiDung} />
          </StatusBanner>
        ))}

        {phan.id === 'tong-quan' && (
          <StatusBanner loai={huongDan.zaloNote.loai} tieuDe={huongDan.zaloNote.tieuDe}>
            <TextMarkup text={huongDan.zaloNote.noiDung} />
          </StatusBanner>
        )}
      </Stack>
    </Box>
  );
}

/** Phần 12 — Lỗi thường gặp: tìm kiếm không dấu + lọc theo nhóm + accordion. */
function LoiThuongGap({ troubleshooting, email }: { troubleshooting: TinhHuongLoi[]; email: string }) {
  const [tuKhoa, setTuKhoa] = useState('');
  const [nhom, setNhom] = useState<NhomLoi | ''>('');

  const ketQua = troubleshooting.filter((t) => {
    if (nhom && t.nhom !== nhom) return false;
    if (!tuKhoa.trim()) return true;
    const vanBan = [t.nhanNhom, t.tinhHuong, t.nguyenNhan, ...t.cachXuLy].join(' ');
    return khopTimKiem(vanBan, tuKhoa);
  });

  return (
    <Box component="section" id="loi" style={{ scrollMarginTop: 16 }}>
      <Stack gap={20}>
        <HeaderPhan
          soThuTu={12}
          tieuDe="Lỗi thường gặp và cách khắc phục"
          moTa="Gõ vài chữ của thông báo đang thấy trên màn hình để tìm nhanh, hoặc chọn nhóm vấn đề. Bấm vào từng dòng để xem cách xử lý."
        />

        <TextInput
          label="Tìm lỗi"
          placeholder="Ví dụ: mật khẩu, tạm khóa, CCCD…"
          value={tuKhoa}
          onChange={(e) => setTuKhoa(e.currentTarget.value)}
        />

        <Chip.Group multiple={false} value={nhom} onChange={(v) => setNhom(v as NhomLoi | '')}>
          <Group gap={8}>
            <Chip value="">Tất cả</Chip>
            {(Object.keys(NHAN_NHOM_LOI) as NhomLoi[]).map((n) => (
              <Chip key={n} value={n}>
                {NHAN_NHOM_LOI[n]}
              </Chip>
            ))}
          </Group>
        </Chip.Group>

        {ketQua.length === 0 ? (
          <Text c="dimmed" fz={14}>
            Chưa tìm thấy lỗi phù hợp. Thầy/Cô gửi email tới {email} theo mẫu ở Phần 13.
          </Text>
        ) : (
          <Accordion variant="separated" radius="md">
            {ketQua.map((t, i) => (
              <Accordion.Item key={`${t.nhom}-${i}`} value={`${t.nhom}-${i}`}>
                <Accordion.Control>
                  <Text fz={11} fw={700} tt="uppercase" c="dimmed" style={{ letterSpacing: '.06em' }}>
                    {t.nhanNhom}
                  </Text>
                  <Text fw={600} fz={14}>
                    {t.tinhHuong}
                  </Text>
                </Accordion.Control>
                <Accordion.Panel>
                  <Stack gap={10}>
                    <Text fz={13} c="dimmed">
                      <TextMarkup text={t.nguyenNhan} />
                    </Text>
                    <Stack gap={6} component="ol" m={0} pl={20}>
                      {t.cachXuLy.map((b, j) => (
                        <Text key={j} component="li" fz={13.5} lh={1.5}>
                          <TextMarkup text={b} />
                        </Text>
                      ))}
                    </Stack>
                  </Stack>
                </Accordion.Panel>
              </Accordion.Item>
            ))}
          </Accordion>
        )}
      </Stack>
    </Box>
  );
}

/** Phần 13 — Liên hệ hỗ trợ và an toàn tài khoản. */
function LienHeSection({ contact }: { contact: LienHeHoTro }) {
  const mau = contact.mauEmail.join('\n');

  return (
    <Box component="section" id="lien-he" style={{ scrollMarginTop: 16 }}>
      <Stack gap={20}>
        <HeaderPhan
          soThuTu={13}
          tieuDe="Liên hệ hỗ trợ và an toàn tài khoản"
          moTa="Viết email đủ thông tin theo mẫu dưới đây giúp cán bộ hỗ trợ xử lý ngay, không phải hỏi lại."
        />

        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
          <Paper withBorder radius={14} p="lg">
            <Stack gap={8}>
              <Text fw={700} fz={13}>
                Email hỗ trợ
              </Text>
              <Text fz={18} fw={700} c="primary.7" style={{ userSelect: 'all', wordBreak: 'break-all' }}>
                {contact.email}
              </Text>
              <CopyButton value={contact.email}>
                {({ copied, copy }) => (
                  <Button size="xs" color={copied ? 'success' : 'accent'} onClick={copy} style={{ justifySelf: 'start' }}>
                    {copied ? 'Đã sao chép' : 'Sao chép địa chỉ email'}
                  </Button>
                )}
              </CopyButton>
              <Text fz={12.5} c="dimmed">
                Gửi từ email cá nhân Thầy/Cô đã khai trong hồ sơ (nếu có).
              </Text>
            </Stack>
          </Paper>

          <Paper withBorder radius={14} p="lg">
            <Stack gap={8}>
              <Text fw={700} fz={13}>
                Mẫu email
              </Text>
              <Text
                component="pre"
                fz={12.5}
                p={10}
                style={{
                  whiteSpace: 'pre-wrap',
                  fontFamily: 'inherit',
                  background: 'var(--mantine-color-gray-0)',
                  border: '1px dashed var(--mantine-color-gray-4)',
                  borderRadius: 8,
                  margin: 0,
                  userSelect: 'all',
                }}
              >
                {mau}
              </Text>
              <CopyButton value={mau}>
                {({ copied, copy }) => (
                  <Button size="xs" color={copied ? 'success' : 'accent'} onClick={copy} style={{ justifySelf: 'start' }}>
                    {copied ? 'Đã sao chép' : 'Sao chép mẫu email'}
                  </Button>
                )}
              </CopyButton>
            </Stack>
          </Paper>
        </SimpleGrid>

        <StatusBanner loai="warning" tieuDe="Không bao giờ gửi mật khẩu">
          Cán bộ hỗ trợ không bao giờ hỏi mật khẩu của Thầy/Cô. Không ghi mật khẩu trong email hay tin nhắn.
        </StatusBanner>

        <Title order={3} fz={16}>
          Giữ an toàn tài khoản
        </Title>
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
          {contact.anToan.map((a, i) => (
            <Paper key={i} p="md" radius={10} style={{ borderLeft: '3px solid var(--mantine-color-success-6)' }}>
              <Text fz={13.5}>
                <TextMarkup text={a} />
              </Text>
            </Paper>
          ))}
        </SimpleGrid>
      </Stack>
    </Box>
  );
}

function FooterHuongDan() {
  return (
    <Box bg="#0F2942" py={20} px={{ base: 'md', sm: 'xl' }}>
      <Container size="lg" p={0}>
        <Stack gap={4} ta="center">
          <Text fz={12.5} c="gray.3">
            Trường Đại học Sư phạm Thành phố Hồ Chí Minh · Hệ thống Bồi dưỡng Năng lực số
          </Text>
          <Text fz={12} c="gray.5">
            {huongDan.hero.diaChi} · {huongDan.hero.email}
          </Text>
        </Stack>
      </Container>
    </Box>
  );
}
