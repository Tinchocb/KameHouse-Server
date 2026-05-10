import { z as zod, ZodTypeAny } from "zod"
import { schemaPresets } from "./schema-presets"

/* -------------------------------------------------------------------------------------------------
 * Helper type
 * -----------------------------------------------------------------------------------------------*/

export type InferType<S extends ZodTypeAny> = zod.infer<S>

/* -------------------------------------------------------------------------------------------------
 * Helper functions
 * -----------------------------------------------------------------------------------------------*/

type DataSchemaCallback<S extends zod.ZodRawShape> = ({ z, presets }: {
    z: typeof zod,
    presets: typeof schemaPresets
}) => zod.ZodObject<S>

export const defineSchema = <S extends zod.ZodRawShape>(callback: DataSchemaCallback<S>): zod.ZodObject<S> => {
    return callback({ z: zod, presets: schemaPresets })
}
