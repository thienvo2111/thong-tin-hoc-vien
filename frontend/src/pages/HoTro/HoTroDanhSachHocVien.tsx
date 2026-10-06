import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Alert,
  Anchor,
  Badge,
  Button,
  Container,
  Group,
  Pagination,
  Paper,
  Select,
  Skeleton,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { useCumCuaToi, useDanhSachHocVienHoTro, xuatDanhSachHoTro } from '@/api/hoTro';
import { thongDiepLoiChung } from '@/lib/loiApi';
import { chuanHoaNfc } from '@/lib/nfc';
import { taiFileTuBlob } from '@/lib/taiFile';
import { TEN_BAI_KHAO_SAT } from '@/lib/trangThaiKhaoSat';

const KICH_THUOC_TRANG = 20;

const TUY_CHON_DANG_NHAP = [
  { value: '', label: 'Đăng nhập: tất cả' },
  { value: 'false', label: 'Chưa đăng nhập' },
  { value: 'true', label: 'Đã đăng nhập' },
];
const TUY_CHON_DAY_DU = [
  { value: '', label: 'Hồ sơ: tất cả' },
  { value: 'false', label: 'Hồ sơ chưa đủ' },
  { value: 'true', label: 'Hồ sơ đủ' },
];

const NHAN_KHAO_SAT: Record<string, string> = { da_mo: 'đã mở', dang_lam: 'đang làm', hoan_thanh: 'xong' };

function thanhBoolean(v: string): boolean | undefined {
  return v === '' ? undefined : v === 'true';
}

