"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SlaService = void 0;
const common_1 = require("@nestjs/common");
const date_fns_1 = require("date-fns");
const date_fns_tz_1 = require("date-fns-tz");
let SlaService = class SlaService {
    timezone = 'America/Sao_Paulo';
    startHour = 8;
    endHour = 18;
    calculateSlaLimit(startDate, slaDurationMinutes) {
        let currentDate = (0, date_fns_tz_1.toZonedTime)(startDate, this.timezone);
        let remainingMinutes = slaDurationMinutes;
        currentDate = this.adjustToBusinessHours(currentDate);
        while (remainingMinutes > 0) {
            const endOfDay = (0, date_fns_1.setMilliseconds)((0, date_fns_1.setSeconds)((0, date_fns_1.setMinutes)((0, date_fns_1.setHours)(currentDate, this.endHour), 0), 0), 0);
            const availableMinutesToday = (0, date_fns_1.differenceInSeconds)(endOfDay, currentDate) / 60;
            if (remainingMinutes <= availableMinutesToday) {
                currentDate = (0, date_fns_1.addMinutes)(currentDate, remainingMinutes);
                remainingMinutes = 0;
            }
            else {
                remainingMinutes -= availableMinutesToday;
                currentDate = this.getNextBusinessDay(currentDate);
                currentDate = (0, date_fns_1.setMilliseconds)((0, date_fns_1.setSeconds)((0, date_fns_1.setMinutes)((0, date_fns_1.setHours)(currentDate, this.startHour), 0), 0), 0);
            }
        }
        return (0, date_fns_tz_1.fromZonedTime)(currentDate, this.timezone);
    }
    calculateUsefulResponseTime(startDate, endDate) {
        let startZoned = (0, date_fns_tz_1.toZonedTime)(startDate, this.timezone);
        let endZoned = (0, date_fns_tz_1.toZonedTime)(endDate, this.timezone);
        if ((0, date_fns_1.isAfter)(startZoned, endZoned)) {
            return 0;
        }
        startZoned = this.adjustToBusinessHours(startZoned);
        endZoned = this.adjustToBusinessHours(endZoned);
        if (startZoned.getTime() >= endZoned.getTime()) {
            return 0;
        }
        let totalSeconds = 0;
        let current = startZoned;
        while (current.getTime() < endZoned.getTime()) {
            const endOfDay = (0, date_fns_1.setMilliseconds)((0, date_fns_1.setSeconds)((0, date_fns_1.setMinutes)((0, date_fns_1.setHours)(current, this.endHour), 0), 0), 0);
            if (endZoned.getTime() <= endOfDay.getTime()) {
                totalSeconds += (0, date_fns_1.differenceInSeconds)(endZoned, current);
                break;
            }
            else {
                totalSeconds += (0, date_fns_1.differenceInSeconds)(endOfDay, current);
                current = this.getNextBusinessDay(current);
                current = (0, date_fns_1.setMilliseconds)((0, date_fns_1.setSeconds)((0, date_fns_1.setMinutes)((0, date_fns_1.setHours)(current, this.startHour), 0), 0), 0);
            }
        }
        return totalSeconds;
    }
    adjustToBusinessHours(date) {
        let current = new Date(date.getTime());
        if ((0, date_fns_1.isWeekend)(current)) {
            current = this.getNextBusinessDay(current);
            current = (0, date_fns_1.setMilliseconds)((0, date_fns_1.setSeconds)((0, date_fns_1.setMinutes)((0, date_fns_1.setHours)(current, this.startHour), 0), 0), 0);
            return current;
        }
        const startOfDay = (0, date_fns_1.setMilliseconds)((0, date_fns_1.setSeconds)((0, date_fns_1.setMinutes)((0, date_fns_1.setHours)(current, this.startHour), 0), 0), 0);
        const endOfDay = (0, date_fns_1.setMilliseconds)((0, date_fns_1.setSeconds)((0, date_fns_1.setMinutes)((0, date_fns_1.setHours)(current, this.endHour), 0), 0), 0);
        if ((0, date_fns_1.isBefore)(current, startOfDay)) {
            return startOfDay;
        }
        if (current.getTime() >= endOfDay.getTime()) {
            current = this.getNextBusinessDay(current);
            return (0, date_fns_1.setMilliseconds)((0, date_fns_1.setSeconds)((0, date_fns_1.setMinutes)((0, date_fns_1.setHours)(current, this.startHour), 0), 0), 0);
        }
        return current;
    }
    getNextBusinessDay(date) {
        const newDate = new Date(date.getTime());
        newDate.setDate(newDate.getDate() + 1);
        if ((0, date_fns_1.getDay)(newDate) === 6) {
            newDate.setDate(newDate.getDate() + 2);
        }
        else if ((0, date_fns_1.getDay)(newDate) === 0) {
            newDate.setDate(newDate.getDate() + 1);
        }
        return newDate;
    }
};
exports.SlaService = SlaService;
exports.SlaService = SlaService = __decorate([
    (0, common_1.Injectable)()
], SlaService);
//# sourceMappingURL=sla.service.js.map