/**
 * The PDF's stand-in fonts (Source Sans 3 + Noto Sans Arabic). The production brand font is
 * Bahij TheSansArabic (licensed) — swap the files here and FONT_FAMILY in theme.ts when it arrives.
 * Loaded at start while the native splash is showing; same family names on Android, iOS and Expo Go.
 */
import { NotoSansArabic_500Medium, NotoSansArabic_700Bold } from '@expo-google-fonts/noto-sans-arabic';
import {
  SourceSans3_400Regular,
  SourceSans3_500Medium,
  SourceSans3_600SemiBold,
  SourceSans3_700Bold,
} from '@expo-google-fonts/source-sans-3';
import { useFonts } from 'expo-font';

const FONTS = {
  SourceSans3_400Regular,
  SourceSans3_500Medium,
  SourceSans3_600SemiBold,
  SourceSans3_700Bold,
  NotoSansArabic_500Medium,
  NotoSansArabic_700Bold,
};

/** True once the fonts are ready (or failed — the app then falls back to the system font). */
export function useAppFonts(): boolean {
  const [loaded, error] = useFonts(FONTS);
  return loaded || Boolean(error);
}
