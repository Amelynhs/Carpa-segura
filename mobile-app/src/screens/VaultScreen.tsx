import React, { useEffect, useRef, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../auth/AuthContext';
import { Hermenegildo, type Mood } from '../components/Hermenegildo';
import { Body, Chip, FadeIn, GlassCard, H1, Label, PastelButton } from '../components/ui';
import { colors, mono, radii, rounded } from '../theme/theme';
import { StepUpModal, type StepUpResult } from './StepUpModal';

interface Secret {
  id: number;
  etiqueta: string;
  valor: string;
  color: 'mint' | 'lavender' | 'pink' | 'sky';
}

const TINT: Record<Secret['color'], string> = { mint: colors.mint, lavender: colors.lav, pink: colors.pink, sky: colors.sky };

export function VaultScreen() {
  const insets = useSafeAreaInsets();
  const { api, elevated, setElevated, log } = useAuth();
  const [data, setData] = useState<Secret[] | null>(null);
  const [asking, setAsking] = useState(false);
  const [loading, setLoading] = useState(false);
  const [mood, setMood] = useState<Mood>('happy');
  const [attack, setAttack] = useState<string | null>(null);

  // Estos dos viven solo en memoria: sirven para la demostración anti-replay.
  const stepUpToken = useRef<string | null>(null);
  const lastCode = useRef<string | null>(null);

  // Al vencer la elevación (10 min) la bóveda se vuelve a cerrar sola.
  useEffect(() => {
    if (!elevated) return setData(null);
    const ms = elevated.expiresAt - Date.now();
    const id = setTimeout(() => {
      setElevated(null);
      setData(null);
      log('warn', 'La sesión elevada expiró: la bóveda se cerró');
    }, Math.max(ms, 0));
    return () => clearTimeout(id);
  }, [elevated, setElevated, log]);

  /** GET /api/boveda-critica. Atrapa el 403 mfa_required y abre el modal de 2FA. */
  async function openVault(useElevated = true) {
    setLoading(true);
    setAttack(null);
    try {
      const r = await api.request('/api/boveda-critica', { tokenOverride: useElevated ? (elevated?.token ?? null) : null });
      if (r.status === 200) {
        setData(r.data.secretos);
        setMood('cool');
      } else if (r.status === 403 && r.data?.error === 'mfa_required') {
        stepUpToken.current = r.data.step_up_token;
        setMood('shock');
        setAsking(true);
      } else if (r.status === 401 && elevated) {
        setElevated(null); // la elevación venció: pedir 2FA otra vez
        log('warn', 'elevated_token vencido: se pedirá el segundo factor');
        await openVault(false); // sin el elevated vencido → 403 → modal 2FA
      }
    } finally {
      setLoading(false);
    }
  }

  /** POST /auth/mfa/verify con step_up_token + código; luego reintenta la bóveda. */
  async function verify(code: string): Promise<StepUpResult> {
    const r = await api.request('/auth/mfa/verify', {
      method: 'POST',
      skipAuth: true,
      body: { step_up_token: stepUpToken.current, code },
    });
    if (r.status === 200) {
      lastCode.current = code;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setElevated({ token: r.data.elevated_token, expiresAt: Date.now() + r.data.expires_in * 1000 });
      log('ok', 'Segundo factor verificado · elevated_token recibido (mfa_verified: true)');
      setAsking(false);
      const v = await api.request('/api/boveda-critica', { tokenOverride: r.data.elevated_token });
      if (v.status === 200) {
        setData(v.data.secretos);
        setMood('cool');
      }
      return { ok: true };
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    if (r.status === 409) return { ok: false, message: 'Replay Attack Detected: ese código ya fue usado' };
    if (r.status === 429) return { ok: false, message: `Demasiados intentos. Espera ${r.data?.retry_after_s ?? 60} s` };
    if (r.status === 401 && r.data?.error === 'invalid_step_up_token') return { ok: false, message: 'El desafío expiró, cierra y vuelve a abrir la bóveda' };
    return { ok: false, message: 'Código incorrecto o fuera de ventana' };
  }

  /** Prueba de aceptación 5: reenviar EXACTAMENTE el mismo código dentro de la ventana. */
  async function replay() {
    if (!stepUpToken.current || !lastCode.current) return;
    const r = await api.request('/auth/mfa/verify', {
      method: 'POST',
      skipAuth: true,
      body: { step_up_token: stepUpToken.current, code: lastCode.current },
    });
    Haptics.notificationAsync(r.status === 409 ? Haptics.NotificationFeedbackType.Warning : Haptics.NotificationFeedbackType.Error);
    setMood(r.status === 409 ? 'shock' : 'sad');
    setAttack(`HTTP ${r.status} · ${r.data?.message ?? r.data?.error ?? 'sin detalle'}`);
  }

  function lock() {
    setElevated(null);
    setData(null);
    setMood('happy');
    setAttack(null);
    log('info', 'Bóveda cerrada manualmente');
  }

  const open = data !== null;

  return (
    <ScrollView contentContainerStyle={{ paddingTop: insets.top + 12, paddingHorizontal: 20, paddingBottom: 150, gap: 16 }} showsVerticalScrollIndicator={false}>
      <FadeIn style={{ alignItems: 'center' }}>
        <Hermenegildo size={150} mood={mood} holdLock={!open} />
        <Label style={{ marginTop: 6 }}>Recurso crítico</Label>
        <H1>{open ? 'Bóveda abierta' : 'Bóveda crítica'}</H1>
        <Chip
          text={open ? '⚡ mfa_verified: true' : '🔒 mfa_verified: false'}
          bg={open ? colors.mint : colors.pink}
          fg={open ? '#2f6b55' : '#9a3a63'}
          style={{ marginTop: 8 }}
        />
      </FadeIn>

      {!open && (
        <FadeIn delay={120}>
          <GlassCard>
            <Body>
              Esta ruta rechaza cualquier access_token estándar con <Text style={{ fontFamily: mono, color: colors.ink }}>403 mfa_required</Text>. Al intentarlo, la app atrapa el error, pide el código TOTP y reintenta con un token elevado.
            </Body>
            <PastelButton title="Abrir la bóveda" icon="🗝️" onPress={() => openVault()} loading={loading} style={{ marginTop: 16 }} />
          </GlassCard>
        </FadeIn>
      )}

      {open && (
        <>
          <View style={{ gap: 12 }}>
            {data!.map((s, i) => (
              <FadeIn key={s.id} delay={i * 110}>
                <View style={{ backgroundColor: TINT[s.color], borderRadius: radii.lg, padding: 18, borderWidth: 3, borderColor: 'rgba(255,255,255,0.9)' }}>
                  <Label style={{ color: colors.ink, opacity: 0.55 }}>{s.etiqueta}</Label>
                  <Text selectable style={{ fontFamily: mono, fontSize: 17, fontWeight: '700', color: colors.ink, marginTop: 6 }}>
                    {s.valor}
                  </Text>
                </View>
              </FadeIn>
            ))}
          </View>

          <FadeIn delay={500}>
            <GlassCard>
              <Label>Laboratorio de ataques · Anti-Replay</Label>
              <Body style={{ marginTop: 6 }}>
                Reenvía al backend el mismo código que acabas de usar. Debe responder 409 Conflict.
              </Body>
              <PastelButton title="Reenviar el código usado" icon="🎭" variant="sunset" onPress={replay} style={{ marginTop: 14 }} />
              {attack && (
                <View style={{ marginTop: 12, backgroundColor: attack.includes('409') ? colors.dangerBg : colors.warnBg, borderRadius: 16, padding: 12 }}>
                  <Text style={{ fontFamily: mono, color: colors.ink, fontSize: 13, textAlign: 'center' }}>{attack}</Text>
                </View>
              )}
              <PastelButton title="Cerrar bóveda" variant="ghost" icon="🔒" onPress={lock} style={{ marginTop: 12 }} />
            </GlassCard>
          </FadeIn>
        </>
      )}

      <StepUpModal visible={asking} onCancel={() => setAsking(false)} onSubmit={verify} />
    </ScrollView>
  );
}
