-- CreateTable
CREATE TABLE "dang_nhap_vle" (
    "hoc_vien_id" UUID NOT NULL,
    "username" VARCHAR(100),
    "email_chup" VARCHAR(255),
    "nguon_import_id" UUID,
    "cap_nhat_luc" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dang_nhap_vle_pkey" PRIMARY KEY ("hoc_vien_id")
);

-- AddForeignKey
ALTER TABLE "dang_nhap_vle" ADD CONSTRAINT "dang_nhap_vle_hoc_vien_id_fkey" FOREIGN KEY ("hoc_vien_id") REFERENCES "hoc_vien"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "dang_nhap_vle" ADD CONSTRAINT "dang_nhap_vle_nguon_import_id_fkey" FOREIGN KEY ("nguon_import_id") REFERENCES "nhat_ky_import"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
