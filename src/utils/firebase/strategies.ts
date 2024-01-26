import { logger } from 'firebase-functions/v2';
import { instrument_prop, strategy_prop } from '../types';
import Firebase from './instance';

export const updateOrderStatus = async (
  {
    id,
    entries_taken_today,
    order_status,
    entry_price,
    exit_price,
    profit_points
  }: strategy_prop,
  order: any
) => {
  Firebase.db.collection('orders').doc(order.orderid).set(order);
  Firebase.db.collection('strategies').doc(id).update({
    order_status,
    entries_taken_today,
    entry_price,
    exit_price,
    profit_points
  });
};

export const cleanAllStrategies = async () => {
  const strategies_colllection = Firebase.db.collection('strategies');
  const response = await strategies_colllection.get();
  if (response.empty) {
    logger.log('🚀 Nothing to reset in 🔥 store ', new Date().toString());
    return [];
  }
  const batch = Firebase.db.batch();
  response.forEach(async (res: any) => {
    const resData: strategy_prop = res.data();
    batch.set(strategies_colllection.doc(res.id), {
      ...resData,
      entries_taken_today: 0,
      order_status: 'IDLE',
      entry_price: 0,
      exit_price: 0,
      profit_points: 0
    });
  });
  logger.log('🚀 Reset strategies done in 🔥 store ', new Date().toString());
  return batch.commit();
};

export const fetchAllActiveStrategies = async () => {
  logger.log(
    '🚀 Fetching all active strategies from 🔥 store ',
    new Date().toString()
  );
  const strategies_colllection = Firebase.db.collection('strategies');
  const response = await strategies_colllection
    .where('status', '==', 'ACTIVE')
    .get();

  if (response.empty) {
    logger.log(
      '🚀 No any active strategies found in 🔥 store',
      new Date().toString()
    );
    return [];
  }

  return new Promise<strategy_prop[]>(async (resolve) => {
    const data: strategy_prop[] = [];
    const result: strategy_prop[] = [];
    const ids: string[] = [];

    response.forEach(async (res: any) => {
      const resData: strategy_prop = res.data();
      if (ids.indexOf(resData.instrument_to_watch.id + '') === -1) {
        ids.push(resData.instrument_to_watch.id + '');
      }
      resData.id = res.id;
      data.push(resData);
    });

    const instruments_collection = Firebase.db.collection('instruments');
    const actual_instruments = await instruments_collection
      .where('token', 'in', ids)
      .get();

    const newDate = new Date();
    let hours = newDate.getHours().toString();
    let minutes = newDate.getMinutes().toString();
    if (hours.length === 1) {
      hours = '0' + hours;
    }
    if (minutes.length === 1) {
      minutes = '0' + minutes;
    }
    const timestamp = parseFloat(hours + '.' + minutes);

    actual_instruments.forEach((instrument) => {
      const strategy = data.find(
        (ms) => ms.instrument_to_watch.id === instrument.id
      );
      if (strategy) {
        strategy.instrument_to_watch = <instrument_prop>instrument.data();
        strategy.instrument_to_watch.id = instrument.id;
        if (
          strategy.max_entries_per_day > strategy.entries_taken_today &&
          timestamp >= strategy.start_entry_after
        ) {
          result.push(strategy);
        }
      }
    });

    logger.log(
      `🚀 Total ${result.length} active strategies found in 🔥 store`,
      new Date().toString()
    );
    resolve(result);
  });
};
