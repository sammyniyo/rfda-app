import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { tasksApi } from "../api";
import { useQuery } from "../components/useQuery";

const statusFilters = ["", "pending", "in_progress", "completed"];

const statusColors = {
  pending: "bg-yellow-100 text-yellow-700 border-yellow-200",
  in_progress: "bg-blue-100 text-blue-700 border-blue-200",
  completed: "bg-green-100 text-green-700 border-green-200",
};

const priorityColors = {
  low: "bg-slate-100 text-slate-700",
  medium: "bg-orange-100 text-orange-700",
  high: "bg-red-100 text-red-700",
};

export default function Tasks() {
  const [status, setStatus] = useState("");
  const {
    data: tasks = [],
    loading,
    error,
  } = useQuery(() => tasksApi.list(status || undefined), [status]);

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
        Failed to load tasks. {error}
      </motion.div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-xl shadow-sm p-4 border border-slate-200"
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
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
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

      {/* Tasks List */}
      {tasks.length === 0 ? (
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
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <p className="text-slate-600 font-medium">
            No tasks match your selection.
          </p>
        </motion.div>
      ) : (
        <motion.ul className="space-y-3" layout>
          <AnimatePresence>
            {tasks.map((t, idx) => (
              <motion.li
                key={t.id}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ delay: idx * 0.05 }}
                whileHover={{ scale: 1.02, translateY: -4 }}
              >
                <div className="bg-white rounded-xl shadow-sm hover:shadow-lg transition-all border border-slate-200 p-6">
                  <div className="flex items-start justify-between mb-3 gap-4">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-semibold text-slate-900 mb-1">
                        {t.title}
                      </h3>
                      {t.description && (
                        <p className="text-slate-600 text-sm">
                          {t.description}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between flex-wrap gap-3 pt-4 border-t border-slate-100 mt-4">
                    <div className="flex gap-2 flex-wrap">
                      <motion.span
                        whileHover={{ scale: 1.05 }}
                        className={`inline-block px-3 py-1 rounded-lg text-xs font-semibold border ${
                          statusColors[t.status] ||
                          "bg-slate-100 text-slate-700 border-slate-200"
                        }`}
                      >
                        {String(t.status).replace("_", " ")}
                      </motion.span>
                      {t.priority && (
                        <motion.span
                          whileHover={{ scale: 1.05 }}
                          className={`inline-block px-3 py-1 rounded-lg text-xs font-semibold ${
                            priorityColors[t.priority] ||
                            "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {t.priority}
                        </motion.span>
                      )}
                    </div>
                    {t.due_date && (
                      <span className="text-xs text-slate-500">
                        Due {new Date(t.due_date).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
              </motion.li>
            ))}
          </AnimatePresence>
        </motion.ul>
      )}
    </div>
  );
}
