import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, Text, View } from 'react-native';
import { useAccounts } from '../auth/useAccounts';
import { generateTotp } from '../crypto/native';
import { Hermenegildo, type Mood } from '../components/Hermenegildo';
import { Body, CodeBoxes, GlassCard, H1, PastelButton } from '../components/ui';
import { colors, rounded } from '../theme/theme';

export interface StepUpResult {
  ok: boolean;
  message?: string;
}

/** Modal de 2FA que aparece al capturar el 403 mfa_required. */
export function StepUpModal({
  visible,
  onCancel,
  onSubmit,
}: {
  visible: boolean;
  onCancel: () => void;
  onSubmit: (code: string) => Promise<StepUpResult>;
}) {
  const { accounts } = useAccounts();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mood, setMood] = useState<Mood>('happy');

  useEffect(() => {
    if (visible) {
      setCode('');
      setError(null);
      setMood('happy');
    }
  }, [visible]);

  async function submit(c: string) {
    if (busy) return;
    setBusy(true);
    setError(null);
    const r = await onSubmit(c);
    setBusy(false);
    if (!r.ok) {
      setError(r.message ?? 'No se pudo verificar');
      setMood(r.message?.includes('Replay') ? 'shock' : 'sad');
      setCode('');
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <View style={{ flex: 1, backgroundColor: 'rgba(74,63,107,0.45)', justifyContent: 'flex-end' }}>
        <Pressable style={{ flex: 1 }} onPress={onCancel} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <GlassCard tint="#fffdfb" style={{ borderBottomLeftRadius: 0, borderBottomRightRadius: 0, borderTopLeftRadius: 36, borderTopRightRadius: 36, paddingBottom: 34, alignItems: 'center' }}>
            <View style={{ marginTop: -86 }}>
              <Hermenegildo size={120} mood={mood} holdLock />
            </View>
            <H1 style={{ textAlign: 'center', marginTop: 4 }}>Verificación en dos pasos</H1>
            <Body style={{ textAlign: 'center', marginTop: 6, marginBottom: 18 }}>
              La bóveda exige un segundo factor. Ingresa el código de 6 dígitos de tu Authenticator.
            </Body>

            <CodeBoxes value={code} onChange={setCode} onComplete={submit} error={!!error} />

            {error && (
              <View style={{ backgroundColor: colors.dangerBg, padding: 10, borderRadius: 14, marginTop: 14 }}>
                <Text style={{ color: colors.danger, fontFamily: rounded, fontWeight: '700', textAlign: 'center' }}>{error}</Text>
              </View>
            )}

            <View style={{ width: '100%', gap: 10, marginTop: 20 }}>
              <PastelButton title="Verificar" icon="🗝️" onPress={() => submit(code)} disabled={code.length !== 6} loading={busy} />
              {accounts.length > 0 && (
                <PastelButton
                  title="Usar mi Authenticator"
                  variant="ghost"
                  icon="🔢"
                  onPress={async () => {
                    const c = await generateTotp(accounts[0].secret);
                    setCode(c);
                  }}
                />
              )}
              <PastelButton title="Cancelar" variant="ghost" onPress={onCancel} />
            </View>
          </GlassCard>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}
