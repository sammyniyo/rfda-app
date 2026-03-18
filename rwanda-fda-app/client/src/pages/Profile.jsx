import { motion } from "framer-motion";
import { profileApi } from "../api";
import { useQuery } from "../components/useQuery";

export default function Profile() {
  const { data: profile, loading, error } = useQuery(profileApi.get);

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
        Failed to load profile. {error}
      </motion.div>
    );
  }

  if (!profile) return null;

  const fields = [
    { label: "Full name", value: profile.name, icon: "👤" },
    { label: "Email", value: profile.email, icon: "📧" },
    { label: "Personal email", value: profile.personal_email, icon: "📧" },
    { label: "Role / Access", value: profile.role, icon: "🏢" },
    {
      label: "Department / Duty station",
      value: profile.department,
      icon: "📍",
    },
    { label: "Phone", value: profile.phone, icon: "📱" },
    { label: "Degree", value: profile.degree, icon: "🎓" },
    { label: "Qualifications", value: profile.qualifications, icon: "📜" },
    {
      label: "Hire date",
      value: profile.hire_date
        ? new Date(profile.hire_date).toLocaleDateString()
        : null,
      icon: "📅",
    },
    { label: "Staff group", value: profile.staff_group, icon: "👥" },
  ];

  return (
    <div className="space-y-6">
      {/* Profile Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="bg-gradient-to-br from-primary-600 to-secondary-600 rounded-2xl shadow-xl p-8 text-white relative overflow-hidden"
      >
        <motion.div
          className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full -mr-48 -mt-48"
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ duration: 8, repeat: Infinity }}
        />

        <div className="relative z-10">
          <div className="flex items-center gap-6 mb-6">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring" }}
              whileHover={{ scale: 1.1 }}
              className="w-24 h-24 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center text-5xl font-bold text-white shadow-lg"
            >
              {profile.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt=""
                  className="w-full h-full object-cover rounded-2xl"
                />
              ) : (
                profile.name?.slice(0, 2).toUpperCase() || "RF"
              )}
            </motion.div>
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
            >
              <h1 className="text-4xl font-bold mb-1">
                {profile.name || "Staff Member"}
              </h1>
              <p className="text-white/90 text-lg">
                {profile.role || "Staff"} • {profile.department || "Rwanda FDA"}
              </p>
              {profile.email && (
                <p className="text-white/70 text-sm mt-1">{profile.email}</p>
              )}
            </motion.div>
          </div>
        </div>
      </motion.div>

      {/* Profile Fields Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {fields.map(({ label, value, icon }, idx) => (
          <motion.div
            key={label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05 }}
            whileHover={{ scale: 1.02, translateY: -4 }}
            className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 hover:shadow-lg transition-all"
          >
            <div className="flex items-center gap-3 mb-2">
              <span className="text-2xl">{icon}</span>
              <label className="text-sm font-semibold text-slate-600">
                {label}
              </label>
            </div>
            <p
              className={`text-lg ${
                value ? "text-slate-900 font-medium" : "text-slate-400"
              }`}
            >
              {value || "—"}
            </p>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
