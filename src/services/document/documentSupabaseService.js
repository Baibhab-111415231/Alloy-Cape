import { supabase } from "../../lib/supabase";
import { mapDocument } from "./documentMapper";

/* =========================================================
   DOCUMENTS
========================================================= */

export async function getDocuments() {
  const { data, error } = await supabase
    .from("documents")
    .select("*")
    .order("created_at", {
      ascending: false,
    });

  if (error) throw error;

  return (data ?? []).map(mapDocument);
}


/* =========================================================
   PROTECTED COPY UPLOAD
========================================================= */

export async function uploadProtectedCopy(
  documentId,
  copyId,
  fileName,
  bytes
) {
  if (!documentId || !copyId || !bytes) {
    throw new Error(
      "Missing protected copy information."
    );
  }

  const path =
    `${documentId}/${copyId}/${fileName}`;

  const { data, error } =
    await supabase.storage
      .from("protected-copies")
      .upload(
        path,
        bytes,
        {
          contentType: "application/pdf",
          upsert: true,
        }
      );

  if (error) throw error;

  return data;
}


/* =========================================================
   EXTERNAL COPY UPLOAD
========================================================= */

export async function uploadExternalCopy(
  documentId,
  copyId,
  fileName,
  bytes
) {
  if (
    !documentId ||
    !copyId ||
    !fileName ||
    bytes === undefined ||
    bytes === null
  ) {
    throw new Error(
      "Missing external copy information."
    );
  }

  const path =
    `${documentId}/${copyId}/external/${fileName}`;

  const uploadBytes =
    bytes instanceof Blob
      ? bytes
      : new Blob(
          [bytes],
          {
            type: "application/pdf",
          }
        );

  const {
    data,
    error,
  } =
    await supabase.storage
      .from("protected-copies")
      .upload(
        path,
        uploadBytes,
        {
          contentType: "application/pdf",
          upsert: true,
        }
      );

  if (error) {
    console.error(
      "EXTERNAL UPLOAD STORAGE ERROR",
      error
    );

    throw error;
  }

  return {
    ...data,
    storagePath: path,
  };
}


/* =========================================================
   EXTERNAL COPY DOWNLOAD
========================================================= */

export async function downloadExternalCopy(
  storagePath
) {
  if (!storagePath) {
    throw new Error(
      "External copy storage path is missing."
    );
  }

  const {
    data,
    error,
  } =
    await supabase.storage
      .from("protected-copies")
      .download(
        storagePath
      );

  if (error) throw error;

  return data;
}


/* =========================================================
   CHECK DOCUMENT PROTECTION
========================================================= */

export async function documentAlreadyProtected(
  sha256
) {
  if (!sha256) {
    return false;
  }

  const {
    data,
    error,
  } =
    await supabase
      .from("documents")
      .select("id, dna_id")
      .eq("sha256", sha256)
      .maybeSingle();

  if (error) throw error;

  return !!data;
}


/* =========================================================
   ADD DOCUMENT
========================================================= */

export async function addDocument(document) {

  const {
    data: existing,
    error: lookupError,
  } =
    await supabase
      .from("documents")
      .select("*")
      .eq("sha256", document.sha256)
      .maybeSingle();

  if (lookupError) {
    throw lookupError;
  }

  if (existing) {
    return {
      ...mapDocument(existing),
      alreadyExists: true,
    };
  }

  const copies =
    document.copies ?? [];

  const firstCopy =
    copies.length > 0
      ? copies[0]
      : null;

  const {
    data,
    error,
  } =
    await supabase
      .from("documents")
      .insert([
        {
          title:
            document.fileName,

          classification:
            document.classification,

          sha256:
            document.sha256,

          dna_id:
            document.dnaId,

          text_hash:
            document.textHash,

          fingerprint:
            document.fingerprint,

          recipient_signature:
            document.recipientSignature,

          sender:
            "Alloy Cape",

          recipient:
            document.recipients.join(", "),

          copies:
            copies,

          recipient_type:
            firstCopy?.recipientType ?? null,

          recipient_organization:
            firstCopy?.recipientOrganization ?? null,

          file_size:
            document.fileSize,

          page_count:
            document.pageCount,

          status:
            document.status,

          /*
           * IMPORTANT:
           * All activity counters start at zero.
           */

          email_shares:
            0,

          download_count:
            0,

          tracker_id:
            document.trackerId,

          cloud_uploads:
            0,

          external_accesses:
            0,
        },
      ])
      .select()
      .single();

  if (error) throw error;

  return {
    ...mapDocument(data),
    alreadyExists: false,
  };
}


/* =========================================================
   GET DOCUMENT BY DNA
========================================================= */

export async function getDocumentByDNA(
  dnaId
) {
  const {
    data,
    error,
  } =
    await supabase
      .from("documents")
      .select("*")
      .eq("dna_id", dnaId)
      .single();

  if (error) return null;

  return mapDocument(data);
}


/* =========================================================
   DELETE DOCUMENT + INVESTIGATION DATA
========================================================= */

