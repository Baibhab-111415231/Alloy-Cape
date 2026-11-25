import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { saveAs } from "file-saver";
import { useNavigate } from "react-router-dom";

import { useIssue } from "../../context/IssueContext";
import { useAuth } from "../../context/AuthContext";

import {
  getCopyEvents,
  logDocumentEvent,
} from "../../services/document/documentEventService";

import {
  getDocumentInvestigations,
} from "../../services/investigation/investigationService";

import {
  deleteDocumentCascade,
  incrementDownload,
  incrementEmailShare,
  incrementCloudUpload,
  incrementExternalAccess,
  uploadProtectedCopy,
  revealCopyPassword,
  downloadProtectedCopy,
  downloadExternalCopy,
} from "../../services/document/documentSupabaseService";

export default function DocumentIdentityDrawer({
  open,
  document,
  onClose,
  onRefresh,
}) {
  const navigate = useNavigate();

  const { loadRegistry } = useIssue();

  const [investigations, setInvestigations] = useState([]);

  const {
      isEmployee,
      isExternal,
      isSecurityOfficer,
      isAdministrator,
      user,
  } = useAuth();

  const [selectedCopyId, setSelectedCopyId] = useState(null);

  const [passwordRevealCounts, setPasswordRevealCounts] =
    useState({});

  const [copyActivity, setCopyActivity] = useState({
    downloads: 0,
    emailShares: 0,
    cloudUploads: 0,
    externalAccesses: 0,
    lastAccessed: null,
    lastLocation: null,
  });

  useEffect(() => {
    if (!document) return;

    setPasswordRevealCounts({});

    const copies = document.copies ?? [];

    setSelectedCopyId(
      copies.length > 0
        ? copies[0].copyId
        : null
    );
  }, [document]);

  useEffect(() => {
    if (!document?.id || !selectedCopyId) {
      setCopyActivity({
        downloads: 0,
        emailShares: 0,
        cloudUploads: 0,
        externalAccesses: 0,
        lastAccessed: null,
        lastLocation: null,
      });

      return;
    }

    async function loadCopyActivity() {
      try {
        const events = await getCopyEvents(
          document.id,
          selectedCopyId
        );

        const lastEvent =
          events.length > 0
            ? events[events.length - 1]
            : null;

        setCopyActivity({
          downloads: events.filter(
            (event) =>
              event.event_type === "DOWNLOAD"
          ).length,

          emailShares: events.filter(
            (event) =>
              event.event_type === "EMAIL_SHARE"
          ).length,

          cloudUploads: events.filter(
            (event) =>
              event.event_type === "CLOUD_UPLOAD"
          ).length,

          externalAccesses: events.filter(
            (event) =>
              event.event_type === "EXTERNAL_ACCESS"
          ).length,

          lastAccessed:
            lastEvent?.created_at ?? null,

          lastLocation:
            lastEvent?.location ?? null,
        });
      } catch (err) {
        console.error(
          "COPY ACTIVITY LOAD ERROR",
          err
        );
      }
    }

    loadCopyActivity();
  }, [document?.id, selectedCopyId]);

  useEffect(() => {
    if (
      !document?.id ||
      (!isSecurityOfficer && !isAdministrator)
    ) {
      setInvestigations([]);
      return;
    }

    let cancelled = false;

    async function loadInvestigations() {
      try {
        const result =
          await getDocumentInvestigations(
            document.id
          );

        if (!cancelled) {
          setInvestigations(
            Array.isArray(result)
              ? result
              : []
          );
        }
      } catch (err) {
        console.error(
          "DOCUMENT INVESTIGATIONS LOAD ERROR",
          err
        );

        if (!cancelled) {
          setInvestigations([]);
        }
      }
    }

    loadInvestigations();

    return () => {
      cancelled = true;
    };
  }, [
    document?.id,
    isSecurityOfficer,
    isAdministrator,
  ]);

  function getSelectedCopy() {
    const copies = document?.copies ?? [];

    if (copies.length === 0) {
      return null;
    }

    if (!selectedCopyId) {
      return copies[0];
    }

    return (
      copies.find(
        (copy) =>
          String(copy.copyId) ===
          String(selectedCopyId)
      ) ?? copies[0]
    );
  }

  function getAccessRules() {
    const classification = String(
      document?.classification ?? ""
    )
      .trim()
      .toUpperCase();

    /*
     * SECURITY OFFICER / ADMINISTRATOR
     *
     * This drawer is primarily used by employees.
     * Security/Admin permissions are retained here
     * only so existing application behavior does not
     * break if this component is reused elsewhere.
     */

    if (isAdministrator) {
      return {
        // Administrator can view
        canViewFile: true,

        // Employee-only actions
        canDownload: false,
        canEmailShare: false,
        canCloudUpload: false,
        canExternalAccess: false,

        // Keep password inspection available
        canRevealPassword: false,

        canDelete: true,

        isRestricted:
          classification === "RESTRICTED",
      };
    }

    if (isSecurityOfficer) {
      return {
        // Security Officer CANNOT view the actual document
        canViewFile: false,

        // Employee-only actions
        canDownload: false,
        canEmailShare: false,
        canCloudUpload: false,
        canExternalAccess: false,

        // Keep investigation/security inspection functionality
        canRevealPassword: false,

        canDelete: true,

        isRestricted:
          classification === "RESTRICTED",
      };
    }

    /*
     * EMPLOYEE
     */

    if (isEmployee) {
      if (
        classification === "PUBLIC" ||
        classification === "INTERNAL"
      ) {
        return {
          canViewFile: true,
          canDownload: true,
          canEmailShare: true,
          canCloudUpload: true,
          canExternalAccess: true,
          canRevealPassword: true,
          canDelete: false,
          isRestricted: false,
        };
      }

      if (classification === "CONFIDENTIAL") {
        return {
          canViewFile: true,
          canDownload: false,
          canEmailShare: true,
          canCloudUpload: false,
          canExternalAccess: false,
          canRevealPassword: true,
          canDelete: false,
          isRestricted: false,
        };
      }

      if (classification === "RESTRICTED") {
        return {
          canViewFile: true,
          canDownload: false,
          canEmailShare: false,
          canCloudUpload: false,
          canExternalAccess: false,
          canRevealPassword: true,
          canDelete: false,
          isRestricted: true,
        };
      }
    }

    /*
    * EXTERNAL RECIPIENT
    */

    if (isExternal) {
        if (
            classification === "PUBLIC" ||
            classification === "INTERNAL"
        ) {
            return {
                canViewFile: true,
                canDownload: true,
                canEmailShare: true,
                canCloudUpload: true,
                canExternalAccess: true,
                canRevealPassword: true,
                canDelete: false,
                isRestricted: false,
            };
        }

        if (classification === "CONFIDENTIAL") {
            return {
                canViewFile: true,
                canDownload: false,
                canEmailShare: true,
                canCloudUpload: false,
                canExternalAccess: false,
                canRevealPassword: true,
                canDelete: false,
                isRestricted: false,
            };
        }

        if (classification === "RESTRICTED") {
            return {
                canViewFile: true,
                canDownload: false,
                canEmailShare: false,
                canCloudUpload: false,
                canExternalAccess: false,
                canRevealPassword: true,
                canDelete: false,
                isRestricted: true,
            };
        }
    }

    return {
      canViewFile: false,
      canDownload: false,
      canEmailShare: false,
      canCloudUpload: false,
      canExternalAccess: false,
      canRevealPassword: false,
      canDelete: false,
      isRestricted: false,
    };
  }

  async function handleRevealPassword() {
      try {
        const copy = getSelectedCopy();

        if (!copy) {
          alert("No protected copy selected.");
          return;
        }

        const result =
          await revealCopyPassword(
            document.id,
            copy.copyId
          );

        const count =
          Number(
            result?.passwordRevealCount ?? 0
          );

        setPasswordRevealCounts((prev) => ({
          ...prev,
          [copy.copyId]: count,
        }));

        setCopyActivity((prev) => ({
          ...prev,
          lastAccessed:
            new Date().toISOString(),
          lastLocation:
            "Internal Network",
        }));

        // Refresh the parent's document list so the
        // persisted count survives closing/reopening the drawer.
        if (typeof onRefresh === "function") {
          try {
            await onRefresh();
          } catch (refreshError) {
            console.error(
              "DOCUMENT LIST REFRESH ERROR",
              refreshError
            );
            // Don't block the reveal on a refresh failure.
          }
        }

        alert(
          "🔑 Protected Copy Password\n\n" +
          `Password: ${result.password}`
        );
      } catch (err) {
        console.error(
          "PASSWORD REVEAL ERROR",
          err
        );

        alert(
          err?.message ??
            "Failed to reveal protected copy password."
        );
      }
  }

  async function handleDelete() {
    const accessRules = getAccessRules();

    if (!accessRules.canDelete) {
      alert(
        "🔒 You are not permitted to delete this document."
      );
      return;
    }

    const confirmed = window.confirm(
      `Delete "${document.fileName}"?\n\n` +
        "This will permanently delete the document.\n\n" +
        "This action cannot be undone."
    );

    if (!confirmed) return;

    try {
      await deleteDocumentCascade(
        document.id
      );

      await loadRegistry();

      onClose();
    } catch (err) {
      console.error(
        "DELETE DOCUMENT ERROR",
        err
      );

      alert(
        err?.message ??
          "Failed to delete document."
      );
    }
  }

  async function handleDownload() {
    const accessRules = getAccessRules();

    if (!accessRules.canDownload) {
      alert(
        "🔒 You are not permitted to download this document."
      );
      return;
    }

    try {
      const classification = String(
        document?.classification ?? ""
      )
        .trim()
        .toUpperCase();

      if (classification === "RESTRICTED") {
        alert(
          "🔒 Restricted documents cannot be downloaded after issuance."
        );
        return;
      }

      const copy = getSelectedCopy();

      if (!copy) {
        alert("No protected copy selected.");
        return;
      }

      if (!copy.storagePath) {
        alert("Protected PDF storage path is missing.");
        return;
      }

      /*
      * STEP 1
      * Get the actual file.
      */
      const blob = await downloadProtectedCopy(
        copy.storagePath
      );

      const copyId =
        copy.copyId ?? null;

      const trackerId =
        copy.trackerId ??
        document.trackerId ??
        null;

      const recipient =
        copy.recipient ?? null;

      const fileName =
        copy.fileName ??
        `Protected_${copyId}.pdf`;

      /*
      * STEP 2
      * DOWNLOAD THE FILE FIRST.
      *
      * Nothing related to logging happens before this.
      */
      saveAs(blob, fileName);

      /*
      * STEP 3
      * Immediately update the user's visible activity.
      */
      const now = new Date().toISOString();

      setCopyActivity((prev) => ({
        ...prev,
        downloads: prev.downloads + 1,
        lastAccessed: now,
        lastLocation: "Internal Network",
      }));

      /*
      * STEP 4
      * Log the download.
      *
      * IMPORTANT:
      * If logging fails, DO NOT show a download failure.
      */
      try {
        await logDocumentEvent({
          documentId: document.id,
          trackerId,
          copyId,
          recipient,

          type: "DOWNLOAD",

          location: "Internal Network",

          details: {
            action: "Protected copy downloaded",

            copyId,

            trackerId,

            recipient,

            recipientType:
              copy.recipientType ?? null,

            recipientOrganization:
              copy.recipientOrganization ?? null,

            fileName,

            actor:
              user?.email ?? null,

            actorRole:
              isAdministrator
                  ? "administrator"
                  : isSecurityOfficer
                  ? "security_officer"
                  : isEmployee
                  ? "employee"
                  : isExternal
                  ? "external"
                  : "unknown",
          },
        });
      } catch (eventError) {
        console.error(
          "DOWNLOAD EVENT LOG ERROR",
          eventError
        );

        // DO NOT alert the user.
      }

      /*
      * STEP 5
      * Update download counter separately.
      *
      * A counter failure must NOT make the download
      * appear unsuccessful.
      */
      try {
        await incrementDownload(document);
      } catch (counterError) {
        console.error(
          "DOWNLOAD COUNTER UPDATE ERROR",
          counterError
        );

        // DO NOT alert the user.
      }

      /*
      * STEP 6
      * Refresh registry in the background.
      *
      * A refresh failure must NOT make the download
      * appear unsuccessful.
      */
      try {
        await loadRegistry();
      } catch (refreshError) {
        console.error(
          "REGISTRY REFRESH AFTER DOWNLOAD ERROR",
          refreshError
        );

        // DO NOT alert the user.
      }

    } catch (err) {
      /*
      * ONLY actual download failures reach here.
      */
      console.error(
        "DOWNLOAD ERROR",
        err
      );

      alert(
        err?.message ??
          "Failed to download protected copy."
      );
    }
  }

  async function handleViewProtectedCopy() {
    const accessRules = getAccessRules();

    if (!accessRules.canViewFile) {
      alert(
        "🔒 You are not permitted to view this document."
      );
      return;
    }

    try {
      const copy =
        getSelectedCopy();

      if (!copy) {
        alert(
          "No protected copy selected."
        );
        return;
      }

      if (!copy.storagePath) {
        alert(
          "Protected PDF storage path is missing."
        );
        return;
      }

      const blob =
        await downloadProtectedCopy(
          copy.storagePath
        );

      const url =
        URL.createObjectURL(blob);

      window.open(
        url,
        "_blank",
        "noopener,noreferrer"
      );

      setTimeout(() => {
        URL.revokeObjectURL(url);
      }, 60000);

      
      setCopyActivity((prev) => ({
        ...prev,

        lastAccessed:
          new Date().toISOString(),

        lastLocation:
          "Internal Network",
      }));
    } catch (err) {
      console.error(
        "VIEW PROTECTED COPY ERROR",
        err
      );

      alert(
        err?.message ??
          "Unable to open protected document."
      );
    }
  }

  async function handleEmailShare() {
    const accessRules = getAccessRules();

    if (!accessRules.canEmailShare) {
      alert(
        "🔒 You are not permitted to share this document by email."
      );
      return;
    }

    try {
      const classification =
        String(
          document?.classification ?? ""
        )
          .trim()
          .toUpperCase();

      if (
        classification !== "PUBLIC" &&
        classification !== "INTERNAL" &&
        classification !== "CONFIDENTIAL"
      ) {
        alert(
          "⚠️ Email sharing is not allowed for this document."
        );
        return;
      }

      const copy =
        getSelectedCopy();

      if (!copy) {
        alert(
          "No protected copy selected."
        );
        return;
      }

      if (!copy.storagePath) {
        alert(
          "Protected PDF storage path is missing."
        );
        return;
      }

      const protectedBlob =
        await downloadProtectedCopy(
          copy.storagePath
        );

      const fileName =
        copy.fileName ??
        `Protected_${copy.copyId}.pdf`;

      const file = new File(
        [protectedBlob],
        fileName,
        {
          type:
            "application/pdf",
        }
      );

      const recipient =
        copy.recipient ??
        document.recipients?.[0] ??
        "";

      const subject =
        `Protected Document - ${document.fileName}`;

      const body =
        `Please find the protected document attached.\n\n` +
        `Document: ${document.fileName}\n` +
        `Recipient: ${recipient}`;

      if (
        navigator.share &&
        typeof navigator.canShare === "function" &&
        navigator.canShare({ files: [file] })
      ) {
        await navigator.share({
          title: subject,
          text: body,
          files: [file],
        });
      } else {
        alert(
          "Email sharing with attachment is not supported by this browser. Please use a browser/device that supports file sharing."
        );
        return;
      }

      try {
        await logDocumentEvent({
          documentId:
            document.id,

          trackerId:
            copy.trackerId ??
            document.trackerId ??
            null,

          copyId:
            copy.copyId ??
            null,

          recipient,

          type:
            "EMAIL_SHARE",

          location:
            "Internal Network",

          details: {
            action:
              "Protected copy shared via email",

            copyId:
              copy.copyId ??
              null,

            recipientType:
              copy.recipientType ??
              null,

            recipientOrganization:
              copy.recipientOrganization ??
              null,

            fileName,
          },
        });
      } catch (eventError) {
        console.error(
          "EMAIL SHARE EVENT ERROR",
          eventError
        );
      }

      try {
        await incrementEmailShare(
          document
        );
      } catch (counterError) {
        console.error(
          "EMAIL SHARE COUNTER ERROR",
          counterError
        );
      }

      const now =
        new Date().toISOString();

      setCopyActivity((prev) => ({
        ...prev,

        emailShares:
          prev.emailShares + 1,

        lastAccessed:
          now,

        lastLocation:
          "Internal Network",
      }));
    } catch (err) {
      if (
        err?.name ===
        "AbortError"
      ) {
        return;
      }

      console.error(
        "EMAIL SHARE ERROR",
        err
      );

      alert(
        err?.message ??
          "Failed to share protected document."
      );
    }
  }

  async function handleCloudUpload() {
    const accessRules =
      getAccessRules();

    if (!accessRules.canCloudUpload) {
      alert(
        "🔒 You are not permitted to upload this document to cloud storage."
      );
      return;
    }

    try {
      const classification =
        String(
          document?.classification ?? ""
        )
          .trim()
          .toUpperCase();

      if (
        classification !== "PUBLIC" &&
        classification !== "INTERNAL"
      ) {
        alert(
          "🔒 Cloud upload is only allowed for PUBLIC and INTERNAL documents."
        );
        return;
      }

      const copy =
        getSelectedCopy();

      if (!copy) {
        alert(
          "No protected copy selected."
        );
        return;
      }

      if (!copy.storagePath) {
        alert(
          "Protected PDF storage path is missing."
        );
        return;
      }

      const protectedBlob =
        await downloadProtectedCopy(
          copy.storagePath
        );

      const fileName =
        copy.fileName ??
        `Protected_${copy.copyId}.pdf`;

      await uploadProtectedCopy(
        document.id,
        copy.copyId,
        fileName,
        protectedBlob
      );

      try {
        await logDocumentEvent({
          documentId:
            document.id,

          trackerId:
            copy.trackerId ??
            document.trackerId ??
            null,

          copyId:
            copy.copyId ??
            null,

          recipient:
            copy.recipient ??
            document.recipients?.[0] ??
            null,

          type:
            "CLOUD_UPLOAD",

          location:
            "Cloud Storage",

          details: {
            action:
              "Protected copy uploaded to Supabase Cloud Storage",

            copyId:
              copy.copyId ??
              null,

            recipientType:
              copy.recipientType ??
              null,

            recipientOrganization:
              copy.recipientOrganization ??
              null,

            fileName,

            storagePath:
              `${document.id}/${copy.copyId}/${fileName}`,
          },
        });
      } catch (eventError) {
        console.error(
          "CLOUD UPLOAD EVENT ERROR",
          eventError
        );
      }

      try {
        await incrementCloudUpload(
          document
        );
      } catch (counterError) {
        console.error(
          "CLOUD UPLOAD COUNTER ERROR",
          counterError
        );
      }

      const now =
        new Date().toISOString();

      setCopyActivity((prev) => ({
        ...prev,

        cloudUploads:
          prev.cloudUploads + 1,

        lastAccessed:
          now,

        lastLocation:
          "Cloud Storage",
      }));

      alert(
        "☁ Protected copy uploaded successfully to cloud storage."
      );
    } catch (err) {
      console.error(
        "CLOUD UPLOAD ERROR",
        err
      );

      alert(
        err?.message ??
          "Failed to upload protected copy to cloud storage."
      );
    }
  }

  async function handleExternalAccess() {
    const accessRules =
      getAccessRules();

    if (!accessRules.canExternalAccess) {
      alert(
        "🔒 You are not permitted to create external access."
      );
      return;
    }

    try {
      const classification =
        String(
          document?.classification ?? ""
        )
          .trim()
          .toUpperCase();

      if (
        classification !== "PUBLIC" &&
        classification !== "INTERNAL"
      ) {
        alert(
          "🔒 External access is only allowed for PUBLIC and INTERNAL documents."
        );
        return;
      }

      const copy =
        getSelectedCopy();

      if (!copy) {
        alert(
          "No protected copy selected."
        );
        return;
      }

      if (!copy.externalStoragePath) {
        alert(
          "External access copy is not available for this protected copy."
        );
        return;
      }

      const externalBlob =
        await downloadExternalCopy(
          copy.externalStoragePath
        );

      const externalFileName =
        copy.externalFileName ??
        (
          copy.fileName ??
          `Protected_${copy.copyId}.pdf`
        ).replace(
          /\.pdf$/i,
          "_EXTERNAL.pdf"
        );

      saveAs(
        externalBlob,
        externalFileName
      );

      const now =
        new Date().toISOString();

      try {
        await logDocumentEvent({
          documentId:
            document.id,

          trackerId:
            copy.trackerId ??
            document.trackerId ??
            null,

          copyId:
            copy.copyId ??
            null,

          recipient:
            copy.recipient ??
            document.recipients?.[0] ??
            null,

          type:
            "EXTERNAL_ACCESS",

          location:
            "External Network",

          details: {
            action:
              "Non-encrypted external copy released",

            copyId:
              copy.copyId ??
              null,

            recipientType:
              copy.recipientType ??
              null,

            recipientOrganization:
              copy.recipientOrganization ??
              null,

            fileName:
              externalFileName,

            encrypted:
              false,

            passwordRequired:
              false,

            accessMode:
              "External Access",
          },
        });
      } catch (eventError) {
        console.error(
          "EXTERNAL ACCESS EVENT ERROR",
          eventError
        );
      }

      try {
        await incrementExternalAccess(
          document
        );
      } catch (counterError) {
        console.error(
          "EXTERNAL ACCESS COUNTER ERROR",
          counterError
        );
      }

      setCopyActivity((prev) => ({
        ...prev,

        externalAccesses:
          prev.externalAccesses + 1,

        lastAccessed:
          now,

        lastLocation:
          "External Network",
      }));

      alert(
        "🌐 External Access copy downloaded successfully."
      );
    } catch (err) {
      console.error(
        "EXTERNAL ACCESS ERROR",
        err
      );

      alert(
        err?.message ??
          "Failed to access external copy."
      );
    }
  }

  function getLatestInvestigation() {
    if (!investigations.length) {
      return null;
    }

    return [...investigations].sort(
      (a, b) =>
        new Date(
          b.investigatedAt ??
          b.createdAt ??
          b.created_at ??
          0
        ) -
        new Date(
          a.investigatedAt ??
          a.createdAt ??
          a.created_at ??
          0
        )
    )[0];
  }

  if (!open || !document) {
    return null;
  }

  const accessRules =
    getAccessRules();

  const selectedCopy =
    getSelectedCopy();

  const latestInvestigation =
    getLatestInvestigation();

  const passwordReveals =
    passwordRevealCounts[
      selectedCopy?.copyId
    ] ??
    selectedCopy?.passwordRevealCount ??
    0;

  const riskScore = Math.min(
    100,
    copyActivity.downloads * 3 +
      copyActivity.emailShares * 8 +
      copyActivity.cloudUploads * 15 +
      copyActivity.externalAccesses * 20 +
      passwordReveals * 5
  );

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}

      <div
        onClick={onClose}
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
      />

      {/* Drawer */}

      <div className="absolute right-0 top-0 h-full w-[480px] overflow-y-auto border-l border-slate-700 bg-[#111B33] shadow-2xl">
        {/* Header */}

        <div className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-700 bg-[#111B33] p-6">
          <h2 className="text-2xl font-bold text-white">
            Document Identity
          </h2>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
          >
            <X className="text-slate-400 transition hover:text-white" />
          </button>
        </div>

        <div className="space-y-8 p-6">
          {/* Hero */}

          <div className="rounded-3xl border border-cyan-700 bg-gradient-to-r from-cyan-900/20 to-blue-900/20 p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <p className="text-xs uppercase tracking-[0.25em] text-cyan-400">
                  Document Identity
                </p>

                <h1 className="mt-2 break-all text-2xl font-bold leading-snug text-white">
                  {document.fileName ??
                    document.title ??
                    "Untitled Document"}
                </h1>

                <p className="mt-4 break-all font-mono text-cyan-300">
                  {document.dnaId ??
                    document.dna_id ??
                    "Unavailable"}
                </p>
              </div>

              <span className="inline-flex whitespace-nowrap rounded-full bg-green-500/20 px-4 py-2 text-sm font-semibold text-green-400">
                VERIFIED
              </span>
            </div>
          </div>

          {/* Document Details */}

          <DocumentSection title="Document Details">
            <IdentityItem
              title="DNA Identifier"
              value={
                document.dnaId ??
                document.dna_id ??
                "Unavailable"
              }
            />

            <IdentityItem
              title="Classification"
              value={
                document.classification ??
                "Unknown"
              }
            />

            <IdentityItem
              title="Recipients"
              value={
                document.recipients?.length ??
                (
                  document.recipient
                    ? 1
                    : 0
                )
              }
            />
          </DocumentSection>

          {/* Protected Copy */}

          <DocumentSection title="Protected Copy">
            {(document.copies ?? []).length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-700 p-5">
                <p className="text-slate-400">
                  No protected copies registered.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <select
                  value={
                    selectedCopyId ?? ""
                  }
                  onChange={(e) =>
                    setSelectedCopyId(
                      e.target.value
                    )
                  }
                  className="w-full rounded-xl border border-slate-700 bg-[#16213A] p-4 text-white outline-none focus:border-cyan-500"
                >
                  {(document.copies ?? []).map(
                    (copy) => (
                      <option
                        key={copy.copyId}
                        value={copy.copyId}
                      >
                        {copy.recipient ??
                          "Unknown"}{" "}
                        —{" "}
                        {copy.recipientType ??
                          "UNKNOWN"}{" "}
                        —{" "}
                        {copy.copyId}
                      </option>
                    )
                  )}
                </select>

                {(() => {
                  const copy =
                    getSelectedCopy();

                  if (!copy) return null;

                  const revealCount =
                    passwordRevealCounts[
                      copy.copyId
                    ] ??
                    copy.passwordRevealCount ??
                    0;

                  return (
                    <div className="space-y-3 rounded-2xl border border-cyan-800 bg-cyan-950/20 p-5">

                      <IdentityItem
                        title="Recipient"
                        value={
                          copy.recipient ??
                          "Unknown"
                        }
                      />

                      <IdentityItem
                        title="Recipient Type"
                        value={
                          copy.recipientType ??
                          "Unknown"
                        }
                        color={
                          copy.recipientType ===
                          "EXTERNAL"
                            ? "text-red-400"
                            : "text-green-400"
                        }
                      />

                      <IdentityItem
                        title="Organization"
                        value={
                          copy.recipientOrganization ??
                          "Unknown"
                        }
                      />

                      <IdentityItem
                        title="Recipient Signature"
                        value={
                          copy.recipientSignature ??
                          "Unknown"
                        }
                      />

                      {accessRules.canRevealPassword && (
                        <button
                          type="button"
                          onClick={
                            handleRevealPassword
                          }
                          className="mt-3 w-full rounded-xl bg-cyan-600 py-3 font-semibold text-white transition hover:bg-cyan-700"
                        >
                          🔑 Reveal Password
                        </button>
                      )}

                      <div className="rounded-xl border border-slate-700 bg-[#111B33] p-4">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-slate-400">
                            Password Reveals
                          </span>

                          <span
                            className={`font-bold ${
                              revealCount >= 5
                                ? "text-red-400"
                                : revealCount >= 3
                                ? "text-yellow-400"
                                : "text-green-400"
                            }`}
                          >
                            {revealCount}
                          </span>
                        </div>

                        {revealCount >= 5 && (
                          <p className="mt-2 text-xs text-red-400">
                            ⚠️ Frequently revealed password
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
          </DocumentSection>

          {/* Issue Information */}

          <DocumentSection title="Issue Information">
            <IdentityItem
              title="File Size"
              value={
                document.fileSize
                  ? `${(
                      document.fileSize /
                      1024 /
                      1024
                    ).toFixed(2)} MB`
                  : "—"
              }
            />

            {(isSecurityOfficer || isAdministrator) && (
              <>
                <IdentityItem
                  title="Page Count"
                  value={
                    document.pageCount ??
                    document.page_count ??
                    "—"
                  }
                />

                <IdentityItem
                  title="Copy ID"
                  value={
                    selectedCopy?.copyId ??
                    selectedCopy?.copy_id ??
                    "Unavailable"
                  }
                  color="text-blue-400"
                />

                <IdentityItem
                  title="Tracker ID"
                  value={
                    selectedCopy?.trackerId ??
                    document.trackerId ??
                    document.tracker_id ??
                    "Unavailable"
                  }
                  color="text-cyan-400"
                />
              </>
            )}

            <IdentityItem
              title="Issued"
              value={
                document.issuedAt
                  ? new Date(
                      document.issuedAt
                    ).toLocaleDateString(
                      "en-GB",
                      {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      }
                    )
                  : "—"
              }
            />
          </DocumentSection>

          {(isSecurityOfficer || isAdministrator) && (
            <DocumentSection title="Security & Integrity">
              <IdentityItem
                title="Security Status"
                value={
                  document.status ??
                  "UNKNOWN"
                }
                color={
                  String(document.status ?? "")
                    .toUpperCase() === "ACTIVE"
                    ? "text-green-400"
                    : String(document.status ?? "")
                        .toUpperCase() === "COMPROMISED"
                    ? "text-red-400"
                    : "text-yellow-400"
                }
              />

              <IdentityItem
                title="Integrity"
                value={
                  document.sha256
                    ? "VERIFIED"
                    : "UNAVAILABLE"
                }
                color={
                  document.sha256
                    ? "text-green-400"
                    : "text-yellow-400"
                }
              />

              <IdentityItem
                title="SHA-256"
                value={
                  document.sha256 ??
                  "Unavailable"
                }
              />

              <IdentityItem
                title="Fingerprint"
                value={
                  document.fingerprint ??
                  "Unavailable"
                }
              />
            </DocumentSection>
          )}

          {(isSecurityOfficer || isAdministrator) && (
            <DocumentSection title="Investigations">

              {/* Latest investigation for THIS document */}

              <div className="rounded-2xl border border-slate-700 bg-[#16213A] p-5">

                <p className="text-xs uppercase tracking-wider text-slate-500">
                  Recent Investigation
                </p>

                {!latestInvestigation ? (
                  <div className="mt-4 rounded-xl border border-dashed border-slate-700 p-5 text-center">
                    <p className="text-slate-400">
                      No investigation has been performed for this document.
                    </p>

                    <p className="mt-2 text-xs text-slate-500">
                      Start a new investigation to generate forensic evidence.
                    </p>
                  </div>
                ) : (
                  <div className="mt-4 rounded-xl border border-cyan-800/50 bg-[#111B33] p-5">

                    <div className="flex items-start justify-between gap-4">

                      <div>
                        <p className="text-xs uppercase tracking-wider text-slate-500">
                          Latest Investigation
                        </p>

                        <h4 className="mt-2 text-lg font-bold text-white">
                          {latestInvestigation.ai?.riskLevel ??
                            latestInvestigation.risk ??
                            "UNKNOWN"}{" "}
                          Risk
                        </h4>

                        <p className="mt-2 text-sm text-slate-400">
                          {new Date(
                            latestInvestigation.investigatedAt ??
                            latestInvestigation.createdAt ??
                            latestInvestigation.created_at
                          ).toLocaleString("en-GB", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>

                      <div className="text-right">

                        <div className="text-2xl font-bold text-cyan-400">
                          {Math.round(
                            latestInvestigation.ai?.confidence ??
                            latestInvestigation.confidence ??
                            0
                          )}%
                        </div>

                        <p className="text-xs text-slate-500">
                          Confidence
                        </p>

                      </div>

                    </div>

                    <div className="mt-4 border-t border-slate-700 pt-4">

                      <p className="text-xs uppercase tracking-wider text-slate-500">
                        Investigation ID
                      </p>

                      <p className="mt-2 break-all font-mono text-sm text-purple-400">
                        {latestInvestigation.id}
                      </p>

                    </div>

                  </div>
                )}

              </div>


              {/* Investigation Actions */}

              <div className="grid grid-cols-2 gap-3">

                {/* NEW INVESTIGATION */}

                <button
                  type="button"
                  onClick={() => {
                    onClose();

                    navigate("/investigations", {
                      state: {
                        documentId: document.id,
                        document: document,
                      },
                    });
                  }}
                  className="rounded-xl bg-purple-600 py-3 font-semibold text-white transition hover:bg-purple-700"
                >
                  🔎 New Investigation
                </button>


                {/* OPEN LATEST INVESTIGATION */}

                <button
                  type="button"
                  disabled={!latestInvestigation}
                  onClick={() => {
                    if (!latestInvestigation) {
                      return;
                    }

                    onClose();

                    navigate(
                      `/reports/${latestInvestigation.id}`
                    );
                  }}
                  className={`rounded-xl py-3 font-semibold transition ${
                    latestInvestigation
                      ? "bg-cyan-600 text-white hover:bg-cyan-700"
                      : "cursor-not-allowed bg-slate-800 text-slate-500"
                  }`}
                >
                  📄 Open Latest Investigation
                </button>

              </div>

            </DocumentSection>
          )}

          {/* Employee Activity */}

          <DocumentSection title="My Activity">
            <IdentityItem
              title="Downloads"
              value={
                copyActivity.downloads
              }
            />

            <IdentityItem
              title="Email Shares"
              value={
                copyActivity.emailShares
              }
            />

            <IdentityItem
              title="Cloud Uploads"
              value={
                copyActivity.cloudUploads
              }
            />

            <IdentityItem
              title="External Accesses"
              value={
                copyActivity.externalAccesses
              }
            />

            <IdentityItem
              title="Activity Score"
              value={`${riskScore}/100`}
              color={
                riskScore > 80
                  ? "text-red-400"
                  : riskScore > 50
                  ? "text-yellow-400"
                  : "text-green-400"
              }
            />

            <IdentityItem
              title="Last Activity"
              value={
                copyActivity.lastAccessed
                  ? new Date(
                      copyActivity.lastAccessed
                    ).toLocaleString()
                  : "Never"
              }
            />

            <IdentityItem
              title="Last Activity Network"
              value={
                copyActivity.lastLocation ??
                "Internal Network"
              }
            />
          </DocumentSection>

          {/* Quick Actions */}

          <DocumentSection title="Quick Actions">
            <div className="space-y-3">
              <button
                type="button"
                onClick={
                  handleViewProtectedCopy
                }
                disabled={
                  !accessRules.canViewFile
                }
                className={`w-full rounded-xl py-3 font-semibold ${
                  accessRules.canViewFile
                    ? "bg-cyan-500 text-slate-950 hover:bg-cyan-400"
                    : "cursor-not-allowed bg-slate-800 text-slate-500"
                }`}
              >
                👁 View Document
              </button>

              {!accessRules.isRestricted && (
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={
                      handleDownload
                    }
                    disabled={
                      !accessRules.canDownload
                    }
                    className={`rounded-xl py-3 font-semibold ${
                      accessRules.canDownload
                        ? "bg-cyan-600 text-white hover:bg-cyan-700"
                        : "cursor-not-allowed bg-slate-800 text-slate-500"
                    }`}
                  >
                    ⬇ Download
                  </button>

                  <button
                    type="button"
                    onClick={
                      handleEmailShare
                    }
                    disabled={
                      !accessRules.canEmailShare
                    }
                    className={`rounded-xl py-3 font-semibold ${
                      accessRules.canEmailShare
                        ? "bg-blue-600 text-white hover:bg-blue-700"
                        : "cursor-not-allowed bg-slate-800 text-slate-500"
                    }`}
                  >
                    📧 Email Share
                  </button>

                  <button
                    type="button"
                    onClick={
                      handleCloudUpload
                    }
                    disabled={
                      !accessRules.canCloudUpload
                    }
                    className={`rounded-xl py-3 font-semibold ${
                      accessRules.canCloudUpload
                        ? "bg-yellow-600 text-white hover:bg-yellow-700"
                        : "cursor-not-allowed bg-slate-800 text-slate-500"
                    }`}
                  >
                    ☁ Cloud Upload
                  </button>

                  <button
                    type="button"
                    onClick={
                      handleExternalAccess
                    }
                    disabled={
                      !accessRules.canExternalAccess
                    }
                    className={`rounded-xl py-3 font-semibold ${
                      accessRules.canExternalAccess
                        ? "bg-red-600 text-white hover:bg-red-700"
                        : "cursor-not-allowed bg-slate-800 text-slate-500"
                    }`}
                  >
                    🌐 External Access
                  </button>
                </div>
              )}

              {accessRules.canDelete && (
                <button
                  type="button"
                  onClick={
                    handleDelete
                  }
                  className="w-full rounded-xl bg-red-600 py-3 font-semibold text-white transition hover:bg-red-700"
                >
                  Delete Document
                </button>
              )}
            </div>
          </DocumentSection>
        </div>
      </div>
    </div>
  );
}

function DocumentSection({
  title,
  children,
}) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-white">
        {title}
      </h3>

      <div className="space-y-3">
        {children}
      </div>
    </div>
  );
}

function IdentityItem({
  title,
  value,
  color = "text-white",
}) {
  return (
    <div className="rounded-2xl border border-slate-700 bg-[#16213A] p-5 transition hover:border-cyan-500">
      <p className="text-xs uppercase tracking-wider text-slate-500">
        {title}
      </p>

      <h3
        className={`mt-3 break-words text-lg font-semibold ${color}`}
      >
        {value}
      </h3>
    </div>
  );
}