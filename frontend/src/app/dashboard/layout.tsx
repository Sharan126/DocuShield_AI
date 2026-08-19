"use client";

import React, { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { 
  ShieldAlert, 
  LayoutDashboard, 
  UploadCloud, 
  ScanLine, 
  Layers, 
  FileCheck, 
  PieChart, 
  Network, 
  History, 
  Settings, 
  UserSquare2,
  Bell, 
  Search, 
  LogOut, 
  Sun, 
  Moon, 
  Globe,
  MessageSquareCode,
  X,
  Send,
  Sparkles
} from "lucide-react";
import { useStore } from "@/store";
import { useAuthStore } from "@/store/authStore";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  
  const { token, user, clearAuth } = useAuthStore();
  const isLoggedIn = !!token;
  
  const { 
    language, 
    setLanguage, 
    theme, 
    toggleTheme, 
    notifications, 
    markAllAsRead, 
    clearNotifications 
  } = useStore();

  const [mounted, setMounted] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [notifOpen, setNotifOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);

  // Chatbot State
  const [chatInput, setChatInput] = useState("");
  const [chatHistory, setChatHistory] = useState([
    { role: "assistant", text: "Hello underwriter. I am DocuShield AI Assistant. Ask me anything about document tampers, RBI Sections, or fraud ring patterns." }
  ]);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Auth Protection - Redirect if not logged in
  useEffect(() => {
    if (mounted && !isLoggedIn) {
      router.push("/login");
    }
  }, [isLoggedIn, router, mounted]);

  // RBAC Page Protection & Redirects
  useEffect(() => {
    if (isLoggedIn && user && pathname) {
      if (pathname === "/dashboard" && user.role === "Auditor") {
        router.push("/dashboard/audits");
        return;
      }
      
      const unauthorizedForAuditor = [
        "/dashboard/upload",
        "/dashboard/scanner",
        "/dashboard/heatmap",
        "/dashboard/validation",
        "/dashboard/analytics",
        "/dashboard/graph"
      ];
      if (user.role === "Auditor" && unauthorizedForAuditor.includes(pathname)) {
        router.push("/dashboard/audits");
        return;
      }
      
      if (user.role === "Underwriter" && pathname === "/dashboard/audits") {
        router.push("/dashboard");
        return;
      }
      
      if (user.role !== "Admin" && pathname === "/dashboard/admin") {
        router.push("/dashboard");
        return;
      }
    }
  }, [isLoggedIn, user, pathname, router]);

  if (!mounted || !isLoggedIn) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <p className="text-sm font-mono text-slate-500">Checking credentials validation clearances...</p>
      </div>
    );
  }

  // Sidebar Menu mapping
  const allMenuItems = [
    { name: { EN: "Dashboard", HI: "डैशबोर्ड", KN: "ಡ್ಯಾಶ್ಬೋರ್ಡ್" }, path: "/dashboard", icon: LayoutDashboard, roles: ["Admin", "Underwriter"] },
    { name: { EN: "Upload Documents", HI: "दस्तावेज़ अपलोड", KN: "ದಾಖಲೆ ಅಪ್ಲೋಡ್" }, path: "/dashboard/upload", icon: UploadCloud, roles: ["Admin", "Underwriter"] },
    { name: { EN: "Fraud Scanner", HI: "धोखाधड़ी स्कैनर", KN: "ವಂಚನೆ ಸ್ಕ್ಯಾನರ್" }, path: "/dashboard/scanner", icon: ScanLine, roles: ["Admin", "Underwriter"] },
    { name: { EN: "Heatmap Viewer", HI: "हीटमैप व्यूअर", KN: "ಹೀಟ್ಮ್ಯಾಪ್ ವೀಕ್ಷಕ" }, path: "/dashboard/heatmap", icon: Layers, roles: ["Admin", "Underwriter"] },
    { name: { EN: "Cross Validation", HI: "क्रॉस सत्यापन", KN: "ಕ್ರಾಸ್ ಸಿಂಧುತ್ವ" }, path: "/dashboard/validation", icon: FileCheck, roles: ["Admin", "Underwriter"] },
    { name: { EN: "Risk Analytics", HI: "जोखिम विश्लेषण", KN: "ಅಪಾಯ ವಿಶ್ಲೇषಣೆ" }, path: "/dashboard/analytics", icon: PieChart, roles: ["Admin", "Underwriter"] },
    { name: { EN: "Graph Intelligence", HI: "ग्राफ इंटेलिजेंस", KN: "ಗ್ರಾಫ್ ಇಂಟೆಲಿಜೆನ್ಸ್" }, path: "/dashboard/graph", icon: Network, roles: ["Admin", "Underwriter"] },
    { name: { EN: "Audit Logs", HI: "ऑडिट लॉग", KN: "ಲೆಕ್ಕ ಪರಿಶೋಧನೆ" }, path: "/dashboard/audits", icon: History, roles: ["Admin", "Auditor"] },
  ];

  const menuItems = allMenuItems.filter(item => item.roles.includes(user?.role || ""));

  // If Admin role, append admin panel
  if (user?.role === "Admin") {
    menuItems.push({
      name: { EN: "Admin Settings", HI: "एडमिन सेटिंग्स", KN: "ನಿರ್ವಾಹಕ ಸೆಟ್ಟಿಂಗ್ಸ್" },
      path: "/dashboard/admin",
      icon: UserSquare2,
      roles: ["Admin"]
    });
  }

  menuItems.push({
    name: { EN: "Settings", HI: "सेटिंग्स", KN: "ಸೆಟ್ಟಿಂಗ್ಸ್" },
    path: "/dashboard/settings",
    icon: Settings,
    roles: ["Admin", "Underwriter", "Auditor"]
  });

  const activeLang = language || "EN";

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const userText = chatInput;
    setChatHistory(prev => [...prev, { role: "user", text: userText }]);
    setChatInput("");

    // Simulate smart banking AI assistant
    setTimeout(() => {
      let reply = "I analyzed the database parameters. Let me know which Document Case ID or loan applicant you want to check.";
      const query = userText.toLowerCase();

      if (query.includes("rbi") || query.includes("compliance")) {
        reply = "DocuShield AI maintains compliance with RBI Section 12.A & 19.F rules by saving full cryptographic hashes, restricting user keycards with JWT RBAC (Admin/Underwriter/Auditor), and writing tamper-proof logs.";
      } else if (query.includes("ela") || query.includes("tamper")) {
        reply = "Error Level Analysis (ELA) compresses uploaded scans at 95% ratio. Altered pixels glow brightly under scaled absolute difference overlays because the modified compression signatures diverge.";
      } else if (query.includes("mismatch") || query.includes("cross")) {
        reply = "Cross-document validation checks name strings, collateral addresses, and salary margins between salary statements, tax forms, and applicant deeds.";
      } else if (query.includes("sunita")) {
        reply = "Sunita_Kumar_SalarySlip_Tampered.png carries a Critical Risk (92.6%). Exif headers report Photoshop editing. Standard font kerning matches patche block deviations at coordinates (x:75, y:295).";
      }

      setChatHistory(prev => [...prev, { role: "assistant", text: reply }]);
    }, 1000);
  };

  return (
    <div className={`min-h-screen ${theme === "light" ? "bg-slate-50 text-slate-900" : "bg-slate-950 text-slate-100"} flex relative font-sans transition-colors duration-200`}>
      
      {/* SIDEBAR NAVIGATION */}
      <aside className={`shrink-0 border-r border-slate-800 ${theme === "light" ? "bg-white" : "bg-slate-900"} h-screen sticky top-0 transition-all duration-300 z-30 flex flex-col justify-between ${sidebarOpen ? "w-64" : "w-20"}`}>
        <div>
          {/* Logo Brand */}
          <div className="h-20 border-b border-slate-800 flex items-center px-5 space-x-3">
            <div className="p-2 bg-cyan-950/60 border border-accent/20 rounded-xl shadow-cyber">
              <ShieldAlert className="w-5 h-5 text-accent" />
            </div>
            {sidebarOpen && (
              <div>
                <span className="font-extrabold tracking-wider text-sm block">DOCUSHIELD</span>
                <span className="text-[9px] text-slate-500 tracking-widest uppercase">Canara Sec Ops</span>
              </div>
            )}
          </div>

          {/* User badge */}
          {sidebarOpen && (
            <div className="m-4 p-4 border border-slate-800 rounded-xl bg-slate-950/40 backdrop-blur-md">
              <p className="text-[10px] text-slate-500 uppercase tracking-wider">Active Credentials</p>
              <h4 className="text-sm font-bold text-slate-200 truncate">{user?.name || user?.username}</h4>
              {user?.name && <p className="text-[10px] text-slate-400 font-mono mt-0.5">@{user.username}</p>}
              <span className="inline-block mt-2 text-[10px] font-bold font-mono px-2 py-0.5 rounded bg-accent/10 border border-accent/20 text-accent uppercase">
                {user?.role}
              </span>
            </div>
          )}

          {/* Menu links */}
          <nav className="mt-6 px-3 space-y-1">
            {menuItems.map((item, i) => {
              const Icon = item.icon;
              const isActive = pathname === item.path;
              return (
                <Link
                  key={i}
                  href={item.path}
                  className={`flex items-center space-x-3 px-4 py-3 rounded-lg text-xs font-semibold tracking-wide transition-all ${
                    isActive 
                      ? "bg-accent text-slate-950 font-bold shadow-cyber hover:bg-cyan-400" 
                      : "text-slate-400 hover:text-white hover:bg-slate-800/50"
                  }`}
                >
                  <Icon className="w-5 h-5 shrink-0" />
                  {sidebarOpen && <span>{item.name[activeLang]}</span>}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Footer Logout */}
        <div className="p-3 border-t border-slate-800">
          <button
            onClick={() => { clearAuth(); router.push("/login"); }}
            className="w-full flex items-center space-x-3 px-4 py-3 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg text-xs font-semibold tracking-wide transition-all"
          >
            <LogOut className="w-5 h-5 shrink-0" />
            {sidebarOpen && <span>Logout Session</span>}
          </button>
        </div>
      </aside>

      {/* CORE WORKSPACE */}
      <div className="flex-1 flex flex-col min-h-screen">
        
        {/* TOP NAVBAR */}
        <header className={`h-20 border-b border-slate-800 ${theme === "light" ? "bg-white" : "bg-slate-900/80"} backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-20`}>
          
          <div className="flex items-center space-x-4">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 border border-slate-800 rounded-lg text-slate-400 hover:text-white"
            >
              <ShieldAlert className="w-5 h-5" />
            </button>
            <div className="hidden sm:flex items-center space-x-3 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 w-64">
              <Search className="w-4 h-4 text-slate-500" />
              <input 
                type="text" 
                placeholder="Search case, applicant name..." 
                className="bg-transparent border-none text-xs outline-none text-white w-full placeholder-slate-500" 
              />
            </div>
          </div>

          <div className="flex items-center space-x-4">
            {/* Real-time notification Bell */}
            <div className="relative">
              <button
                onClick={() => { setNotifOpen(!notifOpen); setLangOpen(false); }}
                className="p-2.5 border border-slate-800 rounded-lg text-slate-400 hover:text-white relative bg-slate-950/20"
              >
                <Bell className="w-5 h-5" />
                {notifications.some(n => !n.read) && (
                  <span className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-red-500 border border-slate-950 animate-pulse" />
                )}
              </button>

              {notifOpen && (
                <div className="absolute right-0 mt-3 w-80 bg-slate-900 border border-slate-850 rounded-xl shadow-2xl p-4 z-50 text-left glass-panel">
                  <div className="flex justify-between items-center pb-3 border-b border-slate-800 mb-3">
                    <h4 className="text-sm font-bold text-white">Underwrite System Alerts</h4>
                    <button onClick={markAllAsRead} className="text-[10px] text-accent hover:underline">Mark all read</button>
                  </div>
                  <div className="space-y-3 max-h-60 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <p className="text-xs text-slate-500 text-center py-4">No active fraud flags logged.</p>
                    ) : (
                      notifications.map(notif => (
                        <div 
                          key={notif.id} 
                          className={`p-2.5 rounded-lg border text-xs relative ${
                            notif.read ? "bg-slate-950/40 border-slate-800/60" : "bg-cyan-950/20 border-accent/20"
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <span className="font-semibold text-slate-200">{notif.title}</span>
                            <span className={`text-[9px] font-bold uppercase ${
                              notif.risk === "Critical" ? "text-red-400" : notif.risk === "High" ? "text-orange-400" : "text-emerald-400"
                            }`}>{notif.risk}</span>
                          </div>
                          <p className="text-[11px] text-slate-400 mt-1">{notif.message}</p>
                          <span className="text-[9px] text-slate-500 block mt-2">{notif.time}</span>
                        </div>
                      ))
                    )}
                  </div>
                  <button 
                    onClick={clearNotifications}
                    className="w-full text-center text-[10px] text-slate-500 hover:text-red-400 mt-3 pt-2 border-t border-slate-800"
                  >
                    Clear alerts log
                  </button>
                </div>
              )}
            </div>

            {/* Language Selector Globe */}
            <div className="relative">
              <button
                onClick={() => { setLangOpen(!langOpen); setNotifOpen(false); }}
                className="p-2.5 border border-slate-800 rounded-lg text-slate-400 hover:text-white flex items-center space-x-1.5 bg-slate-950/20"
              >
                <Globe className="w-5 h-5" />
                <span className="text-xs font-bold font-mono">{activeLang}</span>
              </button>

              {langOpen && (
                <div className="absolute right-0 mt-3 w-40 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl p-2 z-50 text-left">
                  <button onClick={() => { setLanguage("EN"); setLangOpen(false); }} className={`w-full text-left px-3 py-2 text-xs rounded-lg ${activeLang === "EN" ? "bg-accent text-slate-950 font-bold" : "text-slate-300 hover:bg-slate-800"}`}>
                    English (EN)
                  </button>
                  <button onClick={() => { setLanguage("HI"); setLangOpen(false); }} className={`w-full text-left px-3 py-2 text-xs rounded-lg ${activeLang === "HI" ? "bg-accent text-slate-950 font-bold" : "text-slate-300 hover:bg-slate-800"}`}>
                    Hindi (HI)
                  </button>
                  <button onClick={() => { setLanguage("KN"); setLangOpen(false); }} className={`w-full text-left px-3 py-2 text-xs rounded-lg ${activeLang === "KN" ? "bg-accent text-slate-950 font-bold" : "text-slate-300 hover:bg-slate-800"}`}>
                    Kannada (KN)
                  </button>
                </div>
              )}
            </div>

            {/* Light/Dark Toggle */}
            <button
              onClick={toggleTheme}
              className="p-2.5 border border-slate-800 rounded-lg text-slate-400 hover:text-white bg-slate-950/20"
            >
              {theme === "light" ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
            </button>
          </div>

        </header>

        {/* WORKSPACE PAGES VIEWS */}
        <main className="flex-1 p-6 relative">
          {children}
        </main>
      </div>

      {/* FLOATING AI ASSISTANT PANEL */}
      <div className="fixed bottom-6 right-6 z-40">
        {!chatOpen ? (
          <button
            onClick={() => setChatOpen(true)}
            className="p-4 bg-accent hover:bg-cyan-400 text-slate-950 rounded-full shadow-cyberGlow flex items-center justify-center transition-all duration-300 hover:scale-110"
          >
            <MessageSquareCode className="w-6 h-6 animate-pulse" />
          </button>
        ) : (
          <div className="w-80 sm:w-96 h-[450px] bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden glass-panel flex flex-col justify-between">
            {/* Chat header */}
            <div className="p-4 bg-slate-950 border-b border-slate-850 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Sparkles className="w-4 h-4 text-accent animate-spin" style={{ animationDuration: '4s' }} />
                <span className="text-sm font-bold text-white">DocuShield AI Underwriter Chat</span>
              </div>
              <button onClick={() => setChatOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Chat list */}
            <div className="flex-1 p-4 overflow-y-auto space-y-3 font-sans text-xs">
              {chatHistory.map((chat, idx) => (
                <div key={idx} className={`flex ${chat.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`p-3 rounded-xl max-w-[80%] leading-relaxed ${
                    chat.role === "user" ? "bg-accent text-slate-950 font-medium" : "bg-slate-950 text-slate-300 border border-slate-800"
                  }`}>
                    {chat.text}
                  </div>
                </div>
              ))}
            </div>

            {/* Chat input */}
            <form onSubmit={handleSendMessage} className="p-3 border-t border-slate-800 bg-slate-950 flex gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Ask RBI guides, ELA, Photoshop alerts..."
                className="flex-1 bg-slate-900 border border-slate-800 focus:border-accent outline-none text-xs rounded-lg px-3 text-white placeholder-slate-500"
              />
              <button type="submit" className="p-2.5 bg-accent hover:bg-cyan-400 text-slate-950 rounded-lg shrink-0">
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        )}
      </div>

    </div>
  );
}
