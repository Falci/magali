-- CreateTable
CREATE TABLE "FieldLabel" (
    "id" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "label" TEXT NOT NULL,

    CONSTRAINT "FieldLabel_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FieldLabel_field_label_key" ON "FieldLabel"("field", "label");
