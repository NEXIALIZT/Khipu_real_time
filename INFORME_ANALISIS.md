# Informe de Análisis Minucioso: Khipu Guía (Realtime Translator)

## 1. Resumen Ejecutivo
Khipu Guía es una aplicación diseñada en **React Native y Expo** para facilitar traducciones de voz a texto y audio en tiempo real. Soporta dos modalidades: "Sala de Guiado" (1 a muchos) y "Llamada" (1 a 1). La arquitectura se apoya fuertemente en **Zustand** para la gestión del estado global y **Supabase Realtime** para la sincronización entre dispositivos.

Se realizó un escrutinio **línea por línea** del código fuente ubicado en `src/`, abarcando Store (Slices), Servicios Core y Pantallas. Aunque el diseño modular es de alta calidad y la interfaz de usuario está bien pulida, se han detectado **vulnerabilidades críticas y bugs lógicos** que afectarán directamente la experiencia del usuario, especialmente en entornos móviles (Android/iOS) y en modo offline.

---

## 2. Flujo de Uso y Ciclo de Vida (Línea por Línea)

### A. Inicialización y Entrada (`HomeScreen.tsx`)
- **Líneas 38-50**: La app usa `AsyncStorage` para cargar el perfil guardado.
- **Líneas 59-75**: `handleCreateRoom` y `handleJoinRoom` inicializan al usuario en el estado (`initUser`), configuran el tipo de sala y llaman a `createRoom` o `joinRoom` de Zustand.
- **Flujo de Escaneo QR (Líneas 90-111)**: El escáner detecta cadenas con prefijo `guide:` o `call:`, dividiendo el código mediante `split(':')` para auto-asignar el tipo de sala correcto y hacer auto-join de inmediato.

### B. Gestión de Sala y Conectividad (`SupabaseService.ts` & `createRoomSlice.ts`)
- Al crear o unirse a una sala, se delega a `SupabaseService.ts`.
- **SupabaseService (Líneas 33-54)**: Detecta si hay credenciales (`SUPABASE_URL`, `SUPABASE_ANON_KEY`). Si no las hay, activa `useMockMode = true`.
- **MockMode (Offline Local)**: Utiliza `BroadcastChannel` para emitir mensajes entre diferentes pestañas del mismo navegador web. Implementa un excelente sistema de Heartbeat local (Línea 135) para borrar "participantes fantasmas" que cierren la pestaña sin avisar.
- **Supabase Realtime (Líneas 161-291)**: Si hay credenciales, se suscribe al canal `realtime-room-[CODE]`. Usa el mecanismo de **Broadcast** (eventos: `participant-join`, `participant-pong`, `participant-heartbeat`, `translation`, `question-control`). **Acierto técnico**: Se diseñó un propio sistema de Presence ligero mediante "Pong" y "Heartbeat" (cada 5 seg) en lugar del estándar Presence de Supabase, lo cual ahorra muchísimos recursos del servidor.

### C. Captura y Procesamiento de Voz (`VoiceService.ts` & `createTranslationSlice.ts`)
- **Web (Líneas 80-174)**: Inicializa `webkitSpeechRecognition`. Captura audios interim y finales, rearmando el string si hay cortes, y reiniciando automáticamente si el motor se apaga (`restartTimer`).
- **Nativo Móvil (Líneas 242-347)**: Usa `expo-speech-recognition`. Procesa el `transcript` por porciones comparando el conteo de palabras (`lastProcessedWordCount`). Genera "cortes ágiles" artificiales al detectar puntuación o silencios cortos de 1200ms.
- **Traducción en Tiempo Real (`createTranslationSlice.ts:85-154`)**: Un debounceTimer (250ms) intercepta frases en progreso y las envía a `TranslationService.ts`. Un sistema de tokens (`sequenceToken`) previene race conditions asíncronas para que respuestas tardías no sobreescriban traducciones recientes.

### D. Reproducción TTS (`TtsService.ts`)
- **Modo ElevenLabs (Líneas 110-245)**: Llama a la API de ElevenLabs con `eleven_multilingual_v2`. En web reproduce con `new window.Audio()`. En móvil guarda el Buffer como MP3 en `FileSystem.cacheDirectory` y lo reproduce con `expo-audio`.
- **Modo Nativo/Web (Líneas 247-425)**: Utiliza `SpeechSynthesisUtterance` para la web, y `expo-speech` en móvil con un "Cazador de Voces" inteligente (`exactVoiceIdentifier`) que busca la voz con acento correcto en Android/iOS basado en el `langCode`.

---

## 3. Análisis de Funciones Clave

1. **`processTranslationQueue`** (`createTranslationSlice.ts:22`)
   Procesa traducciones de oraciones finales de forma secuencial. Una promesa garantiza que la API de Google sea llamada, reciba el resultado, y haga `SupabaseService.broadcastTranslation` antes de pasar al siguiente fragmento.

2. **`translateToMultiple`** (`TranslationService.ts:75`)
   Usa `Promise.all` para ejecutar traducciones paralelas a N idiomas distintos, pasando por la API pública `gtx` de Google. Usa un `AbortController` (3500ms) como escudo de ahorcamiento para no congelar la UI si el internet es malo.

3. **Control de Preguntas** (`createRoomSlice.ts:308-329` y `SupabaseService`)
   Un pequeño protocolo (handshake) con tipos `request`, `approve`, `reject`, `end`. El host aprueba, y el asistente, al recibir el ok, automáticamente llama a `get().startRecording(true)` encendiendo su propio micrófono (Línea 259 de `createRoomSlice.ts`).

---

## 4. Detección de Errores Lógicos y Bugs Críticos

