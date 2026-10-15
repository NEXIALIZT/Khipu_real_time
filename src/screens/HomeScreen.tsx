import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Modal,
  ActivityIndicator,
  Animated,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { FlagIcon } from '../components/FlagIcon';
import { useAppStore } from '../store/useAppStore';
import { SUPPORTED_LANGUAGES, LanguageCode } from '../types/types';
// import SupabaseService from '../services/SupabaseService';

export const HomeScreen: React.FC = () => {
  const { initUser, createRoom, joinRoom, error, setError, connectionStatus, room, networkEngine, setNetworkEngine } = useAppStore();

  const [name, setName] = useState('');
  const [language, setLanguage] = useState<LanguageCode>('es');
  const [roomCode, setRoomCode] = useState('');
  const [showScanner, setShowScanner] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();

  const [step, setStep] = useState(1);
  const fadeAnim = React.useRef(new Animated.Value(1)).current;

  const [isCallMode, setIsCallMode] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const selectedLangInfo = SUPPORTED_LANGUAGES.find(l => l.code === language);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const savedName = await AsyncStorage.getItem('@khipu_name');
        const savedLang = await AsyncStorage.getItem('@khipu_lang');
        if (savedName) setName(savedName);
        if (savedLang) setLanguage(savedLang as LanguageCode);
      } catch (e) {
        console.warn('Error loading profile', e);
      }
    };
    loadProfile();
  }, []);

  const saveProfile = async (currentName: string, currentLang: string) => {
    try {
      await AsyncStorage.setItem('@khipu_name', currentName);
      await AsyncStorage.setItem('@khipu_lang', currentLang);
    } catch (e) { }
  };

  const handleContinue = () => {
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      setStep(2);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    });
  };

  const handleBack = () => {
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      setStep(1);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    });
  };

  const handleCreateRoom = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => { });
    saveProfile(name, language);
    initUser(name, language);
    createRoom(isCallMode ? 'call' : 'guide');
  };

  const handleJoinRoom = () => {
    if (!roomCode.trim()) {
      setError('Por favor, ingresa el código de sala.');
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => { });
    saveProfile(name, language);
    initUser(name, language);
    joinRoom(roomCode);
  };

  const handleScanQR = async () => {
    if (!permission?.granted) {
      const res = await requestPermission();
      if (res.granted) {
        setShowScanner(true);
      } else {
        setError('Permiso de cámara denegado.');
      }
    } else {
      setShowScanner(true);
    }
  };

  const handleBarcodeScanned = ({ data }: { data: string }) => {
    if (data) {
      let code = data.trim();
      let type: 'call' | 'guide' = 'guide';

      if (code.includes(':')) {
        const parts = code.split(':');
        if (parts[0] === 'call' || parts[0] === 'guide') {
          type = parts[0] as 'call' | 'guide';
        }
        code = parts[1];
      }

      setRoomCode(code);
      setShowScanner(false);

      // Auto-join al escanear
      saveProfile(name, language);
      initUser(name, language);
      joinRoom(code, type);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.header}>
          <Text style={styles.title}>Khipu Guia</Text>
          <Text style={styles.subtitle}>Traducción de Audio en Tiempo Real</Text>
        </View>

        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <Animated.View style={{ opacity: fadeAnim, width: '100%', gap: 24 }}>
          {step === 1 ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Tu Perfil Temporal</Text>

          <Text style={styles.label}>Nombre (Opcional)</Text>
          <TextInput
            style={styles.input}
            placeholder="Ej. Guía Carlos, Oyente María"
            placeholderTextColor="#64748B"
            value={name}
            onChangeText={setName}
            maxLength={20}
          />

          <Text style={styles.label}>Tu Idioma</Text>
          <TouchableOpacity
            style={styles.dropdownButton}
            onPress={() => setIsDropdownOpen(true)}
            activeOpacity={0.8}
          >
            <FlagIcon code={selectedLangInfo?.code || language} size={16} />
            <Text style={styles.dropdownButtonText}>{selectedLangInfo?.name}</Text>
            <Feather name="chevron-down" size={18} color="#71717A" />
          </TouchableOpacity>

          <Modal
            visible={isDropdownOpen}
            transparent={true}
            animationType="fade"
            onRequestClose={() => setIsDropdownOpen(false)}
          >
            <TouchableOpacity
              style={styles.modalOverlay}
              activeOpacity={1}
              onPress={() => setIsDropdownOpen(false)}
            >
              <View style={styles.dropdownMenu}>
                <Text style={styles.dropdownTitle}>Selecciona un Idioma</Text>
                {SUPPORTED_LANGUAGES.map((lang) => {
                  const isSelected = language === lang.code;
                  return (
                    <TouchableOpacity
                      key={lang.code}
                      style={[
                        styles.dropdownItem,
                        isSelected && styles.dropdownItemSelected,
                      ]}
                      onPress={() => {
                        setLanguage(lang.code);
                        setIsDropdownOpen(false);
                      }}
                      activeOpacity={0.7}
                    >
                      <FlagIcon code={lang.code} size={18} />
                      <Text
                        style={[
                          styles.dropdownItemText,
                          isSelected && styles.dropdownItemTextSelected,
                        ]}
                      >
                        {lang.name}
                      </Text>
                      {isSelected && (
                        <Feather name="check" size={16} color="#FAFAFA" style={{ marginLeft: 'auto' }} />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </TouchableOpacity>
          </Modal>

              <Text style={styles.label}>Servidor (Red)</Text>
              <View style={{ gap: 8, marginBottom: 20 }}>
                <TouchableOpacity
                  style={[styles.dropdownItem, { backgroundColor: '#09090B', borderBottomWidth: 0, borderWidth: 1, borderColor: '#27272A' }, networkEngine === 'supabase' && styles.dropdownItemSelected]}
                  onPress={() => setNetworkEngine('supabase')}
                >
                  <Feather name="cloud" size={20} color="#818CF8" style={{ marginRight: 12 }} />
                  <Text style={[styles.dropdownItemText, { marginLeft: 0 }, networkEngine === 'supabase' && styles.dropdownItemTextSelected]}>
                    Supabase (Servicio Original)
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.dropdownItem, { backgroundColor: '#09090B', borderBottomWidth: 0, borderWidth: 1, borderColor: '#27272A' }, networkEngine === 'khipubase-cloud' && styles.dropdownItemSelected]}
                  onPress={() => setNetworkEngine('khipubase-cloud')}
                >
                  <Feather name="globe" size={20} color="#34D399" style={{ marginRight: 12 }} />
                  <Text style={[styles.dropdownItemText, { marginLeft: 0 }, networkEngine === 'khipubase-cloud' && styles.dropdownItemTextSelected]}>
                    Khipubase (Nube Global)
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.dropdownItem, { backgroundColor: '#09090B', borderBottomWidth: 0, borderWidth: 1, borderColor: '#27272A' }, networkEngine === 'khipubase' && styles.dropdownItemSelected]}
                  onPress={() => setNetworkEngine('khipubase')}
                >
                  <Feather name="server" size={20} color="#FBBF24" style={{ marginRight: 12 }} />
                  <Text style={[styles.dropdownItemText, { marginLeft: 0 }, networkEngine === 'khipubase' && styles.dropdownItemTextSelected]}>
                    Khipubase (Servidor Local)
                  </Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity style={[styles.primaryButton, { marginTop: 16 }]} onPress={handleContinue}>
                <Text style={styles.primaryButtonText}>Continuar</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {/* Card: Crear Sala */}
              <View style={styles.card}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
                  <TouchableOpacity onPress={handleBack} style={styles.backButtonIcon} activeOpacity={0.7}>
                    <Feather name="arrow-left" size={22} color="#FAFAFA" />
                  </TouchableOpacity>
                  <Text style={[styles.cardTitle, { marginBottom: 0 }]}>Transmisión</Text>
                </View>
          <Text style={styles.cardDesc}>
            Habla y transmite tu voz traducida simultáneamente a los asistentes.
          </Text>

          <View style={styles.toggleContainer}>
            <TouchableOpacity
              style={[styles.toggleBtn, isCallMode && styles.toggleBtnActive]}
              onPress={() => setIsCallMode(true)}
            >
              <Text style={[styles.toggleBtnText, isCallMode && styles.toggleBtnTextActive]}>
                Llamada
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleBtn, !isCallMode && styles.toggleBtnActive]}
              onPress={() => setIsCallMode(false)}
            >
              <Text style={[styles.toggleBtnText, !isCallMode && styles.toggleBtnTextActive]}>
                Sala de Guiado
              </Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.primaryButton} onPress={handleCreateRoom}>
            <Text style={styles.primaryButtonText}>
              {isCallMode ? 'Crear Llamada' : 'Crear Sala de Guiado'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Card: Unirse a Sala */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Escuchar / Ser Asistente</Text>
          <Text style={styles.cardDesc}>
            Únete a una sala mediante código para escuchar y leer en tu idioma.
          </Text>

          <View style={{ flexDirection: 'row', marginBottom: 16, width: '100%', alignItems: 'stretch' }}>
            <TextInput
              style={[styles.input, styles.codeInput, { flex: 1, flexShrink: 1, minWidth: 0, marginBottom: 0, marginRight: 12 }]}
              placeholder="CÓDIGO"
              placeholderTextColor="#64748B"
              autoCapitalize="characters"
              maxLength={6}
              value={roomCode}
              onChangeText={(text) => {
                setRoomCode(text);
                setError(null);
              }}
            />
            <TouchableOpacity style={styles.scanBtn} onPress={handleScanQR} activeOpacity={0.7}>
              <MaterialCommunityIcons name="qrcode-scan" size={24} color="#FAFAFA" />
            </TouchableOpacity>
          </View>

            <TouchableOpacity style={styles.secondaryButton} onPress={handleJoinRoom}>
              <Text style={styles.secondaryButtonText}>Unirse a Sala</Text>
            </TouchableOpacity>
          </View>
          </>
          )}
        </Animated.View>
      </ScrollView>

      {/* Modal Loading */}
      <Modal visible={connectionStatus === 'CONNECTING' && room !== null} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.qrModalContent}>
            <ActivityIndicator size="large" color="#6366F1" />
            <Text style={[styles.qrModalTitle, { marginTop: 16 }]}>Conectando a la sala...</Text>
          </View>
        </View>
      </Modal>

      {/* Modal Scanner QR */}
      <Modal visible={showScanner} transparent animationType="slide">
        <View style={styles.scannerModalContainer}>
          <View style={styles.scannerHeader}>
            <Text style={styles.scannerTitle}>Escanear Código QR</Text>
            <TouchableOpacity onPress={() => setShowScanner(false)}>
              <Text style={styles.scannerCloseText}>Cerrar</Text>
            </TouchableOpacity>
          </View>
          {showScanner && (
            <CameraView
              style={styles.camera}
              facing="back"
              barcodeScannerSettings={{
                barcodeTypes: ["qr"],
              }}
              onBarcodeScanned={handleBarcodeScanned}
            />
          )}
          <View style={styles.scannerFooter}>
            <Text style={styles.scannerFooterText}>Apunta al código QR para unirte</Text>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#09090B', // Zinc 950
  },
  scrollContainer: {
    padding: 24,
    paddingTop: Platform.OS === 'web' ? 60 : 80,
    paddingBottom: 60,
    gap: 32,
    maxWidth: 520,
    width: '100%',
    alignSelf: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 8,
  },
  backButtonIcon: {
    backgroundColor: 'rgba(250, 250, 250, 0.05)',
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  title: {
    fontSize: 44,
    fontWeight: '900',
    color: '#FAFAFA',
    letterSpacing: -1.5,
  },
  subtitle: {
    fontSize: 17,
    color: '#A1A1AA',
    marginTop: 8,
    fontWeight: '500',
    textAlign: 'center',
  },
  errorContainer: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.2)',
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
  },
  errorText: {
    color: '#FCA5A5',
    fontWeight: '600',
    fontSize: 14,
  },
  card: {
    backgroundColor: '#18181B', // Zinc 900
    borderWidth: 1,
    borderColor: '#27272A', // Zinc 800
    borderRadius: 24,
    padding: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 8,
  },
  cardTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FAFAFA',
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  cardDesc: {
    fontSize: 15,
    color: '#A1A1AA',
    marginBottom: 24,
    lineHeight: 22,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: '#71717A',
    marginBottom: 10,
    marginTop: 16,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  input: {
    backgroundColor: '#09090B',
    borderWidth: 1,
    borderColor: '#27272A',
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 18,
    fontSize: 16,
    color: '#FAFAFA',
    marginBottom: 8,
  },
  codeInput: {
    textAlign: 'center',
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 8,
    borderColor: '#3F3F46',
    color: '#FAFAFA',
    backgroundColor: '#18181B',
  },
  dropdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#09090B',
    borderWidth: 1,
    borderColor: '#27272A',
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 18,
    marginBottom: 8,
  },
  dropdownButtonText: {
    flex: 1,
    fontSize: 16,
    color: '#FAFAFA',
    fontWeight: '600',
    marginLeft: 16,
  },
  dropdownIcon: {
    fontSize: 12,
    color: '#71717A',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
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
  },
  qrModalTitle: {
    color: '#FAFAFA',
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 8,
  },
  dropdownMenu: {
    backgroundColor: '#18181B',
    borderRadius: 32,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: '#3F3F46',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 30,
    elevation: 10,
  },
  dropdownTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FAFAFA',
    marginBottom: 20,
    textAlign: 'center',
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 16,
    marginBottom: 8,
  },
  dropdownItemSelected: {
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.3)',
  },
  flagText: {
    fontSize: 22,
  },
  dropdownItemText: {
    fontSize: 16,
    color: '#A1A1AA',
    fontWeight: '600',
    marginLeft: 16,
  },
  dropdownItemTextSelected: {
    color: '#818CF8',
    fontWeight: '800',
  },
  toggleContainer: {
    flexDirection: 'row',
    backgroundColor: '#09090B',
    borderRadius: 16,
    padding: 6,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#27272A',
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 12,
  },
  toggleBtnActive: {
    backgroundColor: '#18181B',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#27272A',
  },
  toggleBtnText: {
    fontSize: 15,
    color: '#71717A',
    fontWeight: '700',
  },
  toggleBtnTextActive: {
    color: '#FAFAFA',
  },
  primaryButton: {
    backgroundColor: '#FAFAFA',
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    shadowColor: '#FAFAFA',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 4,
  },
  primaryButtonText: {
    color: '#09090B',
    fontSize: 17,
    fontWeight: '800',
  },
  secondaryButton: {
    backgroundColor: '#27272A',
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#FAFAFA',
    fontSize: 17,
    fontWeight: '800',
  },
  connectionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1,
    gap: 10,
  },
  connectionBadgeOnline: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderColor: 'rgba(16, 185, 129, 0.2)',
  },
  connectionBadgeOffline: {
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderColor: 'rgba(245, 158, 11, 0.2)',
  },
  connectionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  connectionBadgeText: {
    fontSize: 13,
    color: '#D1D5DB',
    fontWeight: '600',
    flexShrink: 1,
  },
  scanBtn: {
    backgroundColor: '#09090B',
    borderWidth: 1,
    borderColor: '#27272A',
    borderRadius: 16,
    width: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanBtnText: {
    fontSize: 22,
  },
  scannerModalContainer: {
    flex: 1,
    backgroundColor: '#09090B',
  },
  scannerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 20,
    backgroundColor: '#09090B',
    borderBottomWidth: 1,
    borderBottomColor: '#27272A',
  },
  scannerTitle: {
    color: '#FAFAFA',
    fontSize: 18,
    fontWeight: '700',
  },
  scannerCloseText: {
    color: '#A1A1AA',
    fontSize: 16,
    fontWeight: '600',
  },
  camera: {
    flex: 1,
  },
  scannerFooter: {
    backgroundColor: '#09090B',
    padding: 32,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#27272A',
  },
  scannerFooterText: {
    color: '#A1A1AA',
    fontSize: 16,
    fontWeight: '500',
  },
});
