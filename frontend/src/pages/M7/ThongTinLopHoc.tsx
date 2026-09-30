import { Badge, Box, Button, Center, Container, Group, Loader, Paper, Stack, Text, Title } from '@mantine/core';
import { useKhoaHocToi } from '@/api/hocVien';
import type {
  CumHocVien,
  KhoaHocDangKy,
  LichHocLopToi,
  LopHocToi,
  MucNangLuc,
  TienDoGiaiDoan,
  TrangThaiDiemDanh,
} from '@/api/types';
import { dinhDangNgayGio } from '@/lib/ngay';
import { thongDiepLoiChung } from '@/lib/loiApi';
import { StatusBanner } from '@/components/StatusBanner';

const NHAN_MUC_NANG_LUC: Record<MucNangLuc, string> = {
  co_ban: 'Cơ bản',
  thanh_thao: 'Thành thạo',
  nang_cao: 'Nâng cao',
};

function nhanMucNangLuc(muc: MucNangLuc | null): string {
  return muc ? NHAN_MUC_NANG_LUC[muc] : 'Chưa có kết quả';
}

// T12 (mo-rong-nls-an-giang.md, 2026-09-30) — điểm danh nhập qua IMPORT EXCEL, không có giao diện
// chấm tay. null (chưa điểm danh) không hiện badge nào — tránh gây nhầm học viên nghĩ là "vắng".
const NHAN_DIEM_DANH: Record<TrangThaiDiemDanh, string> = {
  co_mat: 'Có mặt',
  vang: 'Vắng',
  vang_co_phep: 'Vắng có phép',
};

const MAU_DIEM_DANH: Record<TrangThaiDiemDanh, string> = {
  co_mat: 'green',
  vang: 'red',
  vang_co_phep: 'yellow',
};

const NHAN_HINH_THUC: Record<string, string> = {
  truc_tiep: 'Trực tiếp',
  truc_tuyen: 'Trực tuyến',
  danh_gia: 'Đánh giá',
  khac: 'Khác',
};

const MAU_HINH_THUC: Record<string, string> = {
  truc_tiep: 'green',
  truc_tuyen: 'blue',
  danh_gia: 'orange',
  khac: 'gray',
};

/** M7 — Thông tin lớp học của học viên: lịch học, địa điểm/link, kết quả đánh giá đầu vào/đầu ra. */
export default function ThongTinLopHoc() {
  const { data, isLoading, isError, error } = useKhoaHocToi();

  return (
    <Container size="sm" py="xl">
      <Stack gap="lg">
        <Title order={1} size="h2">
          Thông tin lớp học
        </Title>

        {isLoading && (
          <Center py="xl">
            <Loader />
          </Center>
        )}

        {isError && <StatusBanner loai="error">{thongDiepLoiChung(error)}</StatusBanner>}

        {data && data.length === 0 && (
          <StatusBanner loai="info">Thầy/Cô chưa được ghi danh vào khóa bồi dưỡng nào.</StatusBanner>
        )}

        {data?.map((dangKy) => <KhoiKhoaHoc key={dangKy.id} dangKy={dangKy} />)}
      </Stack>
    </Container>
  );
}

function KhoiKhoaHoc({ dangKy }: { dangKy: KhoaHocDangKy }) {
  const { khoa, cum, lop_truc_tiep, lop_zoom, lop_vle, muc_dau_vao, muc_dau_ra, tien_do_giai_doan } = dangKy;
  const chuaCoLopNao = !lop_truc_tiep && !lop_zoom && !lop_vle;

  return (
    <Box p="lg" style={{ borderRadius: 14, border: '1px solid var(--mantine-color-gray-3)', background: 'var(--mantine-color-white)' }}>
      <Stack gap="md">
        <Box>
          <Group gap="xs" wrap="wrap" align="baseline">
            <Title order={2} size="h4">
              {khoa.ten_khoa}
            </Title>
            <Text size="sm" c="dimmed">
              {khoa.ma_khoa}
            </Text>
          </Group>
          <Text size="sm" c="dimmed">
            {dinhDangNgayGio(khoa.thoi_gian_bat_dau)} – {dinhDangNgayGio(khoa.thoi_gian_ket_thuc)}
          </Text>
        </Box>

        {cum && <KhoiCum cum={cum} />}

        {chuaCoLopNao && (
          <StatusBanner loai="info">Chưa được phân vào lớp nào (trực tiếp/Zoom/VLE).</StatusBanner>
        )}

        {lop_truc_tiep && <KhoiLop tieuDe="Lớp trực tiếp" lop={lop_truc_tiep} />}
        {lop_zoom && <KhoiLop tieuDe="Lớp học qua Zoom" lop={lop_zoom} />}
        {lop_vle && <KhoiLop tieuDe="Lớp học trên VLE" lop={lop_vle} />}

        {tien_do_giai_doan.length > 0 && <KhoiTienDoGiaiDoan tienDo={tien_do_giai_doan} />}

        <Box>
          <Text fw={700} size="sm" mb={4}>
            Kết quả đánh giá
          </Text>
          <Group gap="xs">
            <Badge variant="light" color="gray" size="lg">
              Đầu vào: {nhanMucNangLuc(muc_dau_vao)}
            </Badge>
            <Badge variant="light" color="gray" size="lg">
              Đầu ra: {nhanMucNangLuc(muc_dau_ra)}
            </Badge>
          </Group>
        </Box>
      </Stack>
    </Box>
  );
}

