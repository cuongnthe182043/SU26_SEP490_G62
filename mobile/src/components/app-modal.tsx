import { Modal, type ModalProps } from 'react-native';

import { UIOverlaySlot } from '@/providers/ui-provider';

/**
 * Modal của app — dùng thay cho `Modal` của react-native ở mọi nơi.
 *
 * Modal native là một cửa sổ riêng nằm trên mọi View, nên toast / hộp xác nhận / thông
 * báo (useToast, useConfirm, useAppAlert — là View vẽ ở gốc app) bị che mất sau lưng nó.
 * AppModal cho các lớp phủ đó vẽ vào bên trong Modal đang nằm trên cùng.
 */
export function AppModal({ children, ...props }: ModalProps) {
    return (
        <Modal {...props}>
            <UIOverlaySlot>{children}</UIOverlaySlot>
        </Modal>
    );
}
