import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Alert, Anchor, Badge, Container, Group, Paper, Skeleton, Stack, Text, TextInput, Title } from '@mantine/core';
import { useLichDayGv, type BuoiLichDay } from '@/api/hoTroGv';
import { thongDiepLoiChung } from '@/lib/loiApi';
import { dinhDangGio, dinhDangNgay } from '@/lib/ngay';

const NHAN_LOAI_LOP = { truc_tiep: 'Trực tiếp', zoom: 'Zoom', vle: 'VLE' } as const;

/** Lịch dạy theo ngày của mọi lớp trong phạm vi (ADR 0004 L2) — mặc định hôm nay + 14 ngày. */
export default function HoTroGvLichDay() {
  const [tuNgay, setTuNgay] = useState('');
  const [denNgay, setDenNgay] = useState('');
  const { data, isLoading, isError, error, isFetching } = useLichDayGv({
    tu_ngay: tuNgay || undefined,
    den_ngay: denNgay || undefined,
  });

  const theoNgay = useMemo(() => {
    const nhom = new Map<string, BuoiLichDay[]>();
    for (const b of data ?? []) {
      const ngay = dinhDangNgay(b.thoi_gian_bat_dau);
      nhom.set(ngay, [...(nhom.get(ngay) ?? []), b]);
    }
    return [...nhom.entries()];
  }, [data]);

  return (
    <Container size="lg" py="lg">
      <Stack gap="md">
        <Title order={3}>Lịch dạy</Title>
        <Group gap="sm" align="flex-end" wrap="wrap">
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
            Không có buổi học nào trong khoảng thời gian này.
          </Text>
        )}
        <Stack gap="md" style={{ opacity: isFetching ? 0.6 : 1 }}>
          {theoNgay.map(([ngay, ds]) => (
            <Stack key={ngay} gap="xs">
              <Text fw={700}>{ngay}</Text>
              {ds.map((b) => (
                <Paper key={b.id} withBorder radius={12} p="sm">
                  <Group gap="xs" wrap="wrap">
                    <Text fw={600} fz="sm">
                      {dinhDangGio(b.thoi_gian_bat_dau)}–{dinhDangGio(b.thoi_gian_ket_thuc)}
                    </Text>
                    <Text fz="sm">
                      {b.lop.ten_lop} · Buổi {b.buoi_so} · {b.lop.khoa.ma_khoa}
                    </Text>
                    <Badge variant="light">{NHAN_LOAI_LOP[b.lop.loai_lop]}</Badge>
                    {b.giai_doan.hinh_thuc === 'truc_tiep' && (
                      <Anchor component={Link} to={`/ho-tro-gv/lop/${b.lop.id}/giai-doan/${b.giai_doan.id}`} fz="sm">
                        Hồ sơ chuẩn bị
                      </Anchor>
                    )}
                  </Group>
                  <Text fz="sm" mt={4}>
                    {b.diem_hoc ? `${b.diem_hoc.ten}${b.phong ? ` — phòng ${b.phong}` : ''} · ${b.diem_hoc.dia_chi}` : b.dia_diem_hoac_link ?? ''}
                  </Text>
                  <Text fz="xs" c={b.phan_cong.length ? 'dimmed' : 'red'} mt={2}>
                    {b.phan_cong.length
                      ? b.phan_cong.map((p) => `${p.giang_vien.ho_ten}${p.vai_tro === 'ho_tro' ? ' (hỗ trợ)' : ''}`).join(', ')
                      : 'Chưa phân công giảng viên'}
                  </Text>
                </Paper>
              ))}
            </Stack>
          ))}
        </Stack>
      </Stack>
    </Container>
  );
}
