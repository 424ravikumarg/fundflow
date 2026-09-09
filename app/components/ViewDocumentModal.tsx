"use client";

interface ViewDocumentModalProps {
  isOpen: boolean;
  document: {
    filename: string;
    file_type: string;
    parsed_text: string;
    created_at: string;
  } | null;
  onClose: () => void;
}

export default function ViewDocumentModal({
  isOpen,
  document,
  onClose,
}: ViewDocumentModalProps) {
  if (!isOpen || !document) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
      <div className="bg-white rounded-3xl p-6 w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl border border-gray-100 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex justify-between items-start pb-4 border-b border-gray-100">
          <div>
            <h3 className="text-lg font-bold text-gray-900">{document.filename}</h3>
            <p className="text-xs text-gray-400 mt-0.5">
              Type: <span className="font-semibold text-[#6558D3]">{document.file_type}</span> • Uploaded on{" "}
              {new Date(document.created_at).toLocaleDateString()}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl font-medium p-1 cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Parsed Content */}
        <div className="flex-1 overflow-y-auto my-4 p-4 bg-gray-50/70 border border-gray-100 rounded-2xl">
          <p className="text-xs font-semibold uppercase text-gray-400 mb-2">Parsed Document Text & Data:</p>
          <pre className="text-xs font-mono text-gray-800 whitespace-pre-wrap leading-relaxed font-normal">
            {document.parsed_text || "No text could be extracted from this file."}
          </pre>
        </div>

        {/* Footer */}
        <div className="flex justify-end pt-2">
          <button
            onClick={onClose}
            className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-5 py-2 rounded-xl text-sm font-medium transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
