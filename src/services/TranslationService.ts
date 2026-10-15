import { LanguageCode } from '../types/types';
import { Platform } from 'react-native';

class TranslationService {
  private cache = new Map<string, string>();
  private readonly MAX_CACHE_SIZE = 500;

  private getCacheKey(text: string, from: string, to: string) {
    return `${from}:${to}:${text.trim().toLowerCase()}`;
  }

  /**
   * Traduce un texto de un idioma de origen a uno de destino usando la API de Google Translate.
   */
  public async translate(text: string, from: string, to: string, signal?: AbortSignal): Promise<string> {
    if (!text || text.trim() === '') {
      return '';
    }

    try {
      const fromLang = from.toLowerCase();
      const googleLangMap: Record<string, string> = {
        zh: 'zh-CN',
      };
      const toLang = googleLangMap[to.toLowerCase()] || to.toLowerCase();

      if (fromLang === toLang) {
        return text;
      }

      const cacheKey = this.getCacheKey(text, fromLang, toLang);
      if (this.cache.has(cacheKey)) {
        return this.cache.get(cacheKey)!;
      }

      // Implementación de Sistema Multi-Fallback Gratuito
      let finalResult = '';

      try {
        // Intento 1: Google Translate (dict-chrome-ex suele evitar mejor el ban 429)
        let urlGoogle = `https://translate.googleapis.com/translate_a/single?client=dict-chrome-ex&sl=${fromLang}&tl=${toLang}&dt=t&q=${encodeURIComponent(text)}`;
        let resGoogle = await fetch(urlGoogle, { signal });
        
        // Intento 1.5: Si el primer cliente falla, intentamos con gtx
        if (!resGoogle.ok) {
           urlGoogle = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${fromLang}&tl=${toLang}&dt=t&q=${encodeURIComponent(text)}`;
           resGoogle = await fetch(urlGoogle, { signal });
        }
        
        if (!resGoogle.ok) throw new Error('Google 429');
        const data = await resGoogle.json();
        if (data && data[0]) {
          for (let i = 0; i < data[0].length; i++) {
            if (data[0][i] && typeof data[0][i][0] === 'string') {
              finalResult += data[0][i][0];
            }
          }
        }
      } catch (e1) {
        console.warn(`[Translation] Google falló, usando fallback MyMemory. Error: ${e1}`);
        try {
          // Intento 2: MyMemory API Gratuita (Límite 500 palabras/día, ideal para parches temporales)
          const urlMyMemory = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${fromLang}|${toLang}`;
          const resMyMemory = await fetch(urlMyMemory, { signal });
          if (!resMyMemory.ok) throw new Error('MyMemory falló');
          const dataMyMemory = await resMyMemory.json();
          if (dataMyMemory && dataMyMemory.responseData && dataMyMemory.responseData.translatedText) {
            finalResult = dataMyMemory.responseData.translatedText;
            // MyMemory a veces devuelve fallbacks inválidos cuando falla
            if (finalResult.includes('MYMEMORY WARNING')) throw new Error('MyMemory Limit');
          }
        } catch (e2) {
          console.warn(`[Translation] MyMemory falló, usando fallback Lingva. Error: ${e2}`);
          // Intento 3: Lingva Proxy (Open Source Google Proxy)
          const urlLingva = `https://lingva.ml/api/v1/${fromLang}/${toLang}/${encodeURIComponent(text)}`;
          const resLingva = await fetch(urlLingva, { signal });
          if (!resLingva.ok) throw new Error('Lingva falló');
          const dataLingva = await resLingva.json();
          if (dataLingva && dataLingva.translation) {
            finalResult = dataLingva.translation;
          }
        }
      }

      if (finalResult) {
        if (this.cache.size >= this.MAX_CACHE_SIZE) {
          const firstKey = this.cache.keys().next().value;
          if (firstKey) this.cache.delete(firstKey);
        }
        this.cache.set(cacheKey, finalResult);
        return finalResult;
      }

      throw new Error('Todos los servicios de traducción gratuitos fallaron.');
    } catch (error) {
      console.error(`Error traduciendo de ${from} a ${to}:`, error);
      // Fallback simple
      return `${text} [Error en traducción a ${to.toUpperCase()}]`;
    }
  }

  /**
   * Traduce un texto original a múltiples idiomas en paralelo.
   */
  public async translateToMultiple(
    text: string,
    from: LanguageCode,
    toLanguages: LanguageCode[]
  ): Promise<{ [key in LanguageCode]?: string }> {
    const results: { [key in LanguageCode]?: string } = {};
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000); // Aumentado a 8s para tolerar la latencia del proxy CORS en web
    
    // Crear promesas de traducción en paralelo
    const promises = toLanguages.map(async (lang) => {
      if (lang === from) {
        results[lang] = text;
        return;
      }
      try {
        const translated = await this.translate(text, from, lang, controller.signal);
        results[lang] = translated;
      } catch (e) {
        results[lang] = `${text} [Error ${lang}]`;
      }
    });

    await Promise.all(promises);
    clearTimeout(timeoutId);
    return results;
  }
}

export default new TranslationService();
