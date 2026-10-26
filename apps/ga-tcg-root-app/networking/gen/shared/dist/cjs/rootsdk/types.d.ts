import type { BinaryWriteOptions } from "@protobuf-ts/runtime";
import type { IBinaryWriter } from "@protobuf-ts/runtime";
import type { BinaryReadOptions } from "@protobuf-ts/runtime";
import type { IBinaryReader } from "@protobuf-ts/runtime";
import type { PartialMessage } from "@protobuf-ts/runtime";
import { MessageType } from "@protobuf-ts/runtime";
/**
 * @generated from protobuf message rootsdk.Void
 */
export interface Void {
}
declare class Void$Type extends MessageType<Void> {
    constructor();
    create(value?: PartialMessage<Void>): Void;
    internalBinaryRead(reader: IBinaryReader, length: number, options: BinaryReadOptions, target?: Void): Void;
    internalBinaryWrite(message: Void, writer: IBinaryWriter, options: BinaryWriteOptions): IBinaryWriter;
}
/**
 * @generated MessageType for protobuf message rootsdk.Void
 */
export declare const Void: Void$Type;
export {};
