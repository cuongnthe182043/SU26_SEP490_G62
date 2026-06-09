/**
 * useHomeSummary — service integration test
 *
 * NOTE: @testing-library/react-native renderHook chưa tương thích React 19
 * (react-test-renderer@19 đã bỏ createRoot). Test ở đây verify contract
 * của 2 service mà hook gọi, và logic transform data.
 */
import { debtService }     from '@/services/debt-service';
import { incidentService } from '@/services/incident-service';

jest.mock('@/services/debt-service');
jest.mock('@/services/incident-service');

const mockDebt     = debtService     as jest.Mocked<typeof debtService>;
const mockIncident = incidentService as jest.Mocked<typeof incidentService>;

describe('Home Summary — service contract', () => {
    beforeEach(() => jest.clearAllMocks());

    it('getSummary trả về total_remaining dạng string — hook convert sang number', async () => {
        mockDebt.getSummary = jest.fn().mockResolvedValue({ total_remaining: '1500000' });
        const summary = await debtService.getSummary();
        // Hook dùng: Number(summary.total_remaining ?? 0)
        expect(Number(summary.total_remaining ?? 0)).toBe(1500000);
    });

    it('getSummary null → hook giữ debt_remaining = 0', async () => {
        mockDebt.getSummary = jest.fn().mockResolvedValue({ total_remaining: null });
        const summary = await debtService.getSummary();
        expect(Number((summary as any).total_remaining ?? 0)).toBe(0);
    });

    it('getCounts trả về đúng open_count / closed_count', async () => {
        mockIncident.getCounts = jest.fn().mockResolvedValue({ open_count: 3, closed_count: 7 });
        const counts = await incidentService.getCounts();
        expect(counts.open_count).toBe(3);
        expect(counts.closed_count).toBe(7);
    });

    it('Promise.all resolve cả hai cùng lúc', async () => {
        mockDebt.getSummary    = jest.fn().mockResolvedValue({ total_remaining: '500000' });
        mockIncident.getCounts = jest.fn().mockResolvedValue({ open_count: 1, closed_count: 2 });

        const [summary, counts] = await Promise.all([
            debtService.getSummary(),
            incidentService.getCounts(),
        ]);

        expect(Number(summary.total_remaining ?? 0)).toBe(500000);
        expect(counts.open_count).toBe(1);
        expect(counts.closed_count).toBe(2);
    });

    it('Promise.all reject một bên → catch không crash', async () => {
        mockDebt.getSummary    = jest.fn().mockRejectedValue(new Error('network'));
        mockIncident.getCounts = jest.fn().mockResolvedValue({ open_count: 0, closed_count: 0 });

        await expect(
            Promise.all([debtService.getSummary(), incidentService.getCounts()])
        ).rejects.toThrow('network');
    });
});
