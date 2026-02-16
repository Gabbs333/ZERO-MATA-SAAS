import tailwind from '@tailwindcss/postcss';
import autoprefixer from 'autoprefixer';
import postcssPresetEnv from 'postcss-preset-env';

export default {
  plugins: [
    tailwind(),
    postcssPresetEnv({
      browsers: 'safari >= 15, ios >= 15',
      stage: 3,
      features: {
        'nesting-rules': true,
        'cascade-layers': true,
        'color-functional-notation': { preserve: false },
        'custom-properties': { preserve: false },
        'gap-properties': { preserve: false },
      },
      autoprefixer: false,
    }),
    autoprefixer(),
  ],
};
