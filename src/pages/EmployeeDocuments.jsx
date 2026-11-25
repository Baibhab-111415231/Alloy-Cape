import {
  useEffect,
  useState,
} from "react";

import DocumentIdentityDrawer from "../components/registry/DocumentIdentityDrawer";

import {
  saveAs,
} from "file-saver";

import {
  incrementDownload,
} from "../services/document/documentSupabaseService";

import {
  logDocumentEvent,
} from "../services/document/documentEventService";

import {
  FileText,
  Download,
  Eye,
  ShieldCheck,
  Loader2,
  AlertTriangle,
  FolderOpen,
  RefreshCw,
} from "lucide-react";

import Layout from "../components/Layout";

import {
  useAuth,
} from "../context/AuthContext";

import {
  supabase,
} from "../lib/supabase";

import {
  downloadProtectedCopy,
} from "../services/document/documentSupabaseService";

export default function EmployeeDocuments() {

  const {
    user,
    profile,
  } = useAuth();

  const [
    documents,
    setDocuments,
  ] = useState([]);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState("");


  const [
    selectedDocument,
    setSelectedDocument,
  ] = useState(null);

  const [searchQuery, setSearchQuery] = useState("");

  async function loadDocuments() {
    if (!user?.email) {
      setDocuments([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError("");

      const {
        data,
        error: queryError,
      } = await supabase.rpc("get_my_documents");

      if (queryError) {
        throw queryError;
      }


      setDocuments(data ?? []);

    } catch (err) {
      console.error(
        "EMPLOYEE DOCUMENT LOAD ERROR:",
        err
      );

      setError(
        err?.message ||
        "Unable to load your documents."
      );

    } finally {
      setLoading(false);
    }
  }


  useEffect(() => {

    loadDocuments();

  }, [user?.email]);


  function prepareDocumentForDrawer(document) {
    const copy = {
      ...document,

      copyId:
        document.copy_id ??
        null,

      trackerId:
        document.tracker_id ??
        document.trackerId ??
        null,

      storagePath:
        document.storage_path ??
        null,

      externalStoragePath:
        document.external_storage_path ??
        null,

      externalFileName:
        document.external_file_name ??
        document.file_name ??
        document.title ??
        "Protected.pdf",

      fileName:
        document.file_name ??
        document.title ??
        "Protected.pdf",

      recipient:
        document.recipient ??
        user?.email ??
        null,

      recipientType:
        document.recipient_type ??
        null,

      recipientOrganization:
        document.recipient_organization ??
        null,

      recipientSignature:
        document.recipient_signature ??
        null,

      copyPassword:
        document.copy_password ??
        null,

      passwordRevealCount:
        document.password_reveal_count ??
        0,

      classification:
        document.classification ??
        null,

      dnaId:
        document.dna_id ??
        null,
    };

    return {
      ...document,

      // IMPORTANT:
      // Drawer/investigation queries may expect "id"
      id:
        document.document_id ??
        document.id ??
        null,

      document_id:
        document.document_id ??
        document.id ??
        null,

      documentId:
        document.document_id ??
        document.id ??
        null,

      fileName:
        document.file_name ??
        document.title ??
        "Untitled Document",

      dnaId:
        document.dna_id ??
        "Unavailable",

      fileSize:
        document.file_size ??
        0,

      issuedAt:
        document.issued_at ??
        null,

      trackerId:
        document.tracker_id ??
        document.trackerId ??
        null,

      pageCount:
        document.page_count ??
        0,

      recipients:
        document.recipient
          ? [document.recipient]
          : [],

      downloadCount:
        document.download_count ??
        0,

      emailShares:
        document.emailShares ??
        0,

      cloudUploads:
        document.cloudUploads ??
        0,

      externalAccesses:
        document.externalAccesses ??
        0,

      lastAccessed:
        document.lastAccessed ??
        null,

      lastLocation:
        document.lastLocation ??
        null,

      // 🔥 THIS IS THE IMPORTANT FIX
      // The RPC returns the copy directly,
      // so convert that row into a one-item copies array.
      copies: [
        copy
      ],
    };
  }

  function formatFileSize(bytes) {

    if (!bytes) {
      return "—";
    }

    if (bytes < 1024) {
      return `${bytes} B`;
    }

    if (bytes < 1024 * 1024) {

      return `${(
        bytes / 1024
      ).toFixed(1)} KB`;

    }

    return `${(
      bytes /
      (1024 * 1024)
    ).toFixed(1)} MB`;
  }


  function getClassification(document) {
    return String(
      document?.classification ?? ""
    )
      .trim()
      .toUpperCase();
  }

  function canDownload(document) {
    const classification = getClassification(document);

    return (
      classification === "PUBLIC" ||
      classification === "INTERNAL"
    );
  }

  function canEmailShare(document) {
    const classification = getClassification(document);

    return (
      classification === "PUBLIC" ||
      classification === "INTERNAL" ||
      classification === "CONFIDENTIAL"
    );
  }

  function canCloudAccess(document) {
    const classification = getClassification(document);

    return (
      classification === "PUBLIC" ||
      classification === "INTERNAL"
    );
  }

  function canExternalAccess(document) {
    const classification = getClassification(document);

    return (
      classification === "PUBLIC" ||
      classification === "INTERNAL"
    );
  }

  function canPasswordReveal(document) {
    const classification = getClassification(document);

    return (
      classification === "PUBLIC" ||
      classification === "INTERNAL" ||
      classification === "CONFIDENTIAL"
    );
  }

    const filteredDocuments = documents.filter((document) => {
      const query = searchQuery.trim().toLowerCase();
      if (!query) return true;

      const name = (
        document.title ??
        document.file_name ??
        ""
      ).toLowerCase();

      return name.includes(query);
    });

  async function handleView(document) {
    try {
      const storagePath =
        document?.storage_path;

      if (!storagePath) {
        alert("Protected PDF storage path is missing.");
        return;
      }

      const blob =
        await downloadProtectedCopy(
          storagePath
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

    } catch (err) {
      console.error(
        "VIEW DOCUMENT ERROR:",
        err
      );

      alert(
        err?.message ??
        "Unable to open protected document."
      );
    }
  }

    async function handleDownload(document) {
      try {
        const classification = String(
          document?.classification ?? ""
        )
          .trim()
          .toUpperCase();

        if (classification === "CONFIDENTIAL") {
          alert(
            "🔒 Confidential documents cannot be downloaded."
          );
          return;
        }

        if (classification === "RESTRICTED") {
          alert(
            "🔒 Restricted documents cannot be downloaded."
          );
          return;
        }

        if (
          classification !== "PUBLIC" &&
          classification !== "INTERNAL"
        ) {
          alert(
            "This document cannot be downloaded by employees."
          );
          return;
        }

        const storagePath =
          document?.storage_path ??
          document?.storagePath ??
          null;

        if (!storagePath) {
          alert(
            "Protected PDF storage path is missing."
          );
          return;
        }

        const blob =
          await downloadProtectedCopy(
            storagePath
          );

        const copyId =
          document?.copy_id ??
          document?.copyId ??
          null;

        const recipient =
          document?.recipient ??
          user?.email ??
          null;

        const fileName =
          document?.file_name ??
          document?.fileName ??
          document?.title ??
          `Protected_${copyId ?? "document"}.pdf`;

        saveAs(
          blob,
          fileName
        );

        await logDocumentEvent({
          documentId:
            document?.id ?? null,

          trackerId:
            document?.tracker_id ??
            document?.trackerId ??
            null,

          copyId,

          recipient,

          type:
            "DOWNLOAD",

          location:
            "Internal Network",

          details: {
            action:
              "Employee downloaded protected copy",

            classification,

            copyId,

            recipient,

            recipientType:
              document?.recipient_type ??
              document?.recipientType ??
              null,

            recipientOrganization:
              document?.recipient_organization ??
              document?.recipientOrganization ??
              null,

            fileName,

            actor:
              user?.email ??
              null,

            actorRole:
              "employee",
          },
        });

        await incrementDownload(
          document
        );

        // Optional: refresh the list so counters/data stay current
        await loadDocuments();

      } catch (err) {
        console.error(
          "EMPLOYEE DOWNLOAD ERROR:",
          err
        );

        alert(
          err?.message ??
          "Unable to download protected document."
        );
      }
    }


  return (

    <Layout>

      <div className="space-y-8">


        {/* ================================================== */}
        {/* HEADER */}
        {/* ================================================== */}

        <div className="
          rounded-3xl
          border
          border-cyan-500/20
          bg-gradient-to-r
          from-[#0B1220]
          via-[#111C33]
          to-[#16213A]
          p-8
        ">

          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">

            <div className="flex items-center gap-5">

              <div className="rounded-2xl bg-cyan-500/10 p-4">

                <FolderOpen
                  size={34}
                  className="text-cyan-400"
                />

              </div>

              <div>

                <h1 className="text-3xl font-black text-white">

                  My Documents

                </h1>

                <p className="mt-2 text-slate-400">

                  Documents issued to your account.

                </p>

              </div>

            </div>


            <button
              type="button"
              onClick={loadDocuments}
              disabled={loading}
              className="
                flex
                items-center
                justify-center
                gap-2
                rounded-xl
                border
                border-slate-700
                bg-[#0B1220]
                px-4
                py-3
                text-sm
                font-semibold
                text-slate-300
                transition
                hover:border-cyan-500/40
                hover:text-white
                disabled:opacity-50
              "
            >

              <RefreshCw
                size={17}
                className={
                  loading
                    ? "animate-spin"
                    : ""
                }
              />

              Refresh

            </button>

          </div>

          <div className="mt-6">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by file name..."
              className="
                w-full
                rounded-xl
                border
                border-slate-700
                bg-[#0B1220]
                px-4
                py-3
                text-white
                outline-none
                transition
                placeholder:text-slate-600
                focus:border-cyan-500
                focus:ring-2
                focus:ring-cyan-500/20
              "
            />
          </div>


          <div className="mt-6 grid gap-3 sm:grid-cols-2">

            <div className="
              rounded-xl
              border
              border-slate-700
              bg-[#0B1220]
              px-4
              py-3
            ">

              <div className="text-xs uppercase tracking-wider text-slate-500">

                Account

              </div>

              <div className="mt-1 truncate text-sm font-semibold text-white">

                {profile?.full_name ??
                  "Employee"}

              </div>

              <div className="mt-1 truncate text-xs text-slate-500">

                {user?.email}

              </div>

            </div>


            <div className="
              rounded-xl
              border
              border-slate-700
              bg-[#0B1220]
              px-4
              py-3
            ">

              <div className="text-xs uppercase tracking-wider text-slate-500">

                Assigned Documents

              </div>

              <div className="mt-1 text-2xl font-black text-cyan-400">

                {documents.length}

              </div>

            </div>

          </div>

        </div>


        {/* ================================================== */}
        {/* ERROR */}
        {/* ================================================== */}

        {error && (

          <div className="
            flex
            items-start
            gap-4
            rounded-2xl
            border
            border-red-500/30
            bg-red-500/10
            p-5
          ">

            <AlertTriangle
              className="mt-0.5 shrink-0 text-red-400"
              size={24}
            />

            <div>

              <div className="font-bold text-red-300">

                Unable to load documents

              </div>

              <div className="mt-1 text-sm text-slate-400">

                {error}

              </div>

            </div>

          </div>

        )}


        {/* ================================================== */}
        {/* LOADING */}
        {/* ================================================== */}

        {loading && (

          <div className="
            flex
            min-h-64
            items-center
            justify-center
            rounded-3xl
            border
            border-slate-700
            bg-[#111B33]
          ">

            <div className="text-center">

              <Loader2
                size={36}
                className="mx-auto animate-spin text-cyan-400"
              />

              <p className="mt-4 text-sm text-slate-400">

                Loading your documents...

              </p>

            </div>

          </div>

        )}


        {/* ================================================== */}
        {/* EMPTY */}
        {/* ================================================== */}

        {!loading &&
          !error &&
          filteredDocuments.length === 0 && (

            <div className="
              rounded-3xl
              border
              border-slate-700
              bg-[#111B33]
              p-12
              text-center
            ">

              <FileText
                size={52}
                className="mx-auto text-slate-600"
              />

              <h2 className="mt-5 text-xl font-bold text-white">

                No Documents Issued

              </h2>

              <p className="
                mx-auto
                mt-2
                max-w-lg
                text-sm
                leading-6
                text-slate-500
              ">

                {documents.length === 0
                  ? "There are currently no documents registered to your account."
                  : "No documents match your search. Try a different file name."}

              </p>

            </div>

          )}


        {/* ================================================== */}
        {/* DOCUMENT LIST */}
        {/* ================================================== */}

        {!loading &&
          filteredDocuments.length > 0 && (

            <div className="space-y-5">

              {filteredDocuments.map((document) => (

                <div
                  key={document.copy_id}
                  className="
                    rounded-3xl
                    border
                    border-slate-700
                    bg-[#111B33]
                    p-6
                    transition
                    hover:border-cyan-500/30
                    hover:shadow-xl
                    hover:shadow-cyan-950/20
                  "
                >

                  <div className="
                    flex
                    flex-col
                    gap-6
                    xl:flex-row
                    xl:items-center
                    xl:justify-between
                  ">


                    {/* ====================================== */}
                    {/* DOCUMENT                                */}
                    {/* ====================================== */}

                    <div className="flex min-w-0 items-start gap-4">

                      <div className="
                        shrink-0
                        rounded-2xl
                        bg-cyan-500/10
                        p-4
                      ">

                        <FileText
                          size={28}
                          className="text-cyan-400"
                        />

                      </div>


                      <div className="min-w-0">

                        <h2 className="
                          truncate
                          text-lg
                          font-bold
                          text-white
                        ">

                          {document.title ||
                            "Untitled Document"}

                        </h2>


                        <div className="
                          mt-2
                          truncate
                          font-mono
                          text-xs
                          text-slate-500
                        ">

                          DNA:{" "}
                          {document.dna_id ||
                            "Unavailable"}

                        </div>


                        <div className="mt-4 flex flex-wrap gap-2">

                          <span className="
                            rounded-lg
                            border
                            border-cyan-500/20
                            bg-cyan-500/10
                            px-3
                            py-1
                            text-xs
                            font-semibold
                            text-cyan-400
                          ">

                            {document.classification ||
                              "Unknown"}

                          </span>


                          <span className="
                            rounded-lg
                            border
                            border-green-500/20
                            bg-green-500/10
                            px-3
                            py-1
                            text-xs
                            font-semibold
                            text-green-400
                          ">

                            {document.status ||
                              "Issued"}

                          </span>

                        </div>

                      </div>

                    </div>


                    {/* ====================================== */}
                    {/* INFORMATION                             */}
                    {/* ====================================== */}

                    <div className="
                      grid
                      grid-cols-2
                      gap-3
                      lg:grid-cols-3
                    ">

                      <div className="
                        rounded-xl
                        bg-[#0B1220]
                        px-4
                        py-3
                      ">

                        <div className="text-xs text-slate-500">
                          File Size
                        </div>

                        <div className="mt-1 text-sm font-semibold text-white">
                          {formatFileSize(
                            document.file_size
                          )}
                        </div>

                      </div>


                      <div className="
                        rounded-xl
                        bg-[#0B1220]
                        px-4
                        py-3
                      ">

                        <div className="text-xs text-slate-500">
                          Issued
                        </div>

                        <div className="mt-1 text-sm font-semibold text-white">

                          {document.issued_at
                            ? new Date(
                                document.issued_at
                              ).toLocaleDateString()
                            : "—"}

                        </div>

                      </div>


                      <div className="
                        col-span-2
                        rounded-xl
                        bg-[#0B1220]
                        px-4
                        py-3
                        lg:col-span-1
                      ">

                        <div className="text-xs text-slate-500">
                          Recipient
                        </div>

                        <div className="mt-1 truncate text-sm font-semibold text-white">

                          {document.recipient ||
                            user?.email}

                        </div>

                      </div>

                    </div>


                    {/* ====================================== */}
                    {/* ACTIONS                                 */}
                    {/* ====================================== */}

                    <div className="
                      flex
                      shrink-0
                      gap-3
                    ">

                      <button
                        type="button"
                        onClick={() => {
                          setSelectedDocument(
                            prepareDocumentForDrawer(document)
                          );
                        }}
                        className="
                          flex
                          items-center
                          gap-2
                          rounded-xl
                          border
                          border-slate-700
                          bg-[#0B1220]
                          px-4
                          py-3
                          text-sm
                          font-semibold
                          text-slate-300
                          transition
                          hover:border-cyan-500/40
                          hover:text-white
                        "
                      >
                        <Eye size={17} />

                        View
                      </button>

                    </div>

                  </div>


                  {/* ====================================== */}
                  {/* SECURITY FOOTER                         */}
                  {/* ====================================== */}

                  <div className="
                    mt-6
                    flex
                    items-center
                    gap-3
                    border-t
                    border-slate-800
                    pt-5
                  ">

                    <ShieldCheck
                      size={18}
                      className="text-green-400"
                    />

                    <span className="text-xs text-slate-500">

                      Access is restricted to documents
                      issued to your authenticated account.

                    </span>

                  </div>

                </div>

              ))}

            </div>

          )}

      </div>

          <DocumentIdentityDrawer
            open={Boolean(selectedDocument)}
            document={selectedDocument}
            onClose={() => setSelectedDocument(null)}
            onRefresh={loadDocuments}
          />

    </Layout>

  );
}