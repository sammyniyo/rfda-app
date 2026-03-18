import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { applicationsApi } from "../api";
import { useQuery } from "../components/useQuery";

const statusFilters = [
  "",
  "draft",
  "submitted",
  "under_review",
  "approved",
  "rejected",
  "on_hold",
];

const statusColors = {
  draft: "bg-slate-100 text-slate-700",
  submitted: "bg-blue-100 text-blue-700",
  under_review: "bg-purple-100 text-purple-700",
  approved: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
  on_hold: "bg-yellow-100 text-yellow-700",
};

export default function Applications() {
  const [status, setStatus] = useState("");
  const {
    data: applications = [],
    loading,
    error,
  } = useQuery(() => applicationsApi.list(status || undefined), [status]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          className="w-12 h-12 border-4 border-slate-200 border-t-primary-500 rounded-full"
        />
      </div>
    );
  }

  if (error) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="rounded-lg bg-red-50 border border-red-200 p-6 text-red-700"
      >
        Failed to load applications. {error}
      </motion.div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-xl shadow-sm p-4 border border-slate-200 overflow-x-auto"
      >
        <p className="text-sm font-semibold text-slate-700 mb-3">
          Filter by Status
        </p>
        <div className="flex gap-2 flex-wrap">
          {statusFilters.map((s, i) => (
            <motion.button
              key={s || "all"}
              type="button"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.05 }}
              onClick={() => setStatus(s)}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className={`px-4 py-2 rounded-lg font-medium transition-all whitespace-nowrap ${
                status === s
                  ? "bg-gradient-to-r from-primary-600 to-primary-700 text-white shadow-lg"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              {s || "All"}
            </motion.button>
          ))}
        </div>
      </motion.div>

      {/* Applications Table */}
      {applications.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-lg bg-slate-50 border border-slate-200 p-12 text-center"
        >
          <svg
            className="w-12 h-12 text-slate-300 mx-auto mb-3"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <p className="text-slate-600 font-medium">
            No applications match your selection.
          </p>
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden"
        >
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gradient-to-r from-slate-50 to-slate-100 border-b border-slate-200">
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-900">
                    Reference
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-900">
                    Type / Title
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-900">
                    Status
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-900">
                    Submitted
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-900">
                    Updated
                  </th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence>
                  {applications.map((a, idx) => (
                    <motion.tr
                      key={a.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ delay: idx * 0.05 }}
                      whileHover={{ backgroundColor: "#f8fafc" }}
                      className="border-b border-slate-200 hover:bg-slate-50 transition-colors"
                    >
                      <td className="px-6 py-4 font-medium text-primary-600">
                        {a.reference_number || `#${a.id}`}
                      </td>
                      <td className="px-6 py-4">
                        <div>
                          <p className="text-sm font-medium text-slate-900">
                            {a.type || "Application"}
                          </p>
                          {a.title && (
                            <p className="text-xs text-slate-500">{a.title}</p>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <motion.span
                          whileHover={{ scale: 1.05 }}
                          className={`inline-block px-3 py-1 rounded-lg text-xs font-semibold ${
                            statusColors[a.status] ||
                            "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {String(a.status).replace("_", " ")}
                        </motion.span>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">
                        {a.submitted_at
                          ? new Date(a.submitted_at).toLocaleDateString()
                          : "—"}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">
                        {a.updated_at
                          ? new Date(a.updated_at).toLocaleDateString()
                          : "—"}
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        </motion.div>
      )}
    </div>
  );
}
