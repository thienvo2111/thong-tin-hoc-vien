import { Link } from 'react-router-dom';
import { Alert, Badge, Button, Container, Group, Paper, SimpleGrid, Skeleton, Stack, Text, Title } from '@mantine/core';
import { useDotCuaTruong, type TheDotTruong } from '@/api/truongDanhSach';
import { useHoSoDonVi } from '@/api/hoSoDonVi';
import { thongDiepLoiChung } from '@/lib/loiApi';
import { dinhDangNgayLich } from '@/lib/ngayLich';
import { NGUONG_GAP, SDT_HO_TRO_CONG_DON_VI, nhanHan, nhanHetHanNgan, trangThaiHan } from '@/lib/hanNop';
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

/** Issue #66 / ADR 0015 T1: "Còn N ngày" (cam khi ≤ 3), "Hạn cuối hôm nay", đỏ "Đã hết hạn ngày dd/mm – liên hệ HCMUE". */
function ChipHan({ the, now }: { the: TheDotTruong; now: Date }) {
  const tt = trangThaiHan(the, now);
  if (tt.loai === 'het_han') {
    return (
      <Badge color="red" variant="filled" tt="none" h="auto" py={4} styles={{ label: { whiteSpace: 'normal' } }}>
        {nhanHetHanNgan(the.han_hieu_luc_ngay, SDT_HO_TRO_CONG_DON_VI)}
      </Badge>
    );
  }
  const gap = tt.loai === 'hom_nay' || tt.soNgay <= NGUONG_GAP;
  return (
    <Badge color={gap ? 'orange' : 'blue'} variant="light" tt="none">
      {nhanHan(the, now)}
    </Badge>
  );
}

function TheDot({ the, now = new Date() }: { the: TheDotTruong; now?: Date }) {
  const { dot } = the;
  const ds = TRANG_THAI_DANH_SACH[the.trang_thai_danh_sach];
  const hd = TRANG_THAI_HOP_DONG[the.trang_thai_hop_dong];
  const idTieuDe = `dot-${dot.id}`;
  // Issue #66 / T2: hết hạn (chưa nộp) → các việc vẫn mở được nhưng chỉ xem.
  const chiXem = the.da_het_han && the.trang_thai_hop_dong !== 'da_nop';
  const nhanChiXem = (
    <Badge color="gray" variant="light" size="sm">
      Chỉ xem
    </Badge>
  );

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
          {the.han_rieng && (
            <Text size="sm" c="dimmed">
              Hạn riêng của trường: {dinhDangNgayLich(the.han_hieu_luc_ngay)}
            </Text>
          )}
        </div>
        {the.trang_thai_hop_dong !== 'da_nop' && (
          <div>
            <ChipHan the={the} now={now} />
          </div>
        )}

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
                chiXem ? (
                  nhanChiXem
                ) : (
                  <Badge color={ds.mau} variant="light" size="sm">
                    {ds.nhan}
                  </Badge>
                )
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
                chiXem ? (
                  nhanChiXem
                ) : (
                  <Badge color="blue" variant="light" size="sm">
                    {dinhDangGiaTri(the.gia_tri_tam_tinh)}
                  </Badge>
                )
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
                chiXem ? (
                  nhanChiXem
                ) : (
                  <Badge color={hd.mau} variant="light" size="sm">
                    {hd.nhan}
                  </Badge>
                )
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
