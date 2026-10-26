import type { BinaryWriteOptions } from "@protobuf-ts/runtime";
import type { IBinaryWriter } from "@protobuf-ts/runtime";
import type { BinaryReadOptions } from "@protobuf-ts/runtime";
import type { IBinaryReader } from "@protobuf-ts/runtime";
import type { PartialMessage } from "@protobuf-ts/runtime";
import type { JsonValue } from "@protobuf-ts/runtime";
import type { JsonReadOptions } from "@protobuf-ts/runtime";
import type { JsonWriteOptions } from "@protobuf-ts/runtime";
import { MessageType } from "@protobuf-ts/runtime";
export interface Timestamp {
    /**
     * Represents seconds of UTC time since Unix epoch
     * 1970-01-01T00:00:00Z. Must be from 0001-01-01T00:00:00Z to
     * 9999-12-31T23:59:59Z inclusive.
     *
     * @generated from protobuf field: int64 seconds = 1;
     */
    seconds: bigint;
    /**
     * Non-negative fractions of a second at nanosecond resolution. Negative
     * second values with fractions must still have non-negative nanos values
     * that count forward in time. Must be from 0 to 999,999,999
     * inclusive.
     *
     * @generated from protobuf field: int32 nanos = 2;
     */
    nanos: number;
}
declare class Timestamp$Type extends MessageType<Timestamp> {
    constructor();
    /**
     * Creates a new 'Timestamp' for the current time.
     */
    now(): Timestamp;
    /**
     * Converts a 'Timestamp' to a JavaScript Date.
     */
    toDate(message: Timestamp): Date;
    /**
     * Converts a JavaScript Date to a 'Timestamp'.
     */
    fromDate(date: Date): Timestamp;
    /**
     * In JSON format, the 'Timestamp' type is encoded as a string
     * in the RFC 3339 format.
     */
    internalJsonWrite(message: Timestamp, options: JsonWriteOptions): JsonValue;
    /**
     * In JSON format, the 'Timestamp' type is encoded as a string
     * in the RFC 3339 format.
     */
    internalJsonRead(json: JsonValue, options: JsonReadOptions, target?: Timestamp): Timestamp;
    create(value?: PartialMessage<Timestamp>): Timestamp;
    internalBinaryRead(reader: IBinaryReader, length: number, options: BinaryReadOptions, target?: Timestamp): Timestamp;
    internalBinaryWrite(message: Timestamp, writer: IBinaryWriter, options: BinaryWriteOptions): IBinaryWriter;
}
/**
 * @generated MessageType for protobuf message rootsdk.Timestamp
 */
export declare const Timestamp: Timestamp$Type;
export {};
