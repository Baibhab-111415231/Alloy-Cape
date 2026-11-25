import { calculateIntegrity } from "./integrityEngine";
import { calculateRisk } from "../security/riskEngine";

export function runForensicAnalysis({
  document = {},
  uploadedFile = {},
  tracker = {},
  checks = {},
}) {

  const integrity =
    calculateIntegrity(checks);

  const tampered =
    integrity < 90;

  const downloads =
    Number(
      tracker.downloadCount ??
      tracker.downloads ??
      0
    );

  const emailShares =
    Number(
      tracker.emailShares ??
      tracker.emailShareCount ??
      tracker.emailShareCountTotal ??
      0
    );

  const cloudUploads =
    Number(
      tracker.cloudUploads ??
      tracker.cloudUploadCount ??
      0
    );

  const externalAccesses =
    Number(
      tracker.externalShares ??
      tracker.externalAccesses ??
      tracker.externalAccessCount ??
      0
    );

  const passwordReveals =
    Number(
      tracker.passwordReveals ??
      tracker.passwordRevealCount ??
      0
    );

  const semanticScore =
    Number(
      checks.semanticScore ??
      tracker.semanticScore ??
      0
    );

  const leakProbability =
    Number(
      tracker.leakProbability ??
      0
    );

  const recipientType =
    document.recipientType ??
    tracker.recipientType ??
    "";

  const risk =
    calculateRisk({

      ...document,

      classification:
        document.classification,

      integrity,

      tampered,

      downloads,

      emailShares,

      cloudUploads,

      externalAccesses,

      passwordReveals,

      semanticScore,

      leakProbability,

      recipientType,

    });

  return {

    ...document,

    integrity,

    tampered,

    risk,

    recipient:
      document.recipients ??
      document.recipient ??
      null,

    tracker,

    checks,

    downloads,

    emailShares,

    cloudUploads,

    externalAccesses,

    passwordReveals,

    semanticScore,

    leakProbability,

    recipientType,

    uploadedFile,

  };

}