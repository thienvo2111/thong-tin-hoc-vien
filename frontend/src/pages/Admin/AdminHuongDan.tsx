import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Accordion,
  Anchor,
  Badge,
  Box,
  Button,
  Container,
  Group,
  List,
  Paper,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { useToi } from '@/auth/AuthContext';
import { StatusBanner } from '@/components/StatusBanner';
import { TextMarkup } from '@/components/TextMarkup';
import type { BangDuLieu, GhiChu } from '@/content/huongDan';
import { huongDanQuanTri, type MucQuanTri, type PhanQuanTri } from '@/content/huongDanQuanTri';
import { khopTimKiem } from '@/lib/timKiemTiengViet';
import { AdminPageHeader } from './AdminPageHeader';

/** Gom mọi chữ của 1 phần để ô tìm kiếm khớp cả nội dung bên trong (không chỉ tiêu đề). */
function chuCuaPhan(p: PhanQuanTri): string {
  const muc = (m: MucQuanTri) =>
    [m.tieuDe ?? '', ...(m.buoc ?? []), ...(m.ghiChu ?? []).flatMap((g) => [g.tieuDe, g.noiDung]), ...(m.bang ?? []).flatMap((b) => b.hang.flat())].join(' ');
  return [p.tieuDe, p.moTa, muc(p), ...(p.muc ?? []).map(muc)].join(' ');
}

/** Hướng dẫn sử dụng trang quản trị (2026-10-06) — nội dung ở content/huongDanQuanTri.ts (cùng nguồn với bản
 * Word sinh bởi scripts/huong-dan/tao-docx.mjs --quan-tri). Tài khoản đơn vị chỉ thấy phần dành cho mọi tài khoản. */
export default function AdminHuongDan() {
  const { nguoiDung } = useToi();
  const laQuanTri = nguoiDung?.vai_tro === 'quan_tri';
  const [tim, setTim] = useState('');

  const phan = huongDanQuanTri.parts.filter((p) => laQuanTri || p.vaiTro === 'tat_ca');
  const hienPhan = tim.trim() ? phan.filter((p) => khopTimKiem(chuCuaPhan(p), tim)) : phan;
  const hoiDap = huongDanQuanTri.hoiDap.filter((h) => laQuanTri || h.vaiTro === 'tat_ca');

  return (
    <>
      <AdminPageHeader title="Hướng dẫn sử dụng" />
      <Container size="lg" py="lg" px={{ base: 'md', md: 28 }}>
        <Stack gap="xl">
          <Stack gap="xs">
            <Text>
              <TextMarkup text={huongDanQuanTri.gioiThieu} />
            </Text>
            {!laQuanTri && (
              <Text size="sm" c="dimmed">
                Tài khoản của Thầy/Cô thuộc đơn vị (Sở, Phòng, Trường), chỉ hiện các phần dùng được với tài khoản này.
              </Text>
            )}
          </Stack>

          {laQuanTri && (
            <Paper withBorder radius="md" p="lg" aria-label="Quy trình vận hành">
              <Title order={2} fz={18} mb="sm">
                Quy trình vận hành một khóa bồi dưỡng
              </Title>
              <List type="ordered" spacing="xs">
                {huongDanQuanTri.quyTrinh.map((b) => (
                  <List.Item key={b}>
                    <TextMarkup text={b} />
                  </List.Item>
                ))}
              </List>
            </Paper>
          )}

          <TextInput
            label="Tìm trong hướng dẫn"
            placeholder="Ví dụ: nhập dữ liệu, đợt xác nhận, mật khẩu…"
            value={tim}
            onChange={(e) => setTim(e.currentTarget.value)}
            maw={480}
          />

          <Group align="flex-start" gap={40} wrap="nowrap">
            <Box visibleFrom="md" w={240} style={{ flexShrink: 0, position: 'sticky', top: 16 }}>
              <Text fz={11} fw={700} tt="uppercase" c="dimmed" mb={8} style={{ letterSpacing: '.08em' }}>
                Mục lục
              </Text>
              <Stack gap={4}>
                {hienPhan.map((p, i) => (
                  <Anchor key={p.id} href={`#${p.id}`} fz={13.5} c="gray.7" underline="never">
                    {i + 1}. {p.tieuDe}
                  </Anchor>
                ))}
                {hoiDap.length > 0 && (
                  <Anchor href="#hoi-dap" fz={13.5} c="gray.7" underline="never">
                    Hỏi đáp thường gặp
                  </Anchor>
                )}
              </Stack>
            </Box>

            <Stack gap={40} style={{ flex: 1, minWidth: 0 }}>
              {hienPhan.length === 0 && <Text c="dimmed">Không tìm thấy nội dung phù hợp.</Text>}
              {hienPhan.map((p, i) => (
                <PhanHuongDan key={p.id} phan={p} so={i + 1} />
              ))}

              {hoiDap.length > 0 && (
                <Box component="section" id="hoi-dap" style={{ scrollMarginTop: 16 }}>
                  <Title order={2} fz={20} mb="sm">
                    Hỏi đáp thường gặp
                  </Title>
                  <Accordion variant="separated">
                    {hoiDap.map((h, i) => (
                      <Accordion.Item key={h.hoi} value={`hoi-dap-${i}`}>
                        <Accordion.Control>{h.hoi}</Accordion.Control>
                        <Accordion.Panel>
                          <TextMarkup text={h.dap} />
                        </Accordion.Panel>
                      </Accordion.Item>
                    ))}
                  </Accordion>
                </Box>
              )}
            </Stack>
          </Group>
        </Stack>
      </Container>
    </>
  );
}

