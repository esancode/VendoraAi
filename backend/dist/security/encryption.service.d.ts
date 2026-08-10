export declare class EncryptionService {
    private readonly algorithm;
    private readonly key;
    constructor();
    encrypt(plainText: string): string;
    decrypt(cipherText: string): string;
    encryptDeterministic(plainText: string): string;
}
