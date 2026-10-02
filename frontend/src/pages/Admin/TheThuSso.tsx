import { useState } from 'react';
import { Alert, Anchor, Button, Code, CopyButton, Group, Paper, Select, Stack, Text, TextInput, Title } from '@mantine/core';
import { useMutation } from '@tanstack/react-query';
import { taoMaThuSso } from '@/api/sso';
import type { SsoTarget } from '@/api/hocVien';
import { thongDiepLoiChung } from '@/lib/loiApi';
import { dinhDangNgayGio } from '@/lib/ngay';

const TUY_CHON_TARGET = [
  { value: '', label: 'Không target (danh sách bài)' },
  { value: 'khao-sat', label: 'khao-sat — Phiếu khảo sát kĩ năng số' },
  { value: 'danh-gia', label: 'danh-gia — Phiếu đánh giá năng lực số' },
];

/** Thử tích hợp SSO (quản trị): tạo mã thử cho 1 học viên rồi gọi thử POST /sso/doi-ma bằng curl. */
export function TheThuSso() {
  const [maMoet, setMaMoet] = useState('');
  const [target, setTarget] = useState('');
  const tao = useMutation({
    mutationFn: () => taoMaThuSso(maMoet.trim(), (target || undefined) as SsoTarget | undefined),
  });

  const congApi = import.meta.env.VITE_API_BASE_URL || window.location.origin;
  const lenhCurl = tao.data
    ? `curl -X POST ${congApi}/sso/doi-ma -H "Content-Type: application/json" -H "X-API-Key: <SSO_KHAO_SAT_API_KEY>" -d "{\\"code\\":\\"${tao.data.code}\\"}"`
    : '';

  return (
    <Paper withBorder radius="md" p="lg">
      <Stack gap="md">
        <Title order={2} fz={16}>
          Thử tích hợp SSO với trang khảo sát
        </Title>
        <Text fz="sm" c="dimmed">
          Tạo mã dùng một lần cho 1 học viên (bỏ qua điều kiện hồ sơ đầy đủ) để đội khảo sát hoặc quản trị gọi thử
          API đổi mã. Mã hết hạn sau 5 phút và chỉ đổi được 1 lần.
        </Text>
        <Group align="flex-end" wrap="wrap">
          <TextInput
            label="Mã định danh CSDL ngành của học viên"
            value={maMoet}
            onChange={(e) => setMaMoet(e.currentTarget.value)}
            w={260}
          />
          <Select label="Target" data={TUY_CHON_TARGET} value={target} onChange={(v) => setTarget(v ?? '')} w={320} allowDeselect={false} />
          <Button onClick={() => tao.mutate()} loading={tao.isPending} disabled={!maMoet.trim()}>
            Tạo mã thử
          </Button>
        </Group>

        {tao.isError && <Alert color="red">{thongDiepLoiChung(tao.error)}</Alert>}

        {tao.data && (
          <Stack gap="sm">
            <Text fz="sm">
              Học viên: <b>{tao.data.hoc_vien.ho_ten}</b> — hết hạn lúc {dinhDangNgayGio(tao.data.het_han)}
            </Text>
            <Text fz="sm" fw={600}>
              Đường dẫn chuyển sang trang khảo sát
            </Text>
            <Group gap="xs" wrap="nowrap">
              <Code style={{ flex: 1, overflowWrap: 'anywhere' }}>{tao.data.url}</Code>
              <Anchor href={tao.data.url} target="_blank" rel="noopener noreferrer" fz="sm">
                Mở thử
              </Anchor>
            </Group>
            <Text fz="sm" fw={600}>
              Lệnh gọi thử đổi mã (thay &lt;SSO_KHAO_SAT_API_KEY&gt; bằng khóa thật)
            </Text>
            <Code block style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
              {lenhCurl}
            </Code>
            <CopyButton value={lenhCurl}>
              {({ copied, copy }) => (
                <Button variant="default" size="xs" onClick={copy} w="fit-content">
                  {copied ? 'Đã chép' : 'Chép lệnh curl'}
                </Button>
              )}
            </CopyButton>
          </Stack>
        )}
      </Stack>
    </Paper>
  );
}