function PhanHuongDan({ phan, so }: { phan: PhanQuanTri; so: number }) {
  return (
    <Box component="section" id={phan.id} style={{ scrollMarginTop: 16 }}>
      <Stack gap="md">
        <Box style={{ borderBottom: '2px solid var(--mantine-color-gray-2)', paddingBottom: 10 }}>
          <Group gap="xs" align="center">
            <Text fw={700} fz={12} c="accent.6" tt="uppercase" style={{ letterSpacing: '.08em' }}>
              Phần {so}
            </Text>
            {phan.vaiTro === 'quan_tri' && (
              <Badge size="xs" variant="light" color="gray">
                Chỉ Quản trị
              </Badge>
            )}
          </Group>
          <Group justify="space-between" align="center" gap="sm">
            <Title order={2} fz={{ base: 19, sm: 22 }}>
              {phan.tieuDe}
            </Title>
            {phan.manHinh && (
              <Button component={Link} to={phan.manHinh.duongDan} size="xs" variant="light">
                Mở màn hình {phan.manHinh.nhan}
              </Button>
            )}
          </Group>
          <Text c="dimmed" fz={14} mt={6}>
            <TextMarkup text={phan.moTa} />
          </Text>
        </Box>
        <NoiDungMuc muc={phan} />
        {phan.muc?.map((m) => (
          <Stack key={m.tieuDe} gap="sm">
            {m.tieuDe && (
              <Title order={3} fz={16}>
                {m.tieuDe}
              </Title>
            )}
            <NoiDungMuc muc={m} />
          </Stack>
        ))}
      </Stack>
    </Box>
  );
}

function NoiDungMuc({ muc }: { muc: MucQuanTri }) {
  return (
    <>
      {muc.buoc && (
        <List type="ordered" spacing={6}>
          {muc.buoc.map((b) => (
            <List.Item key={b}>
              <TextMarkup text={b} />
            </List.Item>
          ))}
        </List>
      )}
      {muc.bang?.map((b, i) => <BangNoiDung key={i} bang={b} />)}
      {muc.ghiChu?.map((g: GhiChu) => (
        <StatusBanner key={g.tieuDe} loai={g.loai} tieuDe={g.tieuDe}>
          <TextMarkup text={g.noiDung} />
        </StatusBanner>
      ))}
    </>
  );
}

function BangNoiDung({ bang }: { bang: BangDuLieu }) {
  return (
    <Table.ScrollContainer minWidth={560}>
      <Table withTableBorder withColumnBorders verticalSpacing="xs" fz="sm">
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
              {h.map((o, j) => (
                <Table.Td key={j}>
                  <TextMarkup text={o} />
                </Table.Td>
              ))}
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  );
}
