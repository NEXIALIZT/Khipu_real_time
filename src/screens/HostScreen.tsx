import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  Platform,
  TextInput,
  Modal,
  Animated,
  Dimensions,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useAppStore } from '../store/useAppStore';
import { useShallow } from 'zustand/react/shallow';
import { AudioWave } from '../components/AudioWave';
import { SUPPORTED_LANGUAGES } from '../types/types';
import { FlagIcon } from '../components/FlagIcon';
import VoiceService from '../services/VoiceService';
import TtsService from '../services/TtsService';
import { useKeepAwake } from 'expo-keep-awake';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import { HistoryList } from '../components/HistoryList';
import { PendingQuestionBanner, ActiveQuestionBanner } from '../components/QuestionBanners';

export const HostScreen: React.FC = () => {
  useKeepAwake();
  const scrollViewRef = useRef<ScrollView>(null);
  const {
    room,
    connectionStatus,
    participants,
    translations,
    isRecording,
    error,
    startRecording,
    stopRecording,
    sendManualText,
    leaveRoom,
    questionState,
    approveQuestion,
    rejectQuestion,
    endQuestion,
    ttsEnabled,
    toggleTts,
    ttsEngine,
    toggleTtsEngine,
    elevenLabsApiKey,
    setElevenLabsApiKey,
    ttsRate,
    changeTtsRate,
    currentUser,
  } = useAppStore(useShallow(state => ({
    room: state.room,
    connectionStatus: state.connectionStatus,
    participants: state.participants,
    translations: state.translations,
    isRecording: state.isRecording,
    error: state.error,
    startRecording: state.startRecording,
    stopRecording: state.stopRecording,
    sendManualText: state.sendManualText,
    leaveRoom: state.leaveRoom,
    questionState: state.questionState,
    approveQuestion: state.approveQuestion,
    rejectQuestion: state.rejectQuestion,
    endQuestion: state.endQuestion,
    ttsEnabled: state.ttsEnabled,
    toggleTts: state.toggleTts,
    ttsEngine: state.ttsEngine,
    toggleTtsEngine: state.toggleTtsEngine,
    elevenLabsApiKey: state.elevenLabsApiKey,
    setElevenLabsApiKey: state.setElevenLabsApiKey,
    ttsRate: state.ttsRate,
    changeTtsRate: state.changeTtsRate,
    currentUser: state.currentUser,
  })));
  const setTtsRate = changeTtsRate;

  const [manualText, setManualText] = useState('');
  const [micStatus, setMicStatus] = useState<'unknown' | 'granted' | 'denied' | 'testing'>(Platform.OS === 'web' ? 'unknown' : 'granted');
  const [engineStatus, setEngineStatus] = useState<'whisper' | 'native' | 'web' | 'none'>('none');
  const [showQR, setShowQR] = useState(false);

  useEffect(() => {
    VoiceService.registerEngineStatusCallback(setEngineStatus);
    return () => {
      if ((VoiceService as any).unregisterEngineStatusCallback) {
        (VoiceService as any).unregisterEngineStatusCallback();
      }
    };
  }, []);

  const copyToClipboard = async (text: string) => {
    await Clipboard.setStringAsync(text);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  };

  const handleSendManualText = () => {
    if (!manualText.trim()) return;
    sendManualText(manualText);
    setManualText('');
  };

  // Prueba directa de permisos del micrófono
  const testMicPermission = async () => {
    setMicStatus('testing');
    try {
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(track => track.stop()); // Liberar el stream inmediatamente
      }
      setMicStatus('granted');
      // Iniciar grabación automáticamente después de obtener el permiso
      startRecording();
    } catch (err: any) {
      console.error('Permiso de micrófono denegado:', err);
      setMicStatus('denied');
    }
  };

  // Wrapper seguro: primero solicita permiso y luego inicia
  const handleStartRecording = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    if (micStatus !== 'granted') {
      await testMicPermission();
    } else {
      startRecording();
    }
  };

  const handleStopRecording = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    stopRecording();
  };

  if (!room) return null;

  // Filtrar participantes que son oyentes (excluir al Host de la lista de asistentes si se desea, o mostrar a todos)
  const assistants = React.useMemo(() => participants.filter((p) => p.role === 'assistant'), [participants]);
  const host = React.useMemo(() => participants.find((p) => p.role === 'host' || p.role === 'caller'), [participants]);

  // Obtener idioma del host
  const hostLangInfo = SUPPORTED_LANGUAGES.find((l) => l.code === host?.language);

  const [showSidebar, setShowSidebar] = useState(false);
  const slideAnim = useRef(new Animated.Value(Dimensions.get('window').width)).current;
  const blinkAnim = useRef(new Animated.Value(0)).current;
  const prevAssistantsLength = useRef(assistants.length);

  useEffect(() => {
    if (assistants.length > prevAssistantsLength.current) {
      Animated.sequence([
        Animated.timing(blinkAnim, { toValue: 1, duration: 200, useNativeDriver: false }),
        Animated.timing(blinkAnim, { toValue: 0, duration: 800, useNativeDriver: false })
      ]).start();
    }
    prevAssistantsLength.current = assistants.length;
  }, [assistants.length]);

  const toggleSidebar = () => {
    const toValue = showSidebar ? Dimensions.get('window').width : 0;
    Animated.timing(slideAnim, {
      toValue,
      duration: 300,
      useNativeDriver: true,
    }).start();
    setShowSidebar(!showSidebar);
  };

  const [showSettingsSidebar, setShowSettingsSidebar] = useState(false);
  const settingsSlideAnim = useRef(new Animated.Value(Dimensions.get('window').width)).current;

  const toggleSettingsSidebar = () => {
    const toValue = showSettingsSidebar ? Dimensions.get('window').width : 0;
    Animated.timing(settingsSlideAnim, {
      toValue,
      duration: 300,
      useNativeDriver: true,
    }).start();
    setShowSettingsSidebar(!showSettingsSidebar);
  };

  const blinkColor = blinkAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['#9CA3AF', '#10B981']
  });

  return (
    <SafeAreaView style={styles.container}>
      {/* Cabecera estilizada */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.roomBadge}>
            <Text style={styles.roomBadgeLabel}>GUÍA</Text>
            <Text style={styles.roomCode}>{room.code}</Text>
          </View>
          <View style={styles.headerButtonsRow}>
            <TouchableOpacity onPress={toggleSettingsSidebar} style={styles.headerBtn} activeOpacity={0.7}>
              <Feather name="settings" size={18} color="#FAFAFA" />
            </TouchableOpacity>
            <TouchableOpacity onPress={toggleSidebar} style={styles.headerBtn} activeOpacity={0.7}>
              <Animated.View>
                <Feather name="users" size={18} color={blinkColor as any} />
              </Animated.View>
              {assistants.length > 0 && (
                <View style={styles.userCountBadge}>
                  <Text style={styles.userCountText}>{assistants.length}</Text>
                </View>
              )}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowQR(true)} style={styles.headerBtn} activeOpacity={0.7}>
              <MaterialCommunityIcons name="qrcode-scan" size={18} color="#FAFAFA" />
            </TouchableOpacity>
          </View>
        </View>
        
        <View style={styles.statusBadgeContainer}>
          <View
            style={[
              styles.statusIndicator,
              {
                backgroundColor:
                  connectionStatus === 'CONNECTED'
                    ? '#10B981'
                    : connectionStatus === 'CONNECTING'
                    ? '#F59E0B'
                    : '#EF4444',
              },
            ]}
          />
          <Text style={styles.statusText}>
            {connectionStatus === 'CONNECTED'
              ? 'En Línea'
              : connectionStatus === 'CONNECTING'
              ? 'Conectando...'
              : 'Desconectado'}
          </Text>
        </View>
      </View>

      <ScrollView 
        contentContainerStyle={styles.scrollContent} 
        style={styles.scrollView}
        ref={scrollViewRef}
      >
        {/* Banner de error general */}
        {error && (
          <View style={styles.errorBanner}>
            <Feather name="alert-circle" size={16} color="#F87171" style={{ marginRight: 8 }} />
            <Text style={styles.errorBannerText}>{error}</Text>
          </View>
        )}

        {/* Banner de Pregunta Pendiente */}
        {questionState.status === 'pending' && (
          <PendingQuestionBanner 
            userName={questionState.userName!} 
            onApprove={() => approveQuestion(questionState.userId!)} 
            onReject={() => rejectQuestion(questionState.userId!)} 
          />
        )}

        {/* Banner de Pregunta Activa */}
        {questionState.status === 'active' && (
          <ActiveQuestionBanner 
            userName={questionState.userName!} 
            startTime={questionState.startTime!} 
            onEnd={endQuestion} 
          />
        )}

        {/* Consola Central de Transmisión */}
        <View style={styles.consoleCard}>
          <View style={styles.consoleHeader}>
            <View style={styles.langPill}>
              <FlagIcon code={hostLangInfo?.code || 'es'} size={14} style={{ marginRight: 6 }} />
              <Text style={styles.langPillText}>
                {hostLangInfo?.name}
              </Text>
            </View>
            {engineStatus !== 'none' && (
              <View style={[
                styles.engineBadge,
                engineStatus === 'whisper' ? styles.engineBadgeWhisper : engineStatus === 'native' ? styles.engineBadgeNative : styles.engineBadgeWeb
              ]}>
                <Text style={[
                  styles.engineBadgeText,
                  engineStatus === 'whisper' ? { color: '#34D399' } : engineStatus === 'native' ? { color: '#FBBF24' } : { color: '#38BDF8' }
                ]}>
                  {engineStatus === 'whisper' ? 'IA PREMIUM' : (engineStatus === 'native' ? 'MODO ESTÁNDAR' : 'WEB API')}
                </Text>
              </View>
            )}
          </View>
          
          <AudioWave isRecording={isRecording} />

          <View style={styles.voiceControlsRow}>
            {!isRecording ? (
              <TouchableOpacity 
                style={[styles.recordButton, questionState.status === 'active' && { opacity: 0.5 }]} 
                onPress={handleStartRecording}
                disabled={questionState.status === 'active'}
                activeOpacity={0.8}
              >
                <Feather name="mic" size={20} color="#09090B" style={{ marginRight: 8 }} />
                <Text style={styles.recordButtonText}>Iniciar Transmisión</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.stopButton} onPress={handleStopRecording} activeOpacity={0.8}>
                <Feather name="square" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                <Text style={styles.stopButtonText}>Detener</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[
                styles.ttsMiniToggle,
                ttsEnabled ? styles.ttsMiniToggleActive : styles.ttsMiniToggleInactive,
              ]}
              onPress={() => toggleTts(!ttsEnabled)}
              activeOpacity={0.8}
            >
              <Feather 
                name={ttsEnabled ? "volume-2" : "volume-x"} 
                size={22} 
                color={ttsEnabled ? "#10B981" : "#71717A"} 
              />
            </TouchableOpacity>
          </View>

          {/* Entrada de texto manual alternativa */}
          <View style={styles.manualInputRow}>
            <TextInput
              style={styles.manualInput}
              placeholder="O escribe un texto y presiona enviar..."
              placeholderTextColor="#64748B"
              value={manualText}
              onChangeText={setManualText}
              onSubmitEditing={handleSendManualText}
            />
            <TouchableOpacity style={styles.manualSendBtn} onPress={handleSendManualText} activeOpacity={0.8}>
              <Feather name="send" size={18} color="#09090B" />
            </TouchableOpacity>
          </View>

          {/* Transcripción en Tiempo Real */}
          <LiveOriginalText />

          {/* Traducciones en Tiempo Real en la consola */}
          <LiveTranslationsBoard />
        </View>

        {/* Sección: Historial de Mensajes */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Historial de la Sesión</Text>
          <HistoryList translations={translations} copyToClipboard={copyToClipboard} />
        </View>

      </ScrollView>

      {/* Botón de Salida Fijo */}
      <View style={styles.footer}>
        <TouchableOpacity style={styles.leaveButton} onPress={leaveRoom} activeOpacity={0.8}>
          <Feather name="log-out" size={18} color="#EF4444" style={{ marginRight: 8 }} />
          <Text style={styles.leaveButtonText}>Finalizar y Cerrar Sala</Text>
        </TouchableOpacity>
      </View>

      {/* Modal del QR */}
      <Modal visible={showQR} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.qrModalContent}>
            <Text style={styles.qrModalTitle}>Escanea para Unirte</Text>
            <Text style={styles.qrModalSubtitle}>Apunta la cámara de otro dispositivo aquí para unirte automáticamente como asistente.</Text>
            <View style={styles.qrContainer}>
              <QRCode value={`guide:${room.code}`} size={220} />
            </View>
            <Text style={styles.qrModalCode}>{room.code}</Text>
            <TouchableOpacity style={styles.closeQrBtn} onPress={() => setShowQR(false)} activeOpacity={0.7}>
              <Text style={styles.closeQrBtnText}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Sidebar de Asistentes */}
      {showSidebar && (
        <TouchableOpacity 
          style={StyleSheet.absoluteFill} 
          activeOpacity={1} 
          onPress={toggleSidebar}
        >
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' }} />
        </TouchableOpacity>
      )}
      
      <Animated.View 
        style={[
          styles.sidebarContainer, 
          { transform: [{ translateX: slideAnim }] }
        ]}
      >
        <SafeAreaView style={{flex: 1}}>
          <View style={styles.sidebarHeader}>
            <Text style={styles.sidebarTitle}>Asistentes ({assistants.length})</Text>
            <TouchableOpacity onPress={toggleSidebar} style={styles.sidebarCloseBtn} activeOpacity={0.7}>
              <Feather name="x" size={20} color="#A1A1AA" />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 20 }}>
            <View style={styles.assistantsList}>
              {assistants.length === 0 ? (
                <Text style={styles.noAssistantsText}>
                  Nadie se ha unido todavía. Comparte el código o proyecta el QR.
                </Text>
              ) : (
                assistants.map((assistant) => {
                  const lang = SUPPORTED_LANGUAGES.find((l) => l.code === assistant.language);
                  return (
                    <View key={assistant.id} style={styles.assistantItem}>
                      <View style={styles.assistantAvatar}>
                        <Feather name="user" size={16} color="#818CF8" />
                      </View>
                      <View style={styles.assistantInfo}>
                        <Text style={styles.assistantName}>{assistant.name}</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 3 }}>
                          <FlagIcon code={assistant.language} size={12} style={{ marginRight: 6 }} />
                          <Text style={styles.assistantLang}>
                            {lang?.name}
                          </Text>
                        </View>
                      </View>
                    </View>
                  );
                })
              )}
            </View>
          </ScrollView>
        </SafeAreaView>
      </Animated.View>

      {/* Sidebar de Ajustes de Voz (TTS) */}
      {showSettingsSidebar && (
        <TouchableOpacity 
          style={StyleSheet.absoluteFill} 
          activeOpacity={1} 
          onPress={toggleSettingsSidebar}
        >
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' }} />
        </TouchableOpacity>
      )}
      
      <Animated.View 
        style={[
          styles.sidebarContainer, 
          { transform: [{ translateX: settingsSlideAnim }] }
        ]}
      >
        <SafeAreaView style={{flex: 1}}>
          <View style={styles.sidebarHeader}>
            <Text style={styles.sidebarTitle}>Ajustes de Voz</Text>
            <TouchableOpacity onPress={toggleSettingsSidebar} style={styles.sidebarCloseBtn} activeOpacity={0.7}>
              <Feather name="x" size={20} color="#A1A1AA" />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 20 }}>
            {ttsEnabled ? (
              <>
                <View style={styles.speedSection}>
                  <Text style={styles.speedLabel}>Motor de Audio (TTS):</Text>
                  <View style={styles.speedOptions}>
                    <TouchableOpacity
                      style={[
                        styles.speedOptionButton,
                        styles.engineOptionButton,
                        ttsEngine === 'standard' && styles.speedOptionActive,
                      ]}
                      onPress={() => toggleTtsEngine('standard')}
                      activeOpacity={0.8}
                    >
                      <Feather name="zap" size={16} color={ttsEngine === 'standard' ? "#09090B" : "#A1A1AA"} style={{ marginBottom: 4 }} />
                      <Text style={[styles.speedOptionText, ttsEngine === 'standard' && styles.speedOptionTextActive]}>
                        Estándar
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.speedOptionButton,
                        styles.engineOptionButton,
                        ttsEngine === 'elevenlabs' && styles.speedOptionActive,
                      ]}
                      onPress={() => toggleTtsEngine('elevenlabs')}
                      activeOpacity={0.8}
                    >
                      <Feather name="cpu" size={16} color={ttsEngine === 'elevenlabs' ? "#09090B" : "#A1A1AA"} style={{ marginBottom: 4 }} />
                      <Text style={[styles.speedOptionText, ttsEngine === 'elevenlabs' && styles.speedOptionTextActive]}>
                        ElevenLabs
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {ttsEngine === 'elevenlabs' && (
                    <View style={styles.apiKeyContainer}>
                      {elevenLabsApiKey && elevenLabsApiKey.length > 10 ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <Feather name="check-circle" size={16} color="#10B981" style={{ marginRight: 8 }} />
                          <Text style={{ color: '#FAFAFA', fontSize: 13, fontWeight: '700', flex: 1 }}>
                            Premium Conectado
                          </Text>
                        </View>
                      ) : (
                        <>
                          <Text style={styles.apiKeyLabel}>Clave API de ElevenLabs:</Text>
                          <TextInput
                            style={styles.apiKeyInput}
                            placeholder="Pega aquí tu clave sk_..."
                            placeholderTextColor="#64748B"
                            value={elevenLabsApiKey}
                            onChangeText={setElevenLabsApiKey}
                            secureTextEntry
                            autoCapitalize="none"
                            autoCorrect={false}
                          />
                        </>
                      )}
                    </View>
                  )}
                </View>

                <TouchableOpacity
                  style={styles.testAudioButton}
                  activeOpacity={0.8}
                  onPress={() => {
                    TtsService.speak(
                      currentUser?.language === 'es' ? 'Prueba de sonido' :
                      currentUser?.language === 'fr' ? 'Test de son' :
                      currentUser?.language === 'pt' ? 'Teste de som' :
                      currentUser?.language === 'zh' ? '声音测试' :
                      'Sound test',
                      currentUser?.language || 'es'
                    );
                  }}
                >
                  <Feather name="volume-2" size={16} color="#FAFAFA" style={{ marginRight: 8 }} />
                  <Text style={styles.testAudioButtonText}>Probar Sonido</Text>
                </TouchableOpacity>

                <View style={styles.speedSection}>
                  <Text style={styles.speedLabel}>Velocidad de Lectura: {ttsRate.toFixed(1)}x</Text>
                  <View style={styles.speedOptions}>
                    {[0.7, 1.0, 1.3, 1.6].map((rate) => {
                      const isSelected = Math.abs(ttsRate - rate) < 0.05;
                      return (
                        <TouchableOpacity
                          key={rate}
                          style={[
                            styles.speedOptionButton,
                            isSelected && styles.speedOptionActive,
                          ]}
                          onPress={() => setTtsRate(rate)}
                          activeOpacity={0.8}
                        >
                          <Text style={[styles.speedOptionText, isSelected && styles.speedOptionTextActive]}>
                            {rate}x
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              </>
            ) : (
              <Text style={{color: '#71717A', textAlign: 'center', marginTop: 24, fontSize: 14}}>
                La lectura de voz está desactivada. Enciende el interruptor de altavoz en la consola central.
              </Text>
            )}
          </ScrollView>
        </SafeAreaView>
      </Animated.View>
    </SafeAreaView>
  );
};


