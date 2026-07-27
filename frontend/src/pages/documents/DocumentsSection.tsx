/**
 * DocumentsSection — embeddable component for Lead/Deal/Project detail pages.
 *
 * Usage:
 *   <DocumentsSection module="lead" relatedId={leadId} />
 *   <DocumentsSection module="deal" relatedId={dealId} />
 *   <DocumentsSection module="project" relatedId={projectId} />
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Download, Eye, ExternalLink, FileText, Loader2, Plus, Trash2, Upload, X } from "lucide-react";
import {
  deleteDocument,
  getDocuments,
  uploadDocument,
  DOCUMENT_TYPE_LABELS,
  type DocumentRecord,
  type DocumentType,
  type RelatedModule,
} from "../../lib/api/documentsApi";

const TYPE_COLORS: Record<string, string> = {
  portfolio: "bg-purple-100 text-purple-700",
  requirement: "bg-green-100 text-green-700",
  presentation: "bg-amber-100 text-amber-700",
  meeting_notes: "bg-teal-100 text-teal-700",
  contract: "bg-rose-100 text-rose-700",
  other: "bg-slate-100 text-slate-600",
};

function canPreviewDocument(fileName: string | null) {
  const ext = fileName?.split(".").pop()?.toLowerCase() ?? "";
  return ["jpg", "jpeg", "png", "gif", "webp", "svg", "pdf", "txt", "md", "csv", "json", "log"].includes(ext);
}

// ── Inline Upload Modal ─────────────────────────────────────────────────────

function QuickUploadModal({
  module,
  relatedId,
  onClose,
  onUploaded,
}: {
  module: RelatedModule;
  relatedId: string | number;
  onClose: () => void;
  onUploaded: (doc: DocumentRecord) => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [docType, setDocType] = useState<DocumentType>("other");
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) setFile(f);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) { setError("Title is required."); return; }
    if (!file) { setError("Please select a file."); return; }
    setError("");
    try {
      setLoading(true);
      const doc = await uploadDocument({
        title: title.trim(),
        description: description.trim() || undefined,
        file,
        document_type: docType,
        related_module: module,
        related_id: Number(relatedId),
      });
      onUploaded(doc);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setLoading(false);
    }
  };

  const inp =
    "w-full rounded-[8px] border border-[#cfd7e6] px-3 py-2 text-sm outline-none focus:border-[#22c55e] focus:ring-2 focus:ring-green-500/10";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-[14px] bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#d9e1ef] px-5 py-4">
          <h3 className="text-[15px] font-semibold text-[#1f2d3d]">Attach Document</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={17} /></button>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-3 px-5 py-4">
          {error && (
            <p className="rounded-[6px] border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
          )}

          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
            className={`flex cursor-pointer flex-col items-center rounded-[8px] border-2 border-dashed py-5 transition ${
              dragging ? "border-[#22c55e] bg-green-50" : "border-[#cfd7e6] hover:border-[#22c55e]"
            }`}
          >
            <Upload size={20} className="mb-1.5 text-slate-400" />
            {file ? (
              <span className="text-sm font-medium text-[#22c55e]">{file.name}</span>
            ) : (
              <span className="text-sm text-slate-500">Drag & drop or click</span>
            )}
            <input ref={fileRef} type="file" className="hidden" onChange={(e) => { if (e.target.files?.[0]) setFile(e.target.files[0]); }} />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Title *</label>
            <input className={inp} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Document title" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Type</label>
              <select className={inp} value={docType} onChange={(e) => setDocType(e.target.value as DocumentType)}>
                {Object.entries(DOCUMENT_TYPE_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Description</label>
              <input className={inp} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional" />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="rounded-[6px] border border-[#cfd7e6] px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-1.5 rounded-[6px] bg-gradient-to-b from-[#22c55e] to-[#16a34a] px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              {loading && <Loader2 size={12} className="animate-spin" />}
              Attach
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── DocumentsSection ────────────────────────────────────────────────────────

type Props = {
  module: RelatedModule;
  relatedId: string | number;
};

export default function DocumentsSection({ module, relatedId }: Props) {
  const navigate = useNavigate();
  const [docs, setDocs] = useState<DocumentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getDocuments({ related_module: module, related_id: relatedId });
      setDocs(data);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [module, relatedId]);

  useEffect(() => { void load(); }, [load]);

  const handleDelete = async (id: string) => {
    if (!window.confirm("Remove this document?")) return;
    try {
      setDeleting(id);
      await deleteDocument(id);
      setDocs((prev) => prev.filter((d) => d.id !== id));
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="rounded-[10px] border border-[#d9e1ef] bg-white">
      {/* Section header */}
      <div className="flex items-center justify-between border-b border-[#d9e1ef] px-5 py-3.5">
        <div className="flex items-center gap-2">
          <FileText size={15} className="text-slate-500" />
          <h3 className="text-[13px] font-semibold text-[#1f2d3d]">Documents</h3>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
            {docs.length}
          </span>
        </div>
        <button
          onClick={() => setShowUpload(true)}
          className="flex items-center gap-1 rounded-[6px] border border-[#cfd7e6] bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
        >
          <Plus size={12} /> Attach
        </button>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center gap-2 py-8 text-xs text-slate-400">
          <Loader2 size={13} className="animate-spin" /> Loading…
        </div>
      ) : docs.length === 0 ? (
        <div className="py-8 text-center">
          <FileText size={28} className="mx-auto mb-2 text-slate-300" />
          <p className="text-xs text-slate-400">No documents attached.</p>
          <button
            onClick={() => setShowUpload(true)}
            className="mt-2 text-xs font-medium text-[#22c55e] hover:underline"
          >
            Attach one
          </button>
        </div>
      ) : (
        <ul className="divide-y divide-slate-100">
          {docs.map((doc) => (
            <li key={doc.id} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50">
              <FileText size={15} className="shrink-0 text-slate-400" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-[#1f2d3d]">{doc.title}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${TYPE_COLORS[doc.document_type] ?? TYPE_COLORS.other}`}>
                    {DOCUMENT_TYPE_LABELS[doc.document_type as DocumentType] ?? doc.document_type}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    v{doc.version} · {new Date(doc.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => {
                    if (canPreviewDocument(doc.file_name)) {
                      navigate(`/documents/${doc.id}`);
                      return;
                    }

                    if (doc.file_url) {
                      window.open(doc.file_url, "_blank", "noopener,noreferrer");
                      return;
                    }

                    navigate(`/documents/${doc.id}`);
                  }}
                  title="View"
                  className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                >
                  <Eye size={13} />
                </button>
                {doc.file_url && !canPreviewDocument(doc.file_name) ? (
                  <a
                    href={doc.file_url}
                    target="_blank"
                    rel="noreferrer"
                    title="Open File"
                    className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                  >
                    <ExternalLink size={13} />
                  </a>
                ) : null}
                {doc.file_url && (
                  <a
                    href={doc.file_url}
                    download
                    title="Download"
                    className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                  >
                    <Download size={13} />
                  </a>
                )}
                <button
                  onClick={() => void handleDelete(doc.id)}
                  disabled={deleting === doc.id}
                  title="Remove"
                  className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-500 disabled:opacity-50"
                >
                  {deleting === doc.id ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : (
                    <Trash2 size={13} />
                  )}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {showUpload && (
        <QuickUploadModal
          module={module}
          relatedId={relatedId}
          onClose={() => setShowUpload(false)}
          onUploaded={(doc) => { setDocs((prev) => [doc, ...prev]); }}
        />
      )}
    </div>
  );
}
