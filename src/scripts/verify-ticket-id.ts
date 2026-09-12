import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Types } from 'mongoose';
import { Ticket } from '../features/qr/model/ticket.model.js';
import {
  allocateTicket,
  resetTicketIdCache,
  TicketIdSpaceExhaustedError,
} from '../features/qr/service/ticket-id.service.js';
import type { TicketDraft } from '../features/qr/service/ticket-id.service.js';
import type { Session } from '../shared/domain.js';

let failures = 0;

const check = (label: string, actual: unknown, expected: unknown): void => {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  const ok = a === e;
  if (!ok) failures += 1;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${ok ? '' : `\n         expected ${e}\n         actual   ${a}`}`);
};

const draft = (ticketId: string, over: Partial<TicketDraft> = {}): TicketDraft => ({
  ticketId,
  registrationId: null,
  email: `${ticketId}@example.com`,
  name: null,
  userId: `${ticketId}@example.com`,
  session: 'SESSION_1',
  transactionId: '',
  qrToken: `token-${ticketId}`,
  status: 'ACTIVE',
  isCheckedIn: false,
  ...over,
});

const tail = (ticketId: string): number => Number(ticketId.slice(-4));

const seed = async (session: Session, sequences: number[]): Promise<void> => {
  const code = session === 'SESSION_1' ? '81' : '82';
  for (const n of sequences) {
    const id = `TEDXIITP-26-${code}-${n.toString().padStart(4, '0')}`;
    await Ticket.create(draft(id, { session }));
  }
};

const fresh = async (): Promise<void> => {
  await Ticket.deleteMany({});
  resetTicketIdCache();
};

const main = async (): Promise<void> => {
  const mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri(), { dbName: 'ticketid' });
  await Ticket.syncIndexes();

  console.log('\n1. fills gaps left by burned numbers');
  await fresh();
  await seed('SESSION_1', [1, 2, 5]);
  resetTicketIdCache();
  const filled: number[] = [];
  for (let i = 0; i < 3; i += 1) {
    const t = await allocateTicket('SESSION_1', (id) => draft(id, { email: `gap${i}@x.com` }));
    filled.push(tail(t.ticketId));
  }
  check('next three ids fill 3, 4, 6', filled, [3, 4, 6]);

  console.log('\n2. sessions allocate independently');
  await fresh();
  await seed('SESSION_1', [1, 2, 3]);
  resetTicketIdCache();
  const s1 = await allocateTicket('SESSION_1', (id) => draft(id, { email: 's1@x.com' }));
  const s2 = await allocateTicket('SESSION_2', (id) =>
    draft(id, { session: 'SESSION_2', email: 's2@x.com' })
  );
  check('session 1 continues at 4', tail(s1.ticketId), 4);
  check('session 2 starts at 1', tail(s2.ticketId), 1);
  check('session 1 prefix kept', s1.ticketId.startsWith('TEDXIITP-26-81-'), true);
  check('session 2 prefix kept', s2.ticketId.startsWith('TEDXIITP-26-82-'), true);

  console.log('\n3. concurrent allocation never collides');
  await fresh();
  const concurrent = await Promise.all(
    Array.from({ length: 20 }, (_, i) =>
      allocateTicket('SESSION_1', (id) => draft(id, { email: `c${i}@x.com` }))
    )
  );
  const ids = concurrent.map((t) => tail(t.ticketId)).sort((a, b) => a - b);
  check('20 allocations produce 20 unique ids', new Set(ids).size, 20);
  check('ids are dense 1..20', ids, Array.from({ length: 20 }, (_, i) => i + 1));
  check('all four digits wide', concurrent.every((t) => t.ticketId.slice(-4).length === 4), true);

  console.log('\n4. a failed insert does NOT burn the number');
  await fresh();
  await seed('SESSION_1', [1]);
  resetTicketIdCache();
  let threw = '';
  try {
    await allocateTicket('SESSION_1', (id) => {
      const bad = draft(id, { email: 'bad@x.com' });
      return { ...bad, qrToken: '' };
    });
  } catch (error) {
    threw = error instanceof Error ? error.name : 'unknown';
  }
  check('validation error propagates', threw, 'ValidationError');
  const recovered = await allocateTicket('SESSION_1', (id) => draft(id, { email: 'good@x.com' }));
  check('number 2 was released and reused', tail(recovered.ticketId), 2);

  console.log('\n5. a registration conflict is not mistaken for an id conflict');
  await fresh();
  const regId = new Types.ObjectId();
  await Ticket.create(
    draft('TEDXIITP-26-81-0001', { registrationId: regId, email: 'dup@x.com' })
  );
  resetTicketIdCache();
  let conflictName = '';
  try {
    await allocateTicket('SESSION_1', (id) =>
      draft(id, { registrationId: regId, email: 'dup2@x.com' })
    );
  } catch (error) {
    conflictName = (error as { code?: number }).code === 11000 ? 'duplicate-key' : 'other';
  }
  check('duplicate registration surfaces to caller', conflictName, 'duplicate-key');
  const afterConflict = await allocateTicket('SESSION_1', (id) =>
    draft(id, { email: 'after@x.com' })
  );
  check('its number was released, not spent', tail(afterConflict.ticketId), 2);

  console.log('\n6. production gap pattern');
  await fresh();
  const used1 = [
    ...Array.from({ length: 163 }, (_, i) => i + 1),
    166,
    480,
    ...Array.from({ length: 81 }, (_, i) => 636 + i),
  ];
  await seed('SESSION_1', used1);
  resetTicketIdCache();
  check('seeded count matches production', await Ticket.countDocuments({ session: 'SESSION_1' }), 246);
  const nextReal = await allocateTicket('SESSION_1', (id) => draft(id, { email: 'real@x.com' }));
  check('next live session 1 id is 0164', nextReal.ticketId, 'TEDXIITP-26-81-0164');

  console.log('\n7. exhaustion is a typed error, not a hang');
  await fresh();
  await seed('SESSION_2', [1]);
  resetTicketIdCache();
  const pool = await allocateTicket('SESSION_2', (id) =>
    draft(id, { session: 'SESSION_2', email: 'pool@x.com' })
  );
  check('sanity: allocation works before exhausting', tail(pool.ticketId), 2);
  const bulk = Array.from({ length: 9999 }, (_, i) => i + 1).map((n) => ({
    ...draft(`TEDXIITP-26-82-${n.toString().padStart(4, '0')}`, {
      session: 'SESSION_2',
      email: `bulk${n}@x.com`,
    }),
  }));
  await Ticket.deleteMany({ session: 'SESSION_2' });
  await Ticket.insertMany(bulk);
  resetTicketIdCache();
  let exhausted = '';
  try {
    await allocateTicket('SESSION_2', (id) =>
      draft(id, { session: 'SESSION_2', email: 'over@x.com' })
    );
  } catch (error) {
    exhausted = error instanceof TicketIdSpaceExhaustedError ? 'typed' : 'untyped';
  }
  check('full range throws TicketIdSpaceExhaustedError', exhausted, 'typed');

  console.log('\n8. stale cache from another serverless instance');
  await fresh();
  await seed('SESSION_1', [1, 2]);
  resetTicketIdCache();
  await allocateTicket('SESSION_1', (id) => draft(id, { email: 'warm@x.com' }));
  await Ticket.create(draft('TEDXIITP-26-81-0004', { email: 'other-instance@x.com' }));
  const afterStale = await allocateTicket('SESSION_1', (id) =>
    draft(id, { email: 'stale@x.com' })
  );
  check('skips the id another instance took', tail(afterStale.ticketId), 5);
  check('no duplicate ticket ids exist', (await Ticket.distinct('ticketId')).length, 5);

  await mongoose.disconnect();
  await mongo.stop();

  console.log(failures === 0 ? '\nALL CHECKS PASSED\n' : `\n${failures} CHECK(S) FAILED\n`);
  process.exit(failures === 0 ? 0 : 1);
};

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
