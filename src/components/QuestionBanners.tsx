import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';

const QuestionTimer = ({ startTime }: { startTime: number }) => {
  const [timeLeft, setTimeLeft] = useState(120);

  useEffect(() => {
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
    <View style={styles.timerBadge}>
      <Feather name="clock" size={14} color="#EF4444" style={{ marginRight: 6 }} />
      <Text style={styles.timerText}>
        {mins}:{secs.toString().padStart(2, '0')}
      </Text>
    </View>
  );
};

export const PendingQuestionBanner = ({
  userName,
  onApprove,
  onReject,
}: {
  userName: string;
  onApprove: () => void;
  onReject: () => void;
}) => {
  return (
    <View style={styles.questionPendingBanner}>
      <View style={styles.bannerHeaderRow}>
        <View style={styles.iconCirclePending}>
          <Feather name="help-circle" size={18} color="#FBBF24" />
        </View>
        <Text style={styles.questionPendingText}>
          <Text style={{ fontWeight: '800', color: '#FAFAFA' }}>{userName}</Text> solicita hacer una pregunta
        </Text>
      </View>
      <View style={styles.buttonsRow}>
        <TouchableOpacity style={styles.approveBtn} onPress={onApprove} activeOpacity={0.8}>
          <Feather name="check" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
          <Text style={styles.approveBtnText}>Aprobar</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.rejectBtn} onPress={onReject} activeOpacity={0.8}>
          <Feather name="x" size={16} color="#EF4444" style={{ marginRight: 6 }} />
          <Text style={styles.rejectBtnText}>Rechazar</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export const ActiveQuestionBanner = ({
  userName,
  startTime,
  onEnd,
}: {
  userName: string;
  startTime: number;
  onEnd: () => void;
}) => {
  return (
    <View style={styles.questionActiveBanner}>
      <View style={styles.activeHeaderRow}>
        <View style={styles.activeTitleContainer}>
          <View style={styles.pulseDot} />
          <Text style={styles.questionActiveTitle}>Pregunta de {userName} en vivo</Text>
        </View>
        <QuestionTimer startTime={startTime} />
      </View>
      <TouchableOpacity style={styles.endQuestionBtn} onPress={onEnd} activeOpacity={0.8}>
        <Feather name="square" size={15} color="#FFFFFF" style={{ marginRight: 8 }} />
        <Text style={styles.endQuestionBtnText}>Finalizar Pregunta</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  timerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.25)',
  },
  timerText: {
    color: '#EF4444',
    fontWeight: '800',
    fontSize: 14,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  questionPendingBanner: {
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
    borderRadius: 20,
    padding: 18,
    gap: 14,
  },
  bannerHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconCirclePending: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  questionPendingText: {
    color: '#A1A1AA',
    fontSize: 15,
    fontWeight: '500',
    flex: 1,
  },
  buttonsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  approveBtn: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#10B981',
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  approveBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 15,
  },
  rejectBtn: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rejectBtnText: {
    color: '#EF4444',
    fontWeight: '800',
    fontSize: 15,
  },
  questionActiveBanner: {
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderRadius: 20,
    padding: 18,
    gap: 14,
  },
  activeHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  activeTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  pulseDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#EF4444',
  },
  questionActiveTitle: {
    color: '#FAFAFA',
    fontSize: 15,
    fontWeight: '800',
  },
  endQuestionBtn: {
    flexDirection: 'row',
    backgroundColor: '#EF4444',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  endQuestionBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 15,
  },
});
