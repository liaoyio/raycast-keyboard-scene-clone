import antfu, { nextjs } from "@antfu/eslint-config"

export default antfu({
  react: { files: ["src/**/*.{ts,tsx}"] },
  typescript: true,
  // 生成文件、验收产物和第三方解码器由各自工具维护。
  ignores: ["next-env.d.ts", "artifacts/**", "public/assets/**"],

  lessOpinionated: true,
  isInEditor: false,

  stylistic: {
    semi: false,
    quotes: "double",
  },

  formatters: {
    css: true,
    html: true,
    markdown: false,
  },

  rules: {
    "style/max-statements-per-line": "off",
    "react-refresh/only-export-components": "off",
  },
}, nextjs({ files: ["src/**/*.{ts,tsx}"] }), {
  files: ["**/*.{js,mjs,cjs}"],
  // JS 使用 ESLint 原生 unused-vars，避免 TS 规则把正常引用误判成类型引用。
  rules: {
    "unused-imports/no-unused-vars": "off",
    "unused-imports/no-unused-imports": "off",
  },
})