export async function deleteDocumentCascade(
  documentId
) {
  const {
    data: investigations,
    error: investigationError,
  } =
    await supabase
      .from("investigations")
      .select("id")
      .eq("document_id", documentId);

  if (investigationError) {
    throw investigationError;
  }

  const investigationIds =
    investigations?.map(
      (i) => i.id
    ) || [];

  if (investigationIds.length > 0) {

    const {
      error: aiError,
    } =
      await supabase
        .from("investigation_ai_reports")
        .delete()
        .in(
          "investigation_id",
          investigationIds
        );

    if (aiError) throw aiError;

    const {
      error: invError,
    } =
      await supabase
        .from("investigations")
        .delete()
        .in(
          "id",
          investigationIds
        );

    if (invError) throw invError;
  }

  const {
    error: docError,
  } =
    await supabase
      .from("documents")
      .delete()
      .eq(
        "id",
        documentId
      );

  if (docError) throw docError;
}


/* =========================================================
   INTERNAL HELPER
   =========================================================

   Always read the CURRENT database value before incrementing.

   This is important because using:

       document.emailShares + 1

   can use an old/stale object.

   Example:

       Database = 4
       UI object = 4

       Share #1 -> 5
       Share #2 -> UI still has 4 -> writes 5 again

   The helper below fetches the latest value first.
========================================================= */

async function incrementDocumentCounter(
  documentId,
  column,
  currentValue,
  extraFields = {}
) {
  if (!documentId) {
    throw new Error(
      "Document ID is required."
    );
  }

  /*
   * Get the CURRENT value directly from Supabase.
   */

  const {
    data: currentDocument,
    error: fetchError,
  } =
    await supabase
      .from("documents")
      .select(
        `id, ${column}`
      )
      .eq(
        "id",
        documentId
      )
      .single();

  if (fetchError) {
    throw fetchError;
  }

  const databaseValue =
    Number(
      currentDocument?.[column] ??
      currentValue ??
      0
    );

  const newCount =
    databaseValue + 1;

  const {
    data,
    error,
  } =
    await supabase
      .from("documents")
      .update({
        [column]:
          newCount,

        last_accessed:
          new Date().toISOString(),

        ...extraFields,
      })
      .eq(
        "id",
        documentId
      )
      .select("*")
      .single();

  if (error) {
    throw error;
  }

  /*
   * Return the FRESH document.
   */

  return mapDocument(data);
}


/* =========================================================
   DOWNLOAD COUNTER
========================================================= */

export async function incrementDownload(
  document
) {
  return incrementDocumentCounter(
    document?.id,
    "download_count",
    document?.downloadCount
  );
}


/* =========================================================
   EMAIL SHARE COUNTER
========================================================= */

export function incrementEmailShare(
  document
) {
  return incrementDocumentCounter(
    document?.id,
    "email_shares",
    document?.emailShares
  );
}


/* =========================================================
   CLOUD UPLOAD COUNTER
========================================================= */

export function incrementCloudUpload(
  document
) {
  return incrementDocumentCounter(
    document?.id,
    "cloud_uploads",
    document?.cloudUploads
  );
}


/* =========================================================
   EXTERNAL ACCESS COUNTER
========================================================= */

export function incrementExternalAccess(
  document
) {
  return incrementDocumentCounter(
    document?.id,
    "external_accesses",
    document?.externalAccesses,
    {
      last_location:
        "External Network",
    }
  );
}


/* =========================================================
   FIND COPY PASSWORD BY RECIPIENT
========================================================= */

export async function getCopyPasswordByRecipient(
  recipientEmail
) {
  if (!recipientEmail?.trim()) {
    throw new Error(
      "Please enter a recipient email."
    );
  }

  const email =
    recipientEmail
      .trim()
      .toLowerCase();

  const {
    data,
    error,
  } =
    await supabase
      .from("documents")
      .select(
        "id, title, dna_id, copies, created_at"
      )
      .order(
        "created_at",
        {
          ascending: false,
        }
      );

  if (error) {
    throw error;
  }

  for (const document of data ?? []) {

    const copies =
      Array.isArray(document.copies)
        ? document.copies
        : [];

    const copy =
      copies.find(
        item =>
          item?.recipient
            ?.trim()
            .toLowerCase() === email
      );

    if (!copy) {
      continue;
    }

    const password =
      copy.copyPassword ??
      copy.password ??
      null;

    return {
      found: true,

      passwordAvailable:
        !!password,

      documentId:
        document.id,

      fileName:
        document.title,

      dnaId:
        document.dna_id,

      copyId:
        copy.copyId ??
        copy.copy_id ??
        null,

      recipient:
        copy.recipient,

      recipientType:
        copy.recipientType ??
        null,

      recipientOrganization:
        copy.recipientOrganization ??
        null,

      password:
        password,
    };
  }

  return null;
}

