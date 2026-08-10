export declare class SlaService {
    private readonly timezone;
    private readonly startHour;
    private readonly endHour;
    calculateSlaLimit(startDate: Date, slaDurationMinutes: number): Date;
    calculateUsefulResponseTime(startDate: Date, endDate: Date): number;
    private adjustToBusinessHours;
    private getNextBusinessDay;
}
