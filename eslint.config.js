// Configuració d'ESLint.
//
// Per què hi és
// -------------
// El `vite build` només comprova que la sintaxi sigui vàlida. No mira si els
// noms que fas servir existeixen. Per això s'han desplegat tres vegades
// pantalles que compilaven bé i petaven en obrir-les: un component que no
// s'havia copiat, trossos de codi que van quedar com a text, i un import
// que faltava.
//
// Amb això, el desplegament de Cloudflare s'atura amb un missatge clar
// abans de publicar res.
//
// Criteri
// -------
// Només s'activen les regles que detecten coses TRENCADES. Res d'estil:
// ni cometes, ni punts i coma, ni sagnat. Si un dia una regla es queixa de
// quelcom que en realitat funciona, es desactiva aquí sota i s'hi escriu el
// perquè — mai s'apaga tot el fitxer.

import js from '@eslint/js'
import globals from 'globals'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'

export default [
  {
    ignores: ['dist/**', 'node_modules/**', 'worker-avisos/**'],
  },
  {
    files: ['src/**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.browser },
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    settings: {
      react: { version: '18.3' },
    },
    plugins: {
      react,
      'react-hooks': reactHooks,
    },
    rules: {
      // ── Les que importen de debò ──────────────────────────────────────
      // Un nom que no existeix: la causa dels tres errors que hem tingut.
      'no-undef': 'error',
      // Un component de React usat i no importat.
      'react/jsx-no-undef': 'error',
      // Sense això, ESLint no compta que un component s'ha fet servir dins
      // del JSX i avisa que sobra quan en realitat s'utilitza.
      'react/jsx-uses-vars': 'error',
      // Cridar una funció que no s'ha definit enlloc del fitxer.
      'no-obj-calls': 'error',
      // Declarar dues vegades la mateixa cosa (típic en copiar blocs).
      'no-dupe-keys': 'error',
      'no-dupe-args': 'error',
      'no-dupe-class-members': 'error',
      'no-func-assign': 'error',
      // Codi inabastable: sol voler dir que un `return` ha quedat malament.
      'no-unreachable': 'error',
      // Comparacions que sempre donen el mateix.
      'no-self-compare': 'error',
      'use-isnan': 'error',
      'valid-typeof': 'error',
      // Els hooks de React: cridats dins de condicions o de bucles trenquen
      // l'aplicació de maneres molt difícils de diagnosticar.
      'react-hooks/rules-of-hooks': 'error',

      // ── Avisos, que no aturen el desplegament ─────────────────────────
      // Una variable que no es fa servir sovint vol dir que t'has deixat
      // alguna cosa, però no trenca res: només avisa.
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'react-hooks/exhaustive-deps': 'warn',
      'no-empty': 'warn',
    },
  },
]