/** Danh sách học viên trong các cụm được phân công (ADR 0003 H5/H6). `?cum_id=` từ trang chủ. */
export default function HoTroDanhSachHocVien() {
  const [searchParams, setSearchParams] = useSearchParams();
  const cumId = searchParams.get('cum_id') ?? '';
  const [q, setQ] = useState('');
  const [qDebounced] = useDebouncedValue(q, 300);
  const [daDangNhap, setDaDangNhap] = useState('');
  const [dayDu, setDayDu] = useState('');
  const [page, setPage] = useState(1);
  const [dangXuat, setDangXuat] = useState(false);

  const cums = useCumCuaToi();
  const params = useMemo(
    () => ({
      q: qDebounced.trim() ? chuanHoaNfc(qDebounced.trim()) : undefined,
      cum_id: cumId || undefined,
      da_dang_nhap: thanhBoolean(daDangNhap),
      day_du: thanhBoolean(dayDu),
      page,
      page_size: KICH_THUOC_TRANG,
    }),
    [qDebounced, cumId, daDangNhap, dayDu, page],
  );
  const { data, isLoading, isError, error, isFetching } = useDanhSachHocVienHoTro(params);

  const tuyChonCum = [
    { value: '', label: 'Tất cả cụm của tôi' },
    ...(cums.data ?? []).map((c) => ({ value: c.cum_id, label: `${c.ten_cum} · ${c.ma_khoa}` })),
  ];

  function doiCum(v: string | null) {
    const next = new URLSearchParams(searchParams);
    if (v) next.set('cum_id', v);
    else next.delete('cum_id');
    setSearchParams(next, { replace: true });
    setPage(1);
  }

  async function xuat() {
    setDangXuat(true);
    try {
      const blob = await xuatDanhSachHoTro(params);
      const ngay = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      taiFileTuBlob(blob, `ds-cum-ho-tro-${ngay}.xlsx`);
    } catch (err) {
      notifications.show({ color: 'red', message: thongDiepLoiChung(err) });
    } finally {
      setDangXuat(false);
    }
  }

  const tongSoTrang = data ? Math.max(1, Math.ceil(data.total / data.page_size)) : 1;

  return (
    <Container size="xl" py="lg" px={{ base: 'md', md: 28 }}>
      <Stack gap="md">
        <Group justify="space-between">
          <Title order={3}>Học viên</Title>
          <Button variant="default" onClick={xuat} loading={dangXuat} disabled={!data || data.total === 0}>
            Xuất Excel
          </Button>
        </Group>
        <Group gap="sm" wrap="wrap">
          <TextInput
            placeholder="Họ tên (không dấu được), CCCD, mã MOET, tên đăng nhập"
            aria-label="Tìm kiếm"
            value={q}
            onChange={(e) => {
              setQ(e.currentTarget.value);
              setPage(1);
            }}
            w={{ base: '100%', sm: 340 }}
          />
          <Select aria-label="Cụm" data={tuyChonCum} value={cumId} onChange={doiCum} allowDeselect={false} w={{ base: '100%', sm: 240 }} />
          <Select
            aria-label="Đăng nhập"
            data={TUY_CHON_DANG_NHAP}
            value={daDangNhap}
            onChange={(v) => {
              setDaDangNhap(v ?? '');
              setPage(1);
            }}
            allowDeselect={false}
            w={{ base: '100%', sm: 180 }}
          />
          <Select
            aria-label="Hồ sơ"
            data={TUY_CHON_DAY_DU}
            value={dayDu}
            onChange={(v) => {
              setDayDu(v ?? '');
              setPage(1);
            }}
            allowDeselect={false}
            w={{ base: '100%', sm: 170 }}
          />
          <Text fz={12.5} c="dimmed" ml="auto">
            {data ? `${data.total.toLocaleString('vi-VN')} học viên` : ''}
          </Text>
        </Group>

        <Paper withBorder radius={14} style={{ overflow: 'hidden' }}>
          {isLoading && (
            <Stack p="md" gap="sm">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} height={36} />
              ))}
            </Stack>
          )}
          {isError && (
            <Alert color="red" m="md">
              {thongDiepLoiChung(error)}
            </Alert>
          )}
          {data && (
            <Table.ScrollContainer minWidth={960}>
              <Table verticalSpacing="sm" horizontalSpacing="md" highlightOnHover style={{ opacity: isFetching ? 0.6 : 1 }}>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Họ tên</Table.Th>
                    <Table.Th>Tên đăng nhập</Table.Th>
                    <Table.Th>Đơn vị công tác</Table.Th>
                    <Table.Th>Điện thoại</Table.Th>
                    <Table.Th>Cụm</Table.Th>
                    <Table.Th>Đăng nhập</Table.Th>
                    <Table.Th>Hồ sơ</Table.Th>
                    <Table.Th>Khảo sát</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {data.data.length === 0 && (
                    <Table.Tr>
                      <Table.Td colSpan={8}>
                        <Text c="dimmed" ta="center" py="lg">
                          Không có học viên nào khớp bộ lọc.
                        </Text>
                      </Table.Td>
                    </Table.Tr>
                  )}
                  {data.data.map((hv) => (
                    <Table.Tr key={hv.id}>
                      <Table.Td>
                        <Anchor component={Link} to={`/ho-tro/hoc-vien/${hv.id}`} fw={600} fz="sm">
                          {hv.ho_ten}
                        </Anchor>
                      </Table.Td>
                      <Table.Td>
                        <Text fz="sm" ff="monospace">
                          {hv.ten_dang_nhap ?? '—'}
                        </Text>
                      </Table.Td>
                      <Table.Td>{hv.don_vi_cong_tac_ten}</Table.Td>
                      <Table.Td>{hv.so_dien_thoai_lien_he ?? '—'}</Table.Td>
                      <Table.Td>{hv.cum.map((c) => c.ten_cum).join(', ')}</Table.Td>
                      <Table.Td>
                        <Badge color={hv.dang_nhap_lan_cuoi ? 'green' : 'yellow'} variant="light">
                          {hv.dang_nhap_lan_cuoi ? 'Đã đăng nhập' : 'Chưa'}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <Badge color={hv.day_du ? 'green' : 'orange'} variant="light">
                          {hv.day_du ? 'Đủ' : 'Chưa đủ'}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        {hv.khao_sat.length === 0 ? (
                          <Text fz="sm" c="dimmed">
                            Chưa làm
                          </Text>
                        ) : (
                          <Stack gap={0}>
                            {hv.khao_sat.map((k) => (
                              <Text key={k.loai} fz="xs">
                                {TEN_BAI_KHAO_SAT[k.loai as keyof typeof TEN_BAI_KHAO_SAT] ?? k.loai}: {NHAN_KHAO_SAT[k.trang_thai]}
                              </Text>
                            ))}
                          </Stack>
                        )}
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
          )}
        </Paper>

        {data && data.total > 0 && (
          <Group justify="space-between">
            <Text fz={12.5} c="dimmed">
              Trang {data.page} / {tongSoTrang}
            </Text>
            <Pagination value={page} onChange={setPage} total={tongSoTrang} size="sm" />
          </Group>
        )}
      </Stack>
    </Container>
  );
}
