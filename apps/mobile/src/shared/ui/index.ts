// Componentes compartidos (tarea 3.7). Tabla componente → base Obelisco → props → estados: README.md.
export { Alert, alertPalette, type AlertProps, type AlertRole, type AlertVariant } from './Alert';
export {
  Badge,
  badgePalette,
  type BadgeProps,
  type BadgeSize,
  type BadgeTone,
  type BadgeVariant,
} from './Badge';
export {
  Button,
  hitSlopFor,
  type ButtonProps,
  type ButtonSize,
  type ButtonVariant,
} from './Button';
export { Card, type CardProps } from './Card';
export { Chip, type ChipProps } from './Chip';
export { EmptyState, type EmptyStateProps } from './EmptyState';
export { ErrorState, type ErrorStateProps } from './ErrorState';
export {
  formatAge,
  FreshnessLabel,
  freshnessLevel,
  VERY_STALE_SECONDS,
  type FreshnessLabelProps,
  type FreshnessLevel,
} from './FreshnessLabel';
export { triggerHaptic, type HapticKind } from './haptics';
export { LineBadge, type LineBadgeProps, type LineBadgeSize } from './LineBadge';
export {
  BOARD,
  Board,
  boardStatusLabel,
  boardStatusPalette,
  type BoardLayout,
  type BoardNoteTone,
  type BoardProps,
  type BoardRowProps,
  type BoardStatusProps,
  type BoardStatusTone,
} from './Board';
export {
  Pictogram,
  PICTOGRAM_RADIUS,
  pictogramPalette,
  type PictogramProps,
  type PictogramSize,
  type PictogramTone,
} from './Pictogram';
export { OFFLINE_MESSAGE, OfflineBanner, type OfflineBannerProps } from './OfflineBanner';
export { SearchInput, type SearchInputProps } from './SearchInput';
export {
  SegmentedControl,
  Tabs,
  type SegmentedControlProps,
  type SegmentOption,
} from './SegmentedControl';
export {
  Snackbar,
  SnackbarProvider,
  SNACKBAR_ACTION_DURATION_MS,
  SNACKBAR_DURATION_MS,
  SNACKBAR_FADE_MS,
  useSnackbar,
  type ShowSnackbarOptions,
  type SnackbarAction,
  type SnackbarController,
  type SnackbarProps,
} from './Snackbar';
export {
  SIGN_BAND,
  SignBand,
  signBandPalette,
  type SignBandProps,
  type SignBandStatus,
  type SignBandStatusTone,
  type SignBandVariant,
} from './SignBand';
export { Skeleton, SkeletonGroup, type SkeletonGroupProps, type SkeletonProps } from './Skeleton';
export { STATUS, StatusChip, type StatusChipProps, type StatusInfo } from './StatusChip';
export { Text, type TextProps, type TextTone } from './Text';
export { useReduceMotion } from './useReduceMotion';
