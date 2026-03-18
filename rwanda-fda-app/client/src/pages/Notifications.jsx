import { motion, AnimatePresence } from "framer-motion";
import { notificationsApi } from "../api";
import { useQuery } from "../components/useQuery";

const typeLabels = {
  assignment: "New assignment",
  delay: "Delay",
  status_update: "Status update",
  general: "Notification",
};

const typeIcons = {
  assignment: "📋",
  delay: "⏱️",
  status_update: "✅",
  general: "🔔",
};

export default function Notifications() {
  const {
    data: notifications = [],
    loading,
    error,
  } = useQuery(notificationsApi.list);

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
        Failed to load notifications. {error}
      </motion.div>
    );
  }

  return (
    <div className="space-y-4">
      {notifications.length === 0 ? (
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
              d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
            />
          </svg>
          <p className="text-slate-600 font-medium">No notifications yet.</p>
        </motion.div>
      ) : (
        <AnimatePresence>
          {notifications.map((n, idx) => (
            <motion.div
              key={n.id}
              layout
              initial={{ opacity: 0, x: -20, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 20, scale: 0.95 }}
              transition={{ delay: idx * 0.05 }}
              whileHover={{ scale: 1.02, transition: { duration: 0.2 } }}
              className={`rounded-xl shadow-sm border overflow-hidden transition-all ${
                !n.read_at
                  ? "bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200"
                  : "bg-white border-slate-200"
              }`}
            >
              <div className="p-5">
                <div className="flex items-start gap-4">
                  {/* Icon */}
                  <motion.div
                    animate={!n.read_at ? { scale: [1, 1.2, 1] } : {}}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="text-2xl flex-shrink-0 mt-1"
                  >
                    {typeIcons[n.type] || typeIcons.general}
                  </motion.div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-4 flex-wrap mb-2">
                      <h3 className="text-lg font-semibold text-slate-900">
                        {n.title}
                      </h3>
                      <motion.span
                        whileHover={{ scale: 1.05 }}
                        className="inline-block px-3 py-1 text-xs font-semibold rounded-lg bg-slate-100 text-slate-700"
                      >
                        {typeLabels[n.type] || n.type || "Notification"}
                      </motion.span>
                    </div>
                    {n.message && (
                      <p className="text-slate-600 mb-3">{n.message}</p>
                    )}
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span>{new Date(n.created_at).toLocaleString()}</span>
                      {!n.read_at && (
                        <motion.div
                          animate={{ scale: [1, 1.2, 1] }}
                          transition={{ duration: 2, repeat: Infinity }}
                          className="w-2 h-2 bg-blue-500 rounded-full"
                        />
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      )}
    </div>
  );
}
