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
            {/* `visible` truyền tiếp xuống slot: trên iOS Modal còn render children một
                lúc (có khi mãi) sau khi đã ẩn, và slot của một Modal vô hình mà giành
                được lớp phủ thì mọi thông báo biến mất. Xem UIOverlaySlot. */}
            <UIOverlaySlot active={props.visible !== false}>{children}</UIOverlaySlot>
        </Modal>
    );
}
