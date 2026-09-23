import React, { useState, useEffect, useMemo } from "react";
import {
  Mail,
  Search,
  RefreshCw,
  Star,
  Trash2,
  Paperclip,
  CheckCircle2,
  Clock,
  Send,
  Inbox,
  AlertCircle,
  FileText,
  Download,
  Eye,
  Settings,
  ExternalLink,
  ShieldCheck,
  ShieldAlert,
  Tag,
  ChevronRight,
  Filter,
  ArrowLeft,
  X,
  Plus,
  Unlink,
  Check,
  Key,
  Loader2
} from "lucide-react";

import { T } from "../lib/constants";
import { uid, todayISO } from "../lib/format";
import { fetchTable, updateRow, insertRow, deleteRow } from "../lib/db";
import { Card, Badge, Btn, Modal, Field, Input, Select } from "../components/ui";
import {
  FOXIC_EMAIL,
  getMailStatus,
  syncHostingerEmails,
  saveMailToken,
  markEmailReadStatus,
  markEmailStarStatus,
  trashEmailMessage,
  deleteEmailMessage,
  sendEmailMessage
} from "../lib/hostingerMail";

function formatFileSize(bytes) {
  if (!bytes) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

function openPdfViewer(attachment, email) {
  if (!attachment) return;
  const downloadUrl = attachment.data || (attachment.attachmentId ? `/api/mail/attachment/${encodeURIComponent(attachment.folderPath || "INBOX")}/${attachment.uid}/${encodeURIComponent(attachment.attachmentId)}` : null);
  if (!downloadUrl) return;

  const newWindow = window.open();
  if (newWindow) {
    newWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${attachment.name || "Email Attachment"}</title>
          <style>
            body { margin: 0; padding: 0; background: #1c1c1e; height: 100vh; overflow: hidden; font-family: system-ui, -apple-system, sans-serif; display: flex; flex-direction: column; }
            .bar { background: #2c2c2e; color: #fff; padding: 10px 16px; display: flex; justify-content: space-between; align-items: center; font-size: 14px; border-bottom: 1px solid #3a3a3c; }
            iframe { flex: 1; width: 100%; border: none; background: #fff; }
          </style>
        </head>
        <body>
          <div class="bar">
            <span>📎 ${attachment.name || "Document"}</span>
            <a href="${downloadUrl}" download="${attachment.name || "attachment"}" style="color: #0A84FF; text-decoration: none; font-weight: 500;">Download</a>
          </div>
          <iframe src="${downloadUrl}"></iframe>
        </body>
      </html>
    `);
  }
}

function formatEmailDate(dateStr) {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    if (isToday) {
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return d.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch (e) {
    return dateStr;
  }
}

export default function InboxModule({ ctx }) {
  const { emails = [], setEmails, toast, company, role } = ctx;

  const isAllowed = role === "Owner" || role === "Manager" || role === "Viewer";
  const isViewer = role === "Viewer";

  const [connectionStatus, setConnectionStatus] = useState({
    isConnected: false,
    accountEmail: FOXIC_EMAIL,
    maskedToken: null
  });
  const [selectedEmail, setSelectedEmail] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFolder, setSelectedFolder] = useState("inbox"); // inbox, starred, sent, trash
  const [selectedTag, setSelectedTag] = useState("all");
  const [filterType, setFilterType] = useState("all"); // all, unread, attachments
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isQuickReplying, setIsQuickReplying] = useState(false);
  const [quickReplyText, setQuickReplyText] = useState("");
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [showComposeModal, setShowComposeModal] = useState(false);
  const [tokenInput, setTokenInput] = useState("");

  // In-app floating alert notification
  const [notification, setNotification] = useState(null);
  const notifyTimerRef = React.useRef(null);

  const showNotification = (msg, type = "success") => {
    if (notifyTimerRef.current) clearTimeout(notifyTimerRef.current);
    setNotification({ msg, type });
    toast?.show(msg, type);
    notifyTimerRef.current = setTimeout(() => {
      setNotification(null);
    }, 4500);
  };

  // Compose form state
  const [composeForm, setComposeForm] = useState({
    to: "",
    subject: "",
    body: "",
    category: "General"
  });

  // Load real status & auto-sync on mount
  const checkStatus = async () => {
    try {
      const status = await getMailStatus();
      setConnectionStatus(status);
      return status;
    } catch (e) {
      console.warn("Status check failed", e);
      return { isConnected: false };
    }
  };

  useEffect(() => {
    (async () => {
      const status = await checkStatus();
      if (status.isConnected && emails.length === 0) {
        handleSyncMailbox(false);
      }
    })();
  }, []);

  // Filtered emails
  const filteredEmails = useMemo(() => {
    return (emails || []).filter(email => {
      // Folder check
      if (selectedFolder === "starred" && !email.is_starred) return false;
      if (selectedFolder === "sent" && email.folder !== "sent") return false;
      if (selectedFolder === "trash" && email.folder !== "trash") return false;
      if (selectedFolder === "inbox" && email.folder === "trash") return false;

      // Filter pills
      if (filterType === "unread" && email.is_read) return false;
      if (filterType === "attachments" && (!email.attachments || email.attachments.length === 0)) return false;

      // Tag
      if (selectedTag !== "all" && email.category !== selectedTag) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const fromMatch = (email.sender_name || "").toLowerCase().includes(q) || (email.sender_email || "").toLowerCase().includes(q);
        const subjMatch = (email.subject || "").toLowerCase().includes(q);
        const bodyMatch = (email.body_text || email.snippet || "").toLowerCase().includes(q);
        if (!fromMatch && !subjMatch && !bodyMatch) return false;
      }

      return true;
    }).sort((a, b) => new Date(b.received_at || b.date || 0) - new Date(a.received_at || a.date || 0));
  }, [emails, selectedFolder, filterType, selectedTag, searchQuery]);

  // Counts
  const counts = useMemo(() => {
    const list = emails || [];
    return {
      inbox: list.filter(e => e.folder !== "trash").length,
      unread: list.filter(e => !e.is_read && e.folder !== "trash").length,
      starred: list.filter(e => e.is_starred).length,
      attachments: list.filter(e => e.attachments && e.attachments.length > 0 && e.folder !== "trash").length,
      trash: list.filter(e => e.folder === "trash").length,
    };
  }, [emails]);

  // ── Actions ──

  // Real Email Sync from Hostinger Mail API
  const handleSyncMailbox = async (showToast = true) => {
    setIsSyncing(true);
    try {
      const syncResult = await syncHostingerEmails();
      if (syncResult.success && Array.isArray(syncResult.emails)) {
        setEmails(syncResult.emails);
        await checkStatus();
        if (showToast) {
          showNotification(`Synced ${syncResult.count} real emails from ${FOXIC_EMAIL}`, "success");
        }
      }
    } catch (err) {
      console.error("Hostinger sync failed:", err);
      if (showToast) {
        showNotification(`Sync error: ${err.message}`, "error");
      }
    } finally {
      setIsSyncing(false);
    }
  };

  // Save Token Config
  const handleSaveToken = async () => {
    if (!tokenInput.trim()) {
      showNotification("Please enter a valid Hostinger Agentic Mail API Token.", "error");
      return;
    }
    try {
      await saveMailToken(tokenInput.trim());
      setShowConfigModal(false);
      setTokenInput("");
      const st = await checkStatus();
      if (st.isConnected) {
        showNotification(`Hostinger Mail connected for ${FOXIC_EMAIL}`, "success");
        handleSyncMailbox(true);
      } else {
        showNotification("Token saved, but authentication check failed. Please verify the token.", "error");
      }
    } catch (e) {
      showNotification(`Failed to save token: ${e.message}`, "error");
    }
  };

  // Read status toggle
  const handleMarkAsRead = async (email, readStatus = true) => {
    try {
      const updated = { ...email, is_read: readStatus };
      setEmails(prev => prev.map(e => e.id === email.id ? updated : e));
      if (selectedEmail?.id === email.id) {
        setSelectedEmail(updated);
      }
      if (email.uid) {
        await markEmailReadStatus(email.raw_folder, email.uid, readStatus);
      }
      if (email.id && !email.id.startsWith("hostinger_")) {
        try { await updateRow("emails", email.id, { is_read: readStatus }); } catch (e) { }
      }
    } catch (err) {
      console.error("Failed to update read status", err);
    }
  };

  const handleToggleStar = async (e, email) => {
    e?.stopPropagation();
    try {
      const updated = { ...email, is_starred: !email.is_starred };
      setEmails(prev => prev.map(item => item.id === email.id ? updated : item));
      if (selectedEmail?.id === email.id) {
        setSelectedEmail(updated);
      }
      if (email.uid) {
        await markEmailStarStatus(email.raw_folder, email.uid, updated.is_starred);
      }
      if (email.id && !email.id.startsWith("hostinger_")) {
        try { await updateRow("emails", email.id, { is_starred: updated.is_starred }); } catch (e) { }
      }
      showNotification(updated.is_starred ? "Email starred" : "Email unstarred", "info");
    } catch (err) {
      console.error("Failed to star email", err);
    }
  };

  // Real Delete / Move to Trash on Hostinger Mail Server
  const handleMoveToTrash = async (e, email) => {
    e?.stopPropagation();
    if (!email) return;

    const isTrash = email.folder === "trash" || (email.raw_folder || "").toLowerCase().includes("trash");
    const confirmMsg = isTrash
      ? "Permanently delete this email from Hostinger mailbox?"
      : "Move this email to Trash on Hostinger mailbox?";

    if (!window.confirm(confirmMsg)) return;

    setIsDeleting(true);
    try {
      // Optimistically remove from visible list
      setEmails(prev => prev.filter(item => item.id !== email.id));
      if (selectedEmail?.id === email.id) setSelectedEmail(null);

      if (isTrash) {
        // Permanently delete on Hostinger server
        if (email.uid) {
          await deleteEmailMessage(email.raw_folder || "INBOX.Trash", email.uid);
        }
        if (email.id && !email.id.startsWith("hostinger_")) {
          try { await deleteRow("emails", email.id); } catch (e) { }
        }
        showNotification("Email permanently deleted from Hostinger mailbox", "info");
      } else {
        // Move to Trash on Hostinger server
        if (email.uid) {
          await trashEmailMessage(email.raw_folder || "INBOX", email.uid);
        }
        if (email.id && !email.id.startsWith("hostinger_")) {
          try { await updateRow("emails", email.id, { folder: "trash" }); } catch (e) { }
        }
        showNotification("Moved to Trash on Hostinger mailbox", "info");
      }

      // Re-sync mailbox in background to get real updated state & UIDs from Hostinger
      setTimeout(() => {
        handleSyncMailbox(false);
      }, 1000);
    } catch (err) {
      console.error("Failed to delete email:", err);
      showNotification(`Delete error: ${err.message}`, "error");
      handleSyncMailbox(false);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSelectEmail = (email) => {
    setSelectedEmail(email);
    setQuickReplyText("");
    if (!email.is_read) {
      handleMarkAsRead(email, true);
    }
  };

  // Helper to extract clean pure email
  const extractCleanEmail = (str) => {
    if (!str) return "";
    const m = String(str).match(/<([^>]+)>/) || String(str).match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
    return m ? m[1].trim() : String(str).trim();
  };

  // Calculate intelligent reply recipient
  const isSelectedFromSelf = selectedEmail && (selectedEmail.sender_email || "").toLowerCase() === FOXIC_EMAIL.toLowerCase();
  const rawReplyEmail = selectedEmail ? (isSelectedFromSelf ? (selectedEmail.recipient_email || "") : (selectedEmail.sender_email || "")) : "";
  const replyTargetEmail = extractCleanEmail(rawReplyEmail);
  const replyTargetName = selectedEmail ? (isSelectedFromSelf ? (selectedEmail.recipient_email?.split("@")[0] || "Recipient") : (selectedEmail.sender_name || selectedEmail.sender_email || "Sender")) : "";

  // Real Send / Compose Modal via Hostinger Mail API
  const handleSendEmail = async () => {
    const cleanTo = extractCleanEmail(composeForm.to);
    if (!cleanTo) {
      showNotification("Please enter a valid recipient email address.", "error");
      return;
    }
    if (!composeForm.subject || !composeForm.subject.trim()) {
      showNotification("Please enter an email subject.", "error");
      return;
    }

    setIsSending(true);
    try {
      await sendEmailMessage({
        to: cleanTo,
        subject: composeForm.subject.trim(),
        text: composeForm.body,
        displayName: "Foxic Admin"
      });

      showNotification(`Email successfully sent to ${cleanTo}`, "success");
      setShowComposeModal(false);
      setComposeForm({ to: "", subject: "", body: "", category: "General" });

      // Auto-refresh mailbox to pull the sent message into the list
      setTimeout(() => {
        handleSyncMailbox(false);
      }, 1200);
    } catch (err) {
      console.error("Send email error:", err);
      showNotification(`Failed to send email: ${err.message}`, "error");
    } finally {
      setIsSending(false);
    }
  };

  // Inline Quick Reply directly in reader
  const handleSendQuickReply = async () => {
    if (!quickReplyText.trim()) {
      showNotification("Please enter a message to reply.", "error");
      return;
    }
    if (!replyTargetEmail) {
      showNotification("No valid recipient email address found to reply.", "error");
      return;
    }

    const replySubject = selectedEmail.subject.startsWith("Re:") ? selectedEmail.subject : `Re: ${selectedEmail.subject}`;
    const quotedBody = `${quickReplyText.trim()}\n\n--- On ${new Date(selectedEmail.received_at).toLocaleString()}, ${selectedEmail.sender_name || selectedEmail.sender_email} wrote:\n> ${selectedEmail.snippet || selectedEmail.body_text}`;

    setIsQuickReplying(true);
    try {
      await sendEmailMessage({
        to: replyTargetEmail,
        subject: replySubject,
        text: quotedBody,
        displayName: "Foxic Admin"
      });

      showNotification(`Reply successfully sent to ${replyTargetEmail}`, "success");
      setQuickReplyText("");

      // Auto-refresh mailbox in background
      setTimeout(() => {
        handleSyncMailbox(false);
      }, 1200);
    } catch (err) {
      console.error("Quick reply error:", err);
      showNotification(`Failed to send reply: ${err.message}`, "error");
    } finally {
      setIsQuickReplying(false);
    }
  };

  if (!isAllowed) {
    return (
      <div style={{ padding: "60px 20px", display: "flex", justifyContent: "center" }}>
        <Card style={{ maxWidth: 480, textAlign: "center", padding: "36px 28px", border: `1px solid ${T.border}` }}>
          <div style={{
            width: 52,
            height: 52,
            borderRadius: "50%",
            background: T.redWash,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 16px"
          }}>
            <ShieldAlert size={26} color={T.red} />
          </div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: T.ink, margin: "0 0 8px" }}>
            Access Restricted
          </h2>
          <p style={{ fontSize: 13, color: T.inkSoft, margin: "0 0 24px", lineHeight: 1.5 }}>
            Company Email communications are confidential. Only <b>Business Owner</b> and <b>Operations Manager</b> accounts are permitted to access the Email / Inbox workspace.
          </p>
          <Btn
            variant="primary"
            onClick={() => ctx.setActiveTab?.("dashboard")}
            style={{ margin: "0 auto", background: T.navy }}
          >
            Return to Dashboard
          </Btn>
        </Card>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, minHeight: "calc(100vh - 120px)", position: "relative" }}>
      {/* ── IN-APP FLOATING NOTIFICATION TOAST ── */}
      {notification && (
        <div style={{
          position: "fixed",
          top: 24,
          right: 28,
          zIndex: 9999,
          background: notification.type === "error" ? "#FF3B30" : notification.type === "info" ? "#5856D6" : "#248A3D",
          color: "#fff",
          padding: "12px 20px",
          borderRadius: 12,
          boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
          display: "flex",
          alignItems: "center",
          gap: 10,
          fontSize: 13,
          fontWeight: 600,
          animation: "slideInRight 0.25s ease-out"
        }}>
          {notification.type === "error" ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
          <span>{notification.msg}</span>
          <button
            onClick={() => setNotification(null)}
            style={{ background: "none", border: "none", color: "#fff", cursor: "pointer", padding: 2, marginLeft: 8 }}
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* ── TOP BANNER & HEADER ── */}
      <div style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16,
        background: T.surface,
        padding: "16px 22px",
        borderRadius: 16,
        border: `1px solid ${T.border}`,
        boxShadow: "0 2px 8px rgba(0,0,0,0.03)"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            background: connectionStatus.isConnected
              ? "linear-gradient(135deg, #248A3D 0%, #34C759 100%)"
              : "linear-gradient(135deg, #0071E3 0%, #47a3ff 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
            boxShadow: connectionStatus.isConnected
              ? "0 4px 12px rgba(36,138,61,0.25)"
              : "0 4px 12px rgba(0,113,227,0.25)"
          }}>
            <Mail size={22} />
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <h1 style={{ fontSize: 20, fontWeight: 700, color: T.ink, margin: 0 }}>
                Email / Inbox
              </h1>

              {/* Real Hostinger Connection Status Badge */}
              {connectionStatus.isConnected ? (
                <span style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "3px 10px",
                  borderRadius: 20,
                  fontSize: 12,
                  fontWeight: 600,
                  background: T.emeraldWash,
                  color: T.emerald,
                  border: "1px solid rgba(36,138,61,0.2)"
                }}>
                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#248A3D" }} />
                  Connected · Hostinger Mail ({FOXIC_EMAIL})
                </span>
              ) : (
                <span style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "3px 10px",
                  borderRadius: 20,
                  fontSize: 12,
                  fontWeight: 600,
                  background: T.amberWash,
                  color: T.amber,
                  border: "1px solid rgba(176,109,0,0.2)"
                }}>
                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#FF9F0A" }} />
                  Not Connected · {FOXIC_EMAIL}
                </span>
              )}
            </div>
            <p style={{ margin: "3px 0 0 0", fontSize: 13, color: T.inkSoft }}>
              {connectionStatus.isConnected
                ? `Live Hostinger Agentic Mail integration for ${FOXIC_EMAIL}. Real-time REST API connected.`
                : `Connect ${FOXIC_EMAIL} via Hostinger Agentic Mail API to fetch live emails.`}
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* Sync Button */}
          <Btn
            variant={connectionStatus.isConnected ? "primary" : "outline"}
            onClick={() => handleSyncMailbox(true)}
            style={{ display: "flex", alignItems: "center", gap: 6, background: connectionStatus.isConnected ? T.navy : undefined }}
            disabled={isSyncing}
          >
            <RefreshCw size={15} style={{ animation: isSyncing ? "spin 1s linear infinite" : "none" }} />
            {isSyncing ? "Syncing..." : "Sync Mail"}
          </Btn>

          {/* Configure Hostinger Token */}
          {!isViewer && (
            <Btn
              variant="outline"
              onClick={() => setShowConfigModal(true)}
              style={{ display: "flex", alignItems: "center", gap: 6 }}
              title="Configure Hostinger Agentic Mail API Token"
            >
              <Key size={15} />
              API Token
            </Btn>
          )}

          {/* Compose Button */}
          {!isViewer && (
            <Btn
              variant="primary"
              onClick={() => {
                setComposeForm({ to: "", subject: "", body: "", category: "General" });
                setShowComposeModal(true);
              }}
              style={{ display: "flex", alignItems: "center", gap: 6, background: T.navy }}
            >
              <Plus size={16} />
              Compose
            </Btn>
          )}
        </div>
      </div>

      {/* ── NOT CONNECTED BANNER (If not connected) ── */}
      {!connectionStatus.isConnected && (
        <div style={{
          background: "linear-gradient(135deg, #FFF9EB 0%, #FFFFFF 100%)",
          border: "1px solid rgba(176, 109, 0, 0.25)",
          borderRadius: 14,
          padding: "16px 20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 14
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              background: T.amberWash,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: T.amber
            }}>
              <ShieldAlert size={22} />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: T.ink }}>
                Hostinger Agentic Mail API Token Required
              </div>
              <div style={{ fontSize: 12, color: T.inkSoft, marginTop: 2 }}>
                Provide your Hostinger Mail Bearer token to connect {FOXIC_EMAIL} and fetch live incoming messages.
              </div>
            </div>
          </div>

          <Btn
            variant="primary"
            onClick={() => setShowConfigModal(true)}
            style={{ background: T.navy, display: "flex", alignItems: "center", gap: 6 }}
          >
            <Key size={16} />
            Enter API Token
          </Btn>
        </div>
      )}

      {/* ── KPI METRICS CARDS ── */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
        gap: 14
      }}>
        <Card style={{ padding: "14px 18px", display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: T.navyWash, color: T.navy, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Inbox size={20} />
          </div>
          <div>
            <div style={{ fontSize: 12, color: T.inkSoft, fontWeight: 500 }}>Total Synced Emails</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: T.ink }}>{counts.inbox}</div>
          </div>
        </Card>

        <Card style={{ padding: "14px 18px", display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: T.redWash, color: T.red, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Mail size={20} />
          </div>
          <div>
            <div style={{ fontSize: 12, color: T.inkSoft, fontWeight: 500 }}>Unread Emails</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: counts.unread > 0 ? T.red : T.ink }}>{counts.unread}</div>
          </div>
        </Card>

        <Card style={{ padding: "14px 18px", display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: T.amberWash, color: T.amber, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Star size={20} />
          </div>
          <div>
            <div style={{ fontSize: 12, color: T.inkSoft, fontWeight: 500 }}>Starred / Important</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: T.ink }}>{counts.starred}</div>
          </div>
        </Card>

        <Card style={{ padding: "14px 18px", display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: T.emeraldWash, color: T.emerald, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Paperclip size={20} />
          </div>
          <div>
            <div style={{ fontSize: 12, color: T.inkSoft, fontWeight: 500 }}>With Attachments</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: T.ink }}>{counts.attachments}</div>
          </div>
        </Card>
      </div>

      {/* ── MAIN INBOX SPLIT LAYOUT ── */}
      <div style={{
        display: "grid",
        gridTemplateColumns: selectedEmail ? "220px 380px 1fr" : "220px 1fr",
        gap: 16,
        alignItems: "start",
        transition: "all 0.2s ease"
      }}>
        {/* 1. LEFT FOLDERS & LABELS SIDEBAR */}
        <Card style={{ padding: 12, display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Folders */}
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: T.inkFaint, padding: "4px 8px" }}>
              Mailboxes
            </div>
            {[
              { id: "inbox", label: "Inbox", icon: Inbox, count: counts.unread },
              { id: "starred", label: "Starred", icon: Star, count: counts.starred },
              { id: "sent", label: "Sent Mail", icon: Send, count: 0 },
              { id: "trash", label: "Trash", icon: Trash2, count: counts.trash },
            ].map(folder => {
              const Icon = folder.icon;
              const active = selectedFolder === folder.id;
              return (
                <button
                  key={folder.id}
                  onClick={() => {
                    setSelectedFolder(folder.id);
                    setSelectedEmail(null);
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "9px 12px",
                    borderRadius: 10,
                    border: "none",
                    background: active ? T.navyWash : "transparent",
                    color: active ? T.navy : T.ink,
                    fontWeight: active ? 600 : 500,
                    fontSize: 13,
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "all 0.15s ease"
                  }}
                >
                  <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <Icon size={16} color={active ? T.navy : T.inkSoft} />
                    {folder.label}
                  </span>
                  {folder.count > 0 && (
                    <span style={{
                      fontSize: 11,
                      fontWeight: 700,
                      padding: "2px 7px",
                      borderRadius: 12,
                      background: active ? T.navy : T.borderSoft,
                      color: active ? "#fff" : T.inkSoft
                    }}>
                      {folder.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div style={{ height: 1, background: T.borderSoft }} />

          {/* Categories */}
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: T.inkFaint, padding: "4px 8px" }}>
              Categories
            </div>
            {[
              { id: "all", label: "All Categories", color: T.navy },
              { id: "Inquiry", label: "Inquiries & Orders", color: "#AF52DE" },
              { id: "Billing", label: "Billing & Accounts", color: "#FF9F0A" },
              { id: "Support", label: "Support & Codes", color: "#34C759" },
              { id: "General", label: "General", color: "#8E8E93" },
            ].map(cat => (
              <button
                key={cat.id}
                onClick={() => setSelectedTag(cat.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "7px 10px",
                  borderRadius: 8,
                  border: "none",
                  background: selectedTag === cat.id ? "rgba(0,0,0,0.04)" : "transparent",
                  color: selectedTag === cat.id ? T.ink : T.inkSoft,
                  fontWeight: selectedTag === cat.id ? 600 : 400,
                  fontSize: 12,
                  cursor: "pointer",
                  textAlign: "left"
                }}
              >
                <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: cat.color }} />
                  {cat.label}
                </span>
              </button>
            ))}
          </div>

          <div style={{ height: 1, background: T.borderSoft }} />

          {/* Connection Status Box */}
          <div style={{
            background: connectionStatus.isConnected ? "rgba(36,138,61,0.06)" : "rgba(176,109,0,0.06)",
            border: `1px solid ${connectionStatus.isConnected ? "rgba(36,138,61,0.2)" : "rgba(176,109,0,0.2)"}`,
            borderRadius: 10,
            padding: 10,
            fontSize: 11,
            color: T.inkSoft
          }}>
            <div style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              fontWeight: 600,
              color: connectionStatus.isConnected ? T.emerald : T.amber,
              marginBottom: 4
            }}>
              <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                {connectionStatus.isConnected ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                {connectionStatus.isConnected ? "Hostinger Mail Active" : "Token Not Connected"}
              </span>
            </div>
            {connectionStatus.isConnected ? (
              <div>
                Mailbox: <b style={{ color: T.ink }}>{FOXIC_EMAIL}</b><br />
                Token: <code style={{ color: T.inkSoft, fontSize: 10 }}>{connectionStatus.maskedToken}</code>
              </div>
            ) : (
              <div>
                Click <b>"API Token"</b> above to connect {FOXIC_EMAIL}.
              </div>
            )}
          </div>
        </Card>

        {/* 2. EMAIL LIST VIEW */}
        <Card style={{ padding: 0, overflow: "hidden", display: "flex", flexDirection: "column", height: "calc(100vh - 270px)", minHeight: 520 }}>
          {/* List Toolbar */}
          <div style={{
            padding: "12px 16px",
            borderBottom: `1px solid ${T.border}`,
            background: "#FAFAFC",
            display: "flex",
            flexDirection: "column",
            gap: 10
          }}>
            {/* Search Input */}
            <div style={{ position: "relative", width: "100%" }}>
              <Search size={15} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: T.inkFaint }} />
              <input
                type="text"
                placeholder="Search real sender, subject, message body..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: "100%",
                  padding: "8px 12px 8px 34px",
                  borderRadius: 10,
                  border: `1px solid ${T.border}`,
                  fontSize: 13,
                  outline: "none",
                  background: "#fff"
                }}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: T.inkFaint }}
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Filter Pills */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                {[
                  { id: "all", label: "All" },
                  { id: "unread", label: "Unread" },
                  { id: "attachments", label: "Attachments" },
                ].map(filter => (
                  <button
                    key={filter.id}
                    onClick={() => setFilterType(filter.id)}
                    style={{
                      padding: "4px 10px",
                      borderRadius: 14,
                      border: "none",
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: "pointer",
                      background: filterType === filter.id ? T.navy : T.borderSoft,
                      color: filterType === filter.id ? "#fff" : T.inkSoft,
                      transition: "all 0.15s ease"
                    }}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
              <span style={{ fontSize: 12, color: T.inkFaint }}>
                {filteredEmails.length} {filteredEmails.length === 1 ? "email" : "emails"}
              </span>
            </div>
          </div>

          {/* List Rows */}
          <div style={{ flex: 1, overflowY: "auto" }}>
            {filteredEmails.length === 0 ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", padding: 30, textAlign: "center", color: T.inkSoft }}>
                <Mail size={40} strokeWidth={1.5} color={T.inkFaint} style={{ marginBottom: 12 }} />
                <div style={{ fontSize: 15, fontWeight: 600, color: T.ink }}>
                  {connectionStatus.isConnected ? "No emails found" : "Hostinger Mail Not Connected"}
                </div>
                <div style={{ fontSize: 13, color: T.inkFaint, marginTop: 4, maxWidth: 340 }}>
                  {connectionStatus.isConnected
                    ? "Click 'Sync Mail' above to load live messages from info@foxic.in."
                    : "Configure your Hostinger Agentic Mail API Token to fetch live mailbox data."}
                </div>
                {connectionStatus.isConnected ? (
                  <Btn
                    variant="primary"
                    onClick={() => handleSyncMailbox(true)}
                    disabled={isSyncing}
                    style={{ marginTop: 14, background: T.navy, display: "flex", alignItems: "center", gap: 6 }}
                  >
                    <RefreshCw size={15} style={{ animation: isSyncing ? "spin 1s linear infinite" : "none" }} />
                    {isSyncing ? "Syncing..." : "Sync Mail Now"}
                  </Btn>
                ) : (
                  <Btn
                    variant="primary"
                    onClick={() => setShowConfigModal(true)}
                    style={{ marginTop: 14, background: T.navy, display: "flex", alignItems: "center", gap: 6 }}
                  >
                    <Key size={16} />
                    Enter API Token
                  </Btn>
                )}
              </div>
            ) : (
              filteredEmails.map(email => {
                const isSelected = selectedEmail?.id === email.id;
                const isUnread = !email.is_read;
                const hasAttachments = email.attachments && email.attachments.length > 0;

                return (
                  <div
                    key={email.id}
                    onClick={() => handleSelectEmail(email)}
                    style={{
                      padding: "12px 16px",
                      borderBottom: `1px solid ${T.borderSoft}`,
                      background: isSelected ? "rgba(0,113,227,0.06)" : isUnread ? "rgba(0,113,227,0.02)" : "#fff",
                      cursor: "pointer",
                      transition: "background 0.15s ease",
                      borderLeft: isSelected ? `4px solid ${T.navy}` : isUnread ? `4px solid #0071E3` : "4px solid transparent",
                      display: "flex",
                      flexDirection: "column",
                      gap: 6
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      {/* Sender */}
                      <div style={{ display: "flex", alignItems: "center", gap: 8, overflow: "hidden" }}>
                        <button
                          onClick={(e) => handleToggleStar(e, email)}
                          style={{
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            padding: 0,
                            display: "flex",
                            alignItems: "center"
                          }}
                        >
                          <Star
                            size={16}
                            fill={email.is_starred ? "#FF9F0A" : "none"}
                            color={email.is_starred ? "#FF9F0A" : T.inkFaint}
                          />
                        </button>
                        <span style={{
                          fontWeight: isUnread ? 700 : 600,
                          fontSize: 13,
                          color: T.ink,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis"
                        }}>
                          {email.sender_name || email.sender_email}
                        </span>
                      </div>

                      {/* Date & Unread badge */}
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontSize: 11, color: isUnread ? T.navy : T.inkFaint, fontWeight: isUnread ? 600 : 400 }}>
                          {formatEmailDate(email.received_at)}
                        </span>
                        {isUnread && (
                          <span style={{ width: 8, height: 8, borderRadius: "50%", background: T.navy }} />
                        )}
                      </div>
                    </div>

                    {/* Subject */}
                    <div style={{
                      fontSize: 13,
                      fontWeight: isUnread ? 600 : 500,
                      color: T.ink,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis"
                    }}>
                      {email.subject}
                    </div>

                    {/* Snippet */}
                    <div style={{
                      fontSize: 12,
                      color: T.inkSoft,
                      lineHeight: "1.4",
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden"
                    }}>
                      {email.snippet || email.body_text}
                    </div>

                    {/* Tags & Attachments & Quick Delete */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 2 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        {email.category && (
                          <span style={{
                            fontSize: 10,
                            fontWeight: 600,
                            padding: "2px 6px",
                            borderRadius: 6,
                            background: "#F2F2F7",
                            color: T.inkSoft
                          }}>
                            {email.category}
                          </span>
                        )}
                        {hasAttachments && (
                          <span style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                            fontSize: 10,
                            fontWeight: 600,
                            padding: "2px 6px",
                            borderRadius: 6,
                            background: T.navyWash,
                            color: T.navy
                          }}>
                            <Paperclip size={10} />
                            {email.attachments.length}
                          </span>
                        )}
                      </div>

                      {/* Quick Delete button */}
                      {!isViewer && (
                        <button
                          onClick={(e) => handleMoveToTrash(e, email)}
                          title={email.folder === "trash" || (email.raw_folder || "").toLowerCase().includes("trash") ? "Delete permanently" : "Move to trash"}
                          style={{
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            padding: "4px 6px",
                            borderRadius: 6,
                            color: T.inkFaint,
                            display: "flex",
                            alignItems: "center",
                            transition: "color 0.15s ease"
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.color = T.red}
                          onMouseLeave={(e) => e.currentTarget.style.color = T.inkFaint}
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </Card>

        {/* 3. EMAIL DETAIL READER */}
        {selectedEmail && (
          <Card style={{
            padding: 0,
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            height: "calc(100vh - 270px)",
            minHeight: 520,
            border: `1px solid ${T.border}`
          }}>
            {/* Reader Header */}
            <div style={{
              padding: "16px 20px",
              borderBottom: `1px solid ${T.border}`,
              background: "#FAFAFC",
              display: "flex",
              flexDirection: "column",
              gap: 12
            }}>
              {/* Action Buttons Top Row */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <button
                    onClick={() => setSelectedEmail(null)}
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      color: T.inkSoft,
                      padding: 4
                    }}
                    title="Close email preview"
                  >
                    <ArrowLeft size={18} />
                  </button>
                  <button
                    onClick={(e) => handleToggleStar(e, selectedEmail)}
                    style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}
                    title={selectedEmail.is_starred ? "Unstar" : "Star"}
                  >
                    <Star
                      size={18}
                      fill={selectedEmail.is_starred ? "#FF9F0A" : "none"}
                      color={selectedEmail.is_starred ? "#FF9F0A" : T.inkFaint}
                    />
                  </button>
                  <button
                    onClick={() => handleMarkAsRead(selectedEmail, !selectedEmail.is_read)}
                    style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: T.inkSoft, fontSize: 12 }}
                    title="Toggle Read/Unread"
                  >
                    {selectedEmail.is_read ? "Mark as Unread" : "Mark as Read"}
                  </button>
                </div>

                {!isViewer && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <button
                      onClick={(e) => handleMoveToTrash(e, selectedEmail)}
                      disabled={isDeleting}
                      style={{
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        padding: "6px 10px",
                        borderRadius: 8,
                        color: T.red,
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                        fontSize: 12,
                        fontWeight: 600,
                        opacity: isDeleting ? 0.5 : 1
                      }}
                    >
                      <Trash2 size={15} />
                      {selectedEmail.folder === "trash" || (selectedEmail.raw_folder || "").toLowerCase().includes("trash") ? "Delete Permanently" : "Delete"}
                    </button>
                  </div>
                )}
              </div>

              {/* Subject & Category */}
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <h2 style={{ fontSize: 18, fontWeight: 700, color: T.ink, margin: 0, lineHeight: 1.3 }}>
                    {selectedEmail.subject}
                  </h2>
                  {selectedEmail.category && (
                    <span style={{
                      fontSize: 11,
                      fontWeight: 600,
                      padding: "2px 8px",
                      borderRadius: 12,
                      background: T.navyWash,
                      color: T.navy
                    }}>
                      {selectedEmail.category}
                    </span>
                  )}
                </div>
              </div>

              {/* Sender & Recipient info */}
              <div style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "10px 14px",
                background: "#fff",
                borderRadius: 10,
                border: `1px solid ${T.borderSoft}`
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{
                    width: 36,
                    height: 36,
                    borderRadius: "50%",
                    background: "linear-gradient(135deg, #0071E3, #5E5CE6)",
                    color: "#fff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 700,
                    fontSize: 14
                  }}>
                    {(selectedEmail.sender_name || selectedEmail.sender_email || "E")[0].toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: T.ink }}>
                      {selectedEmail.sender_name} <span style={{ fontWeight: 400, color: T.inkSoft }}>&lt;{selectedEmail.sender_email}&gt;</span>
                    </div>
                    <div style={{ fontSize: 11, color: T.inkFaint }}>
                      To: <span style={{ color: T.navy, fontWeight: 500 }}>{selectedEmail.recipient_email || FOXIC_EMAIL}</span>
                    </div>
                  </div>
                </div>

                <div style={{ fontSize: 12, color: T.inkSoft }}>
                  {formatEmailDate(selectedEmail.received_at)}
                </div>
              </div>
            </div>

            {/* Attachments list bar */}
            {selectedEmail.attachments && selectedEmail.attachments.length > 0 && (
              <div style={{
                padding: "12px 20px",
                background: "#F8F9FA",
                borderBottom: `1px solid ${T.border}`,
                display: "flex",
                flexDirection: "column",
                gap: 8
              }}>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: T.inkFaint, display: "flex", alignItems: "center", gap: 6 }}>
                  <Paperclip size={12} />
                  Attachments ({selectedEmail.attachments.length})
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                  {selectedEmail.attachments.map((att, index) => {
                    const downloadUrl = att.data || (att.attachmentId ? `/api/mail/attachment/${encodeURIComponent(att.folderPath || "INBOX")}/${att.uid}/${encodeURIComponent(att.attachmentId)}` : "#");
                    const isPdf = (att.name || "").toLowerCase().endsWith(".pdf") || att.type?.includes("pdf");

                    return (
                      <div
                        key={index}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          padding: "6px 12px",
                          borderRadius: 8,
                          background: "#fff",
                          border: `1px solid ${T.border}`,
                          fontSize: 12
                        }}
                      >
                        <FileText size={16} color={isPdf ? T.red : T.navy} />
                        <div>
                          <div style={{ fontWeight: 600, color: T.ink }}>{att.name || "Attachment"}</div>
                          <div style={{ fontSize: 10, color: T.inkFaint }}>{formatFileSize(att.size)}</div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 4, marginLeft: 8 }}>
                          {isPdf && (
                            <button
                              onClick={() => openPdfViewer(att, selectedEmail)}
                              style={{
                                background: T.navyWash,
                                color: T.navy,
                                border: "none",
                                borderRadius: 6,
                                padding: "4px 8px",
                                fontSize: 11,
                                fontWeight: 600,
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                gap: 4
                              }}
                            >
                              <Eye size={12} />
                              Preview
                            </button>
                          )}
                          <a
                            href={downloadUrl}
                            download={att.name || "download"}
                            style={{
                              background: T.borderSoft,
                              color: T.ink,
                              borderRadius: 6,
                              padding: "4px 8px",
                              fontSize: 11,
                              fontWeight: 600,
                              textDecoration: "none",
                              display: "flex",
                              alignItems: "center",
                              gap: 4
                            }}
                          >
                            <Download size={12} />
                            Download
                          </a>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Email Body Content */}
            <div style={{
              flex: 1,
              padding: "20px 24px",
              overflowY: "auto",
              fontSize: 14,
              color: T.ink,
              lineHeight: 1.6
            }}>
              {selectedEmail.body_html ? (
                <div
                  dangerouslySetInnerHTML={{ __html: selectedEmail.body_html }}
                  style={{ wordBreak: "break-word" }}
                />
              ) : (
                <div style={{ whiteSpace: "pre-wrap" }}>
                  {selectedEmail.body_text || selectedEmail.snippet}
                </div>
              )}
            </div>

            {/* Bottom Inline Quick Reply Section */}
            {!isViewer && (
              <div style={{
                padding: "16px 20px",
                borderTop: `1px solid ${T.border}`,
                background: "#FAFAFC",
                display: "flex",
                flexDirection: "column",
                gap: 10
              }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ fontSize: 12, color: T.inkSoft, display: "flex", alignItems: "center", gap: 6 }}>
                    <span>Replying to:</span>
                    <b style={{ color: T.navy }}>{replyTargetEmail || selectedEmail.sender_email}</b>
                    <span style={{ color: T.inkFaint }}>· from {FOXIC_EMAIL}</span>
                  </div>
                  <button
                    onClick={() => {
                      setComposeForm({
                        to: replyTargetEmail || selectedEmail.sender_email,
                        subject: selectedEmail.subject.startsWith("Re:") ? selectedEmail.subject : `Re: ${selectedEmail.subject}`,
                        body: `\n\n--- On ${new Date(selectedEmail.received_at).toLocaleString()}, ${selectedEmail.sender_name || selectedEmail.sender_email} wrote:\n> ${selectedEmail.snippet || selectedEmail.body_text}`,
                        category: selectedEmail.category || "General"
                      });
                      setShowComposeModal(true);
                    }}
                    style={{
                      background: "none",
                      border: "none",
                      color: T.navy,
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      padding: 0
                    }}
                  >
                    <ExternalLink size={13} />
                    Full Compose Modal
                  </button>
                </div>

                {/* Inline Text Area */}
                <div style={{ position: "relative" }}>
                  <textarea
                    rows={3}
                    placeholder={`Write a quick reply to ${replyTargetName.split(" ")[0]}...`}
                    value={quickReplyText}
                    onChange={(e) => setQuickReplyText(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "10px 14px",
                      borderRadius: 10,
                      border: `1px solid ${T.border}`,
                      background: "#fff",
                      fontSize: 13,
                      outline: "none",
                      fontFamily: "inherit",
                      resize: "none",
                      boxShadow: "inset 0 1px 2px rgba(0,0,0,0.03)"
                    }}
                  />
                </div>

                <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8 }}>
                  {quickReplyText.trim() && (
                    <Btn
                      variant="outline"
                      onClick={() => setQuickReplyText("")}
                      style={{ fontSize: 12, padding: "6px 12px" }}
                    >
                      Clear
                    </Btn>
                  )}
                  <Btn
                    variant="primary"
                    onClick={handleSendQuickReply}
                    disabled={isQuickReplying || !quickReplyText.trim()}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      background: T.navy,
                      fontSize: 13,
                      padding: "8px 16px",
                      opacity: (isQuickReplying || !quickReplyText.trim()) ? 0.6 : 1
                    }}
                  >
                    {isQuickReplying ? (
                      <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} />
                    ) : (
                      <Send size={14} />
                    )}
                    {isQuickReplying ? "Sending..." : `Send Reply`}
                  </Btn>
                </div>
              </div>
            )}
          </Card>
        )}
      </div>

      {/* ── COMPOSE / REPLY MODAL ── */}
      <Modal
        open={showComposeModal}
        title={composeForm.subject.startsWith("Re:") ? "Reply Message" : "Compose New Email"}
        onClose={() => setShowComposeModal(false)}
        width="max-w-2xl"
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 14, padding: "10px 0" }}>
          <div style={{
            background: T.navyWash,
            padding: "8px 12px",
            borderRadius: 8,
            fontSize: 12,
            color: T.navy,
            display: "flex",
            alignItems: "center",
            gap: 8
          }}>
            <ShieldCheck size={16} />
            Sending official email from <b>{FOXIC_EMAIL}</b> via Hostinger Agentic Mail API
          </div>

          <Field label="To (Recipient Email Address)">
            <Input
              type="email"
              placeholder="e.g. shubham49tiwari49@gmail.com"
              value={composeForm.to}
              onChange={(e) => setComposeForm({ ...composeForm, to: e.target.value })}
            />
          </Field>

          <Field label="Category">
            <Select
              value={composeForm.category}
              onChange={(e) => setComposeForm({ ...composeForm, category: e.target.value })}
            >
              <option value="Inquiry">Inquiry Response</option>
              <option value="Billing">Billing & Invoice</option>
              <option value="Support">Customer Support</option>
              <option value="General">General</option>
            </Select>
          </Field>

          <Field label="Subject">
            <Input
              placeholder="Regarding your inquiry / order details..."
              value={composeForm.subject}
              onChange={(e) => setComposeForm({ ...composeForm, subject: e.target.value })}
            />
          </Field>

          <Field label="Message Body">
            <textarea
              rows={8}
              placeholder="Write your email message here..."
              value={composeForm.body}
              onChange={(e) => setComposeForm({ ...composeForm, body: e.target.value })}
              style={{
                width: "100%",
                padding: 12,
                borderRadius: 8,
                border: `1px solid ${T.border}`,
                fontSize: 13,
                outline: "none",
                fontFamily: "inherit",
                resize: "vertical"
              }}
            />
          </Field>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 10 }}>
            <Btn variant="outline" onClick={() => setShowComposeModal(false)} disabled={isSending}>Cancel</Btn>
            <Btn variant="primary" onClick={handleSendEmail} disabled={isSending} style={{ background: T.navy }}>
              {isSending ? <Loader2 size={15} style={{ animation: "spin 1s linear infinite", marginRight: 6 }} /> : <Send size={15} style={{ marginRight: 6 }} />}
              {isSending ? "Sending via Hostinger..." : "Send Email"}
            </Btn>
          </div>
        </div>
      </Modal>

      {/* ── HOSTINGER AGENTIC MAIL API TOKEN CONFIG MODAL ── */}
      <Modal
        open={showConfigModal}
        title="Hostinger Agentic Mail API Integration"
        onClose={() => setShowConfigModal(false)}
        width="max-w-xl"
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 16, padding: "6px 0" }}>
          <div style={{
            background: "rgba(0,113,227,0.06)",
            border: `1px solid rgba(0,113,227,0.2)`,
            borderRadius: 12,
            padding: 14,
            display: "flex",
            alignItems: "flex-start",
            gap: 12
          }}>
            <ShieldCheck size={24} color={T.navy} style={{ flexShrink: 0, marginTop: 2 }} />
            <div style={{ fontSize: 13, color: T.ink, lineHeight: 1.5 }}>
              <b>Hostinger Agentic Mail REST API</b><br />
              Emails for <b>{FOXIC_EMAIL}</b> are fetched directly through the Hostinger Mail REST API (`https://api.mail.hostinger.com`). The Bearer token is stored securely on the backend only.
            </div>
          </div>

          <Field label="Hostinger Mail API Bearer Token">
            <Input
              type="password"
              placeholder="Paste Bearer Token here..."
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
            />
          </Field>

          {connectionStatus.isConnected && (
            <div style={{
              background: "#F5F5F7",
              padding: "10px 14px",
              borderRadius: 8,
              fontSize: 12,
              color: T.inkSoft
            }}>
              Current Status: <b style={{ color: T.emerald }}>Connected</b> (Token: {connectionStatus.maskedToken})
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 10 }}>
            <Btn variant="outline" onClick={() => setShowConfigModal(false)}>Close</Btn>
            <Btn
              variant="primary"
              onClick={handleSaveToken}
              style={{ background: T.navy, display: "flex", alignItems: "center", gap: 6 }}
            >
              <Check size={16} />
              Save & Connect
            </Btn>
          </div>
        </div>
      </Modal>
    </div>
  );
}
