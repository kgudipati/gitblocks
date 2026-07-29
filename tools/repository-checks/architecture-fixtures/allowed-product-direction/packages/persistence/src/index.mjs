import { createHash } from 'node:crypto';
import postgres from 'postgres';

import { contractValue } from '../../contracts/index.mjs';

export const persistenceValue = `${contractValue}-${typeof postgres}-${createHash('sha256').digest('hex')}`;
