import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, Modal, Platform, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useAppStore } from '../store/useAppStore';

export const DiagnosticConsole = ({ visible, onClose }: { visible: boolean, onClose: () => void }) => {
  const { debugLogs, clearLogs } = useAppStore();

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <View style={styles.headerLeft}>
              <Feather name="terminal" size={16} color="#FAFAFA" style={{ marginRight: 8 }} />
              <Text style={styles.modalTitle}>Consola de Diagnóstico</Text>
            </View>
            <View style={styles.headerRight}>
              <TouchableOpacity 
                style={styles.clearBtn} 
                onPress={() => clearLogs()}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Feather name="trash-2" size={14} color="#EF4444" style={{ marginRight: 4 }} />
                <Text style={styles.clearBtnText}>Limpiar</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.closeBtn} 
                onPress={onClose}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Feather name="x" size={18} color="#A1A1AA" />
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView style={styles.logsScroll}>
            {debugLogs.length === 0 ? (
              <Text style={styles.emptyText}>No hay eventos registrados aún.</Text>
            ) : (
              debugLogs.map((log, i) => (
                <Text key={i} style={[
                  styles.logLine,
                  { color: log.type === 'error' ? '#F87171' : log.type === 'warn' ? '#FBBF24' : '#38BDF8' }
                ]}>
                  <Text style={styles.logTimestamp}>[{log.time}]</Text> {log.msg}
                </Text>
              ))
            )}
          </ScrollView>

          <TouchableOpacity 
            style={styles.doneBtn} 
            onPress={onClose}
            activeOpacity={0.8}
          >
            <Text style={styles.doneBtnText}>Cerrar Consola</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    backgroundColor: '#18181B',
    borderRadius: 24,
    padding: 20,
    width: '100%',
    maxWidth: 520,
    borderWidth: 1,
    borderColor: '#27272A',
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  modalTitle: {
    color: '#FAFAFA',
    fontSize: 16,
    fontWeight: '800',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  clearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  clearBtnText: {
    color: '#EF4444',
    fontSize: 12,
    fontWeight: '700',
  },
  closeBtn: {
    padding: 4,
  },
  logsScroll: {
    backgroundColor: '#09090B',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#27272A',
    minHeight: 220,
    maxHeight: 400,
  },
  emptyText: {
    color: '#71717A',
    fontSize: 12,
    fontStyle: 'italic',
    padding: 8,
  },
  logLine: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 6,
  },
  logTimestamp: {
    color: '#71717A',
  },
  doneBtn: {
    marginTop: 16,
    backgroundColor: '#27272A',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  doneBtnText: {
    color: '#FAFAFA',
    fontSize: 14,
    fontWeight: '700',
  },
});
