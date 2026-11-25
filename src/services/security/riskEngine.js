import {
    RISK_LEVELS,
    SCORE_LIMITS,
    ENGINE,
    EXTERNAL_RISK_MULTIPLIER,
} from "../intelligence/constants";


export function calculateRisk(data = {}) {

    let score = 0;

    const factors = [];

    const classification =
        String(
            data.classification ?? "Confidential"
        )
        .trim()
        .toLowerCase();

    const integrity =
        Number(
            data.integrity ?? 100
        );

    const downloads =
        Number(
            data.downloads ?? 0
        );

    const emailShares =
        Number(
            data.emailShares ?? 0
        );

    const cloudUploads =
        Number(
            data.cloudUploads ?? 0
        );

    const externalAccesses =
        Number(
            data.externalAccesses ?? 0
        );

    const passwordReveals =
        Number(
            data.passwordReveals ?? 0
        );

    const semanticScore =
        Number(
            data.semanticScore ?? 0
        );

    const tampered =
        Boolean(
            data.tampered ?? false
        );

    const leakProbability =
        Number(
            data.leakProbability ?? 0
        );

    const recipientType =
        String(
            data.recipientType ?? ""
        )
        .trim()
        .toUpperCase();

    const isExternal =
        recipientType === "EXTERNAL";

    const multiplier =
        isExternal
            ? EXTERNAL_RISK_MULTIPLIER
            : 1;


    // ======================================================
    // CLASSIFICATION
    // ======================================================
    // Classification reflects document sensitivity, but it
    // should only translate into baseline risk when the copy
    // has actually left the organization (EXTERNAL recipient).
    // A fresh, zero-activity INTERNAL copy carries no inherent
    // risk — trust is implicit for internal recipients.
    // ======================================================

    const classificationWeights = {

        public: 0,

        internal: 5,

        confidential: 10,

        restricted: 20,

    };

    const rawClassificationScore =
        classificationWeights[
            classification
        ] ?? 0;

    const classificationScore =
        isExternal
            ? rawClassificationScore
            : 0;

    if (classificationScore > 0) {

        score += classificationScore;

        factors.push({

            category:
                "Classification",

            value:
                classification,

            impact:
                classificationScore,

        });

    } else if (rawClassificationScore > 0 && !isExternal) {

        // Informational only — classification carries no
        // score for internal recipients, but still surfaced
        // for visibility in the evidence list.
        factors.push({

            category:
                "Classification",

            value:
                classification,

            impact:
                0,

        });

    }


    // ======================================================
    // DOWNLOADS
    // ======================================================

    if (downloads > 0) {

        const base =
            Math.min(
                downloads * 2,
                20
            );

        const impact =
            Math.round(base * multiplier);

        score += impact;

        factors.push({

            category:
                "Downloads",

            value:
                downloads,

            impact,

        });

    }


    // ======================================================
    // EMAIL SHARES
    // ======================================================

    if (emailShares > 0) {

        const base =
            Math.min(
                emailShares * 8,
                24
            );

        const impact =
            Math.round(base * multiplier);

        score += impact;

        factors.push({

            category:
                "Email Distribution",

            value:
                emailShares,

            impact,

        });

    }


    // ======================================================
    // CLOUD UPLOADS
    // ======================================================

    if (cloudUploads > 0) {

        const base =
            Math.min(
                cloudUploads * 15,
                30
            );

        const impact =
            Math.round(base * multiplier);

        score += impact;

        factors.push({

            category:
                "Cloud Upload",

            value:
                cloudUploads,

            impact,

        });

    }


    // ======================================================
    // EXTERNAL ACCESS
    // ======================================================

    if (externalAccesses > 0) {

        const base =
            Math.min(
                externalAccesses * 20,
                40
            );

        const impact =
            Math.round(base * multiplier);

        score += impact;

        factors.push({

            category:
                "External Access",

            value:
                externalAccesses,

            impact,

        });

    }


    // ======================================================
    // PASSWORD REVEALS
    // ======================================================

    if (passwordReveals > 0) {

        let base = 3;

        if (passwordReveals >= 3)
            base += 5;

        if (passwordReveals >= 5)
            base += 10;

        if (passwordReveals >= 10)
            base += 20;

        const impact =
            Math.round(base * multiplier);

        score += impact;

        factors.push({

            category:
                "Password Reveals",

            value:
                passwordReveals,

            impact,

        });

    }


    // ======================================================
    // TAMPERING
    // ======================================================
    // Not multiplied — tampering is a forensic finding, not
    // a distribution-behavior signal, and already scores at
    // the top of the scale (and gets a hard override upstream
    // in dnaInspector.js for Critical/High).
    // ======================================================

    if (tampered) {

        score += 40;

        factors.push({

            category:
                "Tampering",

            value:
                "Detected",

            impact:
                40,

        });

    }


    // ======================================================
    // INTEGRITY
    // ======================================================
    // Not multiplied — reflects document state, not recipient
    // behavior.
    // ======================================================

    if (integrity < 60) {

        score += 30;

        factors.push({

            category:
                "Integrity",

            value:
                integrity,

            impact:
                30,

        });

    }

    else if (integrity < 80) {

        score += 20;

        factors.push({

            category:
                "Integrity",

            value:
                integrity,

            impact:
                20,

        });

    }

    else if (integrity < 95) {

        score += 10;

        factors.push({

            category:
                "Integrity",

            value:
                integrity,

            impact:
                10,

        });

    }


    // ======================================================
    // SEMANTIC ANALYSIS
    // ======================================================

    if (semanticScore > 0) {

        const base =
            Math.min(
                semanticScore,
                30
            );

        const impact =
            Math.round(base * multiplier);

        score += impact;

        factors.push({

            category:
                "Semantic Changes",

            value:
                semanticScore,

            impact,

        });

    }


    // ======================================================
    // LEAK PROBABILITY
    // ======================================================

    if (leakProbability > 0) {

        const base =
            leakProbability * 0.5;

        const impact =
            Math.round(base * multiplier);

        score += impact;

        factors.push({

            category:
                "Leak Probability",

            value:
                `${leakProbability}%`,

            impact,

        });

    }


    // ======================================================
    // EXTERNAL RECIPIENT (informational only)
    // ======================================================
    // No longer adds flat score on its own. Recorded as a
    // factor purely for visibility/audit — the actual risk
    // impact of being external is already reflected via the
    // multiplier applied to the activity factors above.
    // ======================================================

    if (isExternal) {

        factors.push({

            category:
                "External Recipient",

            value:
                "EXTERNAL",

            impact:
                0,

        });

    }


    // ======================================================
    // LIMIT SCORE
    // ======================================================

    score =
        Math.round(
            Math.max(
                ENGINE.MIN_SCORE,
                Math.min(
                    score,
                    ENGINE.MAX_SCORE
                )
            )
        );


    // ======================================================
    // RISK LEVEL
    // ======================================================

    let level;

    if (
        score <=
        SCORE_LIMITS.LOW
    ) {

        level =
            RISK_LEVELS.LOW;

    }

    else if (
        score <=
        SCORE_LIMITS.MEDIUM
    ) {

        level =
            RISK_LEVELS.MEDIUM;

    }

    else if (
        score <=
        SCORE_LIMITS.HIGH
    ) {

        level =
            RISK_LEVELS.HIGH;

    }

    else {

        level =
            RISK_LEVELS.CRITICAL;

    }


    return {

        score,

        level,

        factors,

        evidence:
            factors,

    };

}