import { defineConfig } from "cypress";

export default defineConfig({
  allowCypressEnv: false,

  e2e: {
    baseUrl: "http://localhost:5173",
    setupNodeEvents(on, config) {
      require("@cypress/code-coverage/task")(on, config);
      return config;
    },
    experimentalRunAllSpecs: true,
  },

  component: {
    devServer: {
      framework: "react",
      bundler: "vite",
    },
  },
});
