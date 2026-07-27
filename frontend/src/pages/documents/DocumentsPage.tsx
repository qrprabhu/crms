import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Download,
  Eye,
  FileText,
  Loader2,
  Plus,
  Search,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import {
  deleteDocument,
  getDocuments,
  uploadDocument,
  DOCUMENT_TYPE_LABELS,
  MODULE_LABELS,
  type DocumentFilters,
  type DocumentRecord,
  type DocumentType,
  type RelatedModule,
} from "../../lib/api/documentsApi";
import { keepEmployeeOwnedRows } from "../../lib/shared/recordVisibility";

// ── Upload Modal ────────────────────────────────────────────────────────────

function UploadModal({
  onClose,
  onUploaded,
}: {
  onClose: () => void;
  onUploaded: (doc: DocumentRecord) => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [docType, setDocType] = useState<DocumentType>("other");
  const [customType, setCustomType] = useState("");
  const [relatedModule, setRelatedModule] = useState<RelatedModule>("");
  const [relatedId, setRelatedId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) setFile(dropped);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!title.trim()) { setError("Title is required."); return; }
    if (!file) { setError("Please select a file."); return; }
    if (docType === "other" && !customType.trim()) { setError("Please specify the document type."); return; }
    setError("");
    const resolvedType = docType === "other" && customType.trim() ? customType.trim() : docType;
    try {
      setLoading(true);
      const doc = await uploadDocument({
        title: title.trim(),
        description: description.trim() || undefined,
        file,
        document_type: resolvedType as DocumentType,
        related_module: relatedModule || undefined,
        related_id: relatedId ? Number(relatedId) : undefined,
      });
      onUploaded(doc);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setLoading(false);
    }
  };

  const inputCls =
    "w-full rounded-[8px] border border-[#cfd7e6] px-3 py-2 text-sm text-slate-800 outline-none focus:border-[#22c55e] focus:ring-2 focus:ring-green-500/10";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-lg rounded-[16px] bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#d9e1ef] px-6 py-4">
          <h2 className="text-[16px] font-semibold text-[#1f2d3d]">Upload Document</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4 px-6 py-5">
          {error && (
            <p className="rounded-[6px] border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
              {error}
            </p>
          )}

          {/* Drag & drop zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
            className={`flex cursor-pointer flex-col items-center justify-center rounded-[10px] border-2 border-dashed py-6 transition ${
              dragging ? "border-[#22c55e] bg-green-50" : "border-[#cfd7e6] hover:border-[#22c55e] hover:bg-slate-50"
            }`}
          >
            <Upload size={22} className="mb-2 text-slate-400" />
            {file ? (
              <span className="text-sm font-medium text-[#22c55e]">{file.name}</span>
            ) : (
              <>
                <span className="text-sm text-slate-500">Drag & drop or click to select</span>
                <span className="mt-1 text-xs text-slate-400">Max 50 MB</span>
              </>
            )}
            <input
              ref={fileRef}
              type="file"
              className="hidden"
              onChange={(e) => { if (e.target.files?.[0]) setFile(e.target.files[0]); }}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Title *</label>
            <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Document title" />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Description</label>
            <textarea className={inputCls} rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional description" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Document Type</label>
              <select
                className={inputCls}
                value={docType}
                onChange={(e) => { setDocType(e.target.value as DocumentType); setCustomType(""); }}
              >
                {Object.entries(DOCUMENT_TYPE_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
              {docType === "other" && (
                <input
                  className={`${inputCls} mt-2`}
                  value={customType}
                  onChange={(e) => setCustomType(e.target.value)}
                  placeholder="Specify type (e.g. Invoice, NDA…)"
                  autoFocus
                />
              )}
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Link to Module</label>
              <select className={inputCls} value={relatedModule} onChange={(e) => setRelatedModule(e.target.value as RelatedModule)}>
                <option value="">None</option>
                {(["lead", "contact", "deal", "project"] as RelatedModule[]).map((m) => (
                  <option key={m} value={m}>{MODULE_LABELS[m]}</option>
                ))}
              </select>
            </div>
          </div>

          {relatedModule && (
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">{MODULE_LABELS[relatedModule]} ID</label>
              <input
                className={inputCls}
                type="number"
                value={relatedId}
                onChange={(e) => setRelatedId(e.target.value)}
                placeholder={`Enter ${MODULE_LABELS[relatedModule]} ID`}
              />
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="rounded-[6px] border border-[#cfd7e6] px-5 py-2 text-sm text-slate-700 hover:bg-slate-50">
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-1.5 rounded-[6px] bg-gradient-to-b from-[#22c55e] to-[#16a34a] px-5 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              {loading && <Loader2 size={13} className="animate-spin" />}
              Upload
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Type badge ──────────────────────────────────────────────────────────────

const TYPE_COLORS: Record<string, string> = {
  portfolio: "bg-purple-100 text-purple-700",
  requirement: "bg-green-100 text-green-700",
  presentation: "bg-amber-100 text-amber-700",
  meeting_notes: "bg-teal-100 text-teal-700",
  contract: "bg-rose-100 text-rose-700",
  other: "bg-slate-100 text-slate-600",
};

function TypeBadge({ type }: { type: string }) {
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${TYPE_COLORS[type] ?? TYPE_COLORS.other}`}>
      {DOCUMENT_TYPE_LABELS[type as DocumentType] ?? type}
    </span>
  );
}

// ── Main Page ───────────────────────────────────────────────────────────────

export default function DocumentsPage() {
  const navigate = useNavigate();
  const [docs, setDocs] = useState<DocumentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<DocumentType | "">("");
  const [filterModule, setFilterModule] = useState<RelatedModule | "">("");
  const [deleting, setDeleting] = useState<string | null>(null);

  const load = useCallback(async (filters?: DocumentFilters) => {
    try {
      setLoading(true);
      const data = await getDocuments(filters);
      setDocs(keepEmployeeOwnedRows(data));
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Fetch broad list (type/module filters only); local search handles text/IDs flexibly
    void load({ document_type: filterType || undefined, related_module: filterModule || undefined });
  }, [load, filterType, filterModule]);

  const filteredDocs = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return docs;

    const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "");
    const normalizedTerm = normalize(term);
    const termDigits = term.match(/\d+/g)?.join("") ?? "";
    const numericSearch = Number(term);
    const isNumeric = !Number.isNaN(numericSearch);

    return docs.filter((doc) => {
      const matchesText =
        (doc.title || "").toLowerCase().includes(term) ||
        (doc.file_name || "").toLowerCase().includes(term) ||
        (doc.uploaded_by_email || "").toLowerCase().includes(term) ||
        (doc.uploaded_by_name || "").toLowerCase().includes(term) ||
        (doc.document_type || "").toLowerCase().includes(term);

      const linkedLabel = doc.related_module
        ? `${MODULE_LABELS[doc.related_module]} #${doc.related_id ?? ""}`.toLowerCase()
        : "";
      const matchesLinkedLabel =
        linkedLabel.includes(term) ||
        normalize(linkedLabel).includes(normalizedTerm);

      const matchesIds =
        (doc.id && normalize(String(doc.id)).includes(normalizedTerm)) ||
        (isNumeric && doc.related_id !== null && doc.related_id !== undefined && String(doc.related_id).includes(term)) ||
        (termDigits &&
          ((doc.related_id !== null && doc.related_id !== undefined && String(doc.related_id).includes(termDigits)) ||
            (doc.id && String(doc.id).includes(termDigits))));

      return matchesText || matchesLinkedLabel || matchesIds;
    });
  }, [docs, search]);

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this document?")) return;
    try {
      setDeleting(id);
      await deleteDocument(id);
      setDocs((prev) => prev.filter((d) => d.id !== id));
    } catch {
      alert("Failed to delete document.");
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-[#f0fdf4]">
      {/* Header */}
      <div className="border-b border-[#d9e1ef] bg-[#f0fdf4] px-6 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-[18px] font-semibold text-[#1f2d3d]">Documents</h1>
            <p className="text-xs text-slate-500">Manage files linked to your CRM records</p>
          </div>
          <button
            onClick={() => setShowUpload(true)}
            className="flex items-center gap-1.5 rounded-[6px] border border-[#bbf7d0] bg-[linear-gradient(135deg,#4ade80_0%,#16a34a_100%)] px-4 py-2 text-sm font-medium text-white shadow-[0_12px_28px_rgba(34,197,94,0.24)] transition hover:brightness-105"
          >
            <Plus size={15} /> Upload Document
          </button>
        </div>
      </div>

      <div className="space-y-4 p-6">
        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search documents…"
            className="w-full rounded-[8px] border border-[#cfd7e6] bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-[#22c55e]"
            />
          </div>

          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as DocumentType | "")}
            className="rounded-[8px] border border-[#cfd7e6] bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-[#22c55e]"
          >
            <option value="">All Types</option>
            {Object.entries(DOCUMENT_TYPE_LABELS).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>

          <select
            value={filterModule}
            onChange={(e) => setFilterModule(e.target.value as RelatedModule | "")}
            className="rounded-[8px] border border-[#cfd7e6] bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-[#22c55e]"
          >
            <option value="">All Modules</option>
            {(["lead", "contact", "deal", "project"] as RelatedModule[]).map((m) => (
              <option key={m} value={m}>{MODULE_LABELS[m]}</option>
            ))}
          </select>
        </div>

        {/* Table */}
        <div className="rounded-[10px] border border-[#d9e1ef] bg-white overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-slate-400 text-sm gap-2">
              <Loader2 size={16} className="animate-spin" /> Loading documents…
            </div>
          ) : filteredDocs.length === 0 ? (
            <div className="py-16 text-center">
              <FileText size={36} className="mx-auto mb-3 text-slate-300" />
              <p className="text-sm text-slate-500">No documents found.</p>
              <button
                onClick={() => setShowUpload(true)}
                className="mt-3 text-sm font-medium text-[#22c55e] hover:underline"
              >
                Upload your first document
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-[#d9e1ef] bg-slate-50 text-xs font-medium uppercase text-slate-500">
                  <tr>
                    <th className="px-5 py-3">Title</th>
                    <th className="px-5 py-3">Type</th>
                    <th className="px-5 py-3">Linked To</th>
                    <th className="px-5 py-3">Uploaded By</th>
                    <th className="px-5 py-3">Version</th>
                    <th className="px-5 py-3">Date</th>
                    <th className="px-5 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDocs.map((doc) => (
                    <tr key={doc.id} className="border-t border-slate-100 hover:bg-slate-50">
                      <td className="px-5 py-3">
                        <button
                          onClick={() => navigate(`/documents/${doc.id}`)}
                          className="flex items-center gap-2 font-medium text-[#1f2d3d] hover:text-[#22c55e]"
                        >
                          <FileText size={14} className="shrink-0 text-slate-400" />
                          {doc.title}
                        </button>
                        {doc.file_name && (
                          <p className="mt-0.5 pl-[22px] text-xs text-slate-400">{doc.file_name}</p>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <TypeBadge type={doc.document_type} />
                      </td>
                      <td className="px-5 py-3 text-slate-600">
                        {doc.related_module
                          ? `${MODULE_LABELS[doc.related_module]} #${doc.related_id ?? "—"}`
                          : "—"}
                      </td>
                      <td className="px-5 py-3 text-slate-600">{doc.uploaded_by_email ?? "—"}</td>
                      <td className="px-5 py-3">
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                          v{doc.version}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-xs text-slate-500">
                        {new Date(doc.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => navigate(`/documents/${doc.id}`)}
                            title="View"
                            className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                          >
                            <Eye size={14} />
                          </button>
                          {doc.file_url && (
                            <a
                              href={doc.file_url}
                              download
                              title="Download"
                              className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                            >
                              <Download size={14} />
                            </a>
                          )}
                          <button
                            onClick={() => void handleDelete(doc.id)}
                            disabled={deleting === doc.id}
                            title="Delete"
                            className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500 disabled:opacity-50"
                          >
                            {deleting === doc.id ? (
                              <Loader2 size={14} className="animate-spin" />
                            ) : (
                              <Trash2 size={14} />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {showUpload && (
        <UploadModal
          onClose={() => setShowUpload(false)}
          onUploaded={(doc) => setDocs((prev) => [doc, ...prev])}
        />
      )}
    </div>
  );
}
