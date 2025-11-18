-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('system', 'admin', 'clinician');

-- CreateEnum
CREATE TYPE "ConsultationRequestStatus" AS ENUM ('pending', 'accepted', 'rejected');

-- CreateEnum
CREATE TYPE "ConsultationCallStatus" AS ENUM ('patient_answered', 'patient_no_answer', 'clinician_did_not_call');

-- CreateEnum
CREATE TYPE "AuditEventType" AS ENUM ('CREATE', 'UPDATE');

-- CreateEnum
CREATE TYPE "SmsDirection" AS ENUM ('incoming', 'outgoing');

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'clinician',
    "canHaveAvailability" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Patient" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "dateOfBirth" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Patient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsultationRequest" (
    "id" SERIAL NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "ConsultationRequestStatus" NOT NULL DEFAULT 'pending',
    "statusActionedByUserId" INTEGER,
    "statusActionedAt" TIMESTAMP(3),

    CONSTRAINT "ConsultationRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Slot" (
    "id" SERIAL NOT NULL,
    "startDateTime" TIMESTAMP(3) NOT NULL,
    "endDateTime" TIMESTAMP(3) NOT NULL,
    "userId" INTEGER NOT NULL,

    CONSTRAINT "Slot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Consultation" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "patientId" INTEGER,
    "assignedToUserId" INTEGER NOT NULL,
    "consultationRequestId" INTEGER NOT NULL,
    "slotId" INTEGER NOT NULL,

    CONSTRAINT "Consultation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsultationCall" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "consultationId" INTEGER NOT NULL,
    "conductedByUserId" INTEGER NOT NULL,
    "status" "ConsultationCallStatus" NOT NULL,
    "confirmations" JSONB,
    "chiefComplaint" TEXT,
    "reviewOfSystems" TEXT,
    "pastMedicalHistory" TEXT,
    "diagnosis" TEXT,
    "labTests" TEXT,
    "prescriptions" TEXT,
    "safetyNetting" TEXT,
    "followUp" TEXT,
    "additionalNotes" TEXT,

    CONSTRAINT "ConsultationCall_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Config" (
    "id" SERIAL NOT NULL,
    "consultationDurationMinutes" INTEGER NOT NULL DEFAULT 10,
    "breakDurationMinutes" INTEGER NOT NULL DEFAULT 5,
    "bufferTimeMinutes" INTEGER NOT NULL DEFAULT 5,
    "consultationSmsTemplates" JSONB NOT NULL DEFAULT '[]',

    CONSTRAINT "Config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SmsMessage" (
    "id" SERIAL NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "direction" "SmsDirection" NOT NULL DEFAULT 'incoming',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SmsMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutgoingSmsMessage" (
    "id" SERIAL NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "success" BOOLEAN,
    "sentByUserId" INTEGER NOT NULL,
    "sentMessageId" INTEGER,
    "consultationId" INTEGER,

    CONSTRAINT "OutgoingSmsMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_events" (
    "id" SERIAL NOT NULL,
    "eventTimestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actorUserId" INTEGER NOT NULL,
    "eventType" "AuditEventType" NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" INTEGER NOT NULL,
    "changedFields" JSONB,

    CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Auth" (
    "id" TEXT NOT NULL,
    "userId" INTEGER,

    CONSTRAINT "Auth_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthIdentity" (
    "providerName" TEXT NOT NULL,
    "providerUserId" TEXT NOT NULL,
    "providerData" TEXT NOT NULL DEFAULT '{}',
    "authId" TEXT NOT NULL,

    CONSTRAINT "AuthIdentity_pkey" PRIMARY KEY ("providerName","providerUserId")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Patient_dateOfBirth_idx" ON "Patient"("dateOfBirth");

-- CreateIndex
CREATE UNIQUE INDEX "Patient_name_dateOfBirth_key" ON "Patient"("name", "dateOfBirth");

-- CreateIndex
CREATE INDEX "ConsultationRequest_status_createdAt_idx" ON "ConsultationRequest"("status", "createdAt");

-- CreateIndex
CREATE INDEX "ConsultationRequest_createdAt_idx" ON "ConsultationRequest"("createdAt");

-- CreateIndex
CREATE INDEX "Slot_userId_startDateTime_idx" ON "Slot"("userId", "startDateTime");

-- CreateIndex
CREATE INDEX "Slot_startDateTime_idx" ON "Slot"("startDateTime");

-- CreateIndex
CREATE UNIQUE INDEX "Consultation_consultationRequestId_key" ON "Consultation"("consultationRequestId");

-- CreateIndex
CREATE UNIQUE INDEX "Consultation_slotId_key" ON "Consultation"("slotId");

-- CreateIndex
CREATE INDEX "Consultation_assignedToUserId_idx" ON "Consultation"("assignedToUserId");

-- CreateIndex
CREATE INDEX "Consultation_patientId_idx" ON "Consultation"("patientId");

-- CreateIndex
CREATE INDEX "ConsultationCall_consultationId_createdAt_idx" ON "ConsultationCall"("consultationId", "createdAt");

-- CreateIndex
CREATE INDEX "ConsultationCall_conductedByUserId_idx" ON "ConsultationCall"("conductedByUserId");

-- CreateIndex
CREATE UNIQUE INDEX "OutgoingSmsMessage_sentMessageId_key" ON "OutgoingSmsMessage"("sentMessageId");

-- CreateIndex
CREATE INDEX "audit_events_actorUserId_eventTimestamp_idx" ON "audit_events"("actorUserId", "eventTimestamp");

-- CreateIndex
CREATE INDEX "audit_events_entityType_entityId_idx" ON "audit_events"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "audit_events_eventTimestamp_idx" ON "audit_events"("eventTimestamp");

-- CreateIndex
CREATE UNIQUE INDEX "Auth_userId_key" ON "Auth"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_id_key" ON "Session"("id");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- AddForeignKey
ALTER TABLE "ConsultationRequest" ADD CONSTRAINT "ConsultationRequest_statusActionedByUserId_fkey" FOREIGN KEY ("statusActionedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Slot" ADD CONSTRAINT "Slot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Consultation" ADD CONSTRAINT "Consultation_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Consultation" ADD CONSTRAINT "Consultation_assignedToUserId_fkey" FOREIGN KEY ("assignedToUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Consultation" ADD CONSTRAINT "Consultation_consultationRequestId_fkey" FOREIGN KEY ("consultationRequestId") REFERENCES "ConsultationRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Consultation" ADD CONSTRAINT "Consultation_slotId_fkey" FOREIGN KEY ("slotId") REFERENCES "Slot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsultationCall" ADD CONSTRAINT "ConsultationCall_consultationId_fkey" FOREIGN KEY ("consultationId") REFERENCES "Consultation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsultationCall" ADD CONSTRAINT "ConsultationCall_conductedByUserId_fkey" FOREIGN KEY ("conductedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutgoingSmsMessage" ADD CONSTRAINT "OutgoingSmsMessage_sentByUserId_fkey" FOREIGN KEY ("sentByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutgoingSmsMessage" ADD CONSTRAINT "OutgoingSmsMessage_sentMessageId_fkey" FOREIGN KEY ("sentMessageId") REFERENCES "SmsMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutgoingSmsMessage" ADD CONSTRAINT "OutgoingSmsMessage_consultationId_fkey" FOREIGN KEY ("consultationId") REFERENCES "Consultation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Auth" ADD CONSTRAINT "Auth_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthIdentity" ADD CONSTRAINT "AuthIdentity_authId_fkey" FOREIGN KEY ("authId") REFERENCES "Auth"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "Auth"("id") ON DELETE CASCADE ON UPDATE CASCADE;
