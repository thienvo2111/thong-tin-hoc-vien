import { Link } from 'react-router-dom';
import { Alert, Anchor, Badge, Container, Group, Paper, SimpleGrid, Skeleton, Stack, Text, Title } from '@mantine/core';
import { useLichDayCuaToi, type BuoiDayCuaToi } from '@/api/congGiangVien';
import { thongDiepLoiChung } from '@/lib/loiApi';
import { dinhDangGio, dinhDangNgay, dinhDangNgayGio } from '@/lib/ngay';
import { lienKetBanDo } from '@/lib/banDo';

const NHAN_VAI_TRO = { giang_vien: 'Giảng viên', ho_tro: 'Trợ giảng' } as const;

/** Lịch dạy của giảng viên (ADR 0004 G8, issue #20) — 60 ngày tới; buổi gần nhất hiện đủ hậu cần + liên hệ. */
export default function GiangDayLichDay() {
  const { data, isLoading, isError, error } = useLichDayCuaToi();
  const [ganNhat, ...conLai] = data ?? [];

  return (
    <Container size="md" py="lg" px="md">
      <Stack gap="md">
        <Title order={3}>Lịch dạy</Title>
        {isLoading && <Skeleton height={200} />}
        {isError && <Alert color="red">{thongDiepLoiChung(error)}</Alert>}
        {data && data.length === 0 && (
          <Text c="dimmed" ta="center" py="lg">
            Thầy/Cô chưa có buổi dạy nào trong 60 ngày tới.
          </Text>
        )}
        {ganNhat && (
          <>
            <Text fw={700} fz="sm" c="dimmed">
              BUỔI GẦN NHẤT
            </Text>
            <TheBuoi b={ganNhat} dayDu />
          </>
        )}
        {conLai.length > 0 && (
          <Text fw={700} fz="sm" c="dimmed" mt="sm">
            CÁC BUỔI TIẾP THEO
          </Text>
        )}
        {conLai.map((b) => (
          <TheBuoi key={b.id} b={b} />
        ))}
      </Stack>
    </Container>
  );
}

function TheBuoi({ b, dayDu = false }: { b: BuoiDayCuaToi; dayDu?: boolean }) {
  return (
    <Paper withBorder radius={12} p="md" style={dayDu ? { borderColor: 'var(--mantine-color-primary-4)' } : undefined}>
      <Stack gap={6}>
        <Group justify="space-between" wrap="wrap" gap="xs">
          <Text fw={700}>
            {dinhDangNgay(b.thoi_gian_bat_dau)} · {dinhDangGio(b.thoi_gian_bat_dau)}–{dinhDangGio(b.thoi_gian_ket_thuc)}
          </Text>
          {b.vai_tro && <Badge variant="light">{NHAN_VAI_TRO[b.vai_tro]}</Badge>}
        </Group>
        <Anchor component={Link} to={`/giang-day/lop/${b.lop.id}/giai-doan/${b.giai_doan.id}`} fw={600} fz="sm">
          {b.lop.ten_lop} · Buổi {b.buoi_so} · {b.lop.khoa.ma_khoa}
        </Anchor>
        {b.diem_hoc ? (
          <Text fz="sm">
            📍 {b.diem_hoc.ten}
            {b.phong ? ` · phòng ${b.phong}` : ''} — {b.diem_hoc.dia_chi}{' '}
            <Anchor href={lienKetBanDo(b.diem_hoc.dia_chi)} target="_blank" rel="noreferrer" fz="sm">
              Bản đồ
            </Anchor>
          </Text>
        ) : (
          b.dia_diem_hoac_link && <Text fz="sm">📍 {b.dia_diem_hoac_link}</Text>
        )}
        {b.giang_vien_khac.length > 0 && (
          <Text fz="sm" c="dimmed">
            Cùng dạy: {b.giang_vien_khac.map((g) => g.ho_ten).join(', ')}
          </Text>
        )}
        {dayDu && <ChiTietHauCan b={b} />}
      </Stack>
    </Paper>
  );
}

function ChiTietHauCan({ b }: { b: BuoiDayCuaToi }) {
  const h = b.hau_can;
  return (
    <SimpleGrid cols={{ base: 1, sm: 2 }} mt="xs" spacing="sm">
      <div>
        <Text fz="xs" c="dimmed" fw={700}>
          ĐƯA ĐÓN · CHỖ Ở
        </Text>
        {!h ? (
          <Text fz="sm" c="dimmed">
            Nhóm hỗ trợ đang sắp xếp.
          </Text>
        ) : (
          <>
            {h.don_luc && (
              <Text fz="sm">
                Đón lúc {dinhDangNgayGio(h.don_luc)}
                {h.diem_don ? ` tại ${h.diem_don}` : ''}
              </Text>
            )}
            {h.phuong_tien && <Text fz="sm">Phương tiện: {h.phuong_tien}</Text>}
            {h.lien_he_don && <Text fz="sm">Liên hệ đón: {h.lien_he_don}</Text>}
            {h.noi_o_ten && (
              <Text fz="sm">
                Nơi ở: {h.noi_o_ten}
                {h.noi_o_dia_chi ? ` — ${h.noi_o_dia_chi}` : ''}
              </Text>
            )}
          </>
        )}
      </div>
      <div>
        <Text fz="xs" c="dimmed" fw={700}>
          LIÊN HỆ
        </Text>
        {b.thuc_dia.map((t) => (
          <Text key={t.so_dien_thoai} fz="sm">
            Thực địa: {t.ho_ten} —{' '}
            <Anchor href={`tel:${t.so_dien_thoai}`} fz="sm">
              {t.so_dien_thoai}
            </Anchor>
          </Text>
        ))}
        {b.nhom_ho_tro_gv.map((n) => (
          <Text key={n.ho_ten} fz="sm">
            Hỗ trợ GV: {n.ho_ten}
            {n.email ? ` — ${n.email}` : ''}
          </Text>
        ))}
        {b.diem_hoc?.nguoi_lien_he && (
          <Text fz="sm">
            Điểm học: {b.diem_hoc.nguoi_lien_he}
            {b.diem_hoc.sdt_lien_he ? ` — ${b.diem_hoc.sdt_lien_he}` : ''}
          </Text>
        )}
      </div>
    </SimpleGrid>
  );
}
