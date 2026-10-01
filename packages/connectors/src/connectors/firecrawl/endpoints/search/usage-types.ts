// T106 file split (300-line ceiling): the search endpoint's shared body type,
// inferred from the endpoint's schema so the usage fns keep their contextual
// types after the split.
import type { zSearchBody } from './schema/inputs.ts'
import type z from 'zod'


export type SearchBody = z.infer<typeof zSearchBody>
