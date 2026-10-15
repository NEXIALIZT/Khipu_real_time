import React from 'react';
import { View, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import Svg, { Rect, Circle, Polygon, G, Path } from 'react-native-svg';

interface FlagIconProps {
  code: string;
  size?: number; // Height in px, width is calculated with 4:3 ratio
  style?: StyleProp<ViewStyle>;
}

export const FlagIcon: React.FC<FlagIconProps> = ({ code, size = 18, style }) => {
  const normalizedCode = (code || '').toLowerCase().trim();
  const height = size;
  const width = Math.round(size * 1.35); // 4:3 aspect ratio

  const renderFlagSvg = () => {
    switch (normalizedCode) {
      case 'es': // España: Rojo / Amarillo / Rojo (1:2:1)
        return (
          <Svg width={width} height={height} viewBox="0 0 60 45">
            <Rect width="60" height="45" fill="#AA151B" />
            <Rect y="11.25" width="60" height="22.5" fill="#F1BF00" />
            {/* Escudo simplificado elegante */}
            <Rect x="14" y="17" width="8" height="11" rx="2" fill="#AA151B" />
            <Circle cx="18" cy="15.5" r="2" fill="#AA151B" />
            <Rect x="16" y="19" width="4" height="6" fill="#F1BF00" />
          </Svg>
        );

      case 'en':
      case 'us': // Estados Unidos
        return (
          <Svg width={width} height={height} viewBox="0 0 60 45">
            {/* 7 franjas rojas, 6 blancas */}
            <Rect width="60" height="45" fill="#FFFFFF" />
            <Rect y="0" width="60" height="3.46" fill="#B22234" />
            <Rect y="6.92" width="60" height="3.46" fill="#B22234" />
            <Rect y="13.84" width="60" height="3.46" fill="#B22234" />
            <Rect y="20.76" width="60" height="3.46" fill="#B22234" />
            <Rect y="27.68" width="60" height="3.46" fill="#B22234" />
            <Rect y="34.60" width="60" height="3.46" fill="#B22234" />
            <Rect y="41.52" width="60" height="3.48" fill="#B22234" />
            {/* Cantón azul */}
            <Rect width="26" height="24.22" fill="#3C3B6E" />
            {/* Puntos simulando constelación de estrellas */}
            <Circle cx="5" cy="4" r="1.1" fill="#FFFFFF" />
            <Circle cx="13" cy="4" r="1.1" fill="#FFFFFF" />
            <Circle cx="21" cy="4" r="1.1" fill="#FFFFFF" />
            <Circle cx="9" cy="8" r="1.1" fill="#FFFFFF" />
            <Circle cx="17" cy="8" r="1.1" fill="#FFFFFF" />
            <Circle cx="5" cy="12" r="1.1" fill="#FFFFFF" />
            <Circle cx="13" cy="12" r="1.1" fill="#FFFFFF" />
            <Circle cx="21" cy="12" r="1.1" fill="#FFFFFF" />
            <Circle cx="9" cy="16" r="1.1" fill="#FFFFFF" />
            <Circle cx="17" cy="16" r="1.1" fill="#FFFFFF" />
            <Circle cx="5" cy="20" r="1.1" fill="#FFFFFF" />
            <Circle cx="13" cy="20" r="1.1" fill="#FFFFFF" />
            <Circle cx="21" cy="20" r="1.1" fill="#FFFFFF" />
          </Svg>
        );

      case 'fr': // Francia: Azul / Blanco / Rojo vertical
        return (
          <Svg width={width} height={height} viewBox="0 0 60 45">
            <Rect width="20" height="45" fill="#002654" />
            <Rect x="20" width="20" height="45" fill="#FFFFFF" />
            <Rect x="40" width="20" height="45" fill="#ED2939" />
          </Svg>
        );

      case 'pt': // Portugal: Verde (40%) / Rojo (60%) con esfera armilar
        return (
          <Svg width={width} height={height} viewBox="0 0 60 45">
            <Rect width="24" height="45" fill="#006600" />
            <Rect x="24" width="36" height="45" fill="#FF0000" />
            <Circle cx="24" cy="22.5" r="7.5" fill="#FFCC00" />
            <Circle cx="24" cy="22.5" r="4.5" fill="#AA151B" />
          </Svg>
        );

      case 'it': // Italia: Verde / Blanco / Rojo vertical
        return (
          <Svg width={width} height={height} viewBox="0 0 60 45">
            <Rect width="20" height="45" fill="#008C45" />
            <Rect x="20" width="20" height="45" fill="#FFFFFF" />
            <Rect x="40" width="20" height="45" fill="#CD212A" />
          </Svg>
        );

      case 'de': // Alemania: Negro / Rojo / Dorado horizontal
        return (
          <Svg width={width} height={height} viewBox="0 0 60 45">
            <Rect y="0" width="60" height="15" fill="#000000" />
            <Rect y="15" width="60" height="15" fill="#DD0000" />
            <Rect y="30" width="60" height="15" fill="#FFCE00" />
          </Svg>
        );

      case 'ru': // Rusia: Blanco / Azul / Rojo horizontal
        return (
          <Svg width={width} height={height} viewBox="0 0 60 45">
            <Rect y="0" width="60" height="15" fill="#FFFFFF" />
            <Rect y="15" width="60" height="15" fill="#0039A6" />
            <Rect y="30" width="60" height="15" fill="#D52B1E" />
          </Svg>
        );

      case 'ja': // Japón: Blanco con disco solar rojo
        return (
          <Svg width={width} height={height} viewBox="0 0 60 45">
            <Rect width="60" height="45" fill="#FFFFFF" />
            <Circle cx="30" cy="22.5" r="12" fill="#BC002D" />
          </Svg>
        );

      case 'zh': // China: Rojo con estrellas doradas
        return (
          <Svg width={width} height={height} viewBox="0 0 60 45">
            <Rect width="60" height="45" fill="#DE2910" />
            {/* Estrella principal */}
            <Polygon
              points="10,5 12,11 18,11 13,14 15,20 10,16 5,20 7,14 2,11 8,11"
              fill="#FFDE00"
            />
            {/* Pequeñas estrellas compañeras */}
            <Circle cx="21" cy="7" r="1.6" fill="#FFDE00" />
            <Circle cx="24" cy="12" r="1.6" fill="#FFDE00" />
            <Circle cx="24" cy="18" r="1.6" fill="#FFDE00" />
            <Circle cx="21" cy="23" r="1.6" fill="#FFDE00" />
          </Svg>
        );

      default:
        return (
          <Svg width={width} height={height} viewBox="0 0 60 45">
            <Rect width="60" height="45" fill="#27272A" />
            <Circle cx="30" cy="22.5" r="10" fill="#71717A" />
          </Svg>
        );
    }
  };

  return (
    <View style={[styles.container, { width, height }, style]}>
      {renderFlagSvg()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 3,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
