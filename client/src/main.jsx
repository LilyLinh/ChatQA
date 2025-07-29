import React from "react";
import ReactDOM from "react-dom/client";
import ChatApp from "./ChatApp.jsx";  // <-- update here
import "./index.css";
import 'bootstrap/dist/css/bootstrap.min.css';


ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ChatApp />
  </React.StrictMode>
);
