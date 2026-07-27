import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Clock,
  Download,
  Edit2,
  FileText,
  Loader2,
  Save,
  Upload,
  X,
} from "lucide-react";
import {
  deleteDocument,
  getDocumentById,
  updateDocument,
  DOCUMENT_TYPE_LABELS,
  MODULE_LABELS,
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

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex gap-2 text-sm">
      <span className="w-36 shrink-0 text-slate-500">{label}</span>
      <span className="font-medium text-slate-800">{value || "—"}</span>
    </div>
  );
}

function FilePreview({ url, name }: { url: string; name: string | null }) {
  const ext = name?.split(".").pop()?.toLowerCase() ?? "";
  const isImage = ["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(ext);
  const isPdf = ext === "pdf";

  if (isImage) {
    return (
      <img
        src={url}
        alt={name ?? "preview"}
        className="max-h-[400px] w-full rounded-[8px] border border-[#d9e1ef] object-contain bg-slate-50"
      />
    );
  }
  if (isPdf) {
    return (
      <iframe
        src={url}
        title={name ?? "document"}
        className="h-[500px] w-full rounded-[8px] border border-[#d9e1ef]"
      />
    );
  }
  return (
    <div className="flex flex-col items-center justify-center rounded-[10px] border-2 border-dashed border-[#cfd7e6] py-12 text-slate-400">
      <FileText size={40} className="mb-3" />
      <p className="text-sm">No preview available for this file type.</p>
      <a
        href={url}
        download
        className="mt-3 flex items-center gap-1.5 text-sm font-medium text-[#22c55e] hover:underline"
      >
        <Download size={14} /> Download to view
      </a>
    </div>
  );
}

export default function DocumentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [doc, setDoc] = useState<DocumentRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Edit form state
  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editType, setEditType] = useState<DocumentType>("other");
  const [editModule, setEditModule] = useState<RelatedModule>("");
  const [editRelatedId, setEditRelatedId] = useState("");
  const [newFile, setNewFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!id) return;
    void (async () => {
      try {
        setLoading(true);
        const data = await getDocumentById(id);
        setDoc(data);
        // populate edit form
        setEditTitle(data.title);
        setEditDesc(data.description ?? "");
        setEditType(data.document_type);
        setEditModule(data.related_module ?? "");
        setEditRelatedId(data.related_id != null ? String(data.related_id) : "");
      } catch {
        setError("Failed to load document.");
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const handleSave = async () => {
    if (!id || !editTitle.trim()) { setError("Title is required."); return; }
    try {
      setSaving(true);
      setError("");
      const updated = await updateDocument(id, {
        title: editTitle.trim(),
        description: editDesc.trim() || undefined,
        document_type: editType,
        related_module: editModule || undefined,
        related_id: editRelatedId ? Number(editRelatedId) : undefined,
        file: newFile ?? undefined,
      });
      setDoc(updated);
      setNewFile(null);
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!id || !window.confirm("Delete this document permanently?")) return;
    await deleteDocument(id);
    navigate("/documents");
  };

  const inputCls =
    "w-full rounded-[8px] border border-[#cfd7e6] px-3 py-2 text-sm text-slate-800 outline-none focus:border-[#22c55e] focus:ring-2 focus:ring-green-500/10";

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-slate-400 text-sm gap-2">
        <Loader2 size={16} className="animate-spin" /> Loading…
      </div>
    );
  }

  if (error && !doc) {
    return <div className="p-6 text-red-600 text-sm">{error}</div>;
  }

  if (!doc) return null;

  return (
    <div className="h-full overflow-y-auto bg-[#f0fdf4]">
      {/* Header */}
      <div className="border-b border-[#d9e1ef] bg-[#f0fdf4] px-6 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/documents")}
              className="rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
            >
              <ArrowLeft size={18} />
            </button>
            <div>
              <h1 className="text-[18px] font-semibold text-[#1f2d3d]">{doc.title}</h1>
              <p className="text-xs text-slate-500">Document Detail</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {doc.file_url && (
              <a
                href={doc.file_url}
                download
                className="flex items-center gap-1.5 rounded-[6px] border border-[#cfd7e6] bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                <Download size={14} /> Download
              </a>
            )}
            {!editing ? (
              <button
                onClick={() => setEditing(true)}
                className="flex items-center gap-1.5 rounded-[6px] border border-[#cfd7e6] bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                <Edit2 size={14} /> Edit
              </button>
            ) : (
              <>
                <button
                  onClick={() => setEditing(false)}
                  className="rounded-[6px] border border-[#cfd7e6] bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => void handleSave()}
                  disabled={saving}
                  className="flex items-center gap-1.5 rounded-[6px] bg-gradient-to-b from-[#22c55e] to-[#16a34a] px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
                >
                  {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                  Save
                </button>
              </>
            )}
            <button
              onClick={() => void handleDelete()}
              className="rounded-[6px] border border-red-200 bg-white px-4 py-2 text-sm text-red-500 hover:bg-red-50"
            >
              Delete
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 p-6 lg:grid-cols-[1fr_340px]">
        {/* Left — preview */}
        <div className="space-y-4">
          {error && (
            <div className="rounded-[8px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
              {error}
            </div>
          )}

          {/* File preview */}
          <div className="rounded-[10px] border border-[#d9e1ef] bg-white p-5">
            <h2 className="mb-4 text-[13px] font-semibold text-[#1f2d3d]">Preview</h2>
            {doc.file_url ? (
              <FilePreview url={doc.file_url} name={doc.file_name} />
            ) : (
              <p className="text-sm text-slate-400">No file attached.</p>
            )}
          </div>

          {/* Version History */}
          {doc.versions && doc.versions.length > 0 && (
            <div className="rounded-[10px] border border-[#d9e1ef] bg-white p-5">
              <h2 className="mb-4 flex items-center gap-2 text-[13px] font-semibold text-[#1f2d3d]">
                <Clock size={14} /> Version History
              </h2>
              <div className="space-y-2">
                {doc.versions.map((v) => (
                  <div
                    key={v.id}
                    className="flex items-center justify-between rounded-[8px] border border-slate-100 bg-slate-50 px-4 py-2.5 text-sm"
                  >
                    <div>
                      <span className="font-medium text-slate-700">v{v.version_number}</span>
                      <span className="ml-3 text-xs text-slate-400">
                        {v.file_name ?? "file"} · {new Date(v.uploaded_at).toLocaleString()}
                      </span>
                    </div>
                    {v.file_url && (
                      <a
                        href={v.file_url}
                        download
                        className="flex items-center gap-1 text-xs font-medium text-[#22c55e] hover:underline"
                      >
                        <Download size={12} /> Download
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right — metadata / edit form */}
        <div className="space-y-4">
          <div className="rounded-[10px] border border-[#d9e1ef] bg-white p-5">
            <h2 className="mb-4 text-[13px] font-semibold text-[#1f2d3d]">
              {editing ? "Edit Document" : "Document Info"}
            </h2>

            {editing ? (
              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Title *</label>
                  <input className={inputCls} value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Description</label>
                  <textarea className={inputCls} rows={3} value={editDesc} onChange={(e) => setEditDesc(e.target.value)} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Document Type</label>
                  <select className={inputCls} value={editType} onChange={(e) => setEditType(e.target.value as DocumentType)}>
                    {Object.entries(DOCUMENT_TYPE_LABELS).map(([v, l]) => (
                      <option key={v} value={v}>{l}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Linked Module</label>
                  <select className={inputCls} value={editModule} onChange={(e) => setEditModule(e.target.value as RelatedModule)}>
                    <option value="">None</option>
                    {(["lead", "contact", "deal", "project"] as RelatedModule[]).map((m) => (
                      <option key={m} value={m}>{MODULE_LABELS[m]}</option>
                    ))}
                  </select>
                </div>
                {editModule && (
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">{MODULE_LABELS[editModule]} ID</label>
                    <input className={inputCls} type="number" value={editRelatedId} onChange={(e) => setEditRelatedId(e.target.value)} />
                  </div>
                )}
                {/* Replace file */}
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Replace File (optional)</label>
                  <div
                    onClick={() => fileRef.current?.click()}
                    className="flex cursor-pointer items-center gap-2 rounded-[8px] border border-dashed border-[#cfd7e6] px-3 py-2.5 text-sm text-slate-500 hover:border-[#22c55e] hover:text-[#22c55e]"
                  >
                    <Upload size={14} />
                    {newFile ? newFile.name : "Click to select new file…"}
                    <input ref={fileRef} type="file" className="hidden" onChange={(e) => { if (e.target.files?.[0]) setNewFile(e.target.files[0]); }} />
                  </div>
                  {newFile && (
                    <button onClick={() => setNewFile(null)} className="mt-1 flex items-center gap-1 text-xs text-red-400 hover:text-red-600">
                      <X size={11} /> Remove selected file
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <InfoRow label="Title" value={doc.title} />
                <InfoRow label="Description" value={doc.description} />
                <div className="flex gap-2 text-sm">
                  <span className="w-36 shrink-0 text-slate-500">Type</span>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${TYPE_COLORS[doc.document_type] ?? TYPE_COLORS.other}`}>
                    {DOCUMENT_TYPE_LABELS[doc.document_type] ?? doc.document_type}
                  </span>
                </div>
                <InfoRow
                  label="Linked To"
                  value={doc.related_module ? `${MODULE_LABELS[doc.related_module]} #${doc.related_id ?? "—"}` : undefined}
                />
                <InfoRow label="Uploaded By" value={doc.uploaded_by_email} />
                <InfoRow label="File" value={doc.file_name} />
                <InfoRow label="Version" value={`v${doc.version}`} />
                <InfoRow label="Created" value={new Date(doc.created_at).toLocaleString()} />
                <InfoRow label="Updated" value={new Date(doc.updated_at).toLocaleString()} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