Durante la revisión exhaustiva, se detectaron los siguientes errores de código que generarán fallos en producción:

### 🚨 BUG CRÍTICO 1: Crash de App en Móvil sin Supabase (Pantalla en blanco / Cierre inesperado)
- **Archivo**: `SupabaseService.ts` (Líneas 81 y 162)
- **Problema**: El modo "MockMode" asume la existencia de `BroadcastChannel`, el cual no existe nativamente en React Native (Android/iOS) a menos que haya un polyfill. La validación `typeof window !== 'undefined' && 'BroadcastChannel' in window` fallará en móvil. Al fallar este `if`, el servicio **caerá directamente al bloque de conexión Online Real** (Línea 162) aunque `this.client` sea `null` (porque no hay credenciales). Cuando llegue a la Línea 167 e intente ejecutar `this.client.channel(...)`, lanzará un `TypeError: Cannot read property 'channel' of null`, crasheando la app irremediablemente.
- **Solución**: Envolver la línea 167 dentro de un `if (!this.client) { throw new Error('No Supabase Client') }` y retornar un error manejable por el callback `onStatusChange('ERROR')` para que la UI no crashee, sino que muestre "Error de conexión".

### 🚨 BUG LÓGICO 2: Parpadeo y mutilación de texto en micrófono nativo móvil
- **Archivo**: `VoiceService.ts` (Líneas 262-303)
- **Problema**: La implementación del micrófono nativo de Android envía todo el texto acumulado desde que se encendió el micrófono en el evento `event.results[0].transcript`. Sin embargo, el código hace `const newPart = currentWords.slice(lastProcessedWordCount).join(' ');` para simular que solo extrae lo "nuevo". 
  El problema radica en que en Zustand (`createTranslationSlice.ts:101`), el método `onResult` hace `set({ activeOriginalText: text })`, es decir, **REEMPLAZA** todo el texto en pantalla con lo que le llega, no lo concatena.
  Si el usuario en Android dice "Hola como estas hoy", la función enviará "hoy" como `newPart`. La pantalla del celular pasará de mostrar "Hola como estas" a mostrar **únicamente** "hoy", borrando el resto de la frase interina para el Host y los asistentes.
- **Solución**: Si Zustand sobreescribe el texto completo, `VoiceService` debe retornar el *texto acumulado completo actual*, no un slice mutilado. Debe ser: `onResult(fullTranscript, false)`.

### 🚨 BUG DE UI 3: El texto desaparece al finalizar de hablar en modo "Llamada" (`CallScreen`)
- **Archivos**: `CallScreen.tsx` (Línea 81) y `createTranslationSlice.ts` (Línea 180)
- **Problema**: En `CallScreen`, la vista central que muestra la traducción grande depende de: `activeTranslations[myLang] || activeOriginalText;`.
  Cuando el usuario detiene la grabación (`stopRecording`), el Slice global vacía esos campos: `activeOriginalText: '', activeTranslations: {}` y mete la frase final en el array `translations`.
  Dado que `CallScreen` no renderiza un listado histórico (a diferencia de `HostScreen`), al parar de hablar, **la pantalla central se queda en blanco** y vuelve a mostrar el mensaje de placeholder "La conversación aparecerá aquí...". La frase final del participante se pierde en el vacío visual de la UI.
- **Solución**: En `CallScreen.tsx`, si `activeOriginalText` está vacío, debería obtener el último elemento del array de historial:
  `const lastTranslation = translations[0];`
  `const displayedTranslation = activeTranslations[myLang] || activeOriginalText || (lastTranslation ? (lastTranslation.translations[myLang] || lastTranslation.originalText) : null);`

### ⚠️ RIESGO 4: API Key de ElevenLabs en móvil (Manejo del Buffer)
- **Archivo**: `TtsService.ts` (Línea 161)
- **Problema**: Para guardar el audio MP3 en móvil, se usa `Buffer.from(arrayBuffer).toString('base64');`. React Native estándar **no** provee la clase `Buffer` globalmente a menos que esté inyectada mediante un polyfill (por ejemplo a través de `buffer` package). Si no está debidamente configurado en el `babel.config.js` o `index.ts`, al entrar a ElevenLabs la app crasheará en el intento de reproducir el audio con un error de "Buffer is not defined".

### 💡 MEJORA ADICIONAL: Re-Traducción Local en el Asistente
- **Archivo**: `createRoomSlice.ts` (Líneas 158-166)
- **Acierto Lógico**: Es excelente que si un Host manda un texto pero la traducción a cierto idioma falla (o se omite por latencia), el asistente detecta que le falta el `data.translations[myLang]` y hace la traducción de respaldo localmente desde su propio teléfono. Esto le añade mucha resiliencia al sistema.

---

## 5. Conclusión y Recomendaciones Finales

El código tiene un nivel de madurez alto en su estructuración y gestión de componentes asíncronos concurrentes (Reactividad multi-canal). No obstante, los bugs encontrados son **bloqueantes para un entorno de producción (especialmente Android/iOS nativo sin backend)**.

**Próximos pasos recomendados:**
1. Arreglar el manejo del `Client` nulo en `SupabaseService` para evitar el crash total offline en móvil.
2. Eliminar el `slice` destructivo de texto interino en `VoiceService` nativo.
3. Arreglar la visualización de la última frase en `CallScreen` leyendo del array de `translations` cuando el buffer activo se vacíe.
4. Asegurar el polyfill de `Buffer` o usar la librería `expo-file-system` de forma nativa para descargar el archivo sin depender del Buffer base64 en memoria si es posible (ej. usando `FileSystem.downloadAsync`).
