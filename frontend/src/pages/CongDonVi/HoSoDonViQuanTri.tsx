import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Alert, Button, Container, Group, Paper, Skeleton, Stack, Text, Title } from '@mantine/core';
import { ApiError } from '@/api/client';
import { useHoSoDonViQuanTri, type HoSoDonViPhanHoi } from '@/api/hoSoDonVi';
import { NHOM_HO_SO, TRUONG_HO_SO, cheStk, type TruongHoSo } from '@/lib/hoSoDonVi';
import { thongDiepLoiChung } from '@/lib/loiApi';
import { dinhDangNgayGio } from '@/lib/ngay';
import { BadgeHoSo, MucConThieu, ThongTinChuyenKhoan } from './HoSoDonViChung';

// O4: STK cá nhân (Phần 5) che còn 4 số cuối, bấm "Hiện" mới thấy đủ.
const STK_CA_NHAN = new Set<TruongHoSo>(['ht_so_tai_khoan', 'kt_so_tai_khoan']);

/** Quản trị xem (chỉ đọc) Hồ sơ đơn vị của 1 trường (issue #63, ADR 0015 O3, O4). */
export default function HoSoDonViQuanTri() {
  const { donViId = '' } = useParams();
  const { data, isLoading, isError, error, refetch, isFetching } = useHoSoDonViQuanTri(donViId);
  const khongThay = error instanceof ApiError && error.status === 404;

  return (
    <Container size="md" py="lg" px="md">
      <Stack gap="md">
        <div>
          <Button component={Link} to="/quan-tri/danh-sach-tham-gia" variant="subtle" size="compact-sm" px={0}>
            ← Danh sách tham gia
          </Button>
          <Title order={1} size="h3" style={{ overflowWrap: 'anywhere' }}>
            Hồ sơ đơn vị{data ? ` — ${data.don_vi.ten}` : ''}
          </Title>
        </div>

        {isLoading && <Skeleton height={240} radius="md" aria-label="Đang tải" />}
        {isError && khongThay && <Alert color="yellow">Không tìm thấy đơn vị</Alert>}
        {isError && !khongThay && (
          <Alert color="red" title="Không tải được hồ sơ đơn vị">
            <Stack gap="sm" align="flex-start">
              <Text size="sm">{thongDiepLoiChung(error)}</Text>
              <Button size="sm" variant="light" color="red" onClick={() => refetch()} loading={isFetching}>
                Thử lại
              </Button>
            </Stack>
          </Alert>
        )}
        {data && <NoiDung data={data} />}
      </Stack>
    </Container>
  );
}

function NoiDung({ data }: { data: HoSoDonViPhanHoi }) {
  const hoSo = data.ho_so;
  return (
    <>
      <Paper withBorder radius="md" p="md" aria-label="Tình trạng hồ sơ" role="status">
        <Stack gap={4}>
          <Group gap="xs">
            <Text fw={600}>Tình trạng:</Text>
            <BadgeHoSo data={data} />
          </Group>
          {hoSo && <MucConThieu data={data} />}
          {hoSo && (
            <Text size="xs" c="dimmed">
              Cập nhật lúc {dinhDangNgayGio(hoSo.updated_at)}
            </Text>
          )}
        </Stack>
      </Paper>
      {!hoSo && <Text c="dimmed">Trường chưa khai hồ sơ đơn vị.</Text>}
      {hoSo &&
        NHOM_HO_SO.map((nhom) => (
          <Paper key={nhom.ma} withBorder radius="md" p="md" component="section" aria-labelledby={`qt-${nhom.ma}`}>
            <Stack gap="xs">
              <Title order={2} size="h4" id={`qt-${nhom.ma}`}>
                {nhom.ten}
              </Title>
              {TRUONG_HO_SO.filter((t) => t.nhom === nhom.ma).map((t) => (
                <Stack key={t.ma} gap="xs">
                  <DongThongTin ma={t.ma} nhan={t.nhan} giaTri={hoSo[t.ma]} />
                  {t.ma === 'ma_qhns' && <ThongTinChuyenKhoan maQhns={hoSo.ma_qhns} />}
                </Stack>
              ))}
            </Stack>
          </Paper>
        ))}
    </>
  );
}

function DongThongTin({ ma, nhan, giaTri }: { ma: TruongHoSo; nhan: string; giaTri: string | null }) {
  const [hien, setHien] = useState(false);
  const canChe = STK_CA_NHAN.has(ma) && !!giaTri && giaTri.length > 4;
  return (
    <div>
      <Text size="xs" c="dimmed">
        {nhan}
      </Text>
      <Group gap="xs" wrap="nowrap" align="center">
        <Text style={{ overflowWrap: 'anywhere', whiteSpace: 'pre-wrap' }} ff={canChe ? 'monospace' : undefined}>
          {giaTri ? (canChe && !hien ? cheStk(giaTri) : giaTri) : '—'}
        </Text>
        {canChe && (
          <Button
            size="compact-xs"
            variant="subtle"
            aria-label={`${hien ? 'Ẩn' : 'Hiện'} ${nhan}`}
            onClick={() => setHien((h) => !h)}
          >
            {hien ? 'Ẩn' : 'Hiện'}
          </Button>
        )}
      </Group>
    </div>
  );
}
