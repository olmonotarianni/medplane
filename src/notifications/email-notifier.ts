import { LoiteringEvent } from '../types';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class EmailNotifier {
    private static instance: EmailNotifier;

    private constructor() { }

    public static getInstance(): EmailNotifier {
        if (!EmailNotifier.instance) {
            EmailNotifier.instance = new EmailNotifier();
        }
        return EmailNotifier.instance;
    }

    public initialize(): void {
        // No initialization needed for sendmail
    }


    public async sendEmail(options: { to: string, subject: string, body: string }): Promise<void> {
        await execAsync(`echo "${options.body}" | sendmail -f noreply@medplane.com ${options.to}`);
    }
}