export async function getAllCopyPasswords() {

  const { data, error } =
    await supabase
      .from("documents")
      .select("id, title, dna_id, copies, created_at")
      .order("created_at", { ascending: false });

  if (error) throw error;

  const all = [];

  for (const document of data ?? []) {

    const copies =
      Array.isArray(document.copies)
        ? document.copies
        : [];

    for (const copy of copies) {

      const password =
        copy.copyPassword ??
        copy.password ??
        null;

      if (!password) continue;

      all.push({
        documentId: document.id,
        fileName: document.title,
        dnaId: document.dna_id,
        copyId: copy.copyId ?? copy.copy_id ?? null,
        recipient: copy.recipient,
        recipientType: copy.recipientType ?? null,
        recipientOrganization: copy.recipientOrganization ?? null,
        password,
      });
    }
  }

  return all;
}

/* =========================================================
   DOWNLOAD PROTECTED COPY
========================================================= */

export async function downloadProtectedCopy(
  storagePath
) {
  if (!storagePath) {
    throw new Error(
      "Protected copy storage path is missing."
    );
  }

  const {
    data,
    error,
  } =
    await supabase.storage
      .from("protected-copies")
      .download(
        storagePath
      );

  if (error) {
    throw error;
  }

  return data;
}


/* =========================================================
   UPDATE DOCUMENT COPIES
========================================================= */

export async function updateDocumentCopies(
  documentId,
  copies
) {
  if (!documentId) {
    throw new Error(
      "Document ID is required."
    );
  }

  const {
    data,
    error,
  } =
    await supabase
      .from("documents")
      .update({
        copies:
          copies,
      })
      .eq(
        "id",
        documentId
      )
      .select()
      .single();

  if (error) {
    throw error;
  }

  return mapDocument(data);
}


/* =========================================================
   REVEAL COPY PASSWORD
========================================================= */

export async function revealCopyPassword(
  documentId,
  copyId
) {
  if (!documentId || !copyId) {
    throw new Error(
      "Document and copy ID are required."
    );
  }

  /*
   * Get the latest copy data.
   */

  const {
    data: documents,
    error: fetchError,
  } =
    await supabase
      .from("documents")
      .select(
        "id, copies"
      )
      .eq(
        "id",
        documentId
      )
      .limit(1);

  if (fetchError) {
    console.error(
      "REVEAL PASSWORD DOCUMENT QUERY ERROR:",
      fetchError
    );

    throw new Error(
      fetchError.message ??
      "Unable to access the protected document."
    );
  }

  if (
    !documents ||
    documents.length === 0
  ) {
    throw new Error(
      "Protected document could not be found or you do not have permission to access it."
    );
  }

  const data =
    documents[0];

  const copies =
    Array.isArray(data.copies)
      ? data.copies
      : [];

  const index =
    copies.findIndex(
      (copy) =>
        String(
          copy?.copyId ??
          copy?.copy_id ??
          ""
        ) ===
        String(copyId)
    );

  if (index === -1) {
    throw new Error(
      "Protected copy not found."
    );
  }

  const copy =
    copies[index];

  const password =
    copy.copyPassword ??
    copy.password ??
    null;

  if (!password) {
    throw new Error(
      "No password is assigned to this protected copy."
    );
  }

  /*
   * IMPORTANT:
   * Always calculate the reveal count from
   * the CURRENT database copy.
   */

  const currentRevealCount =
    Number(
      copy.passwordRevealCount ??
      copy.password_reveal_count ??
      0
    );

  const revealCount =
    currentRevealCount + 1;

  const revealedAt =
    new Date().toISOString();

  const updatedCopy = {
    ...copy,

    /*
     * Keep the camelCase property used
     * throughout the application.
     */

    passwordRevealCount:
      revealCount,

    lastPasswordRevealedAt:
      revealedAt,
  };

  const updatedCopies =
    [...copies];

  updatedCopies[index] =
    updatedCopy;

  /*
   * Persist the updated copies array.
   */

  const {
    data: updatedDocument,
    error: updateError,
  } =
    await supabase
      .from("documents")
      .update({
        copies:
          updatedCopies,
      })
      .eq(
        "id",
        documentId
      )
      .select(
        "id, copies, title, dna_id, email_shares, download_count, cloud_uploads, external_accesses"
      )
      .limit(1);

  if (updateError) {
    console.error(
      "REVEAL PASSWORD UPDATE ERROR:",
      updateError
    );

    throw new Error(
      updateError.message ??
      "Unable to update password reveal count."
    );
  }

  if (
    !updatedDocument ||
    updatedDocument.length === 0
  ) {
    throw new Error(
      "Password could not be updated. You may not have permission to modify this document."
    );
  }

  const freshDocument =
    updatedDocument[0];

  return {
    password,

    passwordRevealCount:
      revealCount,

    lastPasswordRevealedAt:
      revealedAt,

    copyId,

    document:
      mapDocument(
        freshDocument
      ),
  };
}


/* =========================================================
   TOTAL PASSWORD REVEALS
========================================================= */

export function getTotalPasswordReveals(
  document
) {
  const copies =
    Array.isArray(document?.copies)
      ? document.copies
      : [];

  return copies.reduce(
    (total, copy) =>
      total +
      Number(
        copy?.passwordRevealCount ??
        copy?.password_reveal_count ??
        0
      ),
    0
  );
}