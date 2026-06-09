import { cashCollectionService } from '@/services/cash-collection-service';
import { apiClient }              from '@/lib/api-client';

jest.mock('@/lib/api-client');

const mockApi = apiClient as jest.Mocked<typeof apiClient>;

describe('cashCollectionService', () => {
    beforeEach(() => jest.clearAllMocks());

    describe('getMyCollections', () => {
        it('G62-FE-75: getMyCollections() → GET /api/cash-collections/me không filter', async () => {
            mockApi.get = jest.fn().mockResolvedValue({
                collections: [{ id: 1, amount: '500000', status: 'pending' }],
            });

            const result = await cashCollectionService.getMyCollections();

            expect(mockApi.get).toHaveBeenCalledWith('/api/cash-collections/me');
            expect(Array.isArray(result.collections)).toBe(true);
        });

        it('G62-FE-76: getMyCollections({status:"pending"}) → URL có ?status=pending', async () => {
            mockApi.get = jest.fn().mockResolvedValue({ collections: [] });

            await cashCollectionService.getMyCollections({ status: 'pending' });

            const url: string = (mockApi.get as jest.Mock).mock.calls[0][0];
            expect(url).toContain('status=pending');
        });
    });

    describe('getSummary', () => {
        it('G62-FE-77: getSummary() → GET /api/cash-collections/summary', async () => {
            mockApi.get = jest.fn().mockResolvedValue({
                pending_count:    '2',
                pending_amount:   '1500000',
                confirmed_count:  '5',
                confirmed_amount: '3000000',
                rejected_count:   '0',
                converted_count:  '1',
            });

            const result = await cashCollectionService.getSummary();

            expect(mockApi.get).toHaveBeenCalledWith('/api/cash-collections/summary');
            expect(result.pending_count).toBe('2');
        });
    });

    describe('getById', () => {
        it('G62-FE-78: getById(3) → GET /api/cash-collections/3', async () => {
            mockApi.get = jest.fn().mockResolvedValue({
                collection: { id: 3, amount: '500000' },
            });

            await cashCollectionService.getById(3);

            expect(mockApi.get).toHaveBeenCalledWith('/api/cash-collections/3');
        });
    });

    describe('create', () => {
        it('G62-FE-79: create(payload) → POST /api/cash-collections multipart với receipt', async () => {
            mockApi.postForm = jest.fn().mockResolvedValue({
                message:    'OK',
                collection: { id: 10, status: 'pending' },
            });

            const appendSpy = jest.spyOn(FormData.prototype, 'append');

            const result = await cashCollectionService.create({
                amount:        500000,
                receiptUri:    'file://receipt.jpg',
                paymentMethod: 'cash',
            });

            expect(mockApi.postForm).toHaveBeenCalledWith('/api/cash-collections', expect.any(FormData));
            const appendedKeys = appendSpy.mock.calls.map(c => c[0]);
            expect(appendedKeys).toContain('amount');
            expect(appendedKeys).toContain('receipt');
            expect(result.collection.status).toBe('pending');

            appendSpy.mockRestore();
        });

        it('G62-FE-80: create với shipmentId=5 → formData có "shipmentId"="5"', async () => {
            mockApi.postForm = jest.fn().mockResolvedValue({ message: 'OK', collection: {} });

            const appendSpy = jest.spyOn(FormData.prototype, 'append');

            await cashCollectionService.create({
                amount:     200000,
                receiptUri: 'file://r.jpg',
                shipmentId: 5,
            });

            const appendedKeys = appendSpy.mock.calls.map(c => c[0]);
            expect(appendedKeys).toContain('shipmentId');

            const shipmentCall = appendSpy.mock.calls.find(c => c[0] === 'shipmentId');
            expect(shipmentCall?.[1]).toBe('5');

            appendSpy.mockRestore();
        });
    });
});
