import React from "react";
import ReactDOM from "react-dom/client";
import { assistantServiceClient } from "@ga/gen-client";
import App from "./App";
import { detectClientLocale } from "./locale";
import "./index.css";

const rootElement = document.getElementById("root");
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <App client={assistantServiceClient} locale={detectClientLocale()} />
    </React.StrictMode>
  );
}
