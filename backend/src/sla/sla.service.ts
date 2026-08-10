import { Injectable } from '@nestjs/common';
import { addMinutes, differenceInSeconds, isWeekend, setHours, setMinutes, setSeconds, setMilliseconds, isBefore, isAfter, getDay } from 'date-fns';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';

@Injectable()
export class SlaService {
  private readonly timezone = 'America/Sao_Paulo';
  private readonly startHour = 8;
  private readonly endHour = 18;

  /**
   * Calculates the SLA limit date based on business hours.
   * Business hours: Mon-Fri, 08:00 - 18:00 (America/Sao_Paulo).
   * 
   * @param startDate The start date (e.g. when customer message was received)
   * @param slaDurationMinutes The SLA duration in minutes
   * @returns The exact date when the SLA is breached
   */
  calculateSlaLimit(startDate: Date, slaDurationMinutes: number): Date {
    let currentDate = toZonedTime(startDate, this.timezone);
    let remainingMinutes = slaDurationMinutes;

    // Adjust start date to business hours if it's outside
    currentDate = this.adjustToBusinessHours(currentDate);

    while (remainingMinutes > 0) {
      const endOfDay = setMilliseconds(setSeconds(setMinutes(setHours(currentDate, this.endHour), 0), 0), 0);
      
      const availableMinutesToday = differenceInSeconds(endOfDay, currentDate) / 60;

      if (remainingMinutes <= availableMinutesToday) {
        currentDate = addMinutes(currentDate, remainingMinutes);
        remainingMinutes = 0;
      } else {
        remainingMinutes -= availableMinutesToday;
        // Move to the next business day
        currentDate = this.getNextBusinessDay(currentDate);
        currentDate = setMilliseconds(setSeconds(setMinutes(setHours(currentDate, this.startHour), 0), 0), 0);
      }
    }

    return fromZonedTime(currentDate, this.timezone);
  }

  /**
   * Calculates the useful response time in seconds between two dates,
   * considering only business hours.
   */
  calculateUsefulResponseTime(startDate: Date, endDate: Date): number {
    let startZoned = toZonedTime(startDate, this.timezone);
    let endZoned = toZonedTime(endDate, this.timezone);

    if (isAfter(startZoned, endZoned)) {
      return 0; // Invalid inputs or same time
    }

    startZoned = this.adjustToBusinessHours(startZoned);
    endZoned = this.adjustToBusinessHours(endZoned);
    
    // If after adjusting both are the same, they both fell into the same non-business period
    if (startZoned.getTime() >= endZoned.getTime()) {
      return 0;
    }

    let totalSeconds = 0;
    let current = startZoned;

    while (current.getTime() < endZoned.getTime()) {
      const endOfDay = setMilliseconds(setSeconds(setMinutes(setHours(current, this.endHour), 0), 0), 0);
      
      // If endZoned is on the same day and before endOfDay
      if (endZoned.getTime() <= endOfDay.getTime()) {
        totalSeconds += differenceInSeconds(endZoned, current);
        break;
      } else {
        totalSeconds += differenceInSeconds(endOfDay, current);
        // Move to next business day
        current = this.getNextBusinessDay(current);
        current = setMilliseconds(setSeconds(setMinutes(setHours(current, this.startHour), 0), 0), 0);
      }
    }

    return totalSeconds;
  }

  private adjustToBusinessHours(date: Date): Date {
    let current = new Date(date.getTime()); // copy
    
    // If weekend, move to next Monday at 08:00
    if (isWeekend(current)) {
      current = this.getNextBusinessDay(current);
      current = setMilliseconds(setSeconds(setMinutes(setHours(current, this.startHour), 0), 0), 0);
      return current;
    }

    const startOfDay = setMilliseconds(setSeconds(setMinutes(setHours(current, this.startHour), 0), 0), 0);
    const endOfDay = setMilliseconds(setSeconds(setMinutes(setHours(current, this.endHour), 0), 0), 0);

    // If before 08:00, move to 08:00 today
    if (isBefore(current, startOfDay)) {
      return startOfDay;
    }

    // If after 18:00, move to 08:00 next business day
    if (current.getTime() >= endOfDay.getTime()) {
      current = this.getNextBusinessDay(current);
      return setMilliseconds(setSeconds(setMinutes(setHours(current, this.startHour), 0), 0), 0);
    }

    return current;
  }

  private getNextBusinessDay(date: Date): Date {
    const newDate = new Date(date.getTime());
    newDate.setDate(newDate.getDate() + 1);
    
    // 0 = Sunday, 6 = Saturday
    if (getDay(newDate) === 6) { // Saturday -> Monday
      newDate.setDate(newDate.getDate() + 2);
    } else if (getDay(newDate) === 0) { // Sunday -> Monday
      newDate.setDate(newDate.getDate() + 1);
    }
    
    return newDate;
  }
}
