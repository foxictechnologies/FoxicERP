import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./index.css";

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("React Error Boundary caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "20px",
          backgroundColor: "#F5F5F7",
          fontFamily: "system-ui, -apple-system, sans-serif",
          color: "#1D1D1F"
        }}>
          <div style={{
            background: "#FFFFFF",
            padding: "32px",
            borderRadius: "16px",
            boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
            maxWidth: "500px",
            width: "100%",
            textAlign: "center"
          }}>
            <h2 style={{ fontSize: "20px", fontWeight: "600", marginBottom: "8px", color: "#D70015" }}>
              Something went wrong
            </h2>
            <p style={{ fontSize: "14px", color: "#6E6E73", marginBottom: "16px" }}>
              The application encountered an unexpected runtime error.
            </p>
            <div style={{
              background: "#FFF0F1",
              border: "1px solid rgba(215,0,21,0.2)",
              borderRadius: "8px",
              padding: "12px",
              fontSize: "12px",
              color: "#D70015",
              textAlign: "left",
              fontFamily: "monospace",
              wordBreak: "break-word",
              marginBottom: "20px",
              maxHeight: "150px",
              overflowY: "auto"
            }}>
              {this.state.error?.toString() || "Unknown Error"}
            </div>
            <button
              onClick={() => window.location.reload()}
              style={{
                background: "#0071E3",
                color: "#FFFFFF",
                border: "none",
                borderRadius: "8px",
                padding: "10px 20px",
                fontSize: "14px",
                fontWeight: "500",
                cursor: "pointer"
              }}
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
