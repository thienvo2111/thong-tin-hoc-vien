import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Alert, Anchor, Badge, Container, Group, Paper, Select, Skeleton, Stack, Text, TextInput, Title } from '@mantine/core';
import { useCumCuaToi, useLichHocHoTro } from '@/api/hoTro';
import type { BuoiHocHoTro, LoaiLop } from '@/api/types';
import { chuanHoaLienKet } from '@/lib/lienKet';
import { thongDiepLoiChung } from '@/lib/loiApi';
import { dinhDangGio, dinhDangNgay, ngayIsoVn } from '@/lib/ngay';
import { CoNhacCum, NhacCumNgay } from './NhacCum';

const NHAN_LOAI_LOP: Record<LoaiLop, string> = { truc_tiep: 'Trực tiếp', zoom: 'Zoom', vle: 'VLE' };

/** Lịch các buổi học của lớp có học viên trong cụm (ADR 0003 H5) — mặc định 14 ngày tới. */
export default function HoTroLichHoc() {
  const [searchParams, setSearchParams] = useSearchParams();
  const cumId = searchParams.get('cum_id') ?? '';
  const [tuNgay, setTuNgay] = useState('');
  const [denNgay, setDenNgay] = useState('');
  const cums = useCumCuaToi();
  const { data, isLoading, isError, error, isFetching } = useLichHocHoTro({
    cum_id: cumId || undefined,
    tu_ngay: tuNgay || undefined,
    den_ngay: denNgay || undefined,
  });

  const theoNgay = useMemo(() => {
    const nhom = new Map<string, BuoiHocHoTro[]>();
    for (const b of data ?? []) {
      const ngay = ngayIsoVn(b.thoi_gian_bat_dau);
      nhom.set(ngay, [...(nhom.get(ngay) ?? []), b]);
    }
    return [...nhom.entries()];
  }, [data]);
  const tenCum = useMemo(() => new Map((cums.data ?? []).map((c) => [c.cum_id, c.ten_cum])), [cums.data]);

  function doiCum(v: string | null) {
    const next = new URLSearchParams(searchParams);
    if (v) next.set('cum_id', v);
    else next.delete('cum_id');
    setSearchParams(next, { replace: true });
  }

  return (
    <Container size="lg" py="lg" px={{ base: 'md', md: 28 }}>
      <Stack gap="md">
        <Title order={3}>Lịch học</Title>
        <Group gap="sm" wrap="wrap" align="flex-end">
          <Select
            label="Cụm"
            data={[
              { value: '', label: 'Tất cả cụm của tôi' },
              ...(cums.data ?? []).map((c) => ({ value: c.cum_id, label: `${c.ten_cum} · ${c.ma_khoa}` })),
            ]}
            value={cumId}
            onChange={doiCum}
            allowDeselect={false}
            w={240}
          />
          <TextInput label="Từ ngày" type="date" value={tuNgay} onChange={(e) => setTuNgay(e.currentTarget.value)} w={170} />
          <TextInput label="Đến ngày" type="date" value={denNgay} onChange={(e) => setDenNgay(e.currentTarget.value)} w={170} />
          {!tuNgay && !denNgay && (
            <Text fz="xs" c="dimmed" pb={8}>
              Mặc định: hôm nay và 14 ngày tới
            </Text>
          )}
        </Group>

        {isLoading && <Skeleton height={160} />}
        {isError && <Alert color="red">{thongDiepLoiChung(error)}</Alert>}
        {data && data.length === 0 && (
          <Text c="dimmed" ta="center" py="lg">
            Không có buổi học nào của học viên trong cụm trong khoảng thời gian này.
          </Text>
        )}
        <Stack gap="md" style={{ opacity: isFetching ? 0.6 : 1 }}>
          {theoNgay.map(([ngay, buoi]) => (
            <Stack key={ngay} gap="xs">
              <Group justify="space-between" wrap="wrap" gap="xs">
                <Text fw={700}>{dinhDangNgay(buoi[0].thoi_gian_bat_dau)}</Text>
                <NhacCumNgay
                  ngay={ngay}
                  nhanNgay={dinhDangNgay(buoi[0].thoi_gian_bat_dau)}
                  cumIds={[...new Set(buoi.flatMap((b) => (b.nhac_cum ?? []).map((n) => n.cum_id)))]}
                  tenCum={tenCum}
                />
              </Group>
              {buoi.map((b) => {
                const href = b.dia_diem_hoac_link ? chuanHoaLienKet(b.dia_diem_hoac_link) : null;
                return (
                  <Paper key={b.id} withBorder radius={12} p="sm">
                    <Group justify="space-between" wrap="wrap" gap="xs">
                      <Group gap="xs">
                        <Text fw={600} fz="sm">
                          {dinhDangGio(b.thoi_gian_bat_dau)}–{dinhDangGio(b.thoi_gian_ket_thuc)}
                        </Text>
                        <Text fz="sm">
                          Lớp {b.lop.ten_lop} · Buổi {b.buoi_so}
                        </Text>
                        <Badge variant="light">{NHAN_LOAI_LOP[b.lop.loai_lop]}</Badge>
                      </Group>
                      <Text fz="xs" c="dimmed">
                        {b.so_hoc_vien_cum} học viên của cụm · {b.khoa.ma_khoa} · GĐ{b.giai_doan.thu_tu}
                      </Text>
                    </Group>
                    {b.dia_diem_hoac_link && (
                      <Text fz="sm" mt={4} style={{ wordBreak: 'break-all' }}>
                        {href ? (
                          <Anchor href={href} target="_blank" rel="noreferrer">
                            {b.dia_diem_hoac_link}
                          </Anchor>
                        ) : (
                          b.dia_diem_hoac_link
                        )}
                      </Text>
                    )}
                    {b.diem_hoc && (
                      <Text fz="sm" mt={4}>
                        Điểm học: {b.diem_hoc.ten}
                        {b.phong ? ` — phòng ${b.phong}` : ''} · {b.diem_hoc.dia_chi}
                        {b.diem_hoc.nguoi_lien_he ? ` · Liên hệ: ${b.diem_hoc.nguoi_lien_he}${b.diem_hoc.sdt_lien_he ? ` (${b.diem_hoc.sdt_lien_he})` : ''}` : ''}
                      </Text>
                    )}
                    {(b.thuc_dia ?? []).length > 0 && (
                      <Text fz="xs" mt={4}>
                        Thực địa: {(b.thuc_dia ?? []).map((t) => `${t.ho_ten} (${t.so_dien_thoai})${t.nhiem_vu ? ` — ${t.nhiem_vu}` : ''}`).join(' · ')}
                      </Text>
                    )}
                    {(b.nhom_ho_tro_gv ?? []).length > 0 && (
                      <Text fz="xs" c="dimmed" mt={4}>
                        Hỗ trợ giảng viên: {(b.nhom_ho_tro_gv ?? []).map((n) => `${n.ho_ten}${n.email ? ` (${n.email})` : ''}`).join(' · ')}
                      </Text>
                    )}
                    <CoNhacCum nhac={b.nhac_cum ?? []} tenCum={tenCum} />
                    {b.nhan_su.length > 0 && (
                      <Text fz="xs" c="dimmed" mt={4}>
                        {b.nhan_su
                          .map((n) => `${n.vai_tro === 'giang_vien' ? 'GV' : 'Hỗ trợ'}: ${n.ho_ten}${n.so_dien_thoai ? ` (${n.so_dien_thoai})` : ''}`)
                          .join(' · ')}
                      </Text>
                    )}
                  </Paper>
                );
              })}
            </Stack>
          ))}
        </Stack>
      </Stack>
    </Container>
  );
}