const LiveOriginalText = React.memo(() => {
  const activeOriginalText = useAppStore(s => s.activeOriginalText);
  const isRecording = useAppStore(s => s.isRecording);
  const questionState = useAppStore(s => s.questionState);
  const translations = useAppStore(s => s.translations);
  
  const isVisitorSpeaking = questionState.status === 'active' && activeOriginalText.trim().length > 0;

  let displayedText = activeOriginalText;
  if (!displayedText && translations.length > 0 && isRecording) {
    displayedText = translations[0].originalText;
  }

  return (
    <View style={[styles.liveTranscriptContainer, isVisitorSpeaking && { borderColor: 'rgba(245, 158, 11, 0.4)' }]}>
      <View style={styles.liveLabelRow}>
        <Feather name="mic" size={13} color={isVisitorSpeaking ? "#FBBF24" : "#818CF8"} style={{ marginRight: 6 }} />
        <Text style={[styles.liveLabel, isVisitorSpeaking && { color: '#FBBF24' }]}>
          {isVisitorSpeaking ? `Original (Visitante ${questionState.userName}):` : 'Original (Hablando):'}
        </Text>
      </View>
      <Text style={styles.liveText}>
        {displayedText || (isRecording ? 'Escuchando tu voz...' : 'Micrófono apagado. Presiona Iniciar Transmisión.')}
      </Text>
    </View>
  );
});

