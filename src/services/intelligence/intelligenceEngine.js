import { calculateRisk } from "../security/riskEngine";
import { calculateTrust } from "./trustEngine";
import { generateRecommendations } from "./recommendationEngine";
import { calculateConfidence } from "./confidenceEngine";

export function generateIntelligence({
  document = {},
  investigation = {},
  investigations = [],
}) {

  const investigatedRecipient =
    investigation.investigatedRecipient ??
    investigation.recipient ??
    document.investigatedRecipient ??
    document.recipient ??
    document.recipients ??
    null;

  const trust =
    calculateTrust(
      investigatedRecipient,
      investigations
    );

  const risk =
    calculateRisk({

      ...document,

      ...investigation,

      classification:
        investigation.classification ??
        document.classification,

      integrity:
        investigation.integrity ??
        document.integrity ??
        100,

      tampered:
        investigation.tampered ??
        false,

      downloads:
        investigation.downloads ??
        investigation.downloadCount ??
        0,

      emailShares:
        investigation.emailShares ??
        investigation.emailShareCount ??
        0,

      cloudUploads:
        investigation.cloudUploads ??
        investigation.cloudUploadCount ??
        0,

      externalAccesses:
        investigation.externalAccesses ??
        investigation.externalShares ??
        investigation.externalAccessCount ??
        0,

      passwordReveals:
        investigation.passwordReveals ??
        investigation.passwordRevealCount ??
        0,

      semanticScore:
        investigation.semanticScore ??
        0,

      leakProbability:
        investigation.leakProbability ??
        0,

      recipientType:
        investigation.recipientType ??
        document.recipientType ??
        "",

    });

  const confidence =
    calculateConfidence({

      integrity:
        investigation.integrity ??
        100,

      risk,

      trust,

      historyCount:
        trust.historyCount,

    });

  const recommendations =
    generateRecommendations(
      risk,
      trust
    );

  return {

    risk,

    trust,

    confidence,

    recommendations,

    generatedAt:
      new Date().toISOString(),

  };
}