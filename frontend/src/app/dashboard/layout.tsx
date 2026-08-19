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
  Sparkles,
  Menu,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Clock,
  Trash2
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
  const [desktopSidebarOpen, setDesktopSidebarOpen] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
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

  // Close mobile sidebar on route change
  useEffect(() => {
    setMobileSidebarOpen(false);
  }, [pathname]);

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
        <p className="text-xs font-mono text-slate-500">Checking credentials validation clearances...</p>
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
    { name: { EN: "Risk Analytics", HI: "जोखिम विश्लेषण", KN: "ಅಪಾಯ ವಿಶ್ಲೇಷಣೆ" }, path: "/dashboard/analytics", icon: PieChart, roles: ["Admin", "Underwriter"] },
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
    <div className={`min-h-screen ${theme === "light" ? "bg-slate-50 text-slate-900" : "bg-slate-950 text-slate-100"} flex relative font-sans transition-colors duration-200 overflow-x-hidden`}>
      
      {/* MOBILE DRAWER BACKDROP */}
      {mobileSidebarOpen && (
        <div 
          onClick={() => setMobileSidebarOpen(false)}
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-40 lg:hidden animate-fade-in"
        />
      )}

      {/* MOBILE SIDEBAR DRAWER (Slide-in on mobile) */}
      <aside className={`fixed inset-y-0 left-0 w-72 bg-slate-900 border-r border-slate-800 z-50 flex flex-col justify-between shadow-2xl transition-transform duration-300 transform lg:hidden ${
        mobileSidebarOpen ? "translate-x-0" : "-translate-x-full"
      }`}>
        <div className="overflow-y-auto flex-1">
          {/* Logo Brand + Close Button */}
          <div className="h-20 border-b border-slate-800 flex items-center justify-between px-5">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-cyan-950/60 border border-accent/20 rounded-xl shadow-cyber">
                <ShieldAlert className="w-5 h-5 text-accent" />
              </div>
              <div>
                <span className="font-extrabold tracking-wider text-sm block text-white">DOCUSHIELD</span>
                <span className="text-[9px] text-slate-500 tracking-widest uppercase">Canara Sec Ops</span>
              </div>
            </div>
            <button 
              onClick={() => setMobileSidebarOpen(false)}
              aria-label="Close Sidebar"
              className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800/60"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* User badge */}
          <div className="m-4 p-4 border border-slate-800 rounded-xl bg-slate-950/60 backdrop-blur-md">
            <p className="text-[10px] text-slate-500 uppercase tracking-wider">Active Credentials</p>
            <h4 className="text-sm font-bold text-slate-200 truncate">{user?.name || user?.username}</h4>
            {user?.name && <p className="text-[10px] text-slate-400 font-mono mt-0.5">@{user.username}</p>}
            <span className="inline-block mt-2 text-[10px] font-bold font-mono px-2 py-0.5 rounded bg-accent/10 border border-accent/20 text-accent uppercase">
              {user?.role}
            </span>
          </div>

          {/* Menu links */}
          <nav className="mt-4 px-3 space-y-1">
            {menuItems.map((item, i) => {
              const Icon = item.icon;
              const isActive = pathname === item.path;
              return (
                <Link
                  key={i}
                  href={item.path}
                  onClick={() => setMobileSidebarOpen(false)}
                  className={`flex items-center space-x-3 px-4 py-3 rounded-lg text-xs font-semibold tracking-wide transition-all ${
                    isActive 
                      ? "bg-accent text-slate-950 font-bold shadow-cyber" 
                      : "text-slate-400 hover:text-white hover:bg-slate-800/50"
                  }`}
                >
                  <Icon className="w-5 h-5 shrink-0" />
                  <span>{item.name[activeLang]}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Footer Logout */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/40">
          <button
            onClick={() => { clearAuth(); router.push("/login"); }}
            className="w-full flex items-center space-x-3 px-4 py-3 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg text-xs font-semibold tracking-wide transition-all"
          >
            <LogOut className="w-5 h-5 shrink-0" />
            <span>Logout Session</span>
          </button>
        </div>
      </aside>

      {/* DESKTOP SIDEBAR NAVIGATION (Visible on lg screens) */}
      <aside className={`hidden lg:flex lg:flex-col lg:sticky lg:top-0 lg:h-screen shrink-0 border-r border-slate-800 ${theme === "light" ? "bg-white" : "bg-slate-900"} transition-all duration-300 z-30 justify-between ${desktopSidebarOpen ? "w-64" : "w-20"}`}>
        <div>
          {/* Logo Brand */}
          <div className="h-20 border-b border-slate-800 flex items-center px-5 space-x-3">
            <div className="p-2 bg-cyan-950/60 border border-accent/20 rounded-xl shadow-cyber shrink-0">
              <ShieldAlert className="w-5 h-5 text-accent" />
            </div>
            {desktopSidebarOpen && (
              <div className="overflow-hidden">
                <span className="font-extrabold tracking-wider text-sm block truncate">DOCUSHIELD</span>
                <span className="text-[9px] text-slate-500 tracking-widest uppercase truncate block">Canara Sec Ops</span>
              </div>
            )}
          </div>

          {/* User badge */}
          {desktopSidebarOpen && (
            <div className="m-4 p-4 border border-slate-800 rounded-xl bg-slate-950/40 backdrop-blur-md">
              <p className="text-[10px] text-slate-500 uppercase tracking-wider">Active Credentials</p>
              <h4 className="text-sm font-bold text-slate-200 truncate">{user?.name || user?.username}</h4>
              {user?.name && <p className="text-[10px] text-slate-400 font-mono mt-0.5 truncate">@{user.username}</p>}
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
                  title={item.name[activeLang]}
                  className={`flex items-center space-x-3 px-4 py-3 rounded-lg text-xs font-semibold tracking-wide transition-all ${
                    isActive 
                      ? "bg-accent text-slate-950 font-bold shadow-cyber hover:bg-cyan-400" 
                      : "text-slate-400 hover:text-white hover:bg-slate-800/50"
                  }`}
                >
                  <Icon className="w-5 h-5 shrink-0" />
                  {desktopSidebarOpen && <span className="truncate">{item.name[activeLang]}</span>}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Footer Logout */}
        <div className="p-3 border-t border-slate-800">
          <button
            onClick={() => { clearAuth(); router.push("/login"); }}
            title="Logout Session"
            className="w-full flex items-center space-x-3 px-4 py-3 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg text-xs font-semibold tracking-wide transition-all"
          >
            <LogOut className="w-5 h-5 shrink-0" />
            {desktopSidebarOpen && <span>Logout Session</span>}
          </button>
        </div>
      </aside>

      {/* CORE WORKSPACE */}
      <div className="flex-1 flex flex-col min-h-screen min-w-0 w-full overflow-x-hidden">
        
        {/* TOP NAVBAR */}
        <header className={`h-16 sm:h-20 border-b border-slate-800 ${theme === "light" ? "bg-white" : "bg-slate-900/80"} backdrop-blur-md px-4 sm:px-6 flex items-center justify-between sticky top-0 z-20`}>
          
          <div className="flex items-center space-x-3 sm:space-x-4">
            {/* Mobile Hamburger Toggle Button */}
            <button
              onClick={() => setMobileSidebarOpen(true)}
              aria-label="Open Navigation Drawer"
              className="lg:hidden p-2 border border-slate-800 rounded-lg text-slate-300 hover:text-accent hover:bg-slate-800/60 transition-colors"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Desktop Collapse/Expand Toggle Button */}
            <button
              onClick={() => setDesktopSidebarOpen(!desktopSidebarOpen)}
              aria-label="Toggle Desktop Sidebar"
              className="hidden lg:block p-2 border border-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"
            >
              <ShieldAlert className="w-5 h-5 text-accent" />
            </button>

            {/* Brand title on mobile header */}
            <div className="flex lg:hidden items-center space-x-2">
              <span className="font-extrabold tracking-wider text-xs sm:text-sm text-white">DOCUSHIELD <span className="text-accent text-[10px]">AI</span></span>
            </div>

            <div className="hidden md:flex items-center space-x-3 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 w-48 sm:w-64">
              <Search className="w-4 h-4 text-slate-500 shrink-0" />
              <input 
                type="text" 
                placeholder="Search case, applicant name..." 
                className="bg-transparent border-none text-xs outline-none text-white w-full placeholder-slate-500" 
              />
            </div>
          </div>

          <div className="flex items-center space-x-2 sm:space-x-4">
            {/* Real-time notification Bell */}
            <div className="relative">
              <button
                onClick={() => { setNotifOpen(!notifOpen); setLangOpen(false); }}
                aria-label="Toggle notifications"
                className={`p-2 sm:p-2.5 border rounded-xl relative transition-colors ${
                  notifOpen 
                    ? "border-accent bg-cyan-950/40 text-accent shadow-cyber" 
                    : theme === "light"
                    ? "border-slate-200 bg-slate-100/80 text-slate-700 hover:text-slate-900 hover:bg-slate-200"
                    : "border-slate-800 text-slate-300 hover:text-white bg-slate-950/40 hover:bg-slate-800/60"
                }`}
              >
                <Bell className="w-4 h-4 sm:w-5 sm:h-5" />
                {notifications.some(n => !n.read) && (
                  <span className="absolute -top-1 -right-1 flex h-3 w-3 sm:h-3.5 sm:w-3.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 sm:h-3.5 sm:w-3.5 bg-red-500 border-2 border-slate-950"></span>
                  </span>
                )}
              </button>

              {/* Click-away backdrop for notification & language panels */}
              {notifOpen && (
                <div 
                  className="fixed inset-0 z-40 bg-slate-950/30 backdrop-blur-[2px] sm:bg-transparent"
                  onClick={() => setNotifOpen(false)}
                />
              )}

              {notifOpen && (
                <div className="fixed sm:absolute inset-x-3 sm:inset-x-auto top-18 sm:top-full sm:right-0 sm:mt-2 w-auto sm:w-[380px] bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl z-50 overflow-hidden text-left flex flex-col animate-fade-in">
                  
                  {/* Panel Header */}
                  <div className="p-4 bg-slate-950 border-b border-slate-800 flex justify-between items-center">
                    <div className="flex items-center space-x-2">
                      <div className="p-1.5 bg-cyan-950/80 border border-cyan-500/30 rounded-lg">
                        <ShieldAlert className="w-4 h-4 text-accent" />
                      </div>
                      <div>
                        <h4 className="text-xs sm:text-sm font-bold text-white tracking-wide">Underwrite System Alerts</h4>
                        <p className="text-[9px] text-slate-400 font-mono">
                          {notifications.filter(n => !n.read).length} active security warnings
                        </p>
                      </div>
                    </div>
                    <button 
                      onClick={markAllAsRead} 
                      className="text-[11px] font-semibold text-accent hover:text-cyan-300 px-2.5 py-1 rounded-md bg-accent/10 border border-accent/20 transition-all hover:bg-accent/20"
                    >
                      Mark all read
                    </button>
                  </div>

                  {/* Alert Cards Feed */}
                  <div className="p-3 space-y-2.5 max-h-[380px] overflow-y-auto bg-slate-900/95 divide-y divide-slate-800/40">
                    {notifications.length === 0 ? (
                      <div className="py-8 text-center space-y-2">
                        <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
                        <p className="text-xs font-semibold text-slate-300">All alerts cleared</p>
                        <p className="text-[10px] text-slate-500">Underwriting queues are currently healthy.</p>
                      </div>
                    ) : (
                      notifications.map(notif => (
                        <div 
                          key={notif.id} 
                          className={`p-3.5 rounded-xl border transition-all pt-3 ${
                            notif.risk === "Critical"
                              ? "bg-slate-950 border-red-500/30 hover:border-red-500/50 shadow-sm"
                              : notif.risk === "High"
                              ? "bg-slate-950 border-amber-500/30 hover:border-amber-500/50 shadow-sm"
                              : "bg-slate-950 border-slate-800 hover:border-slate-700 shadow-sm"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-start space-x-2.5">
                              <div className="mt-0.5 shrink-0">
                                {notif.risk === "Critical" ? (
                                  <div className="p-1 rounded-md bg-red-950/80 border border-red-500/40 text-red-400">
                                    <AlertTriangle className="w-3.5 h-3.5" />
                                  </div>
                                ) : notif.risk === "High" ? (
                                  <div className="p-1 rounded-md bg-amber-950/80 border border-amber-500/40 text-amber-400">
                                    <AlertCircle className="w-3.5 h-3.5" />
                                  </div>
                                ) : (
                                  <div className="p-1 rounded-md bg-cyan-950/80 border border-cyan-500/40 text-accent">
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                  </div>
                                )}
                              </div>
                              <div>
                                <h5 className="text-xs font-bold text-white leading-tight">{notif.title}</h5>
                                <p className="text-[11px] text-slate-300 mt-1 leading-relaxed">{notif.message}</p>
                              </div>
                            </div>

                            <span className={`text-[9px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-full shrink-0 border ${
                              notif.risk === "Critical" 
                                ? "text-red-300 bg-red-950/80 border-red-500/40" 
                                : notif.risk === "High" 
                                ? "text-amber-300 bg-amber-950/80 border-amber-500/40" 
                                : "text-emerald-300 bg-emerald-950/80 border-emerald-500/40"
                            }`}>
                              {notif.risk}
                            </span>
                          </div>

                          <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-slate-900/80">
                            <span className="flex items-center space-x-1 text-[10px] text-slate-500 font-mono">
                              <Clock className="w-3 h-3 text-slate-500" />
                              <span>{notif.time}</span>
                            </span>
                            {!notif.read && (
                              <span className="text-[9px] font-semibold text-accent uppercase font-mono">Unread</span>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Panel Footer */}
                  <div className="p-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
                    <span className="text-[10px] text-slate-500 font-mono">
                      Log ledger: {notifications.length} entries
                    </span>
                    <button 
                      onClick={clearNotifications}
                      className="text-[10px] font-semibold text-slate-400 hover:text-red-400 flex items-center space-x-1 transition-colors"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Clear alerts log</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Language Selector Globe */}
            <div className="relative">
              <button
                onClick={() => { setLangOpen(!langOpen); setNotifOpen(false); }}
                aria-label="Select Language"
                className={`p-2 sm:p-2.5 border rounded-xl flex items-center space-x-1 sm:space-x-1.5 transition-colors ${
                  langOpen
                    ? "border-accent bg-cyan-950/40 text-accent shadow-cyber"
                    : theme === "light"
                    ? "border-slate-200 bg-slate-100/80 text-slate-700 hover:text-slate-900 hover:bg-slate-200"
                    : "border-slate-800 text-slate-300 hover:text-white bg-slate-950/40 hover:bg-slate-800/60"
                }`}
              >
                <Globe className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="text-[11px] sm:text-xs font-bold font-mono">{activeLang}</span>
              </button>

              {langOpen && (
                <div 
                  className="fixed inset-0 z-40 bg-transparent"
                  onClick={() => setLangOpen(false)}
                />
              )}

              {langOpen && (
                <div className="absolute right-0 mt-2 w-44 bg-slate-900 border border-slate-700/80 rounded-xl shadow-2xl p-2 z-50 text-left">
                  <button onClick={() => { setLanguage("EN"); setLangOpen(false); }} className={`w-full text-left px-3 py-2 text-xs rounded-lg font-semibold ${activeLang === "EN" ? "bg-accent text-slate-950 font-bold shadow-cyber" : "text-slate-200 hover:bg-slate-800"}`}>
                    English (EN)
                  </button>
                  <button onClick={() => { setLanguage("HI"); setLangOpen(false); }} className={`w-full text-left px-3 py-2 text-xs rounded-lg font-semibold ${activeLang === "HI" ? "bg-accent text-slate-950 font-bold shadow-cyber" : "text-slate-200 hover:bg-slate-800"}`}>
                    Hindi (HI)
                  </button>
                  <button onClick={() => { setLanguage("KN"); setLangOpen(false); }} className={`w-full text-left px-3 py-2 text-xs rounded-lg font-semibold ${activeLang === "KN" ? "bg-accent text-slate-950 font-bold shadow-cyber" : "text-slate-200 hover:bg-slate-800"}`}>
                    Kannada (KN)
                  </button>
                </div>
              )}
            </div>

            {/* Light/Dark Toggle */}
            <button
              onClick={toggleTheme}
              aria-label="Toggle Theme"
              className={`p-2 sm:p-2.5 border rounded-xl transition-colors ${
                theme === "light"
                  ? "border-slate-200 bg-slate-100/80 text-slate-700 hover:text-slate-900 hover:bg-slate-200"
                  : "border-slate-800 text-slate-300 hover:text-white bg-slate-950/40 hover:bg-slate-800/60"
              }`}
            >
              {theme === "light" ? <Moon className="w-4 h-4 sm:w-5 sm:h-5" /> : <Sun className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400" />}
            </button>
          </div>

        </header>

        {/* WORKSPACE PAGES VIEWS */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 relative min-w-0 w-full overflow-x-hidden">
          {children}
        </main>
      </div>

      {/* FLOATING AI ASSISTANT PANEL */}
      <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-40">
        {!chatOpen ? (
          <button
            onClick={() => setChatOpen(true)}
            aria-label="Open AI Assistant"
            className="p-3.5 sm:p-4 bg-accent hover:bg-cyan-400 text-slate-950 rounded-full shadow-cyberGlow flex items-center justify-center transition-all duration-300 hover:scale-110"
          >
            <MessageSquareCode className="w-5 h-5 sm:w-6 sm:h-6 animate-pulse" />
          </button>
        ) : (
          <div className="w-[calc(100vw-2rem)] sm:w-96 max-w-md h-[420px] sm:h-[450px] bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden glass-panel flex flex-col justify-between">
            {/* Chat header */}
            <div className="p-3.5 sm:p-4 bg-slate-950 border-b border-slate-850 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Sparkles className="w-4 h-4 text-accent animate-spin" style={{ animationDuration: '4s' }} />
                <span className="text-xs sm:text-sm font-bold text-white truncate">DocuShield AI Underwriter Chat</span>
              </div>
              <button onClick={() => setChatOpen(false)} className="text-slate-400 hover:text-white p-1">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Chat list */}
            <div className="flex-1 p-3 sm:p-4 overflow-y-auto space-y-3 font-sans text-xs">
              {chatHistory.map((chat, idx) => (
                <div key={idx} className={`flex ${chat.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`p-2.5 sm:p-3 rounded-xl max-w-[85%] sm:max-w-[80%] leading-relaxed ${
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
                placeholder="Ask RBI guides, ELA, alerts..."
                className="flex-1 bg-slate-900 border border-slate-800 focus:border-accent outline-none text-xs rounded-lg px-3 py-2 text-white placeholder-slate-500"
              />
              <button type="submit" className="p-2 sm:p-2.5 bg-accent hover:bg-cyan-400 text-slate-950 rounded-lg shrink-0">
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        )}
      </div>

    </div>
  );
}
