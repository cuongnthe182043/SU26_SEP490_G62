import { Pressable, StyleSheet } from 'react-native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { Text, XStack } from 'tamagui';
import { appTheme } from '@/theme/app-theme';

type Props = {
  page:       number;
  totalPages: number;
  total:      number;
  totalLabel?: string;
  onPrev:     () => void;
  onNext:     () => void;
  onPage:     (p: number) => void;
  disabled:   boolean;
};

export function PaginationBar({
  page, totalPages, total, totalLabel = 'mục',
  onPrev, onNext, onPage, disabled,
}: Props) {
  if (totalPages <= 1) return null;

  const getPageNumbers = (): number[] => {
    const maxVisible = 5;
    let start = Math.max(1, page - Math.floor(maxVisible / 2));
    let end   = start + maxVisible - 1;
    if (end > totalPages) { end = totalPages; start = Math.max(1, end - maxVisible + 1); }
    const pages: number[] = [];
    for (let i = start; i <= end; i++) pages.push(i);
    return pages;
  };

  return (
    <XStack
      alignItems="center"
      justifyContent="center"
      paddingVertical={14}
      gap={6}
      borderTopWidth={1}
      borderTopColor={appTheme.colors.border}
      backgroundColor={appTheme.colors.background}
    >
      <Pressable
        onPress={onPrev}
        disabled={disabled || page <= 1}
        style={[s.btn, (disabled || page <= 1) && s.btnDisabled]}
        hitSlop={8}
      >
        <ChevronLeft
          size={16}
          color={page <= 1 ? appTheme.colors.border : appTheme.colors.primary}
        />
      </Pressable>

      {getPageNumbers().map((p) => (
        <Pressable
          key={p}
          onPress={() => onPage(p)}
          disabled={disabled || p === page}
          style={[s.btn, p === page && s.btnActive]}
          hitSlop={6}
        >
          <Text
            fontSize={13}
            fontWeight={p === page ? '900' : '600'}
            color={p === page ? '#fff' : appTheme.colors.textMuted}
          >
            {p}
          </Text>
        </Pressable>
      ))}

      <Pressable
        onPress={onNext}
        disabled={disabled || page >= totalPages}
        style={[s.btn, (disabled || page >= totalPages) && s.btnDisabled]}
        hitSlop={8}
      >
        <ChevronRight
          size={16}
          color={page >= totalPages ? appTheme.colors.border : appTheme.colors.primary}
        />
      </Pressable>

      <Text fontSize={11} color={appTheme.colors.textMuted} marginLeft={4}>
        {total} {totalLabel}
      </Text>
    </XStack>
  );
}

const s = StyleSheet.create({
  btn: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: appTheme.colors.border,
    backgroundColor: appTheme.colors.surface,
  },
  btnActive: {
    backgroundColor: appTheme.colors.primary,
    borderColor:     appTheme.colors.primary,
  },
  btnDisabled: {
    borderColor:     appTheme.colors.border,
    backgroundColor: appTheme.colors.surfaceSoft,
  },
});
