export declare class PasswordHasherService {
    hash(password: string): Promise<string>;
    compare(hash: string, password_raw: string): Promise<boolean>;
}
