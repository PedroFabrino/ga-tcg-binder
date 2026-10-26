import React from "react";
import ReactDOM from "react-dom/client";
import { assistantServiceClient } from "@ga/gen-client";
import App from "./App";
import "./index.css";

const rootElement = document.getElementById("root");
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <App client={assistantServiceClient} />
    </React.StrictMode>
  );
}
