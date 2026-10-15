import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';

interface AudioWaveProps {
  isRecording: boolean;
}

export const AudioWave: React.FC<AudioWaveProps> = ({ isRecording }) => {
  // Animaciones para 5 barras
  const anims = [
    useRef(new Animated.Value(1)).current,
    useRef(new Animated.Value(1)).current,
    useRef(new Animated.Value(1)).current,
    useRef(new Animated.Value(1)).current,
    useRef(new Animated.Value(1)).current,
  ];

  useEffect(() => {
    let active = true;

    const pulse = () => {
      if (!isRecording || !active) {
        // Regresar a tamaño mínimo
        anims.forEach((anim) => {
          Animated.spring(anim, {
            toValue: 1,
            useNativeDriver: false,
          }).start();
        });
        return;
      }

      // Animación en paralelo con diferentes alturas y duraciones
      const animations = anims.map((anim, index) => {
        // Generar altura aleatoria entre 0.3 y 3.0
        const toValue = 0.3 + Math.random() * 2.7;
        const duration = 200 + Math.random() * 300;

        return Animated.sequence([
          Animated.timing(anim, {
            toValue,
            duration,
            useNativeDriver: false,
          }),
          Animated.timing(anim, {
            toValue: 0.5,
            duration,
            useNativeDriver: false,
          }),
        ]);
      });

      Animated.parallel(animations).start(() => {
        if (active && isRecording) {
          pulse();
        }
      });
    };

    if (isRecording) {
      pulse();
    } else {
      anims.forEach((anim) => {
        Animated.spring(anim, {
          toValue: 0.3,
          useNativeDriver: false,
        }).start();
      });
    }

    return () => {
      active = false;
    };
  }, [isRecording]);

  return (
    <View style={styles.container}>
      {anims.map((anim, index) => {
        // Aumentar tamaño para la barra del centro
        const baseHeight = index === 2 ? 32 : index === 1 || index === 3 ? 24 : 16;
        
        // Mapear color según posición para crear gradiente dinámico verde esmeralda / blanco
        let color = '#FAFAFA'; // Centro
        if (index === 0 || index === 4) color = '#059669'; // Extremos
        if (index === 1 || index === 3) color = '#10B981'; // Tono intermedio

        return (
          <Animated.View
            key={index}
            style={[
              styles.bar,
              {
                height: baseHeight,
                backgroundColor: color,
                transform: [
                  {
                    scaleY: anim,
                  },
                ],
              },
            ]}
          />
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 100,
    gap: 6,
  },
  bar: {
    width: 6,
    borderRadius: 3,
  },
});
