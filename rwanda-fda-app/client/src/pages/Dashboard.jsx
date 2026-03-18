import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  profileApi,
  tasksApi,
  applicationsApi,
  notificationsApi,
} from "../api";
import { useQuery } from "../components/useQuery";

const IconTasks = () => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M9 11l3 3L22 4" />
    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
  </svg>
);
const IconApplications = () => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <path d="M14 2v6h6" />
    <path d="M16 13H8" />
    <path d="M16 17H8" />
    <path d="M10 9H8" />
  </svg>
);
const IconNotifications = () => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </svg>
);

const StatCard = ({ icon: Icon, value, label, to, color, delay }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay, duration: 0.3 }}
  >
    <Link to={to} className="group block">
      <motion.div
        whileHover={{ scale: 1.05, translateY: -4 }}
        whileTap={{ scale: 0.98 }}
        className={`relative overflow-hidden rounded-2xl p-6 shadow-lg transition-all duration-300 bg-gradient-to-br ${color} min-h-[200px] flex flex-col justify-between`}
      >
        {/* Background gradient overlay */}
        <motion.div
          className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
          initial={{ opacity: 0 }}
          whileHover={{ opacity: 0.1 }}
        />

        <div className="relative z-10">
          <div className="mb-4 inline-flex p-3 rounded-xl bg-white/20 backdrop-blur-sm">
            <motion.div
              animate={{ rotate: [0, 10, -10, 0] }}
              transition={{ duration: 4, repeat: Infinity }}
            >
              <Icon className="w-6 h-6 text-white" />
            </motion.div>
          </div>

          <motion.div
            key={value}
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-4xl font-bold text-white mb-2"
          >
            {value}
          </motion.div>
          <p className="text-white/90 font-medium">{label}</p>
        </div>

        {/* Animated corner accent */}
        <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -mr-12 -mt-12 group-hover:scale-125 transition-transform duration-300" />
      </motion.div>
    </Link>
  </motion.div>
);

const SectionCard = ({ title, viewAllLink, children, delay }) => (
  <motion.section
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay, duration: 0.3 }}
    className="rounded-2xl bg-white shadow-lg overflow-hidden"
  >
    <div className="bg-gradient-to-r from-slate-50 to-blue-50 px-6 py-5 border-b border-slate-200 flex items-center justify-between">
      <h3 className="text-lg font-bold text-slate-900">{title}</h3>
      <Link
        to={viewAllLink}
        className="text-sm text-primary-600 hover:text-primary-700 font-semibold transition-colors hover:underline"
      >
        View all →
      </Link>
    </div>
    <div className="p-6">{children}</div>
  </motion.section>
);

const TaskRow = ({ task, index }) => (
  <motion.div
    initial={{ opacity: 0, x: -20 }}
    animate={{ opacity: 1, x: 0 }}
    transition={{ delay: index * 0.05 }}
    whileHover={{ x: 4 }}
    className="flex items-center justify-between py-4 px-4 rounded-lg hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0"
  >
    <div className="flex-1 min-w-0">
      <p className="font-medium text-slate-900 truncate">{task.title}</p>
      <p className="text-sm text-slate-500 truncate">
        {task.description || "No description"}
      </p>
    </div>
    <motion.span
      whileHover={{ scale: 1.05 }}
      className={`ml-4 px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
        task.status === "completed"
          ? "bg-green-100 text-green-700"
          : task.status === "pending"
            ? "bg-yellow-100 text-yellow-700"
            : "bg-blue-100 text-blue-700"
      }`}
    >
      {task.status || "pending"}
    </motion.span>
  </motion.div>
);

