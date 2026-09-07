import { Counter } from '../model/counter.model.js';
import { sessionCode } from '../../../shared/domain.js';
import type { Session } from '../../../shared/domain.js';

const counterKeyFor = (session: Session): string =>
  session === 'SESSION_1' ? 'ticket_sequence_81' : 'ticket_sequence_82';

export const nextTicketId = async (session: Session): Promise<string> => {
  const counter = await Counter.findOneAndUpdate(
    { key: counterKeyFor(session) },
    { $inc: { sequence: 1 } },
    { returnDocument: 'after', upsert: true }
  );

  if (!counter) {
    throw new Error(`Failed to allocate a ticket sequence for ${session}`);
  }

  const sequence = counter.sequence.toString().padStart(4, '0');
  return `TEDXIITP-26-${sessionCode(session)}-${sequence}`;
};
