import { Badge, Box, Button, Card, Group, Stack, Text, Title } from '@mantine/core';
import { Link } from 'react-router-dom';
import { useNhuCauMucToi } from '@/api/nhuCauMuc';
import type { NhuCauMucCuaToi } from '@/api/types';
import { dinhDangNgayGio } from '@/lib/ngay';
import { nhanMucNangLuc } from '@/lib/mucNangLuc';

/** ADR 0013 (D8): thẻ nổi bật ở /toi cho từng đợt nhu cầu mức học — cam khi chưa chọn, xanh khi đã chọn. */
export function TheNhuCauMuc() {
  const { data } = useNhuCauMucToi();
  if (!data?.length) return null;
  return (
    <Stack gap="md">
      {data.map((nc) => (
        <TheMotDot key={nc.dot.id} nc={nc} />
      ))}
    </Stack>
  );
}

function TheMotDot({ nc }: { nc: NhuCauMucCuaToi }) {
  const { dot, lua_chon } = nc;
  const daDong = dot.trang_thai === 'da_dong';
  const mau = lua_chon ? 'green' : nc.du_dieu_kien && !daDong ? 'orange' : 'gray';
  const nhanNut = daDong || !nc.du_dieu_kien ? 'Xem chi tiết' : lua_chon ? 'Đổi lựa chọn' : 'Chọn nhu cầu';
  return (
    <Card
      withBorder
      radius="md"
      p="lg"
      data-testid="the-nhu-cau-muc"
      style={{
        borderColor: `var(--mantine-color-${mau}-6)`,
        background: `var(--mantine-color-${mau}-0)`,
        borderWidth: 2,
      }}
    >
      <Group justify="space-between" align="flex-start" wrap="nowrap" gap="sm">
        <Box>
          <Title order={2} size="h4">
            {dot.ten_dot}
          </Title>
          <Text size="sm" c="dimmed">
            {nc.khoa.ten_khoa}
          </Text>
        </Box>
        <Badge color={mau} variant="filled" size="lg">
          {lua_chon ? `Đã chọn: ${nhanMucNangLuc(lua_chon.muc_chon)}` : 'Chưa chọn'}
        </Badge>
      </Group>
      <Text size="sm" mt="xs">
        {daDong ? `Đã đóng lúc ${dinhDangNgayGio(dot.dong_luc)}` : `Hạn chót: ${dinhDangNgayGio(dot.dong_luc)}`}
      </Text>
      <Button
        component={Link}
        to={`/toi/nhu-cau-muc?dot=${dot.id}`}
        mt="md"
        fullWidth
        color={mau}
        variant={lua_chon || daDong ? 'light' : 'filled'}
        style={{ minHeight: 44 }}
      >
        {nhanNut}
      </Button>
    </Card>
  );
}