// T12 (mo-rong-nls-an-giang.md, 2026-09-30) — tiến độ theo từng giai đoạn (vd tiến độ VLE, điểm
// đánh giá giai đoạn), nhập qua import ket_qua_giai_doan.
function KhoiTienDoGiaiDoan({ tienDo }: { tienDo: TienDoGiaiDoan[] }) {
  return (
    <Box>
      <Text fw={700} size="sm" mb={4}>
        Tiến độ học tập
      </Text>
      <Stack gap="xs">
        {tienDo.map((gd) => (
          <Group key={gd.giai_doan_id} gap="xs" justify="space-between">
            <Text size="sm">{gd.ten_giai_doan}</Text>
            <Group gap="xs">
              <Badge variant="light" color="blue" size="sm">
                Hoàn thành: {gd.ty_le_hoan_thanh == null ? 'Chưa có' : `${gd.ty_le_hoan_thanh}%`}
              </Badge>
              {gd.diem != null && (
                <Badge variant="light" color="gray" size="sm">
                  Điểm: {gd.diem}
                </Badge>
              )}
            </Group>
          </Group>
        ))}
      </Stack>
    </Box>
  );
}

function KhoiCum({ cum }: { cum: CumHocVien }) {
  return (
    <Paper p="md" radius="md" style={{ background: 'var(--mantine-color-gray-0)' }}>
      <Text fw={700} size="sm">
        Cụm hỗ trợ Zalo: {cum.ten_cum}
      </Text>
      {cum.ghi_chu && (
        <Text size="sm" c="dimmed" mt={2}>
          {cum.ghi_chu}
        </Text>
      )}
      {cum.link_zalo && (
        <Button component="a" href={cum.link_zalo} size="xs" mt={6}>
          Vào nhóm Zalo
        </Button>
      )}
    </Paper>
  );
}

function KhoiLop({ tieuDe, lop }: { tieuDe: string; lop: LopHocToi }) {
  return (
    <Paper p="md" radius="md" withBorder>
      <Text fw={700} size="sm" c="dimmed" mb={4}>
        {tieuDe}
      </Text>
      <Stack gap="sm">
        <Text fw={700}>{lop.ten_lop}</Text>

        {lop.nhan_su.length > 0 && (
          <Stack gap={4}>
            {lop.nhan_su.map((ns) => (
              <Text size="sm" key={ns.id}>
                {ns.vai_tro}: {ns.ho_ten}
                {ns.so_dien_thoai ? ` — ${ns.so_dien_thoai}` : ''}
              </Text>
            ))}
          </Stack>
        )}

        <BuoiHocTheoGiaiDoan lichHoc={lop.lich_hoc} />
      </Stack>
    </Paper>
  );
}

function BuoiHocTheoGiaiDoan({ lichHoc }: { lichHoc: LichHocLopToi[] }) {
  if (lichHoc.length === 0) return null;

  const nhomTheoGiaiDoan = new Map<string, { ten: string; hinhThuc: string; buoi: LichHocLopToi[] }>();
  for (const buoi of lichHoc) {
    const nhom = nhomTheoGiaiDoan.get(buoi.giai_doan_id);
    if (nhom) {
      nhom.buoi.push(buoi);
    } else {
      nhomTheoGiaiDoan.set(buoi.giai_doan_id, {
        ten: buoi.giai_doan.ten_giai_doan,
        hinhThuc: buoi.giai_doan.hinh_thuc,
        buoi: [buoi],
      });
    }
  }

  return (
    <Stack gap="md">
      {[...nhomTheoGiaiDoan.values()].map((giaiDoan) => (
        <Box key={giaiDoan.ten}>
          <Group gap="xs" mb={6}>
            <Text fw={600} size="sm">
              {giaiDoan.ten}
            </Text>
            <Badge size="sm" color={MAU_HINH_THUC[giaiDoan.hinhThuc] ?? 'gray'}>
              {NHAN_HINH_THUC[giaiDoan.hinhThuc] ?? giaiDoan.hinhThuc}
            </Badge>
          </Group>
          <Stack gap="xs">
            {giaiDoan.buoi.map((buoi) => (
              <Box key={buoi.id} p="sm" style={{ borderRadius: 10, background: 'var(--mantine-color-gray-0)' }}>
                <Group gap="xs">
                  <Text size="sm" fw={600}>
                    Buổi {buoi.buoi_so}
                  </Text>
                  {buoi.trang_thai_diem_danh && (
                    <Badge size="sm" color={MAU_DIEM_DANH[buoi.trang_thai_diem_danh]}>
                      {NHAN_DIEM_DANH[buoi.trang_thai_diem_danh]}
                    </Badge>
                  )}
                </Group>
                <Text size="sm" c="dimmed">
                  {dinhDangNgayGio(buoi.thoi_gian_bat_dau)} – {dinhDangNgayGio(buoi.thoi_gian_ket_thuc)}
                </Text>
                {buoi.dia_diem_hoac_link &&
                  (buoi.dia_diem_hoac_link.startsWith('http://') || buoi.dia_diem_hoac_link.startsWith('https://') ? (
                    <Button component="a" href={buoi.dia_diem_hoac_link} size="xs" mt={6}>
                      Vào học
                    </Button>
                  ) : (
                    <Text size="sm" mt={4}>
                      Địa điểm: {buoi.dia_diem_hoac_link}
                    </Text>
                  ))}
              </Box>
            ))}
          </Stack>
        </Box>
      ))}
    </Stack>
  );
}
