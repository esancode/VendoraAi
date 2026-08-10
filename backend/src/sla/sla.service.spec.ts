import { Test, TestingModule } from '@nestjs/testing';
import { SlaService } from './sla.service';
import { toZonedTime, formatInTimeZone } from 'date-fns-tz';

describe('SlaService', () => {
  let service: SlaService;
  const TIMEZONE = 'America/Sao_Paulo';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SlaService],
    }).compile();

    service = module.get<SlaService>(SlaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('calculateSlaLimit', () => {
    it('should calculate limit correctly within the same business day', () => {
      // Monday 10:00 AM (Sao Paulo time)
      const startDateStr = '2026-08-10T10:00:00-03:00';
      const startDate = new Date(startDateStr);
      
      const result = service.calculateSlaLimit(startDate, 30);
      
      // Should be 10:30 AM
      expect(formatInTimeZone(result, TIMEZONE, 'yyyy-MM-dd HH:mm:ss')).toBe('2026-08-10 10:30:00');
    });

    it('should push to next business day if SLA breaches end of day', () => {
      // Monday 17:55 (Sao Paulo time)
      const startDateStr = '2026-08-10T17:55:00-03:00';
      const startDate = new Date(startDateStr);
      
      // 10 minutes SLA. 5 minutes today, 5 minutes tomorrow (from 08:00)
      const result = service.calculateSlaLimit(startDate, 10);
      
      // Should be Tuesday 08:05 AM
      expect(formatInTimeZone(result, TIMEZONE, 'yyyy-MM-dd HH:mm:ss')).toBe('2026-08-11 08:05:00');
    });

    it('should push over the weekend', () => {
      // Friday 17:55 (Sao Paulo time)
      const startDateStr = '2026-08-14T17:55:00-03:00'; // Aug 14 2026 is a Friday
      const startDate = new Date(startDateStr);
      
      // 10 minutes SLA
      const result = service.calculateSlaLimit(startDate, 10);
      
      // Should be Monday 08:05 AM
      expect(formatInTimeZone(result, TIMEZONE, 'yyyy-MM-dd HH:mm:ss')).toBe('2026-08-17 08:05:00');
    });

    it('should handle messages received during weekend', () => {
      // Saturday 10:00 AM
      const startDateStr = '2026-08-15T10:00:00-03:00';
      const startDate = new Date(startDateStr);
      
      const result = service.calculateSlaLimit(startDate, 30);
      
      // Should start counting from Monday 08:00 AM, so limit is 08:30 AM
      expect(formatInTimeZone(result, TIMEZONE, 'yyyy-MM-dd HH:mm:ss')).toBe('2026-08-17 08:30:00');
    });

    it('should handle messages received outside business hours (before 8 AM)', () => {
      // Monday 06:00 AM
      const startDateStr = '2026-08-10T06:00:00-03:00';
      const startDate = new Date(startDateStr);
      
      const result = service.calculateSlaLimit(startDate, 30);
      
      // Should start counting from 08:00 AM
      expect(formatInTimeZone(result, TIMEZONE, 'yyyy-MM-dd HH:mm:ss')).toBe('2026-08-10 08:30:00');
    });
  });

  describe('calculateUsefulResponseTime', () => {
    it('should calculate time correctly within same day', () => {
      const start = new Date('2026-08-10T10:00:00-03:00');
      const end = new Date('2026-08-10T10:30:00-03:00');
      
      const seconds = service.calculateUsefulResponseTime(start, end);
      expect(seconds).toBe(30 * 60); // 30 minutes in seconds
    });

    it('should discount non-business hours', () => {
      // Monday 17:55 to Tuesday 08:05
      const start = new Date('2026-08-10T17:55:00-03:00');
      const end = new Date('2026-08-11T08:05:00-03:00');
      
      const seconds = service.calculateUsefulResponseTime(start, end);
      // 5 min on monday + 5 min on tuesday = 10 min
      expect(seconds).toBe(10 * 60);
    });

    it('should discount weekend completely', () => {
      // Friday 17:55 to Monday 08:05
      const start = new Date('2026-08-14T17:55:00-03:00');
      const end = new Date('2026-08-17T08:05:00-03:00');
      
      const seconds = service.calculateUsefulResponseTime(start, end);
      expect(seconds).toBe(10 * 60);
    });

    it('should handle if both times fall into the same weekend block', () => {
      // Saturday 10:00 to Saturday 15:00
      const start = new Date('2026-08-15T10:00:00-03:00');
      const end = new Date('2026-08-15T15:00:00-03:00');
      
      const seconds = service.calculateUsefulResponseTime(start, end);
      expect(seconds).toBe(0);
    });
  });
});
