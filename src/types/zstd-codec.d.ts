declare module 'zstd-codec' {
    export class ZstdCodec {
        static run(): Promise<ZstdCodec>;
        decompress(data: Uint8Array): Uint8Array;
    }
}
