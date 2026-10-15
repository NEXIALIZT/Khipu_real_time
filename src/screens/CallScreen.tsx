import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, Platform, Modal, ScrollView } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useKeepAwake } from 'expo-keep-awake';
import { useAppStore } from '../store/useAppStore';
import { useShallow } from 'zustand/react/shallow';
import { HistoryList } from '../components/HistoryList';
import { FlagIcon } from '../components/FlagIcon';
import { SUPPORTED_LANGUAGES } from '../types/types';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';

export const CallScreen: React.FC = () => {
  useKeepAwake();
  const { 
    room, 
    currentUser, 
    participants,
    activeOriginalText, 
    activeTranslations,
    translations, 
    isRecording, 
    startRecording, 
    stopRecording, 
    leaveRoom,
    ttsEnabled,
    toggleTts,
    error,
    setError
  } = useAppStore(useShallow(state => ({
    room: state.room, 
    currentUser: state.currentUser, 
    participants: state.participants,
    activeOriginalText: state.activeOriginalText, 
    activeTranslations: state.activeTranslations,
    translations: state.translations, 
    isRecording: state.isRecording, 
    startRecording: state.startRecording, 
    stopRecording: state.stopRecording, 
    leaveRoom: state.leaveRoom,
    ttsEnabled: state.ttsEnabled,
    toggleTts: state.toggleTts,
    error: state.error,
    setError: state.setError
  })));

  const copyToClipboard = async (text: string) => {
    await Clipboard.setStringAsync(text);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  };

  const [isMuted, setIsMuted] = useState(!isRecording);
  const [showQR, setShowQR] = useState(false);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [error, setError]);

  // El otro participante (o el propio si es el único por ahora)
  const otherParticipant = participants.find(p => p.id !== currentUser?.id) || participants[0];

  useEffect(() => {
    setIsMuted(!isRecording);
  }, [isRecording]);

  const handleToggleMute = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    if (isRecording) {
      stopRecording();
    } else {
      startRecording(true); // Pasamos true para asegurar envío rápido en call
    }
  };

  const handleToggleSpeaker = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    toggleTts(!ttsEnabled);
  };

  const handleEndCall = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    leaveRoom();
  };

  const myLang = currentUser?.language || 'es';
  const lastTranslation = translations?.[0];
  
  // Determinamos la traducción principal a mostrar
  let displayedTranslation = activeTranslations[myLang];
  if (!displayedTranslation) {
    displayedTranslation = activeOriginalText;
  }
  if (!displayedTranslation && lastTranslation) {
    displayedTranslation = lastTranslation.translations[myLang] || lastTranslation.originalText;
  }

  // Determinamos el subtítulo original para no perderlo al parar de hablar
  let displayedOriginal = activeOriginalText;
  let isFromMe = isRecording && activeOriginalText.length > 0;

  if (!activeOriginalText && lastTranslation) {
    displayedOriginal = lastTranslation.originalText;
    isFromMe = lastTranslation.senderId === currentUser?.id;
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        
        {/* Cabecera estilizada */}
        <View style={styles.header}>
          <View style={styles.headerTopRow}>
            <View style={styles.roomBadge}>
              <Text style={styles.roomBadgeLabel}>SALA</Text>
              <Text style={styles.roomCode}>{room?.code}</Text>
            </View>
            <TouchableOpacity onPress={() => setShowQR(true)} style={styles.qrBtn} activeOpacity={0.7}>
              <MaterialCommunityIcons name="qrcode-scan" size={20} color="#FAFAFA" />
            </TouchableOpacity>
          </View>

          <View style={styles.statusBadge}>
            <View style={[styles.statusDot, { backgroundColor: participants.length > 1 ? '#10B981' : '#F59E0B' }]} />
            <Text style={styles.statusText}>
              {participants.length > 1 ? 'Conectado' : 'Esperando al interlocutor...'}
            </Text>
          </View>
        </View>

        {error && (
          <View style={styles.errorContainer}>
            <Feather name="alert-circle" size={16} color="#F87171" style={{ marginRight: 8 }} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <ScrollView contentContainerStyle={styles.scrollContent} style={styles.scrollView}>
          {/* Avatar Central */}
          <View style={styles.avatarContainer}>
            <View style={[styles.avatarCircle, !isMuted && styles.avatarCircleActive]}>
              {otherParticipant?.name ? (
                <Text style={styles.avatarInitial}>
                  {otherParticipant.name.charAt(0).toUpperCase()}
                </Text>
              ) : (
                <Feather name="user" size={48} color="#FAFAFA" />
              )}
            </View>
            <Text style={styles.callerName}>{otherParticipant?.name || 'Invitado'}</Text>
            {otherParticipant?.language ? (
              <View style={styles.callerLangPill}>
                <FlagIcon code={otherParticipant.language} size={13} style={{ marginRight: 6 }} />
                <Text style={styles.callerLangText}>
                  {SUPPORTED_LANGUAGES.find(l => l.code === otherParticipant.language)?.name || otherParticipant.language}
                </Text>
              </View>
            ) : null}
            <View style={styles.callerStatusPill}>
              <Feather name={!isMuted ? "mic" : "mic-off"} size={12} color={!isMuted ? "#10B981" : "#71717A"} />
              <Text style={[styles.callerStatusText, !isMuted && { color: '#10B981' }]}>
                {!isMuted ? 'Transmitiendo voz' : 'Silenciado'}
              </Text>
            </View>
          </View>

          {/* Tarjeta de Traducción en Vivo */}
          <View style={styles.translationContainer}>
            <View style={styles.translationHeader}>
              <Feather name="globe" size={14} color="#818CF8" />
              <Text style={styles.translationLabel}>Traducción en tiempo real</Text>
            </View>
            {displayedTranslation ? (
              <Text style={styles.translatedText}>{displayedTranslation}</Text>
            ) : (
              <Text style={styles.placeholderText}>La conversación traducida aparecerá aquí...</Text>
            )}
            {displayedOriginal && isFromMe ? (
              <Text style={styles.originalSubtitle}>Tú: {displayedOriginal}</Text>
            ) : null}
          </View>

          {/* Historial de la Llamada */}
          <View style={styles.historySection}>
            <Text style={styles.historyTitle}>Historial de Llamada</Text>
            <HistoryList translations={translations} copyToClipboard={copyToClipboard} />
          </View>
        </ScrollView>

        {/* Controles de Llamada (Fijos al fondo) */}
        <View style={styles.controlsContainer}>
          <View style={styles.controlItem}>
            <TouchableOpacity 
              style={[styles.controlBtn, !isMuted ? styles.controlBtnActive : styles.controlBtnMuted]} 
              onPress={handleToggleMute}
              activeOpacity={0.8}
            >
              <Feather 
                name={isMuted ? "mic-off" : "mic"} 
                size={26} 
                color={!isMuted ? "#09090B" : "#A1A1AA"} 
              />
            </TouchableOpacity>
            <Text style={[styles.controlLabel, !isMuted && styles.controlLabelActive]}>
              {isMuted ? 'Silenciado' : 'Micrófono'}
            </Text>
          </View>

          <View style={styles.controlItem}>
            <TouchableOpacity 
              style={[styles.controlBtn, styles.endCallBtn]} 
              onPress={handleEndCall}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons name="phone-hangup" size={32} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={[styles.controlLabel, { color: '#EF4444' }]}>Finalizar</Text>
          </View>

          <View style={styles.controlItem}>
            <TouchableOpacity 
              style={[styles.controlBtn, ttsEnabled ? styles.controlBtnSpeakerOn : styles.controlBtnMuted]} 
              onPress={handleToggleSpeaker}
              activeOpacity={0.8}
            >
              <Feather 
                name={ttsEnabled ? "volume-2" : "volume-x"} 
                size={26} 
                color={ttsEnabled ? "#FAFAFA" : "#71717A"} 
              />
            </TouchableOpacity>
            <Text style={[styles.controlLabel, ttsEnabled && styles.controlLabelActive]}>
              {ttsEnabled ? 'Altavoz' : 'Silencio'}
            </Text>
          </View>
        </View>

      </View>

      {/* Modal del QR */}
      <Modal visible={showQR} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.qrModalContent}>
            <Text style={styles.qrModalTitle}>Escanea para Llamar</Text>
            <Text style={styles.qrModalSubtitle}>
              Apunta la cámara de otro dispositivo aquí para unirte a esta llamada automáticamente.
            </Text>
            <View style={styles.qrContainer}>
              <QRCode value={`call:${room?.code || ''}`} size={220} />
            </View>
            <Text style={styles.qrModalCode}>{room?.code}</Text>
            <TouchableOpacity style={styles.closeQrBtn} onPress={() => setShowQR(false)} activeOpacity={0.7}>
              <Text style={styles.closeQrBtnText}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#09090B', // Zinc 950
  },
  container: {
    flex: 1,
    paddingTop: Platform.OS === 'web' ? 24 : 12,
  },
  scrollView: {
    flex: 1,
    width: '100%',
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 40,
    alignItems: 'center',
    maxWidth: 600,
    width: '100%',
    alignSelf: 'center',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.25)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
    marginHorizontal: 24,
    marginTop: 12,
  },
  errorText: {
    color: '#F87171',
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  header: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    alignItems: 'center',
    gap: 8,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  roomBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#18181B',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#27272A',
    gap: 8,
  },
  roomBadgeLabel: {
    color: '#71717A',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  roomCode: {
    color: '#FAFAFA',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 2,
  },
  qrBtn: {
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
    borderRadius: 14,
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(24, 24, 27, 0.6)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
    borderWidth: 1,
    borderColor: '#27272A',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    color: '#A1A1AA',
    fontSize: 12,
    fontWeight: '600',
  },
  avatarContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 24,
  },
  avatarCircle: {
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: '#18181B',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#27272A',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 6,
  },
  avatarCircleActive: {
    borderColor: '#10B981',
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    shadowColor: '#10B981',
    shadowOpacity: 0.35,
    shadowRadius: 20,
  },
  avatarInitial: {
    fontSize: 54,
    color: '#FAFAFA',
    fontWeight: '800',
  },
  callerName: {
    color: '#FAFAFA',
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  callerLangPill: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#09090B',
    borderWidth: 1,
    borderColor: '#27272A',
  },
  callerLangText: {
    fontSize: 12,
    color: '#A1A1AA',
    fontWeight: '700',
  },
  callerStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
  },
  callerStatusText: {
    fontSize: 11,
    color: '#71717A',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  translationContainer: {
    minHeight: 120,
    width: '100%',
    backgroundColor: '#18181B',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: '#27272A',
    marginBottom: 24,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 4,
  },
  translationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  translationLabel: {
    color: '#818CF8',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  historySection: {
    width: '100%',
    backgroundColor: '#18181B',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: '#27272A',
  },
  historyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FAFAFA',
    marginBottom: 16,
    letterSpacing: -0.3,
  },
  translatedText: {
    color: '#FAFAFA',
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 32,
  },
  originalSubtitle: {
    color: '#A1A1AA',
    fontSize: 14,
    marginTop: 12,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  placeholderText: {
    color: '#71717A',
    fontSize: 15,
    textAlign: 'center',
    fontWeight: '500',
  },
  controlsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'center',
    paddingVertical: 18,
    paddingHorizontal: 24,
    borderTopWidth: 1,
    borderTopColor: '#27272A',
    backgroundColor: '#09090B',
  },
  controlItem: {
    alignItems: 'center',
    gap: 8,
  },
  controlBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 68,
    height: 68,
    borderRadius: 34,
  },
  controlBtnMuted: {
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
  },
  controlBtnActive: {
    backgroundColor: '#FAFAFA',
    borderWidth: 1,
    borderColor: '#FAFAFA',
    shadowColor: '#FAFAFA',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
  },
  controlBtnSpeakerOn: {
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#3F3F46',
  },
  endCallBtn: {
    backgroundColor: '#EF4444',
    borderWidth: 1,
    borderColor: '#EF4444',
    width: 76,
    height: 76,
    borderRadius: 38,
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 16,
    elevation: 8,
  },
  controlLabel: {
    color: '#71717A',
    fontSize: 12,
    fontWeight: '700',
  },
  controlLabelActive: {
    color: '#FAFAFA',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  qrModalContent: {
    backgroundColor: '#18181B',
    borderRadius: 32,
    padding: 32,
    alignItems: 'center',
    width: '100%',
    maxWidth: 360,
    borderWidth: 1,
    borderColor: '#27272A',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 10,
  },
  qrModalTitle: {
    color: '#FAFAFA',
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  qrModalSubtitle: {
    color: '#A1A1AA',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  qrContainer: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 20,
    marginBottom: 20,
  },
  qrModalCode: {
    color: '#FAFAFA',
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: 6,
    marginBottom: 24,
  },
  closeQrBtn: {
    backgroundColor: '#27272A',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 16,
    width: '100%',
    alignItems: 'center',
  },
  closeQrBtnText: {
    color: '#FAFAFA',
    fontSize: 16,
    fontWeight: '700',
  },
});
