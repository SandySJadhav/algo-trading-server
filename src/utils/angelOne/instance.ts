import Cron from 'croner';
import Angel from './base';

let angelInstance: Angel | null;

/**
 * Initiate angel instance creation and login process
 */
const AngelLogin = async () => {
  /**
   * ┌──────────────── (optional) second (0 - 59)
   * │ ┌────────────── minute (0 - 59)
   * │ │ ┌──────────── hour (0 - 23)
   * │ │ │ ┌────────── day of month (1 - 31)
   * │ │ │ │ ┌──────── month (1 - 12, JAN-DEC)
   * │ │ │ │ │ ┌────── day of week (0 to 6 are Sunday to Saturday; 7 is Sunday, the same as 0)
   * │ │ │ │ │ │
   * * * * * * *
   */
  let loginSchedulerTimer = '0 9 * * 1-5'; // Runs at 09:00 on every day-of-week from Monday-Friday.
  let loginMaxRuns;
  if (process.env.ENVIRONMENT === 'dev') {
    loginMaxRuns = 1;
    loginSchedulerTimer = '* * * * * *';
  }
  const loginCroner = Cron(
    loginSchedulerTimer,
    { maxRuns: loginMaxRuns },
    async () => {
      if (angelInstance?.JWTTOKEN) {
        console.log(
          '🚀 Running previous Angel instance cleanups ',
          new Date().toString()
        );
        angelInstance.cleanup();
        angelInstance = null;
      }
      console.log('🚀 Angel Login Croner executed ', new Date().toString());
      angelInstance = new Angel();
    }
  );

  if (process.env.ENVIRONMENT !== 'dev') {
    loginCroner.trigger();
  }
};

export default AngelLogin;
