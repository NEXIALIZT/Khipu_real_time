import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { TranslationData, SUPPORTED_LANGUAGES } from '../types/types';
import { FlagIcon } from './FlagIcon';

interface HistoryListProps {
  translations: TranslationData[];
  copyToClipboard: (text: string) => void;
}

export const HistoryList = React.memo(({ translations, copyToClipboard }: HistoryListProps) => {
  if (translations.length === 0) {
    return <Text style={styles.noHistoryText}>No hay frases registradas aún en esta sesión.</Text>;
  }

  return (
    <ScrollView style={styles.historyContainer} contentContainerStyle={{ gap: 12 }} nestedScrollEnabled={true}>
      {translations.map((item, idx) => (
        <View key={idx} style={styles.historyItem}>
          <View style={styles.originalRow}>
            <View style={styles.labelContainer}>
              <Text style={styles.roleLabel}>{item.senderName || 'Participante'}:</Text>
              <Text style={styles.historyOriginalText}>{item.originalText}</Text>
            </View>
            <TouchableOpacity 
              onPress={() => copyToClipboard(item.originalText)} 
              style={styles.copyBtn}
              activeOpacity={0.7}
            >
              <Feather name="copy" size={15} color="#71717A" />
            </TouchableOpacity>
          </View>

          <View style={styles.translationsContainer}>
            {Object.keys(item.translations).map((langKey) => {
              const langCode = langKey;
              const langInfo = SUPPORTED_LANGUAGES.find((l) => l.code === langCode);
              const text = (item.translations as any)[langCode];
              if (!text) return null;

              return (
                <View key={langCode} style={styles.translationRow}>
                  <View style={{ flex: 1 }}>
                    <View style={styles.langBadgeRow}>
                      <FlagIcon code={langCode} size={11} style={{ marginRight: 6 }} />
                      <Text style={styles.langBadgeText}>{langInfo?.name}</Text>
                    </View>
                    <Text style={styles.translatedText}>{text}</Text>
                  </View>
                  <TouchableOpacity 
                    onPress={() => copyToClipboard(text)} 
                    style={styles.copyBtn}
                    activeOpacity={0.7}
                  >
                    <Feather name="copy" size={15} color="#71717A" />
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        </View>
      ))}
    </ScrollView>
  );
});

const styles = StyleSheet.create({
  historyContainer: {
    maxHeight: 380,
  },
  noHistoryText: {
    fontSize: 14,
    color: '#71717A',
    textAlign: 'center',
    paddingVertical: 18,
    fontStyle: 'italic',
  },
  historyItem: {
    backgroundColor: '#09090B',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#27272A',
  },
  originalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  labelContainer: {
    flex: 1,
    paddingRight: 8,
  },
  roleLabel: {
    color: '#818CF8',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  historyOriginalText: {
    fontSize: 15,
    color: '#FAFAFA',
    fontWeight: '600',
    lineHeight: 22,
  },
  translationsContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#27272A',
    gap: 10,
  },
  translationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(24, 24, 27, 0.6)',
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#27272A',
  },
  langBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  langBadgeText: {
    color: '#A1A1AA',
    fontSize: 11,
    fontWeight: '700',
  },
  translatedText: {
    fontSize: 14,
    color: '#34D399',
    fontWeight: '600',
    lineHeight: 20,
  },
  copyBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
});
