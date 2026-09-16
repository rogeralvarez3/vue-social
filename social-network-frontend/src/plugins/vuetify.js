/**
 * Configuracion de Vuetify.
 * Definimos un tema propio (no el azul/blanco por defecto de Material Design)
 * para que la app tenga una identidad visual propia, con soporte claro/oscuro.
 */
import 'vuetify/styles';
import '@mdi/font/css/materialdesignicons.css';
import { createVuetify } from 'vuetify';
import * as components from 'vuetify/components';
import * as directives from 'vuetify/directives';

const temaClaro = {
  dark: false,
  colors: {
    background: '#f1f3f6',
    surface: '#ffffff',
    primary: '#4f5bd5',
    'primary-darken-1': '#3c46a8',
    secondary: '#00c2a8',
    accent: '#ff6f91',
    error: '#e5484d',
    warning: '#f5a623',
    info: '#2196f3',
    success: '#2fbf71'
  }
};

const temaOscuro = {
  dark: true,
  colors: {
    background: '#0f1115',
    surface: '#181b21',
    primary: '#7c86ff',
    'primary-darken-1': '#5a63d8',
    secondary: '#1fe0c2',
    accent: '#ff86a8',
    error: '#ff5a5f',
    warning: '#f7b955',
    info: '#4fb2ff',
    success: '#38d17b'
  }
};

export default createVuetify({
  components,
  directives,
  theme: {
    defaultTheme: 'temaClaro',
    themes: { temaClaro, temaOscuro }
  },
  defaults: {
    VCard: { rounded: 'lg' },
    VBtn: { rounded: 'lg', style: 'text-transform:none;font-weight:600;' },
    VTextField: { variant: 'outlined', density: 'comfortable', rounded: 'lg' },
    VTextarea: { variant: 'outlined', density: 'comfortable', rounded: 'lg' },
    VSelect: { variant: 'outlined', density: 'comfortable', rounded: 'lg' }
  }
});
