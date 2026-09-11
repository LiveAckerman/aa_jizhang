import type { ActionResponse } from 'adminjs'

type SerializedRecord = {
  params?: Record<string, unknown>
  populated?: Record<string, SerializedRecord | null>
}

const stripRecordFields = (
  record: SerializedRecord | undefined,
  fields: readonly string[],
): void => {
  if (!record) return
  for (const field of fields) delete record.params?.[field]
  for (const populated of Object.values(record.populated ?? {})) {
    if (populated) stripRecordFields(populated, fields)
  }
}

export const sanitizeActionResponse = (
  response: ActionResponse,
  fields: readonly string[],
): ActionResponse => {
  stripRecordFields(response.record as SerializedRecord | undefined, fields)
  for (const record of response.records ?? []) {
    stripRecordFields(record as SerializedRecord, fields)
  }
  return response
}
