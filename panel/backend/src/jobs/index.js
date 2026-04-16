const cron = require('node-cron');
const logger = require('../config/logger');
const { runPlaytimeCheck } = require('./playtimeCheck');
const { runDailyReport } = require('./dailyReport');

function startJobs(io) {
  const playtimeCron = process.env.PLAYTIME_CHECK_CRON || '* * * * *';
  const reportCron   = process.env.DAILY_REPORT_CRON   || '0 21 * * *';

  // Verificación de límites cada minuto
  cron.schedule(playtimeCron, async () => {
    try {
      await runPlaytimeCheck(io);
    } catch (err) {
      logger.error('Error en playtimeCheck job:', err.message);
    }
  }, { timezone: process.env.TZ || 'Europe/Madrid' });

  // Informe diario
  cron.schedule(reportCron, async () => {
    try {
      await runDailyReport(io);
    } catch (err) {
      logger.error('Error en dailyReport job:', err.message);
    }
  }, { timezone: process.env.TZ || 'Europe/Madrid' });

  logger.info(`⏰ Jobs iniciados — playtime: ${playtimeCron} | report: ${reportCron}`);
}

module.exports = { startJobs };
