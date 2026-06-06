import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import App from "./App.jsx";
import AdminApp from "./admin/AdminApp.jsx";
import Blog from "./pages/Blog.jsx";
import BlogPost from "./pages/BlogPost.jsx";
import "./styles/colors_and_type.css";
import "./styles/components.css";
import "./styles/styles.css";
import "./styles/admin.css";
import "./styles/blog.css";

const isAdmin = window.location.pathname.replace(/\/+$/, "").endsWith("/admin");

if (isAdmin) {
  ReactDOM.createRoot(document.getElementById("root")).render(<React.StrictMode><AdminApp /></React.StrictMode>);
} else {
  ReactDOM.createRoot(document.getElementById("root")).render(
    <React.StrictMode>
      <HelmetProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/blog/:slug" element={<BlogPost />} />
            <Route path="/blog" element={<Blog />} />
            <Route path="*" element={<App />} />
          </Routes>
        </BrowserRouter>
      </HelmetProvider>
    </React.StrictMode>
  );
}
