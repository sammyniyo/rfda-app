import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.js';
import dbTestRoutes from './routes/dbTest.js';
import profileRoutes from './routes/profile.js';
import tasksRoutes from './routes/tasks.js';
import applicationsRoutes from './routes/applications.js';
import notificationsRoutes from './routes/notifications.js';
import { authMiddleware } from './middleware/auth.js';

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors({ origin: true }));
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/db-test', dbTestRoutes);
app.use('/api/profile', authMiddleware, profileRoutes);
app.use('/api/tasks', authMiddleware, tasksRoutes);
app.use('/api/applications', authMiddleware, applicationsRoutes);
app.use('/api/notifications', authMiddleware, notificationsRoutes);

app.get('/api/health', (_, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`Rwanda FDA API running at http://localhost:${PORT}`);
});
