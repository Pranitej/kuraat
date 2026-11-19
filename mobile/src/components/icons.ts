/**
 * The Lucide icons the app uses — imported one by one so the bundle carries these, not all ~1,600.
 * Add an icon here (same name as in lucide-react-native) before using it anywhere else.
 */
import { createElement } from 'react';
import { I18nManager } from 'react-native';
import type { LucideIcon, LucideProps } from 'lucide-react-native';
import ChevronLeftBase from 'lucide-react-native/icons/chevron-left';
import ChevronRightBase from 'lucide-react-native/icons/chevron-right';

export type { LucideIcon, LucideProps };

/** Back / forward arrows point the other way in right-to-left (Arabic). */
function mirrored(Icon: LucideIcon): LucideIcon {
  const Mirrored = (props: LucideProps) => createElement(Icon, { ...props, style: [props.style, I18nManager.isRTL ? { transform: [{ scaleX: -1 }] } : null] } as LucideProps);
  return Mirrored as unknown as LucideIcon;
}

export { default as Banknote } from 'lucide-react-native/icons/banknote';
export { default as Bell } from 'lucide-react-native/icons/bell';
export { default as BellOff } from 'lucide-react-native/icons/bell-off';
export { default as Check } from 'lucide-react-native/icons/check';
export { default as ChevronDown } from 'lucide-react-native/icons/chevron-down';
export { default as ChevronUp } from 'lucide-react-native/icons/chevron-up';
export const ChevronLeft = mirrored(ChevronLeftBase);
export const ChevronRight = mirrored(ChevronRightBase);
export { default as Languages } from 'lucide-react-native/icons/languages';
export { default as CircleCheck } from 'lucide-react-native/icons/circle-check';
export { default as Clock } from 'lucide-react-native/icons/clock';
export { default as CloudOff } from 'lucide-react-native/icons/cloud-off';
export { default as CreditCard } from 'lucide-react-native/icons/credit-card';
export { default as Eye } from 'lucide-react-native/icons/eye';
export { default as EyeOff } from 'lucide-react-native/icons/eye-off';
export { default as Gift } from 'lucide-react-native/icons/gift';
export { default as Heart } from 'lucide-react-native/icons/heart';
export { default as Info } from 'lucide-react-native/icons/info';
export { default as KeyRound } from 'lucide-react-native/icons/key-round';
export { default as ListFilter } from 'lucide-react-native/icons/list-filter';
export { default as LocateFixed } from 'lucide-react-native/icons/locate-fixed';
export { default as Lock } from 'lucide-react-native/icons/lock';
export { default as LogOut } from 'lucide-react-native/icons/log-out';
export { default as Mail } from 'lucide-react-native/icons/mail';
export { default as MapPin } from 'lucide-react-native/icons/map-pin';
export { default as MapPinOff } from 'lucide-react-native/icons/map-pin-off';
export { default as Maximize } from 'lucide-react-native/icons/maximize';
export { default as Minimize2 } from 'lucide-react-native/icons/minimize-2';
export { default as Minus } from 'lucide-react-native/icons/minus';
export { default as Navigation } from 'lucide-react-native/icons/navigation';
export { default as Package } from 'lucide-react-native/icons/package';
export { default as PackageSearch } from 'lucide-react-native/icons/package-search';
export { default as PackageX } from 'lucide-react-native/icons/package-x';
export { default as Pencil } from 'lucide-react-native/icons/pencil';
export { default as Phone } from 'lucide-react-native/icons/phone';
export { default as Plus } from 'lucide-react-native/icons/plus';
export { default as ReceiptText } from 'lucide-react-native/icons/receipt-text';
export { default as RefreshCw } from 'lucide-react-native/icons/refresh-cw';
export { default as Search } from 'lucide-react-native/icons/search';
export { default as SearchX } from 'lucide-react-native/icons/search-x';
export { default as Share2 } from 'lucide-react-native/icons/share-2';
export { default as ShoppingBag } from 'lucide-react-native/icons/shopping-bag';
export { default as Store } from 'lucide-react-native/icons/store';
export { default as Tag } from 'lucide-react-native/icons/tag';
export { default as Trash2 } from 'lucide-react-native/icons/trash-2';
export { default as TriangleAlert } from 'lucide-react-native/icons/triangle-alert';
export { default as Truck } from 'lucide-react-native/icons/truck';
export { default as User } from 'lucide-react-native/icons/user';
export { default as WifiOff } from 'lucide-react-native/icons/wifi-off';
export { default as X } from 'lucide-react-native/icons/x';
export { default as ZoomIn } from 'lucide-react-native/icons/zoom-in';
export { default as ZoomOut } from 'lucide-react-native/icons/zoom-out';
