-- CreateEnum
CREATE TYPE "CertificateAssignment" AS ENUM ('AUTO', 'BULK', 'MANUAL');

-- CreateEnum
CREATE TYPE "ContentStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "TemplateStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- AlterTable
ALTER TABLE "certificates" ADD COLUMN     "assignment" "CertificateAssignment" NOT NULL DEFAULT 'BULK',
ADD COLUMN     "issuedById" TEXT,
ADD COLUMN     "overrideReason" TEXT,
ADD COLUMN     "templateId" TEXT,
ADD COLUMN     "templateSnapshot" TEXT;

-- AlterTable
ALTER TABLE "exams" ADD COLUMN     "certificateTemplateId" TEXT;

-- CreateTable
CREATE TABLE "content_documents" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "content" TEXT NOT NULL DEFAULT '{}',
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "publishedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "content_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_revisions" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "status" "ContentStatus" NOT NULL,
    "note" TEXT,
    "authorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "content_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "certificate_templates" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "TemplateStatus" NOT NULL DEFAULT 'DRAFT',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "design" TEXT NOT NULL DEFAULT '{}',
    "content" TEXT NOT NULL DEFAULT '{}',
    "version" INTEGER NOT NULL DEFAULT 1,
    "publishedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "certificate_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "template_revisions" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "design" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "status" "TemplateStatus" NOT NULL,
    "note" TEXT,
    "authorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "template_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "content_documents_key_key" ON "content_documents"("key");

-- CreateIndex
CREATE INDEX "content_documents_status_idx" ON "content_documents"("status");

-- CreateIndex
CREATE UNIQUE INDEX "content_revisions_documentId_version_key" ON "content_revisions"("documentId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "certificate_templates_slug_key" ON "certificate_templates"("slug");

-- CreateIndex
CREATE INDEX "certificate_templates_status_idx" ON "certificate_templates"("status");

-- CreateIndex
CREATE UNIQUE INDEX "template_revisions_templateId_version_key" ON "template_revisions"("templateId", "version");

-- CreateIndex
CREATE INDEX "certificates_assignment_idx" ON "certificates"("assignment");

-- CreateIndex
CREATE INDEX "certificates_templateId_idx" ON "certificates"("templateId");

-- CreateIndex
CREATE INDEX "exams_certificateTemplateId_idx" ON "exams"("certificateTemplateId");

-- AddForeignKey
ALTER TABLE "exams" ADD CONSTRAINT "exams_certificateTemplateId_fkey" FOREIGN KEY ("certificateTemplateId") REFERENCES "certificate_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "certificate_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_revisions" ADD CONSTRAINT "content_revisions_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "content_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "template_revisions" ADD CONSTRAINT "template_revisions_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "certificate_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

