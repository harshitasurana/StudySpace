import 'dotenv/config';
import './config/sqlite-compat.js'; // must be before any model import
import http from 'http';
import app from './app.js';
import models from './models/model.js';
import { logInfo, logError } from './common/utils/logger.js';
import { initSocket } from './common/socket/socket.manager.js';
import { startStreakReminderJob } from './common/jobs/streak_reminder_job.js';
import { startExamReminderJob } from './common/jobs/exam_reminder_job.js';
import { startStudyReminderJob } from './common/jobs/study_reminder_job.js';

const PORT = process.env.PORT || 3000;

const server = http.createServer(app);
initSocket(server);

const startServer = async () => {
  try {
    await models.sequelize.authenticate();
    const dbType = process.env.USE_SQLITE === 'true' ? 'SQLite' : 'PostgreSQL';
    logInfo(`Connected to ${dbType} with Sequelize`, { service: "database" });

    server.listen(PORT, () => {
      logInfo('Server running', { port: PORT, service: 'server' });
    });

    startStreakReminderJob();
    startExamReminderJob();
    startStudyReminderJob();
  } catch (err) {
    logError('Failed to start server', err, { service: 'server' });
    process.exit(1);
  }
};

startServer();
