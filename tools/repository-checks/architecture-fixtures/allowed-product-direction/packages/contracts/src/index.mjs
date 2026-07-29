import Ajv from 'ajv';
import { Type } from 'typebox';

import { domainValue } from '../../domain/index.mjs';

export const contractValue = `${domainValue}-${Ajv.name}-${typeof Type}`;