const LiveTranslationsBoard = React.memo(() => {
  const activeOriginalText = useAppStore(s => s.activeOriginalText);
  const activeTranslations = useAppStore(s => s.activeTranslations);
  const translations = useAppStore(s => s.translations);
  const isRecording = useAppStore(s => s.isRecording);
  
  let sourceTranslations = activeTranslations;
  if (activeOriginalText.trim().length === 0 && translations.length > 0 && isRecording) {
    sourceTranslations = translations[0].translations;
  }

  if (Object.keys(sourceTranslations).length === 0) return null;

  return (
    <View style={styles.liveTranslationsContainer}>
      <View style={styles.liveLabelRow}>
        <Feather name="globe" size={13} color="#34D399" style={{ marginRight: 6 }} />
        <Text style={[styles.liveLabel, { color: '#34D399' }]}>Traducciones Simultáneas:</Text>
      </View>
      {Object.keys(sourceTranslations).map((langKey) => {
        const langCode = langKey as any;
        const langInfo = SUPPORTED_LANGUAGES.find((l) => l.code === langCode);
        const translated = (sourceTranslations as any)[langCode];
        if (!translated) return null;
        return (
          <View key={langCode} style={styles.liveTranslationItem}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
              <FlagIcon code={langCode} size={12} style={{ marginRight: 6 }} />
              <Text style={styles.liveTranslationLang}>{langInfo?.name}</Text>
            </View>
            <Text style={styles.liveTranslationText}>{translated}</Text>
          </View>
        );
      })}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#09090B', // Zinc 950
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    gap: 20,
    maxWidth: 720,
    width: '100%',
    alignSelf: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderColor: '#27272A',
    backgroundColor: '#09090B',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  roomBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#18181B',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#27272A',
    gap: 8,
  },
  roomBadgeLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#71717A',
    letterSpacing: 1.5,
  },
  roomCode: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FAFAFA',
    letterSpacing: 2,
  },
  headerButtonsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  headerBtn: {
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
    borderRadius: 14,
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userCountBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#10B981',
    borderRadius: 9,
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userCountText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
  },
  statusBadgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#18181B',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 8,
    borderWidth: 1,
    borderColor: '#27272A',
  },
  statusIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 12,
    color: '#A1A1AA',
    fontWeight: '700',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.25)',
    borderRadius: 16,
    padding: 16,
  },
  errorBannerText: {
    color: '#F87171',
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  consoleCard: {
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 6,
  },
  consoleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  langPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#09090B',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#27272A',
  },
  langPillText: {
    color: '#FAFAFA',
    fontSize: 14,
    fontWeight: '700',
  },
  engineBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
  },
  engineBadgeWhisper: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  engineBadgeNative: {
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  engineBadgeWeb: {
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    borderColor: 'rgba(56, 189, 248, 0.3)',
  },
  engineBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  voiceControlsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    marginVertical: 18,
  },
  recordButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FAFAFA',
    paddingHorizontal: 32,
    paddingVertical: 18,
    borderRadius: 20,
    shadowColor: '#FAFAFA',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 6,
  },
  recordButtonText: {
    color: '#09090B',
    fontWeight: '800',
    fontSize: 16,
    letterSpacing: -0.3,
  },
  stopButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EF4444',
    paddingHorizontal: 32,
    paddingVertical: 18,
    borderRadius: 20,
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
  },
  stopButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 16,
  },
  ttsMiniToggle: {
    width: 58,
    height: 58,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#09090B',
    borderWidth: 1,
    borderColor: '#27272A',
  },
  ttsMiniToggleActive: {
    borderColor: '#10B981',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
  },
  ttsMiniToggleInactive: {
    backgroundColor: '#09090B',
  },
  manualInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 14,
    marginBottom: 8,
  },
  manualInput: {
    flex: 1,
    backgroundColor: '#09090B',
    borderWidth: 1,
    borderColor: '#27272A',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 14,
    color: '#FAFAFA',
  },
  manualSendBtn: {
    backgroundColor: '#FAFAFA',
    borderRadius: 16,
    width: 50,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  liveTranscriptContainer: {
    backgroundColor: '#09090B',
    borderRadius: 16,
    padding: 18,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#27272A',
  },
  liveLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  liveLabel: {
    fontSize: 11,
    color: '#818CF8',
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  liveText: {
    fontSize: 17,
    color: '#FAFAFA',
    lineHeight: 25,
    fontWeight: '600',
  },
  liveTranslationsContainer: {
    backgroundColor: '#09090B',
    borderRadius: 16,
    padding: 18,
    marginTop: 14,
    borderWidth: 1,
    borderColor: '#27272A',
    gap: 12,
  },
  liveTranslationItem: {
    backgroundColor: 'rgba(24, 24, 27, 0.6)',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#27272A',
  },
  liveTranslationLang: {
    fontSize: 11,
    color: '#A1A1AA',
    fontWeight: '700',
    marginBottom: 4,
  },
  liveTranslationText: {
    fontSize: 16,
    color: '#34D399',
    lineHeight: 23,
    fontWeight: '600',
  },
  card: {
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 4,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#FAFAFA',
    marginBottom: 16,
    letterSpacing: -0.3,
  },
  footer: {
    padding: 20,
    borderTopWidth: 1,
    borderColor: '#27272A',
    backgroundColor: '#09090B',
    alignItems: 'center',
  },
  leaveButton: {
    flexDirection: 'row',
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    paddingHorizontal: 28,
    paddingVertical: 16,
    borderRadius: 16,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
    justifyContent: 'center',
  },
  leaveButtonText: {
    color: '#EF4444',
    fontWeight: '800',
    fontSize: 15,
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
  sidebarContainer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
    width: 320,
    backgroundColor: '#18181B',
    borderLeftWidth: 1,
    borderColor: '#27272A',
    shadowColor: '#000',
    shadowOffset: { width: -5, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 20,
    zIndex: 100,
  },
  sidebarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#27272A',
  },
  sidebarTitle: {
    color: '#FAFAFA',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  sidebarCloseBtn: {
    padding: 6,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  assistantsList: {
    gap: 10,
  },
  noAssistantsText: {
    fontSize: 14,
    color: '#71717A',
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 24,
    lineHeight: 20,
  },
  assistantItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#09090B',
    padding: 14,
    borderRadius: 14,
    gap: 12,
    borderWidth: 1,
    borderColor: '#27272A',
  },
  assistantAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  assistantInfo: {
    flex: 1,
  },
  assistantName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FAFAFA',
  },
  assistantLang: {
    fontSize: 12,
    color: '#A1A1AA',
    marginTop: 2,
  },
  speedSection: {
    marginTop: 20,
  },
  speedLabel: {
    fontSize: 13,
    color: '#A1A1AA',
    marginBottom: 12,
    fontWeight: '700',
  },
  speedOptions: {
    flexDirection: 'row',
    gap: 10,
  },
  speedOptionButton: {
    flex: 1,
    backgroundColor: '#09090B',
    borderWidth: 1,
    borderColor: '#27272A',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  speedOptionActive: {
    backgroundColor: '#FAFAFA',
    borderColor: '#FAFAFA',
  },
  speedOptionText: {
    fontSize: 13,
    color: '#A1A1AA',
    fontWeight: '700',
  },
  speedOptionTextActive: {
    color: '#09090B',
    fontWeight: '800',
  },
  engineOptionButton: {
    flex: 1,
    paddingVertical: 16,
  },
  apiKeyContainer: {
    marginTop: 16,
    backgroundColor: '#09090B',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#27272A',
  },
  apiKeyLabel: {
    color: '#A1A1AA',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 8,
  },
  apiKeyInput: {
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
    borderRadius: 12,
    color: '#FAFAFA',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 13,
  },
  testAudioButton: {
    flexDirection: 'row',
    backgroundColor: '#27272A',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  testAudioButtonText: {
    color: '#FAFAFA',
    fontWeight: '800',
    fontSize: 14,
  },
});


