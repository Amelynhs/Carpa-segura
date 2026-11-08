import React, { useRef, useState } from 'react';
import { Modal, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { Hermenegildo } from '../components/Hermenegildo';
import { Body, PastelButton } from '../components/ui';
import { colors, radii, rounded } from '../theme/theme';

/** Opción A: escaneo del QR otpauth:// con la cámara. */
export function ScannerModal({ visible, onClose, onUri }: { visible: boolean; onClose: () => void; onUri: (uri: string) => Promise<void> }) {
  const [perm, ask] = useCameraPermissions();
  const [msg, setMsg] = useState<string | null>(null);
  const busy = useRef(false);

  async function onScan(data: string) {
    if (busy.current) return;
    busy.current = true;
    try {
      await onUri(data);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setMsg(null);
      onClose();
    } catch (e: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setMsg(e?.message ?? 'QR no válido');
      setTimeout(() => (busy.current = false), 1800);
      return;
    }
    busy.current = false;
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: '#2d2548' }}>
        {perm?.granted ? (
          <CameraView
            style={{ flex: 1 }}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={({ data }) => onScan(data)}
          />
        ) : (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 16 }}>
            <Hermenegildo size={130} mood="shock" />
            <Text style={{ fontFamily: rounded, fontSize: 20, fontWeight: '800', color: '#fff', textAlign: 'center' }}>Necesito tu cámara para leer el QR</Text>
            <Body style={{ color: '#d8ccf5', textAlign: 'center' }}>Solo se usa para leer el código; la imagen nunca sale del teléfono.</Body>
            <PastelButton title="Permitir cámara" onPress={() => ask()} />
          </View>
        )}

        {perm?.granted && (
          <View pointerEvents="none" style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, alignItems: 'center', justifyContent: 'center' }}>
            <View style={{ width: 250, height: 250, borderRadius: radii.xl, borderWidth: 5, borderColor: colors.pink }} />
            <Text style={{ marginTop: 18, color: '#fff', fontFamily: rounded, fontWeight: '800', fontSize: 15 }}>Apunta al QR de otpauth://</Text>
          </View>
        )}

        {msg && (
          <View style={{ position: 'absolute', top: 70, left: 20, right: 20, backgroundColor: colors.dangerBg, padding: 14, borderRadius: 18 }}>
            <Text style={{ color: colors.danger, fontFamily: rounded, fontWeight: '700', textAlign: 'center' }}>{msg}</Text>
          </View>
        )}
        <View style={{ position: 'absolute', bottom: 44, left: 40, right: 40 }}>
          <PastelButton title="Cerrar" variant="ghost" onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}
