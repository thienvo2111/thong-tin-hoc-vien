import { Link } from 'react-router-dom';
import { Alert, Badge, Button, Container, Group, Paper, SimpleGrid, Skeleton, Stack, Text, Title } from '@mantine/core';
import { useDotCuaTruong, type TheDotTruong } from '@/api/truongDanhSach';
import { useHoSoDonVi } from '@/api/hoSoDonVi';
import { thongDiepLoiChung } from '@/lib/loiApi';
import { dinhDangNgayLich } from '@/lib/ngayLich';
import { dinhDangSuat } from './danhSachThamGiaNhan';
import { NHAN_CHUONG_TRINH_NGAN, TRANG_THAI_DANH_SACH, TRANG_THAI_HOP_DONG, dinhDangGiaTri } from './hopDongNhan';
import { BadgeHoSo } from './HoSoDonViChung';

/** Trang chủ của trường trên Cổng đơn vị (issue #60, ADR 0015 U1 — prototype phương án C):
 * thẻ Hồ sơ đơn vị ở trên cùng, rồi mỗi đợt có danh sách của trường là một thẻ việc cần làm. */
export default function TrangChuTruong() {
  const { data, isLoading, isError, error, refetch, isFetching } = useDotCuaTruong();

  return (
    <Container size="sm" py="lg" px="md">
      <Stack gap="md">
        <Title order={1} size="h3">
          Việc cần làm
        </Title>

        <TheHoSoDonVi />

        {isLoading && (
          <Stack gap="md" aria-label="Đang tải">
            <Skeleton height={180} radius="md" />
            <Skeleton height={180} radius="md" />
          </Stack>
        )}

        {isError && (
          <Alert color="red" title="Không tải được danh sách đợt">
            <Stack gap="sm" align="flex-start">
              <Text size="sm">{thongDiepLoiChung(error)}</Text>
              <Button size="sm" variant="light" color="red" onClick={() => refetch()} loading={isFetching}>
                Thử lại
              </Button>
            </Stack>
          </Alert>
        )}

        {data && data.length === 0 && (
          <Paper withBorder radius="md" p="md">
            <Text c="dimmed">Chưa có đợt bồi dưỡng nào cho trường</Text>
          </Paper>
        )}

        {data?.map((the) => (
          <TheDot key={the.dot.id} the={the} />
        ))}
      </Stack>
    </Container>
  );
}

/** Issue #63 / U1: thẻ Hồ sơ đơn vị dùng chung mọi đợt, badge Đủ thông tin / Còn thiếu N mục / Chưa khai. */
function TheHoSoDonVi() {
  const { data } = useHoSoDonVi();
  return (
    <Paper withBorder radius="md" p="md" component="section" aria-label="Hồ sơ đơn vị">
      <Stack gap="sm">
        <Group justify="space-between" wrap="nowrap" align="flex-start" gap="sm">
          <div>
            <Text fw={600}>Hồ sơ đơn vị</Text>
            <Text size="sm" c="dimmed">
              Khai một lần, dùng cho mọi chương trình
            </Text>
          </div>
          {data && <BadgeHoSo data={data} />}
        </Group>
        <Button component={Link} to="/ho-so-don-vi" variant="light" fullWidth justify="space-between">
          Xem / sửa hồ sơ đơn vị
        </Button>
      </Stack>
    </Paper>
  );
}

function TheDot({ the }: { the: TheDotTruong }) {
  const { dot } = the;
  const ds = TRANG_THAI_DANH_SACH[the.trang_thai_danh_sach];
  const hd = TRANG_THAI_HOP_DONG[the.trang_thai_hop_dong];
  const idTieuDe = `dot-${dot.id}`;

  return (
    <Paper withBorder radius="md" p="md" component="article" aria-labelledby={idTieuDe}>
      <Stack gap="sm">
        <Group gap="xs">
          <Badge variant="filled">{NHAN_CHUONG_TRINH_NGAN[dot.chuong_trinh]}</Badge>
          <Badge color={ds.mau} variant="light">
            Danh sách: {ds.nhan}
          </Badge>
          <Badge color={hd.mau} variant="light">
            Hợp đồng: {hd.nhan}
          </Badge>
        </Group>
        <div>
          <Title order={2} size="h4" id={idTieuDe} style={{ overflowWrap: 'anywhere' }}>
            {dot.ten}
          </Title>
          <Text size="sm" c="dimmed">
            Hạn nộp: {dinhDangNgayLich(dot.han_nop_ngay)}
          </Text>
        </div>

        <SimpleGrid cols={{ base: 2, xs: 3 }} spacing="sm" verticalSpacing="xs">
          <SoLieu nhan="Số người" giaTri={String(the.so_nguoi)} />
          <SoLieu nhan="Tổng suất" giaTri={dinhDangSuat(the.tong_suat)} />
          <SoLieu nhan="Giá trị tạm tính" giaTri={dinhDangGiaTri(the.gia_tri_tam_tinh)} />
        </SimpleGrid>

        <Stack component="ul" gap="xs" m={0} p={0} style={{ listStyle: 'none' }} aria-label="Việc cần làm">
          <li>
            <Button component={Link} to={`/dot/${dot.id}/danh-sach`} variant="light" fullWidth justify="space-between">
              Xem danh sách tham gia
            </Button>
          </li>
          {/* Issue #61: xác nhận ngay trên màn danh sách; nhãn trạng thái đi kèm việc. */}
          <li>
            <Button
              component={Link}
              to={`/dot/${dot.id}/danh-sach`}
              variant="default"
              fullWidth
              justify="space-between"
              rightSection={
                <Badge color={ds.mau} variant="light" size="sm">
                  {ds.nhan}
                </Badge>
              }
            >
              Xác nhận danh sách
            </Button>
          </li>
          {/* Issue #64: Phần 3–4 + Nộp trên cùng màn hợp đồng của đợt. */}
          <li>
            <Button
              component={Link}
              to={`/dot/${dot.id}/hop-dong`}
              variant="default"
              fullWidth
              justify="space-between"
              rightSection={
                <Badge color="blue" variant="light" size="sm">
                  {dinhDangGiaTri(the.gia_tri_tam_tinh)}
                </Badge>
              }
            >
              Thông tin hợp đồng
            </Button>
          </li>
          <li>
            <Button
              component={Link}
              to={`/dot/${dot.id}/hop-dong`}
              variant="default"
              fullWidth
              justify="space-between"
              rightSection={
                <Badge color={hd.mau} variant="light" size="sm">
                  {hd.nhan}
                </Badge>
              }
            >
              Nộp hợp đồng
            </Button>
          </li>
        </Stack>
      </Stack>
    </Paper>
  );
}

function SoLieu({ nhan, giaTri }: { nhan: string; giaTri: string }) {
  return (
    <div>
      <Text size="xs" c="dimmed">
        {nhan}
      </Text>
      <Text fw={600} style={{ overflowWrap: 'anywhere' }}>
        {giaTri}
      </Text>
    </div>
  );
}