const ApplicationRow = ({ app, index }) => (
  <motion.div
    initial={{ opacity: 0, x: -20 }}
    animate={{ opacity: 1, x: 0 }}
    transition={{ delay: index * 0.05 }}
    whileHover={{ x: 4 }}
    className="flex items-center justify-between py-4 px-4 rounded-lg hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0"
  >
    <Link
      to="/applications"
      className="flex-1 min-w-0 hover:text-primary-600 transition-colors"
    >
      <p className="font-medium text-slate-900 truncate">
        {app.title || app.reference_number || `Application #${app.id}`}
      </p>
      <p className="text-sm text-slate-500 truncate">
        {app.reference_number || "No reference"}
      </p>
    </Link>
    <motion.span
      whileHover={{ scale: 1.05 }}
      className={`ml-4 px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
        app.status === "approved"
          ? "bg-green-100 text-green-700"
          : app.status === "rejected"
            ? "bg-red-100 text-red-700"
            : app.status === "pending"
              ? "bg-yellow-100 text-yellow-700"
              : "bg-slate-100 text-slate-700"
      }`}
    >
      {app.status || "pending"}
    </motion.span>
  </motion.div>
);

export default function Dashboard() {
  const { data: profile } = useQuery(profileApi.get);
  const { data: tasks = [], error: tasksError } = useQuery(tasksApi.list);
  const { data: applications = [], error: appsError } = useQuery(
    applicationsApi.list,
  );
  const { data: notifications = [] } = useQuery(notificationsApi.list);

  const pendingTasks = Array.isArray(tasks)
    ? tasks.filter((t) => t.status !== "completed").length
    : 0;
  const recentApplications = Array.isArray(applications)
    ? applications.slice(0, 5)
    : [];
  const unreadNotifs = Array.isArray(notifications)
    ? notifications.filter((n) => !n.read_at).length
    : 0;
  const tasksList = tasksError ? [] : tasks || [];
  const appsList = appsError ? [] : applications || [];

  const firstName = profile?.name ? profile.name.split(" ")[0] : "";

  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary-600 via-secondary-600 to-accent-600 shadow-xl p-6 text-white">
          <motion.div
            className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full -mr-48 -mt-48"
            animate={{ scale: [1, 1.1, 1], rotate: [0, 50, 0] }}
            transition={{ duration: 8, repeat: Infinity }}
          />

          <div className="relative z-10">
            <motion.h2
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="text-3xl font-bold"
            >
              Welcome back{firstName ? `, ${firstName}` : ""}! 👋
            </motion.h2>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="text-white/80 text-sm mt-1"
            >
              Here's your dashboard overview
            </motion.p>
          </div>
        </div>
      </motion.div>

      {/* Stat Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard
          icon={IconTasks}
          value={pendingTasks}
          label="Pending tasks"
          to="/tasks"
          color="from-blue-500 to-blue-600"
          delay={0.1}
        />
        <StatCard
          icon={IconApplications}
          value={applications.length}
          label="My applications"
          to="/applications"
          color="from-purple-500 to-purple-600"
          delay={0.2}
        />
        <StatCard
          icon={IconNotifications}
          value={unreadNotifs}
          label="Unread notifications"
          to="/notifications"
          color="from-amber-500 to-amber-600"
          delay={0.3}
        />
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SectionCard title="Recent tasks" viewAllLink="/tasks" delay={0.4}>
          {tasksList.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-12"
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
              <p className="text-slate-500">
                {tasksError ? "Tasks unavailable." : "No tasks assigned yet."}
              </p>
            </motion.div>
          ) : (
            <div className="space-y-0">
              {tasksList.slice(0, 5).map((task, idx) => (
                <TaskRow key={task.id} task={task} index={idx} />
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard
          title="My applications"
          viewAllLink="/applications"
          delay={0.5}
        >
          {recentApplications.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-12"
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
              <p className="text-slate-500">
                {appsError
                  ? "Applications unavailable."
                  : "No applications yet."}
              </p>
            </motion.div>
          ) : (
            <div className="space-y-0">
              {recentApplications.map((app, idx) => (
                <ApplicationRow key={app.id} app={app} index={idx} />
              ))}
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
