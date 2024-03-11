import Cron from 'croner';
import Angel from './base';
import { commonPrint, formatNumberInTime, getISTTime } from '../helpers';

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
          commonPrint()
        );
        angelInstance.cleanup();
        angelInstance = null;
      }
      console.log('🚀 Angel Login Croner executed ', commonPrint());
      angelInstance = new Angel();
    }
  );

  if (process.env.ENVIRONMENT !== 'dev') {
    loginCroner.trigger();
  }
};

export const forceKillOrders = () => {
  if (angelInstance) {
    console.log('🚀 Initiated Gracefully shutdown');
    angelInstance.ACTIVE_STRATEGIES?.forEach((strategy, index) => {
      if (angelInstance && strategy.order_status === 'PLACED') {
        console.log(`🚀 Force exit order ${strategy.id}`, commonPrint());
        // force exit order as server is restarting
        angelInstance.exitOrder(index);
      }
    });
    angelInstance.cleanup();
  }
};

export const backtest = async ({ numberOfDays = 1 }) => {
  console.log('🚀 Backtesting');
  const backtestAngel = new Angel();

  const newDate = getISTTime();

  // loop from here
  const day = newDate.date();
  const month = newDate.month();
  const year = newDate.year();

  const candle_to_watch_start_at = 18;
  const start_entry_after = 18.3;

  const entryTimeData = String(start_entry_after).split('.');
  const entryHour = entryTimeData[0];
  const entryMinute = entryTimeData[1];

  const fromdate = `${year}-${formatNumberInTime(
    month + 1
  )}-${formatNumberInTime(day)} ${
    formatNumberInTime(candle_to_watch_start_at) +
    ':' +
    formatNumberInTime(Number(entryMinute || '0'))
  }`;

  const todate = `${year}-${formatNumberInTime(
    month + 1
  )}-${formatNumberInTime(day)} ${formatNumberInTime(
    start_entry_after - 1
  )}:${formatNumberInTime(59)}`;
};

export default AngelLogin;
