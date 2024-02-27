import { commonPrint, getISTTime } from '../helpers';
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
  try {
    Firebase.db
      .collection('orders')
      .doc(order.orderid)
      .set({
        ...order,
        profit_points,
        entry_price,
        exit_price
      });
  } catch (error) {
    console.error('Failed to update orders database -> ', error);
  }
  try {
    Firebase.db.collection('strategies').doc(id).update({
      order_status,
      entries_taken_today
    });
  } catch (error) {
    console.error('Failed to update strategies database -> ', error);
  }
};

export const cleanAllStrategies = async () => {
  const strategies_colllection = Firebase.db.collection('strategies');
  const response = await strategies_colllection.get();
  if (response.empty) {
    console.log('🚀 Nothing to reset in 🔥 store ', commonPrint());
    return [];
  }
  const batch = Firebase.db.batch();
  response.forEach(async (res: any) => {
    const resData: strategy_prop = res.data();
    batch.set(strategies_colllection.doc(res.id), {
      ...resData,
      entries_taken_today: 0,
      order_status: 'IDLE'
    });
  });
  console.log('🚀 Reset strategies done in 🔥 store ', commonPrint());
  return batch.commit();
};

export const fetchAllActiveStrategies = async () => {
  console.log(
    '🚀 Fetching all active strategies from 🔥 store ',
    commonPrint()
  );
  const strategies_colllection = Firebase.db.collection('strategies');
  const response = await strategies_colllection
    .where('status', '==', 'ACTIVE')
    .where('order_status', '==', 'IDLE')
    .get();

  if (response.empty) {
    console.log('🚀 No any active strategies found in 🔥 store', commonPrint());
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

    const newDate = getISTTime();
    let hours = newDate.hour().toString();
    let minutes = newDate.minute().toString();
    if (hours.length === 1) {
      hours = '0' + hours;
    }
    if (minutes.length === 1) {
      minutes = '0' + minutes;
    }
    const timestamp = parseFloat(hours + '.' + minutes);

    actual_instruments.forEach((instrument) => {
      data.forEach((strategy) => {
        if (strategy.instrument_to_watch.id === instrument.id) {
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
    });

    resolve(result);
  });
};
