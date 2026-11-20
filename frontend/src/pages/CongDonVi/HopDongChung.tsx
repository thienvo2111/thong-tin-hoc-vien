import { Paper, SimpleGrid, Stack, Text } from '@mantine/core';
import type { HopDongPhanHoi, LyDoChanNop } from '@/api/hopDong';
import { NHAN_TRUONG_HOP_DONG } from '@/lib/hopDong';
import { dinhDangNgayLich } from '@/lib/ngayLich';
import { dinhDangSuat } from './danhSachThamGiaNhan';
import { dinhDangGiaTri } from './hopDongNhan';

// Issue #64: phần dùng chung giữa màn hợp đồng của trường và màn Quản trị xem hợp đồng.

export function SoLieuHopDong({ data }: { data: HopDongPhanHoi }) {
  return (
    <Paper withBorder radius="md" p="md" component="section" aria-label="Số liệu hợp đồng">
      <SimpleGrid cols={2} spacing="sm" verticalSpacing="xs">
        <SoLieu nhan="Số người" giaTri={String(data.so_nguoi)} />
        <SoLieu nhan="Tổng suất" giaTri={dinhDangSuat(data.tong_suat)} />
        <SoLieu nhan="Đơn giá" giaTri={dinhDangGiaTri(data.don_gia)} />
        <SoLieu nhan="Giá trị" giaTri={dinhDangGiaTri(data.gia_tri)} />
      </SimpleGrid>
    </Paper>
  );
}

/** Lý do chưa nộp được (ly_do_chan của API), theo thứ tự backend. */
export function DanhSachLyDoChan({ id, lyDo }: { id?: string; lyDo: LyDoChanNop[] }) {
  return (
    <Stack gap={4}>
      <Text fw={600} size="sm">
        Chưa nộp được:
      </Text>
      <Stack component="ul" id={id} gap={2} m={0} pl="md" aria-label="Lý do chưa nộp được">
        {lyDo.map((l) => (
          <Text component="li" key={l.ma} size="sm" c="red.8">
            {l.thong_diep}
          </Text>
        ))}
      </Stack>
    </Stack>
  );
}

/** Phần 3–4 + cờ điểm học trực tiếp, chỉ xem. */
export function ThongTinPhan34({ data }: { data: HopDongPhanHoi }) {
  const coPhan4 = data.can_phan_4 || !!data.phan_4.so_qd || !!data.phan_4.ngay_qd;
  return (
    <Paper withBorder radius="md" p="md" component="section" aria-label="Thông tin hợp đồng">
      <Stack gap="xs">
        <DongChiXem nhan="Trường là điểm học trực tiếp" giaTri={data.diem_hoc_truc_tiep ? 'Có' : 'Không'} />
        <DongChiXem nhan={NHAN_TRUONG_HOP_DONG.nguoi_nhan} giaTri={data.phan_3.nguoi_nhan} />
        <DongChiXem nhan={NHAN_TRUONG_HOP_DONG.sdt_nguoi_nhan} giaTri={data.phan_3.sdt_nguoi_nhan} />
        <DongChiXem nhan={NHAN_TRUONG_HOP_DONG.dia_chi_nhan} giaTri={data.phan_3.dia_chi_nhan} />
        <DongChiXem nhan={NHAN_TRUONG_HOP_DONG.ghi_chu} giaTri={data.phan_3.ghi_chu} />
        {coPhan4 && (
          <>
            <DongChiXem nhan={NHAN_TRUONG_HOP_DONG.so_qd} giaTri={data.phan_4.so_qd} />
            <DongChiXem
              nhan={NHAN_TRUONG_HOP_DONG.ngay_qd}
              giaTri={data.phan_4.ngay_qd ? dinhDangNgayLich(data.phan_4.ngay_qd) : null}
            />
          </>
        )}
      </Stack>
    </Paper>
  );
}

function DongChiXem({ nhan, giaTri }: { nhan: string; giaTri: string | null }) {
  return (
    <div>
      <Text size="xs" c="dimmed">
        {nhan}
      </Text>
      <Text style={{ overflowWrap: 'anywhere', whiteSpace: 'pre-wrap' }}>{giaTri || '—'}</Text>
    </div>
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
