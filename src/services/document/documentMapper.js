export function mapDocument(doc) {

  const copies =
    Array.isArray(doc.copies)
      ? doc.copies.map((copy) => ({

          ...copy,

          copyId:
            copy.copyId ??
            copy.copy_id ??
            null,

          dnaId:
            copy.dnaId ??
            copy.dna_id ??
            doc.dna_id ??
            null,

          recipient:
            copy.recipient ??
            null,

          recipientType:
            copy.recipientType ??
            copy.recipient_type ??
            null,

          recipientOrganization:
            copy.recipientOrganization ??
            copy.recipient_organization ??
            null,

          recipientSignature:
            copy.recipientSignature ??
            copy.recipient_signature ??
            null,

          trackerId:
            copy.trackerId ??
            copy.tracker_id ??
            doc.tracker_id ??
            null,

          copyPassword:
            copy.copyPassword ??
            copy.password ??
            null,

          fileName:
            copy.fileName ??
            null,

          storagePath:
            copy.storagePath ??
            null,

          externalStoragePath:
            copy.externalStoragePath ??
            null,

          externalFileName:
            copy.externalFileName ??
            null,

          downloadCount:
            Number(
              copy.downloadCount ??
              copy.download_count ??
              0
            ),

          passwordRevealCount:
            Number(
              copy.passwordRevealCount ??
              copy.password_reveal_count ??
              0
            ),

          lastPasswordRevealedAt:
            copy.lastPasswordRevealedAt ??
            copy.last_password_revealed_at ??
            null,

          issuedAt:
            copy.issuedAt ??
            copy.issued_at ??
            null,

          // =========================
          // FORENSIC BASELINE
          // =========================

          sha256:
            copy.sha256 ??
            null,

          textHash:
            copy.textHash ??
            copy.text_hash ??
            null,

          pageCount:
            Number(
              copy.pageCount ??
              copy.page_count ??
              0
            ),

          text:
            copy.text ??
            null,

          fingerprint:
            copy.fingerprint ??
            null,

          fileSize:
            copy.fileSize ??
            copy.file_size ??
            null,

          classification:
            copy.classification ??
            doc.classification ??
            null,

        }))
      : [];

  // =========================
  // TOTAL PASSWORD REVEALS
  // =========================

  const passwordReveals =
    copies.reduce(
      (total, copy) =>
        total +
        Number(
          copy.passwordRevealCount ?? 0
        ),
      0
    );

  return {

    id:
      doc.id,

    dnaId:
      doc.dna_id,

    fileName:
      doc.title,

    classification:
      doc.classification,

    sha256:
      doc.sha256,

    fileSize:
      doc.file_size,

    recipients:
      doc.recipient
        ? doc.recipient.split(", ")
        : [],

    integrity:
      Number(
        doc.integrity ?? 100
      ),

    status:
      doc.status,

    pageCount:
      Number(
        doc.page_count ?? 0
      ),

    issuedAt:
      doc.created_at,

    trackerId:
      doc.tracker_id,

    // =========================
    // ACTIVITY COUNTERS
    // =========================

    downloadCount:
      Number(
        doc.download_count ?? 0
      ),

    emailShares:
      Number(
        doc.email_shares ?? 0
      ),

    cloudUploads:
      Number(
        doc.cloud_uploads ?? 0
      ),

    externalAccesses:
      Number(
        doc.external_accesses ?? 0
      ),

    // IMPORTANT:
    // Risk engine uses passwordReveals
    passwordReveals,

    lastAccessed:
      doc.last_accessed,

    lastLocation:
      doc.last_location,

    // =========================
    // DOCUMENT CONTENT
    // =========================

    text:
      doc.text,

    textHash:
      doc.text_hash,

    fingerprint:
      doc.fingerprint,

    recipientSignature:
      doc.recipient_signature,

    // =========================
    // PROTECTED COPIES
    // =========================

    copies,

    recipientType:
      doc.recipient_type ??
      null,

    recipientOrganization:
      doc.recipient_organization ??
      null,

  };
}