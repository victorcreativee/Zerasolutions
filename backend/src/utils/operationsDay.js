import { buildDateFilter } from './reportDates.js';
import { HttpError } from './httpError.js';
export function operationsDay(date, startOffset = 0, endOffset = startOffset) {
  const range = buildDateFilter({dateFrom:date,dateTo:date});
  if (!range) throw new HttpError(400,'Choose a date.');
  const offsets=[startOffset,endOffset].map(value=>Number(value));
  if (offsets.some(value=>!Number.isInteger(value)||Math.abs(value)>840)) throw new HttpError(400,'Invalid timezone offset.');
  return {gte:new Date(range.gte.getTime()+offsets[0]*60000),lt:new Date(range.lt.getTime()+offsets[1]*60000)};
}
