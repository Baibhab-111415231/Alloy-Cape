import { supabase } from "../../lib/supabase";

export async function logDocumentEvent({
    documentId,
    trackerId,
    copyId = null,
    type,
    recipient = null,
    source = "Alloy Cape",
    device =
        typeof navigator !== "undefined"
            ? navigator.userAgent
            : "Unknown",
    ip = null,
    location = "Unknown",
    details = {},
}) {


    const { error } =
        await supabase
            .from("document_events")
            .insert([
                {
                    document_id:
                        documentId,

                    tracker_id:
                        trackerId,

                    copy_id:
                        copyId,

                    event_type:
                        type,

                    recipient:
                        recipient,

                    event_source:
                        source,

                    device:
                        device,

                    ip_address:
                        ip,

                    location:
                        location,

                    details:
                        details,
                },
            ]);

    if (error) {
        console.error(
            "DOCUMENT EVENT INSERT FAILED:",
            error
        );

        throw error;
    }
}

export async function getDocumentEvents(
  documentId
) {
  const { data, error } = await supabase
    .from("document_events")
    .select("*")
    .eq("document_id", documentId)
    .order("created_at", {
      ascending: true,
    });

  if (error) throw error;

  return data ?? [];
}

export async function getCopyEvents(
  documentId,
  copyId
) {
  if (!documentId || !copyId) {
    return [];
  }

  const { data, error } = await supabase
    .from("document_events")
    .select("*")
    .eq("document_id", documentId)
    .eq("copy_id", copyId)
    .order("created_at", {
      ascending: true,
    });

  if (error) throw error;

  return data ?? [];
}