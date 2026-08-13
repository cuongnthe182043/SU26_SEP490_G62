/**
 * Màn "Chuyển khoản" của kế toán — nút xác nhận nhận tiền.
 *
 * Bug đã sửa: modal xác nhận không có ô nhập số tiền thực nhận nên luôn gọi API với
 * actual_amount rỗng, trong khi backend (accountantBankTransferService) BẮT BUỘC trường
 * này và ném lỗi "Vui lòng nhập số tiền thực nhận". Kết quả là bấm bao nhiêu lần cũng
 * không xác nhận được — kế toán không có cách nào hoàn tất thao tác trên màn này.
 *
 * Số tiền phải cho SỬA chứ không gửi cứng theo phiếu: kế toán đối chiếu sao kê, khách có
 * thể chuyển thiếu/thừa và backend dựa vào con số này để ghi công nợ hoặc phân bổ phần dư.
 */
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { BankTransferView } from '../../src/pages/Accountant/views/BankTransferView';
import { accountantService } from '../../src/pages/Accountant/services/accountant.service';

vi.mock('../../src/pages/Accountant/services/accountant.service', () => ({
  accountantService: {
    getPendingBankTransfers: vi.fn(),
    confirmBankTransfer: vi.fn(),
  },
}));

vi.mock('../../src/components/shared-ui/Toast', () => ({
  notify: { success: vi.fn(), error: vi.fn() },
}));

// confirmDialog là modal lồng trong modal — trong test cho nó đồng ý luôn để tập trung
// kiểm tra dữ liệu gửi lên API.
vi.mock('../../src/components/shared-ui/confirm', () => ({
  confirmDialog: vi.fn(() => Promise.resolve(true)),
}));

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query) => ({
    matches: false, media: query, onchange: null,
    addListener: vi.fn(), removeListener: vi.fn(),
    addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn(),
  }),
});

const RECEIPT = {
  receipt_id: 100005,
  amount: '200000.00',
  customer_name: 'Quân',
  driver_name: 'Phạm Văn Tiền',
  plate_number: '51E-123.45',
  pickup_address: 'Hồ Tây',
  delivery_address: 'Tây Tựu',
  collected_at: '2026-08-13T17:37:44.648Z',
  proof_urls: [],
};

const openConfirmModal = async () => {
  render(<BankTransferView />);
  await screen.findByText('Quân');
  fireEvent.click(screen.getByRole('button', { name: /Xác nhận/i }));
  await screen.findByText('Xác nhận nhận tiền chuyển khoản');
};

describe('BankTransferView — xác nhận nhận tiền', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    accountantService.getPendingBankTransfers.mockResolvedValue({
      receipts: [RECEIPT],
      pagination: { total: 1, page: 1, limit: 20, totalPages: 1 },
    });
    accountantService.confirmBankTransfer.mockResolvedValue({ action: 'exact' });
  });

  it('gửi kèm số tiền thực nhận — thiếu trường này backend từ chối, bấm mãi không xong', async () => {
    await openConfirmModal();
    fireEvent.click(screen.getByRole('button', { name: /Xác nhận đã nhận tiền/i }));

    await waitFor(() => expect(accountantService.confirmBankTransfer).toHaveBeenCalled());
    const [receiptId, , actualAmount] = accountantService.confirmBankTransfer.mock.calls[0];
    expect(receiptId).toBe(100005);
    expect(actualAmount).toBe(200000);
  });

  it('cho sửa số tiền khi khách chuyển thiếu, và gửi đúng số đã sửa', async () => {
    await openConfirmModal();

    const input = screen.getByPlaceholderText(/số tiền đối chiếu trên sao kê/i);
    fireEvent.change(input, { target: { value: '100000' } });

    // Báo trước cho kế toán biết hệ quả trước khi bấm
    expect(screen.getByText(/Khách chuyển thiếu/i)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /Xác nhận đã nhận tiền/i }));
    await waitFor(() => expect(accountantService.confirmBankTransfer).toHaveBeenCalled());
    expect(accountantService.confirmBankTransfer.mock.calls[0][2]).toBe(100000);
  });

  it('bỏ trống số tiền thì khoá nút, không gọi API', async () => {
    await openConfirmModal();

    fireEvent.change(screen.getByPlaceholderText(/số tiền đối chiếu trên sao kê/i), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: /Xác nhận đã nhận tiền/i }));

    expect(accountantService.confirmBankTransfer).not.toHaveBeenCalled();
  });
});
