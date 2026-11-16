import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

const SIZE = 256;

/**
 * Profile photo: pick from the gallery (system photo picker — no storage permission on Android
 * 13+ or iOS), centre-crop to a square and shrink to a 256 px JPEG data URL — the same result as the
 * web's resizeImage, well under the server's 300 KB limit. Null when the customer cancels.
 */
export async function pickAvatar(): Promise<string | null> {
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 1 });
  if (result.canceled || !result.assets?.length) return null;
  const { uri, width, height } = result.assets[0];
  const side = Math.min(width, height);
  const context = ImageManipulator.manipulate(uri);
  if (width !== height) context.crop({ originX: (width - side) / 2, originY: (height - side) / 2, width: side, height: side });
  context.resize({ width: SIZE, height: SIZE });
  const image = await context.renderAsync();
  const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.85, base64: true });
  return saved.base64 ? `data:image/jpeg;base64,${saved.base64}` : null;
}
