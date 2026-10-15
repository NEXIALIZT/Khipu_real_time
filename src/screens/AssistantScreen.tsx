import React, { useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  Platform,
  TextInput,
} from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useAppStore } from '../store/useAppStore';
import { useShallow } from 'zustand/react/shallow';
import { SUPPORTED_LANGUAGES } from '../types/types';
import { FlagIcon } from '../components/FlagIcon';
import TtsService from '../services/TtsService';
import { useKeepAwake } from 'expo-keep-awake';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';

export const AssistantScreen: React.FC = () => {
  useKeepAwake();
  const scrollViewRef = useRef<ScrollView>(null);
  const {
    room,
    connectionStatus,
    participants,
    translations,
    currentUser,
    ttsEnabled,
    ttsRate,
    ttsEngine,
    elevenLabsApiKey,
    toggleTts,
    changeTtsRate,
    toggleTtsEngine,
    setElevenLabsApiKey,
    leaveRoom,
    questionState,
    requestQuestion,
    endQuestion,
    isRecording,
  } = useAppStore(useShallow(state => ({
    room: state.room,
    connectionStatus: state.connectionStatus,
    participants: state.participants,
    translations: state.translations,
    currentUser: state.currentUser,
    ttsEnabled: state.ttsEnabled,
    ttsRate: state.ttsRate,
    ttsEngine: state.ttsEngine,
    elevenLabsApiKey: state.elevenLabsApiKey,
    toggleTts: state.toggleTts,
    changeTtsRate: state.changeTtsRate,
    toggleTtsEngine: state.toggleTtsEngine,
    setElevenLabsApiKey: state.setElevenLabsApiKey,
    leaveRoom: state.leaveRoom,
    questionState: state.questionState,
    requestQuestion: state.requestQuestion,
    endQuestion: state.endQuestion,
    isRecording: state.isRecording,
  })));

  if (!room || !currentUser) return null;

  if (connectionStatus === 'CONNECTING') {
    return (
      <SafeAreaView style={[styles.container, styles.centerContainer]}>
        <View style={styles.connectingBox}>
          <View style={styles.connectingIconContainer}>
            <Feather name="loader" size={28} color="#FAFAFA" />
          </View>
          <Text style={styles.connectingTitle}>Conectando a la sala</Text>
          <Text style={styles.connectingSubtitle}>Sincronizando con el anfitrión de la sala...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const copyToClipboard = async (text: string) => {
    await Clipboard.setStringAsync(text);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  };

  // Encontrar el idioma del asistente actual
  const myLangInfo = SUPPORTED_LANGUAGES.find((l) => l.code === currentUser.language);

  // Encontrar al Host
  const host = participants.find((p) => p.role === 'host' || p.role === 'caller');
  const hostLangInfo = host ? SUPPORTED_LANGUAGES.find((l) => l.code === host.language) : null;

  const isConnected = connectionStatus === 'CONNECTED';

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.roomBadge}>
            <Text style={styles.roomBadgeText}>SALA</Text>
          </View>
          <Text style={styles.roomCode}>{room.code}</Text>
        </View>

        <View style={styles.statusBadge}>
          <View
            style={[
              styles.statusDot,
              { backgroundColor: isConnected ? '#10B981' : '#EF4444' },
            ]}
          />
          <Text style={styles.statusText}>
            {isConnected ? 'En vivo' : 'Desconectado'}
          </Text>
        </View>
      </View>

      <ScrollView 
        contentContainerStyle={styles.scrollContent} 
        style={styles.scrollView}
        ref={scrollViewRef}
      >
        {/* Info del Host */}
        <View style={styles.hostCard}>
          <View style={styles.hostAvatar}>
            <Feather name="user" size={18} color="#FAFAFA" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.hostRoleLabel}>ANFITRIÓN / GUÍA</Text>
            <Text style={styles.hostName}>{host ? host.name : 'Guía de la Sala'}</Text>
            {hostLangInfo && (
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                <Text style={styles.hostLang}>Origen: </Text>
                <FlagIcon code={hostLangInfo.code} size={12} style={{ marginRight: 6 }} />
                <Text style={styles.hostLang}>{hostLangInfo.name}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Sección: Preguntas y Respuestas */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardTitle}>Participación</Text>
          </View>
          
          {questionState.status === 'idle' && (
            <TouchableOpacity 
              style={styles.askBtn} 
              onPress={requestQuestion}
              activeOpacity={0.8}
            >
              <Feather name="help-circle" size={18} color="#09090B" style={{ marginRight: 8 }} />
              <Text style={styles.askBtnText}>Solicitar hacer una pregunta</Text>
            </TouchableOpacity>
          )}

          {questionState.status === 'pending' && questionState.userId === currentUser.id && (
            <View style={styles.pendingContainer}>
              <Feather name="clock" size={18} color="#FBBF24" style={{ marginRight: 8 }} />
              <Text style={styles.pendingText}>Esperando aprobación del guía...</Text>
            </View>
          )}

          {questionState.status === 'active' && questionState.userId === currentUser.id && (
            <View style={styles.activeContainer}>
              <View style={styles.activeHeader}>
                <View style={styles.activeTitleRow}>
                  <View style={styles.recordingPulse} />
                  <Text style={styles.activeTitle}>Tu micrófono está abierto</Text>
                </View>
                <QuestionTimer startTime={questionState.startTime!} />
              </View>
              <Text style={styles.activeSubtitle}>
                Habla en tu idioma. Tu voz será traducida para el guía. {isRecording ? '(Escuchando...)' : '(Iniciando...)'}
              </Text>
              
              <TouchableOpacity 
                style={styles.endQuestionBtn} 
                onPress={endQuestion}
                activeOpacity={0.8}
              >
                <Feather name="square" size={15} color="#FAFAFA" style={{ marginRight: 8 }} />
                <Text style={styles.endQuestionBtnText}>Finalizar Mi Pregunta</Text>
              </TouchableOpacity>
            </View>
          )}

          {questionState.status === 'active' && questionState.userId !== currentUser.id && (
            <View style={styles.activeOtherContainer}>
              <MaterialCommunityIcons name="waveform" size={18} color="#38BDF8" style={{ marginRight: 8 }} />
              <Text style={styles.activeOtherText}>{questionState.userName} está haciendo una pregunta...</Text>
            </View>
          )}
        </View>

        {/* Sección: Pantalla de Traducción Principal */}
        <View style={[styles.card, styles.translationCard]}>
          <View style={styles.translationCardHeader}>
            <View style={styles.langBadge}>
              <FlagIcon code={currentUser.language} size={13} style={{ marginRight: 6 }} />
              <Text style={styles.langBadgeText}>
                {myLangInfo?.name || 'Tu idioma'}
              </Text>
            </View>
            <View style={styles.liveIndicator}>
              <View style={[styles.statusDot, { backgroundColor: '#10B981' }]} />
              <Text style={styles.liveIndicatorText}>TRADUCCIÓN EN DIRECTO</Text>
            </View>
          </View>
          
          <LiveAssistantTranslation 
            myLangCode={currentUser.language} 
            hostLangCode={hostLangInfo?.code} 
          />
        </View>

        {/* Sección: Controles de Audio (TTS) */}
        <View style={styles.card}>
          <View style={styles.ttsHeaderRow}>
            <View>
              <Text style={styles.cardTitle}>Reproducción por Voz</Text>
              <Text style={styles.cardSubtitle}>Lectura automática del audio traducido</Text>
            </View>
            <TouchableOpacity
              style={[
                styles.ttsBadgeButton,
                ttsEnabled ? styles.ttsBadgeActive : styles.ttsBadgeInactive,
              ]}
              onPress={() => toggleTts(!ttsEnabled)}
              activeOpacity={0.8}
            >
              <Feather 
                name={ttsEnabled ? "volume-2" : "volume-x"} 
                size={16} 
                color={ttsEnabled ? "#09090B" : "#A1A1AA"} 
                style={{ marginRight: 6 }}
              />
              <Text style={[styles.ttsBadgeText, ttsEnabled ? styles.ttsBadgeTextActive : styles.ttsBadgeTextInactive]}>
                {ttsEnabled ? 'Activo' : 'Silencio'}
              </Text>
            </TouchableOpacity>
          </View>

          {ttsEnabled && (
            <View style={styles.speedSection}>
              <Text style={styles.sectionLabel}>Motor de Voz:</Text>
              <View style={styles.engineOptions}>
                <TouchableOpacity
                  style={[
                    styles.engineOptionButton,
                    ttsEngine === 'standard' && styles.optionButtonActive,
                  ]}
                  onPress={() => toggleTtsEngine('standard')}
                  activeOpacity={0.8}
                >
                  <Feather 
                    name="zap" 
                    size={14} 
                    color={ttsEngine === 'standard' ? "#09090B" : "#A1A1AA"} 
                    style={{ marginRight: 6 }} 
                  />
                  <Text style={[styles.optionText, ttsEngine === 'standard' && styles.optionTextActive]}>
                    Estándar
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.engineOptionButton,
                    ttsEngine === 'elevenlabs' && styles.optionButtonActive,
                  ]}
                  onPress={() => toggleTtsEngine('elevenlabs')}
                  activeOpacity={0.8}
                >
                  <MaterialCommunityIcons 
                    name="waveform" 
                    size={16} 
                    color={ttsEngine === 'elevenlabs' ? "#09090B" : "#A1A1AA"} 
                    style={{ marginRight: 6 }} 
                  />
                  <Text style={[styles.optionText, ttsEngine === 'elevenlabs' && styles.optionTextActive]}>
                    ElevenLabs
                  </Text>
                </TouchableOpacity>
              </View>

              {ttsEngine === 'elevenlabs' && (
                <View style={styles.apiKeyContainer}>
                  {elevenLabsApiKey && elevenLabsApiKey.length > 10 ? (
                    <View style={styles.apiKeySuccessRow}>
                      <Feather name="check-circle" size={16} color="#10B981" style={{ marginRight: 8 }} />
                      <Text style={styles.apiKeySuccessText}>
                        Servidor de Voz Premium Conectado
                      </Text>
                    </View>
                  ) : (
                    <>
                      <Text style={styles.apiKeyLabel}>Clave API de ElevenLabs (xi-api-key):</Text>
                      <TextInput
                        style={styles.apiKeyInput}
                        placeholder="Pega aquí tu clave sk_..."
                        placeholderTextColor="#71717A"
                        value={elevenLabsApiKey}
                        onChangeText={setElevenLabsApiKey}
                        secureTextEntry
                        autoCapitalize="none"
                        autoCorrect={false}
                      />
                      <Text style={styles.apiKeyHelp}>
                        Voz humana realista con entonación natural (requiere conexión).
                      </Text>
                    </>
                  )}
                </View>
              )}

              {/* Botón Probar Sonido */}
              <TouchableOpacity
                style={styles.testAudioButton}
                onPress={() => {
                  TtsService.speak(
                    currentUser.language === 'es' ? 'Prueba de sonido correcta' :
                    currentUser.language === 'fr' ? 'Test de son réussi' :
                    currentUser.language === 'pt' ? 'Teste de som bem-sucedido' :
                    currentUser.language === 'zh' ? '声音测试成功' :
                    'Sound test successful',
                    currentUser.language
                  );
                }}
                activeOpacity={0.8}
              >
                <Feather name="volume-2" size={15} color="#FAFAFA" style={{ marginRight: 8 }} />
                <Text style={styles.testAudioButtonText}>Probar Sonido</Text>
              </TouchableOpacity>

              {/* Velocidad de lectura */}
              <View style={{ marginTop: 20 }}>
                <Text style={styles.sectionLabel}>Velocidad de Lectura: {ttsRate.toFixed(1)}x</Text>
                <View style={styles.speedOptions}>
                  {[0.7, 1.0, 1.3, 1.6].map((rate) => {
                    const isSelected = Math.abs(ttsRate - rate) < 0.05;
                    return (
                      <TouchableOpacity
                        key={rate}
                        style={[
                          styles.speedOptionButton,
                          isSelected && styles.optionButtonActive,
                        ]}
                        onPress={() => changeTtsRate(rate)}
                        activeOpacity={0.8}
                      >
                        <Text style={[styles.optionText, isSelected && styles.optionTextActive]}>
                          {rate.toFixed(1)}x
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            </View>
          )}
        </View>

        {/* Historial para el Asistente */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardTitle}>Historial de Traducciones</Text>
            <Text style={styles.historyCount}>{translations.length} entradas</Text>
          </View>
          
          <View style={styles.historyContainer}>
            {translations.length === 0 ? (
              <View style={styles.emptyHistoryBox}>
                <Feather name="message-square" size={24} color="#3F3F46" style={{ marginBottom: 8 }} />
                <Text style={styles.noHistoryText}>Aún no se han recibido traducciones.</Text>
              </View>
            ) : (
              translations.map((item, idx) => {
                const translated = item.translations[currentUser.language] || item.originalText;
                if (!translated) return null;
                return (
                  <View key={idx} style={styles.historyItem}>
                    <View style={styles.historyMainRow}>
                      <Text style={styles.historyText}>{translated}</Text>
                      <TouchableOpacity 
                        onPress={() => copyToClipboard(translated)} 
                        style={styles.copyBtn}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Feather name="copy" size={14} color="#A1A1AA" />
                      </TouchableOpacity>
                    </View>
                    <View style={styles.historyOriginalRow}>
                      <Feather name="corner-down-right" size={12} color="#71717A" style={{ marginRight: 6 }} />
                      <Text style={styles.historyOriginal} numberOfLines={2}>
                        {item.originalText}
                      </Text>
                    </View>
                  </View>
                );
              })
            )}
          </View>
        </View>
      </ScrollView>

      {/* Footer / Salir */}
      <View style={styles.footer}>
        <TouchableOpacity 
          style={styles.leaveButton} 
          onPress={leaveRoom}
          activeOpacity={0.8}
        >
          <Feather name="log-out" size={16} color="#EF4444" style={{ marginRight: 8 }} />
          <Text style={styles.leaveButtonText}>Salir de la Sala</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const QuestionTimer = ({ startTime }: { startTime: number }) => {
  const [timeLeft, setTimeLeft] = React.useState(120);

  React.useEffect(() => {
    const updateTimer = () => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      setTimeLeft(Math.max(0, 120 - elapsed));
    };
    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [startTime]);

  const mins = Math.floor(timeLeft / 60);
  const secs = timeLeft % 60;
  return (
    <Text style={styles.timerText}>
      {mins}:{secs.toString().padStart(2, '0')}
    </Text>
  );
};

const LiveAssistantTranslation = React.memo(({ myLangCode, hostLangCode }: { myLangCode: string, hostLangCode?: string }) => {
  const activeOriginalText = useAppStore(s => s.activeOriginalText);
  const activeTranslations = useAppStore(s => s.activeTranslations);
  const connectionStatus = useAppStore(s => s.connectionStatus);
  const translations = useAppStore(s => s.translations);

  let currentTranslation = (activeTranslations as any)[myLangCode] || activeOriginalText;
  let originalToDisplay = activeOriginalText;

  if (!currentTranslation && translations.length > 0) {
    const last = translations[0];
    currentTranslation = (last.translations as any)[myLangCode] || last.originalText;
    originalToDisplay = last.originalText;
  }

  const isConnected = connectionStatus === 'CONNECTED';

  return (
    <View style={styles.translationBody}>
      <Text style={styles.mainTranslationText}>
        {currentTranslation || (
          <Text style={styles.placeholderText}>
            {isConnected
              ? 'Esperando que el guía comience a hablar...'
              : 'Conectando con el guía...'}
          </Text>
        )}
      </Text>

      {originalToDisplay.trim().length > 0 && (
        <View style={styles.originalSubtextContainer}>
          <View style={styles.originalBadge}>
            <Text style={styles.originalSublabel}>ORIGINAL ({hostLangCode?.toUpperCase() || 'HOST'})</Text>
          </View>
          <Text style={styles.originalSubtext}>{originalToDisplay}</Text>
        </View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#09090B',
  },
  centerContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  connectingBox: {
    alignItems: 'center',
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
    borderRadius: 24,
    padding: 32,
    maxWidth: 380,
    width: '100%',
  },
  connectingIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#27272A',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  connectingTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FAFAFA',
    marginBottom: 8,
    textAlign: 'center',
  },
  connectingSubtitle: {
    color: '#A1A1AA',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 16,
    maxWidth: 640,
    width: '100%',
    alignSelf: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderColor: '#27272A',
    backgroundColor: '#09090B',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  roomBadge: {
    backgroundColor: '#27272A',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  roomBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#A1A1AA',
    letterSpacing: 1,
  },
  roomCode: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FAFAFA',
    letterSpacing: 2,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#18181B',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 8,
    borderWidth: 1,
    borderColor: '#27272A',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 12,
    color: '#A1A1AA',
    fontWeight: '700',
  },
  hostCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
    borderRadius: 20,
    padding: 16,
    gap: 14,
  },
  hostAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#27272A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hostRoleLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#71717A',
    letterSpacing: 1,
  },
  hostName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FAFAFA',
    marginTop: 2,
  },
  hostLang: {
    fontSize: 13,
    color: '#A1A1AA',
    marginTop: 2,
  },
  card: {
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
    borderRadius: 24,
    padding: 20,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FAFAFA',
    letterSpacing: 0.3,
  },
  cardSubtitle: {
    fontSize: 13,
    color: '#71717A',
    marginTop: 2,
  },
  askBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FAFAFA',
    paddingVertical: 14,
    borderRadius: 14,
  },
  askBtnText: {
    color: '#09090B',
    fontWeight: '800',
    fontSize: 15,
  },
  pendingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.25)',
    borderRadius: 14,
    padding: 14,
  },
  pendingText: {
    color: '#FBBF24',
    fontWeight: '700',
    fontSize: 14,
  },
  activeContainer: {
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderRadius: 16,
    padding: 16,
  },
  activeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  activeTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  recordingPulse: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#EF4444',
  },
  activeTitle: {
    color: '#F87171',
    fontWeight: '800',
    fontSize: 15,
  },
  timerText: {
    color: '#EF4444',
    fontWeight: '900',
    fontSize: 16,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  activeSubtitle: {
    color: '#A1A1AA',
    marginBottom: 16,
    fontSize: 13,
    lineHeight: 18,
  },
  endQuestionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EF4444',
    paddingVertical: 12,
    borderRadius: 12,
  },
  endQuestionBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
  },
  activeOtherContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(56, 189, 248, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.2)',
    borderRadius: 14,
    padding: 14,
  },
  activeOtherText: {
    color: '#38BDF8',
    fontWeight: '700',
    fontSize: 14,
  },
  translationCard: {
    minHeight: 220,
    justifyContent: 'space-between',
    padding: 20,
  },
  translationCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#27272A',
    paddingBottom: 12,
    marginBottom: 16,
  },
  langBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#27272A',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  langBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FAFAFA',
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  liveIndicatorText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#71717A',
    letterSpacing: 1,
  },
  translationBody: {
    flex: 1,
    justifyContent: 'center',
  },
  mainTranslationText: {
    fontSize: 26,
    fontWeight: '800',
    color: '#FAFAFA',
    lineHeight: 36,
    textAlign: 'center',
    paddingVertical: 16,
  },
  placeholderText: {
    color: '#71717A',
    fontSize: 18,
    fontWeight: '500',
  },
  originalSubtextContainer: {
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#27272A',
  },
  originalBadge: {
    alignSelf: 'flex-start',
    marginBottom: 6,
  },
  originalSublabel: {
    fontSize: 11,
    color: '#71717A',
    fontWeight: '800',
    letterSpacing: 1,
  },
  originalSubtext: {
    fontSize: 14,
    color: '#A1A1AA',
    lineHeight: 20,
  },
  ttsHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  ttsBadgeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  ttsBadgeActive: {
    backgroundColor: '#FAFAFA',
    borderColor: '#FAFAFA',
  },
  ttsBadgeInactive: {
    backgroundColor: '#27272A',
    borderColor: '#3F3F46',
  },
  ttsBadgeText: {
    fontSize: 13,
    fontWeight: '800',
  },
  ttsBadgeTextActive: {
    color: '#09090B',
  },
  ttsBadgeTextInactive: {
    color: '#A1A1AA',
  },
  speedSection: {
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#27272A',
  },
  sectionLabel: {
    fontSize: 13,
    color: '#A1A1AA',
    marginBottom: 10,
    fontWeight: '700',
  },
  engineOptions: {
    flexDirection: 'row',
    gap: 10,
  },
  engineOptionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#27272A',
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#3F3F46',
  },
  speedOptions: {
    flexDirection: 'row',
    gap: 8,
  },
  speedOptionButton: {
    flex: 1,
    backgroundColor: '#27272A',
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#3F3F46',
  },
  optionButtonActive: {
    backgroundColor: '#FAFAFA',
    borderColor: '#FAFAFA',
  },
  optionText: {
    fontSize: 13,
    color: '#A1A1AA',
    fontWeight: '700',
  },
  optionTextActive: {
    color: '#09090B',
    fontWeight: '800',
  },
  apiKeyContainer: {
    marginTop: 14,
    backgroundColor: '#09090B',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#27272A',
  },
  apiKeySuccessRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  apiKeySuccessText: {
    color: '#FAFAFA',
    fontSize: 13,
    fontWeight: '600',
  },
  apiKeyLabel: {
    color: '#A1A1AA',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
  },
  apiKeyInput: {
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
    borderRadius: 10,
    color: '#FAFAFA',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
  },
  apiKeyHelp: {
    color: '#71717A',
    fontSize: 11,
    marginTop: 6,
  },
  testAudioButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#27272A',
    borderRadius: 12,
    paddingVertical: 12,
    marginTop: 14,
  },
  testAudioButtonText: {
    color: '#FAFAFA',
    fontWeight: '700',
    fontSize: 13,
  },
  historyCount: {
    fontSize: 12,
    color: '#71717A',
    fontWeight: '700',
  },
  historyContainer: {
    gap: 10,
  },
  emptyHistoryBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
  },
  noHistoryText: {
    fontSize: 13,
    color: '#71717A',
    fontStyle: 'italic',
  },
  historyItem: {
    backgroundColor: '#09090B',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#27272A',
  },
  historyMainRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  historyText: {
    fontSize: 14,
    color: '#FAFAFA',
    fontWeight: '700',
    lineHeight: 20,
    flex: 1,
  },
  copyBtn: {
    padding: 4,
    backgroundColor: '#18181B',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#27272A',
  },
  historyOriginalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  historyOriginal: {
    fontSize: 12,
    color: '#71717A',
    flex: 1,
  },
  footer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderColor: '#27272A',
    backgroundColor: '#09090B',
    alignItems: 'center',
  },
  leaveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    paddingVertical: 14,
    borderRadius: 14,
    width: '100%',
    maxWidth: 400,
  },
  leaveButtonText: {
    color: '#EF4444',
    fontWeight: '800',
    fontSize: 14,
    letterSpacing: 0.3,
  },
});
