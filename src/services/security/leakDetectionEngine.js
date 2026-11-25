function normalizeCopyId(value) {
    if (value === null || value === undefined) {
        return null;
    }

    return String(value).trim();
}

function normalizeEventType(value) {
    return String(value ?? "")
        .trim()
        .toUpperCase();
}

function getCopyEvents(events = [], copyId = null) {
    const normalizedCopyId = normalizeCopyId(copyId);

    if (!normalizedCopyId) {
        return [];
    }

    return events.filter((event) => {
        const eventCopyId = normalizeCopyId(
            event?.copy_id ??
            event?.copyId
        );

        return eventCopyId === normalizedCopyId;
    });
}

function countEvents(events, type) {
    const normalizedType = normalizeEventType(type);

    return events.filter(
        (event) =>
            normalizeEventType(
                event?.event_type ??
                event?.eventType ??
                event?.type
            ) === normalizedType
    ).length;
}

export function detectLeak(
    document = {},
    copy = null,
    events = []
) {
    let score = 0;

    const evidence = [];

    const copyId = normalizeCopyId(
        copy?.copyId ??
        copy?.copy_id
    );

    // ======================================================
    // COPY-SPECIFIC EVENTS
    // ======================================================

    const copyEvents = getCopyEvents(
        events,
        copyId
    );

    // ======================================================
    // ACTIVITY COUNTS
    // ======================================================

    const downloadCount = countEvents(
        copyEvents,
        "DOWNLOAD"
    );

    const emailShares = countEvents(
        copyEvents,
        "EMAIL_SHARE"
    );

    const cloudUploads = countEvents(
        copyEvents,
        "CLOUD_UPLOAD"
    );

    const externalAccesses = countEvents(
        copyEvents,
        "EXTERNAL_ACCESS"
    );

    // ======================================================
    // DOWNLOADS
    // ======================================================

    if (downloadCount > 0) {
        const points = Math.min(
            downloadCount * 5,
            20
        );

        score += points;

        evidence.push({
            severity:
                downloadCount >= 5
                    ? "Medium"
                    : "Low",

            type:
                downloadCount >= 5
                    ? "Repeated Downloads"
                    : "Download",

            points,

            message:
                `${downloadCount} download(s) recorded for protected copy ${copyId}.`,
        });
    }

    // ======================================================
    // EMAIL SHARES
    // ======================================================

    if (emailShares > 0) {
        const points = Math.min(
            emailShares * 10,
            40
        );

        score += points;

        evidence.push({
            severity:
                emailShares >= 5
                    ? "High"
                    : emailShares >= 2
                        ? "Medium"
                        : "Low",

            type:
                "Email Distribution",

            points,

            message:
                `${emailShares} email share(s) recorded for protected copy ${copyId}.`,
        });
    }

    // ======================================================
    // CLOUD UPLOADS
    // ======================================================

    if (cloudUploads > 0) {
        const points = Math.min(
            cloudUploads * 20,
            40
        );

        score += points;

        evidence.push({
            severity: "High",

            type: "Cloud Upload",

            points,

            message:
                `${cloudUploads} cloud upload(s) recorded for protected copy ${copyId}.`,
        });
    }

    // ======================================================
    // EXTERNAL ACCESS
    // ======================================================

    if (externalAccesses > 0) {
        const points = Math.min(
            externalAccesses * 30,
            60
        );

        score += points;

        evidence.push({
            severity: "Critical",

            type: "External Access",

            points,

            message:
                `${externalAccesses} external access event(s) recorded for protected copy ${copyId}.`,
        });
    }

    // ======================================================
    // FINAL SCORE
    // ======================================================

    score = Math.min(
        Math.max(
            Math.round(score),
            0
        ),
        100
    );

    // ======================================================
    // LEAK LEVEL
    // ======================================================

    let level = "Minimal";

    if (score >= 20) {
        level = "Low";
    }

    if (score >= 40) {
        level = "Medium";
    }

    if (score >= 60) {
        level = "High";
    }

    if (score >= 80) {
        level = "Critical";
    }

    // ======================================================
    // RESULT
    // ======================================================

    return {
        probability: score,

        level,

        evidence,

        copyId,

        activity: {
            downloads: downloadCount,
            emailShares,
            cloudUploads,
            externalAccesses,
            totalEvents: copyEvents.length,
        },
    };
}